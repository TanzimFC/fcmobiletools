-- Find a League: private FC Mobile profiles, owner-reviewed listings and server-enforced actions.
create table if not exists public.league_profiles (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  status text not null check (status in ('looking_for_league','in_a_league','league_owner','not_looking')),
  fc_mobile_uid text not null check (char_length(fc_mobile_uid) between 3 and 64),
  in_game_username text not null check (char_length(in_game_username) between 2 and 40),
  ovr integer not null check (ovr between 50 and 200),
  region_server text not null check (char_length(region_server) between 2 and 60),
  preferred_languages text[] not null default array['English']::text[],
  discord_handle text,
  tournament_sizes text[] not null default '{}'::text[],
  availability text,
  play_style text,
  notes text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists league_profiles_search_idx
  on public.league_profiles(status, updated_at desc, ovr desc);
create index if not exists league_profiles_region_idx
  on public.league_profiles(region_server, status);

create table if not exists public.league_listings (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.accounts(id) on delete cascade,
  slug text not null unique,
  name text not null check (char_length(name) between 3 and 70),
  description text not null check (char_length(description) between 20 and 700),
  logo_url text,
  league_game_id text,
  region_server text not null,
  preferred_languages text[] not null default array['English']::text[],
  min_ovr integer not null check (min_ovr between 50 and 200),
  tournament_frequency text not null check (tournament_frequency in ('daily','most_days','several_weekly','weekly','occasional')),
  tournament_sizes text[] not null default array['4v4']::text[],
  discord_required boolean not null default false,
  player_commitment text not null check (player_commitment in ('casual','regular','competitive')),
  weekly_rewards text,
  discord_invite_url text,
  open_spots integer not null default 1 check (open_spots between 0 and 50),
  recruiting_open boolean not null default true,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused','removed')),
  moderation_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  last_kickoff_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A user can have one pending or live listing at a time, but may resubmit after rejection/removal.
create unique index if not exists league_one_open_listing_per_owner
  on public.league_listings(owner_account_id)
  where status in ('pending','approved','paused');
create index if not exists league_directory_idx
  on public.league_listings(status, recruiting_open, last_kickoff_at desc, last_active_at desc, created_at desc);

create table if not exists public.league_outreach (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.accounts(id) on delete cascade,
  player_account_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint league_outreach_not_self check (owner_account_id <> player_account_id),
  constraint league_outreach_once_per_owner unique(owner_account_id, player_account_id)
);
create index if not exists league_outreach_daily_usage_idx
  on public.league_outreach(owner_account_id, created_at desc);

create table if not exists public.league_active_confirmations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists league_active_confirmation_window_idx
  on public.league_active_confirmations(listing_id, account_id, created_at desc);

create or replace function public.league_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$function$;

drop trigger if exists league_profiles_set_updated_at on public.league_profiles;
create trigger league_profiles_set_updated_at
before update on public.league_profiles
for each row execute function public.league_set_updated_at();

drop trigger if exists league_listings_set_updated_at on public.league_listings;
create trigger league_listings_set_updated_at
before update on public.league_listings
for each row execute function public.league_set_updated_at();

create or replace function public.server_league_kickoff(
  p_listing_id uuid,
  p_owner_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_listing public.league_listings%rowtype;
  v_now timestamptz := clock_timestamp();
  v_next timestamptz;
begin
  select * into v_listing
  from public.league_listings
  where id = p_listing_id
  for update;

  if not found or v_listing.owner_account_id <> p_owner_account_id then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'League listing not found.');
  end if;
  if v_listing.status <> 'approved' or not v_listing.recruiting_open then
    return jsonb_build_object('ok', false, 'code', 'not_approved', 'message', 'Only an approved, recruiting league can use Kickoff.');
  end if;

  if v_listing.last_kickoff_at is not null and v_listing.last_kickoff_at > v_now - interval '6 hours' then
    v_next := v_listing.last_kickoff_at + interval '6 hours';
    return jsonb_build_object(
      'ok', false, 'code', 'cooldown',
      'message', 'Kickoff is available again after the cooldown.',
      'nextKickoffAt', v_next
    );
  end if;

  update public.league_listings
  set last_kickoff_at = v_now, updated_at = v_now
  where id = p_listing_id;

  return jsonb_build_object(
    'ok', true,
    'lastKickoffAt', v_now,
    'nextKickoffAt', v_now + interval '6 hours'
  );
end;
$function$;

create or replace function public.server_league_confirm_active(
  p_listing_id uuid,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_listing public.league_listings%rowtype;
  v_previous timestamptz;
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_account_id::text || ':' || p_listing_id::text));

  select * into v_listing
  from public.league_listings
  where id = p_listing_id
  for update;

  if not found or v_listing.status <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'This league is not available for active confirmation.');
  end if;

  select max(created_at) into v_previous
  from public.league_active_confirmations
  where listing_id = p_listing_id and account_id = p_account_id;

  if v_previous is not null and v_previous > v_now - interval '24 hours' then
    return jsonb_build_object(
      'ok', false,
      'code', 'cooldown',
      'message', 'You can confirm this league again after 24 hours.',
      'nextConfirmationAt', v_previous + interval '24 hours'
    );
  end if;

  insert into public.league_active_confirmations(listing_id, account_id, created_at)
  values (p_listing_id, p_account_id, v_now);

  update public.league_listings
  set last_active_at = v_now, updated_at = v_now
  where id = p_listing_id;

  select count(*)::integer into v_count
  from public.league_active_confirmations
  where listing_id = p_listing_id and created_at >= v_now - interval '7 days';

  return jsonb_build_object(
    'ok', true,
    'confirmedAt', v_now,
    'nextConfirmationAt', v_now + interval '24 hours',
    'confirmationsLast7Days', v_count
  );
end;
$function$;

create or replace function public.server_league_reveal_player(
  p_owner_account_id uuid,
  p_player_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_today timestamptz := date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  v_now timestamptz := clock_timestamp();
  v_existing boolean := false;
  v_used integer := 0;
begin
  if p_owner_account_id = p_player_account_id then
    return jsonb_build_object('ok', false, 'code', 'invalid_target', 'message', 'You cannot reveal your own profile.');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_owner_account_id::text));

  if not exists (
    select 1 from public.league_listings
    where owner_account_id = p_owner_account_id
      and status = 'approved'
      and recruiting_open = true
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_approved', 'message', 'Player search is only available to approved league owners with recruitment open.');
  end if;

  if not exists (
    select 1 from public.league_profiles
    where account_id = p_player_account_id
      and status = 'looking_for_league'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'This player is no longer looking for a league.');
  end if;

  select exists (
    select 1 from public.league_outreach
    where owner_account_id = p_owner_account_id and player_account_id = p_player_account_id
  ) into v_existing;

  select count(*)::integer into v_used
  from public.league_outreach
  where owner_account_id = p_owner_account_id and created_at >= v_today;

  if v_existing then
    return jsonb_build_object(
      'ok', true, 'already_revealed', true,
      'used_today', v_used, 'remaining_today', greatest(0, 3 - v_used)
    );
  end if;

  if v_used >= 3 then
    return jsonb_build_object(
      'ok', false, 'code', 'daily_limit',
      'message', 'You have reached the daily limit of three player contacts.',
      'used_today', v_used, 'remaining_today', 0
    );
  end if;

  insert into public.league_outreach(owner_account_id, player_account_id, created_at)
  values (p_owner_account_id, p_player_account_id, v_now)
  on conflict (owner_account_id, player_account_id) do nothing;

  select count(*)::integer into v_used
  from public.league_outreach
  where owner_account_id = p_owner_account_id and created_at >= v_today;

  return jsonb_build_object(
    'ok', true, 'already_revealed', false,
    'used_today', v_used, 'remaining_today', greatest(0, 3 - v_used)
  );
end;
$function$;

alter table public.league_profiles enable row level security;
alter table public.league_listings enable row level security;
alter table public.league_outreach enable row level security;
alter table public.league_active_confirmations enable row level security;

revoke all on public.league_profiles from public, anon, authenticated;
revoke all on public.league_listings from public, anon, authenticated;
revoke all on public.league_outreach from public, anon, authenticated;
revoke all on public.league_active_confirmations from public, anon, authenticated;

grant select, insert, update, delete on public.league_profiles to service_role;
grant select, insert, update, delete on public.league_listings to service_role;
grant select, insert, update, delete on public.league_outreach to service_role;
grant select, insert, update, delete on public.league_active_confirmations to service_role;

revoke all on function public.server_league_kickoff(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_confirm_active(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_reveal_player(uuid, uuid) from public, anon, authenticated;

grant execute on function public.server_league_kickoff(uuid, uuid) to service_role;
grant execute on function public.server_league_confirm_active(uuid, uuid) to service_role;
grant execute on function public.server_league_reveal_player(uuid, uuid) to service_role;
