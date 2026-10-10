-- FCMobiletools · League Crew + Matchday log
-- Additive and idempotent. Safe to run more than once. Never drops or rewrites existing data.
-- Run in the Supabase SQL editor BEFORE (or right after) deploying the new code.
-- Until it is applied the Worker keeps the old behaviour (owner-only Kickoff) and hides the new UI.
--
-- 1) Crew: players the owner approves as real members of the league.
--    Any approved crew member can press Kickoff, so every member has a reason to open the site.
-- 2) Matchday log: the owner logs a tournament per day, shown as proof of activity to quest hunters.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────
create table if not exists public.league_crew (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined','removed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint league_crew_once_per_listing unique (listing_id, account_id)
);
-- A player can be an approved crew member of one league at a time.
create unique index if not exists league_crew_one_approved_per_account
  on public.league_crew(account_id) where status = 'approved';
create index if not exists league_crew_listing_idx on public.league_crew(listing_id, status);
create index if not exists league_crew_account_idx on public.league_crew(account_id, status);

create table if not exists public.league_kickoff_log (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists league_kickoff_log_listing_idx
  on public.league_kickoff_log(listing_id, created_at desc);

create table if not exists public.league_matchdays (
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  day date not null,
  size text not null check (size in ('4v4','8v8','16v16','32v32')),
  created_at timestamptz not null default now(),
  primary key (listing_id, day)
);

-- ─────────────────────────────────────────────────────────────
-- Functions (called only by the Worker with the service key)
-- ─────────────────────────────────────────────────────────────

-- Player asks to join a league's crew.
create or replace function public.server_league_crew_request(
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
  v_prev text;
begin
  perform pg_advisory_xact_lock(hashtext('league-crew:' || p_account_id::text));

  select * into v_listing from public.league_listings where id = p_listing_id;
  if not found or v_listing.status <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'This league is not available.');
  end if;
  if v_listing.owner_account_id = p_account_id then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'You already own this league.');
  end if;
  if exists (select 1 from public.league_crew where account_id = p_account_id and status = 'approved') then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'message', 'You are already in a league crew. Leave it first.');
  end if;

  select status into v_prev from public.league_crew
  where listing_id = p_listing_id and account_id = p_account_id;
  if v_prev = 'pending' then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'message', 'Your request is already waiting for the owner.');
  end if;
  if (select count(*) from public.league_crew where account_id = p_account_id and status = 'pending') >= 3 then
    return jsonb_build_object('ok', false, 'code', 'limit', 'message', 'You have 3 pending crew requests. Cancel one first.');
  end if;
  if (select count(*) from public.league_crew where listing_id = p_listing_id and status = 'approved') >= 50 then
    return jsonb_build_object('ok', false, 'code', 'limit', 'message', 'This crew is full.');
  end if;

  insert into public.league_crew(listing_id, account_id, status, created_at, decided_at)
  values (p_listing_id, p_account_id, 'pending', clock_timestamp(), null)
  on conflict (listing_id, account_id) do update
    set status = 'pending', created_at = clock_timestamp(), decided_at = null;

  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$function$;

-- Owner approves / declines a request, or removes a member.
create or replace function public.server_league_crew_decide(
  p_listing_id uuid,
  p_owner_account_id uuid,
  p_account_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_listing public.league_listings%rowtype;
  v_row public.league_crew%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('league-crew:' || p_account_id::text));

  select * into v_listing from public.league_listings where id = p_listing_id;
  if not found or v_listing.owner_account_id <> p_owner_account_id then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'League listing not found.');
  end if;
  if p_action not in ('approve','decline','remove') then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Unknown crew action.');
  end if;

  select * into v_row from public.league_crew
  where listing_id = p_listing_id and account_id = p_account_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Crew request not found.');
  end if;

  if p_action = 'approve' then
    if v_row.status <> 'pending' then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'This request was already handled.');
    end if;
    if exists (select 1 from public.league_crew where account_id = p_account_id and status = 'approved') then
      update public.league_crew set status = 'declined', decided_at = clock_timestamp() where id = v_row.id;
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'message', 'That player already joined another league crew.');
    end if;
    if (select count(*) from public.league_crew where listing_id = p_listing_id and status = 'approved') >= 50 then
      return jsonb_build_object('ok', false, 'code', 'limit', 'message', 'Your crew is full (50 members).');
    end if;
    update public.league_crew set status = 'approved', decided_at = clock_timestamp() where id = v_row.id;
    -- the player now belongs here: drop their other pending requests
    update public.league_crew set status = 'declined', decided_at = clock_timestamp()
    where account_id = p_account_id and status = 'pending' and id <> v_row.id;
  elsif p_action = 'decline' then
    if v_row.status <> 'pending' then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'This request was already handled.');
    end if;
    update public.league_crew set status = 'declined', decided_at = clock_timestamp() where id = v_row.id;
  else
    if v_row.status <> 'approved' then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'That player is not in your crew.');
    end if;
    update public.league_crew set status = 'removed', decided_at = clock_timestamp() where id = v_row.id;
  end if;

  return jsonb_build_object('ok', true, 'action', p_action);
end;
$function$;

-- Member leaves, or cancels their own pending request.
create or replace function public.server_league_crew_leave(
  p_listing_id uuid,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
begin
  update public.league_crew set status = 'removed', decided_at = clock_timestamp()
  where listing_id = p_listing_id and account_id = p_account_id and status in ('pending','approved');
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'You are not in this crew.');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

-- Kickoff for the owner OR any approved crew member. One shared 6h cooldown per league.
create or replace function public.server_league_kickoff_v2(
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
  v_now timestamptz := clock_timestamp();
  v_next timestamptz;
  v_role text;
begin
  select * into v_listing from public.league_listings where id = p_listing_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'League listing not found.');
  end if;

  if v_listing.owner_account_id = p_account_id then
    v_role := 'owner';
  elsif exists (select 1 from public.league_crew
                where listing_id = p_listing_id and account_id = p_account_id and status = 'approved') then
    v_role := 'crew';
  else
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Only the owner and approved crew members can use Kickoff.');
  end if;

  if v_listing.status <> 'approved' or not v_listing.recruiting_open then
    return jsonb_build_object('ok', false, 'code', 'not_approved', 'message', 'Only an approved, recruiting league can use Kickoff.');
  end if;

  if v_listing.last_kickoff_at is not null and v_listing.last_kickoff_at > v_now - interval '6 hours' then
    v_next := v_listing.last_kickoff_at + interval '6 hours';
    return jsonb_build_object('ok', false, 'code', 'cooldown',
      'message', 'Someone already kicked off. It is available again after the cooldown.',
      'nextKickoffAt', v_next);
  end if;

  update public.league_listings set last_kickoff_at = v_now, updated_at = v_now where id = p_listing_id;
  insert into public.league_kickoff_log(listing_id, account_id, created_at) values (p_listing_id, p_account_id, v_now);

  return jsonb_build_object('ok', true, 'role', v_role, 'lastKickoffAt', v_now, 'nextKickoffAt', v_now + interval '6 hours');
end;
$function$;

-- Owner logs today's tournament (one entry per UTC day, size can be corrected the same day).
create or replace function public.server_league_log_matchday(
  p_listing_id uuid,
  p_owner_account_id uuid,
  p_size text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_listing public.league_listings%rowtype;
  v_today date := (clock_timestamp() at time zone 'UTC')::date;
begin
  select * into v_listing from public.league_listings where id = p_listing_id;
  if not found or v_listing.owner_account_id <> p_owner_account_id then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'League listing not found.');
  end if;
  if v_listing.status <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_approved', 'message', 'Only an approved league can log tournaments.');
  end if;
  if p_size not in ('4v4','8v8','16v16','32v32') then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Choose a tournament size.');
  end if;

  insert into public.league_matchdays(listing_id, day, size) values (p_listing_id, v_today, p_size)
  on conflict (listing_id, day) do update set size = excluded.size;

  return jsonb_build_object('ok', true, 'day', v_today, 'size', p_size,
    'matchdays7d', (select count(*) from public.league_matchdays where listing_id = p_listing_id and day > v_today - 7));
end;
$function$;

-- Directory signals: crew size, tournaments this week, 14-day strip, last kicker + the caller's own crew state.
create or replace function public.server_league_crew_signals(
  p_account_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
  select jsonb_build_object(
    'signals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'listingId', l.id,
        'crewCount', (select count(*)::integer from public.league_crew c where c.listing_id = l.id and c.status = 'approved'),
        'matchdays7d', (select count(*)::integer from public.league_matchdays m
                        where m.listing_id = l.id and m.day > (clock_timestamp() at time zone 'UTC')::date - 7),
        'matchdays14', coalesce((select jsonb_agg(m.day order by m.day) from public.league_matchdays m
                        where m.listing_id = l.id and m.day > (clock_timestamp() at time zone 'UTC')::date - 14), '[]'::jsonb),
        'lastKickoffBy', (select coalesce(a.display_name, a.username)
                          from public.league_kickoff_log k join public.accounts a on a.id = k.account_id
                          where k.listing_id = l.id order by k.created_at desc limit 1)
      ))
      from public.league_listings l
      where l.status = 'approved' and l.recruiting_open
    ), '[]'::jsonb),
    'myCrew', (select jsonb_build_object('listingId', c.listing_id, 'status', c.status)
               from public.league_crew c
               where c.account_id = p_account_id and c.status in ('approved','pending')
               order by (c.status = 'approved') desc, c.created_at desc limit 1),
    'myRequests', coalesce((select jsonb_agg(c.listing_id) from public.league_crew c
                            where c.account_id = p_account_id and c.status = 'pending'), '[]'::jsonb)
  );
$function$;

-- Owner view: crew requests + members, and the listing's own 14-day tournament strip.
create or replace function public.server_league_owner_crew(
  p_listing_id uuid,
  p_owner_account_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_listing public.league_listings%rowtype;
begin
  select * into v_listing from public.league_listings where id = p_listing_id;
  if not found or v_listing.owner_account_id <> p_owner_account_id then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'League listing not found.');
  end if;
  return jsonb_build_object(
    'ok', true,
    'crew', coalesce((
      select jsonb_agg(jsonb_build_object(
        'accountId', c.account_id,
        'status', c.status,
        'requestedAt', c.created_at,
        'displayName', coalesce(a.display_name, a.username),
        'username', a.username,
        'avatarUrl', a.avatar_url,
        'inGameUsername', p.in_game_username,
        'ovr', p.ovr,
        'discordHandle', p.discord_handle
      ) order by (c.status = 'pending') desc, c.created_at)
      from public.league_crew c
      join public.accounts a on a.id = c.account_id
      left join public.league_profiles p on p.account_id = c.account_id
      where c.listing_id = p_listing_id and c.status in ('pending','approved')
    ), '[]'::jsonb),
    'matchdays14', coalesce((select jsonb_agg(m.day order by m.day) from public.league_matchdays m
                    where m.listing_id = p_listing_id and m.day > (clock_timestamp() at time zone 'UTC')::date - 14), '[]'::jsonb),
    'matchdays7d', (select count(*)::integer from public.league_matchdays m
                    where m.listing_id = p_listing_id and m.day > (clock_timestamp() at time zone 'UTC')::date - 7)
  );
end;
$function$;

-- ─────────────────────────────────────────────────────────────
-- Lock-down (same pattern as the other league tables)
-- ─────────────────────────────────────────────────────────────
alter table public.league_crew enable row level security;
alter table public.league_kickoff_log enable row level security;
alter table public.league_matchdays enable row level security;

revoke all on public.league_crew from public, anon, authenticated;
revoke all on public.league_kickoff_log from public, anon, authenticated;
revoke all on public.league_matchdays from public, anon, authenticated;

grant select, insert, update, delete on public.league_crew to service_role;
grant select, insert, update, delete on public.league_kickoff_log to service_role;
grant select, insert, update, delete on public.league_matchdays to service_role;

revoke all on function public.server_league_crew_request(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_crew_decide(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.server_league_crew_leave(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_kickoff_v2(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_log_matchday(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.server_league_crew_signals(uuid) from public, anon, authenticated;
revoke all on function public.server_league_owner_crew(uuid, uuid) from public, anon, authenticated;

grant execute on function public.server_league_crew_request(uuid, uuid) to service_role;
grant execute on function public.server_league_crew_decide(uuid, uuid, uuid, text) to service_role;
grant execute on function public.server_league_crew_leave(uuid, uuid) to service_role;
grant execute on function public.server_league_kickoff_v2(uuid, uuid) to service_role;
grant execute on function public.server_league_log_matchday(uuid, uuid, text) to service_role;
grant execute on function public.server_league_crew_signals(uuid) to service_role;
grant execute on function public.server_league_owner_crew(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
