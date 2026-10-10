-- FCMobiletools · Leagues Premium
-- Additive and idempotent: safe to run more than once, never drops or rewrites existing data.
-- Run this in the Supabase SQL editor BEFORE deploying the new code.

-- ─────────────────────────────────────────────────────────────
-- 1) New listing columns
-- ─────────────────────────────────────────────────────────────
alter table public.league_listings
  add column if not exists tagline text check (tagline is null or char_length(tagline) <= 100),
  add column if not exists active_hours text check (active_hours is null or char_length(active_hours) <= 60),
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_until timestamptz,
  add column if not exists admin_note text check (admin_note is null or char_length(admin_note) <= 1000);

create index if not exists league_listings_featured_idx
  on public.league_listings(is_featured, featured_until)
  where is_featured;

-- ─────────────────────────────────────────────────────────────
-- 2) New tables
-- ─────────────────────────────────────────────────────────────
create table if not exists public.league_saves (
  account_id uuid not null references public.accounts(id) on delete cascade,
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, listing_id)
);
create index if not exists league_saves_listing_idx on public.league_saves(listing_id);

create table if not exists public.league_join_clicks (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists league_join_clicks_listing_idx
  on public.league_join_clicks(listing_id, created_at desc);
create index if not exists league_join_clicks_account_idx
  on public.league_join_clicks(account_id, listing_id, created_at desc);

create table if not exists public.league_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  reporter_account_id uuid not null references public.accounts(id) on delete cascade,
  reason text not null check (reason in ('fake_or_misleading','inactive','inappropriate','spam','other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists league_one_open_report_per_reporter
  on public.league_reports(listing_id, reporter_account_id)
  where status = 'open';
create index if not exists league_reports_status_idx
  on public.league_reports(status, created_at desc);
create index if not exists league_reports_reporter_idx
  on public.league_reports(reporter_account_id, created_at desc);

create table if not exists public.league_moderation_log (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  action text not null,
  note text,
  actor text,
  created_at timestamptz not null default now()
);
create index if not exists league_moderation_log_listing_idx
  on public.league_moderation_log(listing_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 3) Player-facing functions (called only by the Worker with the service key)
-- ─────────────────────────────────────────────────────────────

-- Confirm-active now refuses owners confirming their own league (it inflated activity ranking).
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

  if v_listing.owner_account_id = p_account_id then
    return jsonb_build_object('ok', false, 'code', 'own_listing', 'message', 'Only other players can confirm your league is active.');
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

-- Save / unsave a league (toggle). Max 50 saved leagues per account.
create or replace function public.server_league_toggle_save(
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
  v_status text;
  v_deleted integer := 0;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('league-save:' || p_account_id::text));

  select status into v_status from public.league_listings where id = p_listing_id;

  delete from public.league_saves
  where listing_id = p_listing_id and account_id = p_account_id;
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    return jsonb_build_object('ok', true, 'saved', false);
  end if;

  if v_status is distinct from 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'This league is not available.');
  end if;

  select count(*)::integer into v_count from public.league_saves where account_id = p_account_id;
  if v_count >= 50 then
    return jsonb_build_object('ok', false, 'code', 'limit', 'message', 'You can save up to 50 leagues. Remove one to save another.');
  end if;

  insert into public.league_saves(account_id, listing_id) values (p_account_id, p_listing_id)
  on conflict do nothing;
  return jsonb_build_object('ok', true, 'saved', true);
end;
$function$;

-- Record a join click (one per player per league per 24h; owners are ignored).
create or replace function public.server_league_track_join(
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
  v_owner uuid;
  v_status text;
  v_now timestamptz := clock_timestamp();
begin
  perform pg_advisory_xact_lock(hashtext('league-join:' || p_account_id::text || ':' || p_listing_id::text));

  select owner_account_id, status into v_owner, v_status
  from public.league_listings where id = p_listing_id;

  if not found or v_status <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'This league is not available.');
  end if;
  if v_owner = p_account_id then
    return jsonb_build_object('ok', true, 'tracked', false);
  end if;
  if exists (
    select 1 from public.league_join_clicks
    where listing_id = p_listing_id and account_id = p_account_id
      and created_at > v_now - interval '24 hours'
  ) then
    return jsonb_build_object('ok', true, 'tracked', false);
  end if;

  insert into public.league_join_clicks(listing_id, account_id, created_at)
  values (p_listing_id, p_account_id, v_now);
  return jsonb_build_object('ok', true, 'tracked', true);
end;
$function$;

-- Report a listing. Max 5 reports per account per 24h, one open report per listing.
create or replace function public.server_league_report(
  p_listing_id uuid,
  p_account_id uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_owner uuid;
  v_status text;
  v_details text := nullif(left(btrim(coalesce(p_details, '')), 500), '');
begin
  if p_reason is null or p_reason not in ('fake_or_misleading','inactive','inappropriate','spam','other') then
    return jsonb_build_object('ok', false, 'code', 'invalid_reason', 'message', 'Choose a reason for the report.');
  end if;

  perform pg_advisory_xact_lock(hashtext('league-report:' || p_account_id::text));

  select owner_account_id, status into v_owner, v_status
  from public.league_listings where id = p_listing_id;

  if not found or v_status <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'This league is not available.');
  end if;
  if v_owner = p_account_id then
    return jsonb_build_object('ok', false, 'code', 'own_listing', 'message', 'You cannot report your own league.');
  end if;
  if (select count(*) from public.league_reports
      where reporter_account_id = p_account_id
        and created_at > clock_timestamp() - interval '24 hours') >= 5 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited', 'message', 'You have reached the daily report limit. Please try again tomorrow.');
  end if;

  begin
    insert into public.league_reports(listing_id, reporter_account_id, reason, details)
    values (p_listing_id, p_account_id, p_reason, v_details);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'message', 'You already have an open report for this league. Thank you, the team will review it.');
  end;

  return jsonb_build_object('ok', true);
end;
$function$;

-- Owner-only insights for their own listing.
create or replace function public.server_league_owner_insights(
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
  v_since timestamptz := clock_timestamp() - interval '7 days';
begin
  if not exists (
    select 1 from public.league_listings
    where id = p_listing_id and owner_account_id = p_owner_account_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'League listing not found.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'confirmations7d', (select count(distinct account_id) from public.league_active_confirmations
                        where listing_id = p_listing_id and created_at >= v_since
                          and account_id <> p_owner_account_id),
    'saves', (select count(*) from public.league_saves where listing_id = p_listing_id),
    'joinClicks7d', (select count(*) from public.league_join_clicks
                     where listing_id = p_listing_id and created_at >= v_since),
    'uniqueJoiners7d', (select count(distinct account_id) from public.league_join_clicks
                        where listing_id = p_listing_id and created_at >= v_since)
  );
end;
$function$;

-- One call that gives the directory its trust signals plus the caller's own saved / confirmed lists.
create or replace function public.server_league_directory_signals(
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
        'confirmations7d', coalesce(c.n, 0),
        'saves', coalesce(s.n, 0)
      ))
      from public.league_listings l
      left join (
        select a.listing_id, count(distinct a.account_id)::integer as n
        from public.league_active_confirmations a
        join public.league_listings own on own.id = a.listing_id
        where a.created_at >= clock_timestamp() - interval '7 days'
          and a.account_id <> own.owner_account_id
        group by a.listing_id
      ) c on c.listing_id = l.id
      left join (
        select listing_id, count(*)::integer as n
        from public.league_saves
        group by listing_id
      ) s on s.listing_id = l.id
      where l.status = 'approved' and l.recruiting_open
    ), '[]'::jsonb),
    'saved', coalesce((
      select jsonb_agg(listing_id) from public.league_saves where account_id = p_account_id
    ), '[]'::jsonb),
    'confirmedRecently', coalesce((
      select jsonb_agg(distinct listing_id) from public.league_active_confirmations
      where account_id = p_account_id and created_at >= clock_timestamp() - interval '24 hours'
    ), '[]'::jsonb)
  );
$function$;

-- ─────────────────────────────────────────────────────────────
-- 4) Admin functions (called only by the Worker after admin authentication)
-- ─────────────────────────────────────────────────────────────

-- Atomic review: status change + audit log in one transaction.
create or replace function public.server_league_admin_review(
  p_listing_id uuid,
  p_status text,
  p_note text,
  p_actor text default 'site-admin'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_row public.league_listings%rowtype;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_actor text := coalesce(nullif(btrim(coalesce(p_actor, '')), ''), 'site-admin');
  v_now timestamptz := clock_timestamp();
begin
  if p_status is null or p_status not in ('approved','rejected','paused','removed') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'message', 'Choose a valid review action.');
  end if;

  select * into v_row from public.league_listings where id = p_listing_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'League listing not found.');
  end if;
  if p_status <> 'approved' and v_note is null then
    return jsonb_build_object('ok', false, 'code', 'note_required', 'message', 'Add a short review note for this action.');
  end if;

  begin
    update public.league_listings
    set status = p_status,
        moderation_note = v_note,
        reviewed_by = v_actor,
        reviewed_at = v_now,
        updated_at = v_now,
        is_featured = case when p_status = 'approved' then is_featured else false end,
        featured_until = case when p_status = 'approved' then featured_until else null end
    where id = p_listing_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'owner_has_open_listing',
      'message', 'This owner already has another pending, live or paused listing.');
  end;

  insert into public.league_moderation_log(listing_id, action, note, actor, created_at)
  values (p_listing_id, p_status, v_note, v_actor, v_now);

  return jsonb_build_object('ok', true, 'status', p_status, 'previousStatus', v_row.status);
end;
$function$;

-- Verified badge, time-boxed Featured placement and a private admin note.
create or replace function public.server_league_admin_set_flags(
  p_listing_id uuid,
  p_verified boolean default null,
  p_featured boolean default null,
  p_featured_days integer default null,
  p_admin_note text default null,
  p_set_note boolean default false,
  p_actor text default 'site-admin'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_row public.league_listings%rowtype;
  v_actor text := coalesce(nullif(btrim(coalesce(p_actor, '')), ''), 'site-admin');
  v_now timestamptz := clock_timestamp();
  v_days integer := greatest(1, least(coalesce(p_featured_days, 7), 60));
  v_note text := nullif(left(btrim(coalesce(p_admin_note, '')), 1000), '');
  v_new public.league_listings%rowtype;
begin
  select * into v_row from public.league_listings where id = p_listing_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'League listing not found.');
  end if;
  if p_featured is true and v_row.status <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_live', 'message', 'Only live listings can be featured.');
  end if;

  update public.league_listings
  set is_verified = coalesce(p_verified, is_verified),
      is_featured = coalesce(p_featured, is_featured),
      featured_until = case
        when p_featured is true then v_now + make_interval(days => v_days)
        when p_featured is false then null
        else featured_until end,
      admin_note = case when p_set_note then v_note else admin_note end,
      updated_at = v_now
  where id = p_listing_id
  returning * into v_new;

  if p_verified is not null and p_verified is distinct from v_row.is_verified then
    insert into public.league_moderation_log(listing_id, action, note, actor, created_at)
    values (p_listing_id, case when p_verified then 'verified' else 'unverified' end, null, v_actor, v_now);
  end if;
  if p_featured is true then
    insert into public.league_moderation_log(listing_id, action, note, actor, created_at)
    values (p_listing_id, 'featured', v_days || ' day(s)', v_actor, v_now);
  elsif p_featured is false and v_row.is_featured then
    insert into public.league_moderation_log(listing_id, action, note, actor, created_at)
    values (p_listing_id, 'unfeatured', null, v_actor, v_now);
  end if;
  if p_set_note and v_note is distinct from v_row.admin_note then
    insert into public.league_moderation_log(listing_id, action, note, actor, created_at)
    values (p_listing_id, 'admin_note', v_note, v_actor, v_now);
  end if;

  return jsonb_build_object(
    'ok', true,
    'isVerified', v_new.is_verified,
    'isFeatured', v_new.is_featured,
    'featuredUntil', v_new.featured_until,
    'adminNote', v_new.admin_note
  );
end;
$function$;

create or replace function public.server_league_admin_resolve_report(
  p_report_id uuid,
  p_status text,
  p_actor text default 'site-admin',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_listing uuid;
  v_actor text := coalesce(nullif(btrim(coalesce(p_actor, '')), ''), 'site-admin');
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_now timestamptz := clock_timestamp();
begin
  if p_status is null or p_status not in ('resolved','dismissed') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'message', 'Choose resolve or dismiss.');
  end if;

  update public.league_reports
  set status = p_status, resolved_by = v_actor, resolved_at = v_now
  where id = p_report_id and status = 'open'
  returning listing_id into v_listing;

  if not found then
    if exists (select 1 from public.league_reports where id = p_report_id) then
      return jsonb_build_object('ok', false, 'code', 'already_closed', 'message', 'This report was already handled.');
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Report not found.');
  end if;

  insert into public.league_moderation_log(listing_id, action, note, actor, created_at)
  values (v_listing, 'report_' || p_status, v_note, v_actor, v_now);

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$function$;

create or replace function public.server_league_admin_stats()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
  select jsonb_build_object(
    'pending',  (select count(*) from public.league_listings where status = 'pending'),
    'approved', (select count(*) from public.league_listings where status = 'approved'),
    'rejected', (select count(*) from public.league_listings where status = 'rejected'),
    'paused',   (select count(*) from public.league_listings where status = 'paused'),
    'removed',  (select count(*) from public.league_listings where status = 'removed'),
    'total',    (select count(*) from public.league_listings),
    'featuredLive', (select count(*) from public.league_listings
                     where status = 'approved' and is_featured
                       and (featured_until is null or featured_until > clock_timestamp())),
    'verified', (select count(*) from public.league_listings where is_verified),
    'openReports', (select count(*) from public.league_reports where status = 'open'),
    'joinClicks7d', (select count(*) from public.league_join_clicks
                     where created_at >= clock_timestamp() - interval '7 days'),
    'saves', (select count(*) from public.league_saves),
    'confirmations7d', (select count(*) from public.league_active_confirmations
                        where created_at >= clock_timestamp() - interval '7 days'),
    'playersLooking', (select count(*) from public.league_profiles where status = 'looking_for_league'),
    'profiles', (select count(*) from public.league_profiles),
    'outreachToday', (select count(*) from public.league_outreach
                      where created_at >= date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC')
  );
$function$;

-- ─────────────────────────────────────────────────────────────
-- 5) Lock everything down (service role only, same model as the existing league tables)
-- ─────────────────────────────────────────────────────────────
alter table public.league_saves enable row level security;
alter table public.league_join_clicks enable row level security;
alter table public.league_reports enable row level security;
alter table public.league_moderation_log enable row level security;

revoke all on public.league_saves from public, anon, authenticated;
revoke all on public.league_join_clicks from public, anon, authenticated;
revoke all on public.league_reports from public, anon, authenticated;
revoke all on public.league_moderation_log from public, anon, authenticated;

grant select, insert, update, delete on public.league_saves to service_role;
grant select, insert, update, delete on public.league_join_clicks to service_role;
grant select, insert, update, delete on public.league_reports to service_role;
grant select, insert, update, delete on public.league_moderation_log to service_role;

revoke all on function public.server_league_confirm_active(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_toggle_save(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_track_join(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_report(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.server_league_owner_insights(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_directory_signals(uuid) from public, anon, authenticated;
revoke all on function public.server_league_admin_review(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.server_league_admin_set_flags(uuid, boolean, boolean, integer, text, boolean, text) from public, anon, authenticated;
revoke all on function public.server_league_admin_resolve_report(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.server_league_admin_stats() from public, anon, authenticated;

grant execute on function public.server_league_confirm_active(uuid, uuid) to service_role;
grant execute on function public.server_league_toggle_save(uuid, uuid) to service_role;
grant execute on function public.server_league_track_join(uuid, uuid) to service_role;
grant execute on function public.server_league_report(uuid, uuid, text, text) to service_role;
grant execute on function public.server_league_owner_insights(uuid, uuid) to service_role;
grant execute on function public.server_league_directory_signals(uuid) to service_role;
grant execute on function public.server_league_admin_review(uuid, text, text, text) to service_role;
grant execute on function public.server_league_admin_set_flags(uuid, boolean, boolean, integer, text, boolean, text) to service_role;
grant execute on function public.server_league_admin_resolve_report(uuid, text, text, text) to service_role;
grant execute on function public.server_league_admin_stats() to service_role;

-- Make PostgREST pick up the new columns and functions immediately.
notify pgrst, 'reload schema';
