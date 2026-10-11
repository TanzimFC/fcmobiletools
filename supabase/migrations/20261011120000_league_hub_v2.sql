-- FCMobiletools · League Hub v2
-- Additive and idempotent. Run in the Supabase SQL editor BEFORE deploying the matching code.
--   * open listings (live immediately, reviewed/verified are badges, not gates)
--   * divisions, join methods, accent colour, rules acceptance, sample clubs
--   * apply-to-league flow with team screenshot and player-controlled UID / Discord sharing
--   * public (signed-out) activity signals and Community Spotlight

-- ─────────────────────────────────────────────────────────────
-- 1) Listings
-- ─────────────────────────────────────────────────────────────
alter table public.league_listings
  add column if not exists division text,
  add column if not exists join_methods text[] not null default array['apply']::text[],
  add column if not exists accent text not null default 'cyan',
  add column if not exists rules_accepted_at timestamptz,
  add column if not exists rules_version text,
  add column if not exists is_sample boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'league_listings_division_chk') then
    alter table public.league_listings add constraint league_listings_division_chk
      check (division is null or division in ('bronze','silver','world_class','legendary','fc_champions'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'league_listings_accent_chk') then
    alter table public.league_listings add constraint league_listings_accent_chk
      check (accent in ('cyan','gold','mint','violet','rose','orange','sky','lime'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'league_listings_join_methods_chk') then
    alter table public.league_listings add constraint league_listings_join_methods_chk
      check (join_methods <@ array['apply','discord','in_game']::text[] and cardinality(join_methods) between 1 and 3);
  end if;
end $$;

-- Short pitch instead of a long description. Existing rows are untouched.
alter table public.league_listings drop constraint if exists league_listings_description_check;
alter table public.league_listings alter column description set default '';
alter table public.league_listings add constraint league_listings_description_check
  check (char_length(description) <= 700);

-- Sample clubs have no owner account.
alter table public.league_listings alter column owner_account_id drop not null;
alter table public.league_listings alter column status set default 'approved';

create index if not exists league_listings_division_idx
  on public.league_listings(division, status, recruiting_open);

-- ─────────────────────────────────────────────────────────────
-- 2) Player profiles: UID optional, sharing is the player's choice
-- ─────────────────────────────────────────────────────────────
alter table public.league_profiles alter column fc_mobile_uid drop not null;
alter table public.league_profiles drop constraint if exists league_profiles_fc_mobile_uid_check;
alter table public.league_profiles add constraint league_profiles_fc_mobile_uid_check
  check (fc_mobile_uid is null or char_length(fc_mobile_uid) between 3 and 64);
alter table public.league_profiles
  add column if not exists share_uid boolean not null default false,
  add column if not exists share_discord boolean not null default false;

-- ─────────────────────────────────────────────────────────────
-- 3) Applications
-- ─────────────────────────────────────────────────────────────
create table if not exists public.league_applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  applicant_account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'new' check (status in ('new','shortlisted','invited','joined','declined','withdrawn')),
  message text check (message is null or char_length(message) <= 200),
  screenshot_url text,
  ovr integer,
  in_game_username text,
  region_server text,
  shared_uid text,
  shared_discord text,
  owner_note text check (owner_note is null or char_length(owner_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  constraint league_application_once unique (listing_id, applicant_account_id)
);
create index if not exists league_applications_listing_idx
  on public.league_applications(listing_id, status, created_at desc);
create index if not exists league_applications_applicant_idx
  on public.league_applications(applicant_account_id, status);

create or replace function public.server_league_apply(
  p_listing_id uuid,
  p_account_id uuid,
  p_message text,
  p_screenshot_url text,
  p_share_uid boolean,
  p_share_discord boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_listing public.league_listings%rowtype;
  v_profile public.league_profiles%rowtype;
  v_existing public.league_applications%rowtype;
  v_active integer;
  v_id uuid;
  v_msg text := nullif(left(btrim(coalesce(p_message, '')), 200), '');
begin
  select * into v_listing from public.league_listings where id = p_listing_id;
  if not found or v_listing.status <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'This league is not available.');
  end if;
  if v_listing.is_sample then
    return jsonb_build_object('ok', false, 'code', 'sample', 'message', 'This is a sample club for testing. Apply to a real league instead.');
  end if;
  if v_listing.owner_account_id = p_account_id then
    return jsonb_build_object('ok', false, 'code', 'own', 'message', 'You cannot apply to your own league.');
  end if;
  if not v_listing.recruiting_open or v_listing.open_spots <= 0 then
    return jsonb_build_object('ok', false, 'code', 'closed', 'message', 'This league has no open spots right now.');
  end if;
  select * into v_profile from public.league_profiles where account_id = p_account_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'profile', 'message', 'Add your OVR and in-game name first.');
  end if;

  select * into v_existing from public.league_applications
   where listing_id = p_listing_id and applicant_account_id = p_account_id for update;
  if found and v_existing.status not in ('withdrawn','declined') then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'message', 'You already applied to this league.');
  end if;

  select count(*) into v_active from public.league_applications
   where applicant_account_id = p_account_id and status in ('new','shortlisted','invited');
  if v_active >= 5 then
    return jsonb_build_object('ok', false, 'code', 'limit', 'message', 'You have 5 open applications. Withdraw one to apply again.');
  end if;

  if found then
    update public.league_applications set
      status = 'new', message = v_msg, screenshot_url = p_screenshot_url,
      ovr = v_profile.ovr, in_game_username = v_profile.in_game_username, region_server = v_profile.region_server,
      shared_uid = case when p_share_uid then v_profile.fc_mobile_uid else null end,
      shared_discord = case when p_share_discord then v_profile.discord_handle else null end,
      owner_note = null, updated_at = clock_timestamp(), status_changed_at = clock_timestamp()
    where id = v_existing.id returning id into v_id;
  else
    insert into public.league_applications(listing_id, applicant_account_id, message, screenshot_url,
      ovr, in_game_username, region_server, shared_uid, shared_discord)
    values (p_listing_id, p_account_id, v_msg, p_screenshot_url,
      v_profile.ovr, v_profile.in_game_username, v_profile.region_server,
      case when p_share_uid then v_profile.fc_mobile_uid else null end,
      case when p_share_discord then v_profile.discord_handle else null end)
    returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'new');
end;
$function$;

create or replace function public.server_league_application_decide(
  p_application_id uuid,
  p_owner_account_id uuid,
  p_status text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_app public.league_applications%rowtype;
  v_listing public.league_listings%rowtype;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
begin
  if p_status is null or p_status not in ('new','shortlisted','invited','joined','declined') then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Choose a valid status.');
  end if;
  select * into v_app from public.league_applications where id = p_application_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Application not found.');
  end if;
  select * into v_listing from public.league_listings where id = v_app.listing_id;
  if v_listing.owner_account_id is distinct from p_owner_account_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'This is not your league.');
  end if;
  if v_app.status = 'withdrawn' then
    return jsonb_build_object('ok', false, 'code', 'withdrawn', 'message', 'The player withdrew this application.');
  end if;

  update public.league_applications
     set status = p_status, owner_note = coalesce(v_note, owner_note),
         updated_at = clock_timestamp(),
         status_changed_at = case when status <> p_status then clock_timestamp() else status_changed_at end
   where id = p_application_id;

  -- A player who actually joined takes one open spot.
  if p_status = 'joined' and v_app.status <> 'joined' then
    update public.league_listings set open_spots = greatest(open_spots - 1, 0), updated_at = clock_timestamp()
     where id = v_listing.id;
  elsif v_app.status = 'joined' and p_status <> 'joined' then
    update public.league_listings set open_spots = least(open_spots + 1, 50), updated_at = clock_timestamp()
     where id = v_listing.id;
  end if;
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$function$;

create or replace function public.server_league_application_withdraw(
  p_application_id uuid,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare v_app public.league_applications%rowtype;
begin
  select * into v_app from public.league_applications
   where id = p_application_id and applicant_account_id = p_account_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Application not found.');
  end if;
  if v_app.status = 'joined' then
    return jsonb_build_object('ok', false, 'code', 'joined', 'message', 'You are already in this league.');
  end if;
  update public.league_applications
     set status = 'withdrawn', updated_at = clock_timestamp(), status_changed_at = clock_timestamp()
   where id = p_application_id;
  return jsonb_build_object('ok', true, 'status', 'withdrawn');
end;
$function$;

-- ─────────────────────────────────────────────────────────────
-- 4) Public activity signals (no account needed) + Community Spotlight score
-- ─────────────────────────────────────────────────────────────
create or replace function public.server_league_public_signals()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'listingId', l.id,
    'confirmations7d', coalesce(c.n, 0),
    'saves', coalesce(s.n, 0),
    'matchdays7d', coalesce(m.n, 0),
    'crewCount', coalesce(cr.n, 0),
    'applications7d', coalesce(ap.n, 0),
    'activityScore', coalesce(c.n, 0) * 3 + coalesce(m.n, 0) * 3 + coalesce(ap.n, 0) * 2 + coalesce(j.n, 0) + coalesce(s.n, 0)
  )), '[]'::jsonb)
  from public.league_listings l
  left join (
    select a.listing_id, count(distinct a.account_id)::integer as n
    from public.league_active_confirmations a
    join public.league_listings own on own.id = a.listing_id
    where a.created_at >= clock_timestamp() - interval '7 days'
      and a.account_id is distinct from own.owner_account_id
    group by a.listing_id
  ) c on c.listing_id = l.id
  left join (select listing_id, count(*)::integer as n from public.league_saves group by listing_id) s on s.listing_id = l.id
  left join (
    select listing_id, count(*)::integer as n from public.league_matchdays
    where day > (clock_timestamp() at time zone 'UTC')::date - 7 group by listing_id
  ) m on m.listing_id = l.id
  left join (
    select listing_id, count(*)::integer as n from public.league_crew where status = 'approved' group by listing_id
  ) cr on cr.listing_id = l.id
  left join (
    select listing_id, count(*)::integer as n from public.league_applications
    where created_at >= clock_timestamp() - interval '7 days' group by listing_id
  ) ap on ap.listing_id = l.id
  left join (
    select listing_id, count(*)::integer as n from public.league_join_clicks
    where created_at >= clock_timestamp() - interval '7 days' group by listing_id
  ) j on j.listing_id = l.id
  where l.status = 'approved' and l.recruiting_open;
$function$;

-- ─────────────────────────────────────────────────────────────
-- 5) Access
-- ─────────────────────────────────────────────────────────────
alter table public.league_applications enable row level security;
revoke all on public.league_applications from public, anon, authenticated;
grant select, insert, update, delete on public.league_applications to service_role;

revoke all on function public.server_league_apply(uuid, uuid, text, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.server_league_application_decide(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.server_league_application_withdraw(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_public_signals() from public, anon, authenticated;
grant execute on function public.server_league_apply(uuid, uuid, text, text, boolean, boolean) to service_role;
grant execute on function public.server_league_application_decide(uuid, uuid, text, text) to service_role;
grant execute on function public.server_league_application_withdraw(uuid, uuid) to service_role;
grant execute on function public.server_league_public_signals() to service_role;

-- Public sample/demo league seeding intentionally removed. Sample listings must stay out of production.
