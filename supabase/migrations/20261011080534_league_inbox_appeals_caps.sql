-- FCMobiletools: league workflow caps, application-linked inbox, and suspension appeals.
-- Run in Supabase SQL Editor before deploying the matching Worker release.

create table if not exists public.league_listing_appeals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  owner_account_id uuid not null references public.accounts(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 20 and 1200),
  status text not null default 'open' check (status in ('open','approved','denied')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists league_listing_appeals_status_idx
  on public.league_listing_appeals(status, created_at desc);
create unique index if not exists league_listing_appeals_one_open_idx
  on public.league_listing_appeals(listing_id) where status = 'open';

create table if not exists public.league_conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  owner_account_id uuid not null references public.accounts(id) on delete cascade,
  applicant_account_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint league_conversation_participants_differ check (owner_account_id <> applicant_account_id),
  constraint league_conversation_listing_applicant_unique unique (listing_id, applicant_account_id)
);
create index if not exists league_conversations_owner_idx
  on public.league_conversations(owner_account_id, updated_at desc);
create index if not exists league_conversations_applicant_idx
  on public.league_conversations(applicant_account_id, updated_at desc);

create table if not exists public.league_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.league_conversations(id) on delete cascade,
  sender_account_id uuid not null references public.accounts(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1200),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists league_messages_conversation_idx
  on public.league_messages(conversation_id, created_at desc);
create index if not exists league_messages_unread_idx
  on public.league_messages(conversation_id, read_at) where read_at is null;

alter table public.league_listing_appeals enable row level security;
alter table public.league_conversations enable row level security;
alter table public.league_messages enable row level security;
revoke all on public.league_listing_appeals from public, anon, authenticated;
revoke all on public.league_conversations from public, anon, authenticated;
revoke all on public.league_messages from public, anon, authenticated;
grant select, insert, update, delete on public.league_listing_appeals to service_role;
grant select, insert, update, delete on public.league_conversations to service_role;
grant select, insert, update, delete on public.league_messages to service_role;

create or replace function public.server_league_submit_appeal(
  p_listing_id uuid, p_owner_account_id uuid, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_listing public.league_listings%rowtype;
  v_appeal public.league_listing_appeals%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into v_listing from public.league_listings where id = p_listing_id for update;
  if not found or v_listing.owner_account_id is distinct from p_owner_account_id then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'League listing not found.');
  end if;
  if v_listing.status <> 'paused' then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'message', 'Only a suspended league can appeal here.');
  end if;
  if char_length(v_reason) < 20 or char_length(v_reason) > 1200 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Write an appeal between 20 and 1,200 characters.');
  end if;
  select * into v_appeal from public.league_listing_appeals
    where listing_id = p_listing_id and status = 'open' limit 1;
  if found then
    return jsonb_build_object('ok', true, 'id', v_appeal.id, 'status', 'open', 'message', 'Your appeal is already waiting for review.');
  end if;
  insert into public.league_listing_appeals(listing_id, owner_account_id, reason)
    values (p_listing_id, p_owner_account_id, v_reason) returning * into v_appeal;
  return jsonb_build_object('ok', true, 'id', v_appeal.id, 'status', v_appeal.status);
end;
$function$;

create or replace function public.server_league_admin_resolve_appeal(
  p_appeal_id uuid, p_status text, p_note text, p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set "TimeZone" = 'UTC'
as $function$
declare
  v_appeal public.league_listing_appeals%rowtype;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if p_status not in ('approved','denied') then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Choose approve or deny.');
  end if;
  select * into v_appeal from public.league_listing_appeals where id = p_appeal_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Appeal not found.');
  end if;
  if v_appeal.status <> 'open' then
    return jsonb_build_object('ok', false, 'code', 'already_closed', 'message', 'This appeal has already been reviewed.');
  end if;
  update public.league_listing_appeals set
    status = p_status, review_note = v_note, reviewed_by = left(coalesce(p_actor, 'site-admin'), 100),
    reviewed_at = clock_timestamp()
    where id = p_appeal_id;
  if p_status = 'approved' then
    update public.league_listings set status = 'approved', moderation_note = null,
      reviewed_by = left(coalesce(p_actor, 'site-admin'), 100), reviewed_at = clock_timestamp(),
      updated_at = clock_timestamp() where id = v_appeal.listing_id;
  else
    update public.league_listings set moderation_note = coalesce(v_note, 'Suspension appeal denied.'),
      updated_at = clock_timestamp() where id = v_appeal.listing_id;
  end if;
  return jsonb_build_object('ok', true, 'status', p_status, 'listingId', v_appeal.listing_id);
end;
$function$;

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
    select count(*)::integer into v_count from public.league_saves where account_id = p_account_id;
    return jsonb_build_object('ok', true, 'saved', false, 'savedCount', v_count);
  end if;

  if v_status is distinct from 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'This league is not available.');
  end if;

  select count(*)::integer into v_count from public.league_saves where account_id = p_account_id;
  if v_count >= 3 then
    return jsonb_build_object('ok', false, 'code', 'limit', 'message', 'You can save up to 3 leagues. Remove one to save another.');
  end if;

  insert into public.league_saves(account_id, listing_id) values (p_account_id, p_listing_id)
  on conflict do nothing;
  select count(*)::integer into v_count from public.league_saves where account_id = p_account_id;
  return jsonb_build_object('ok', true, 'saved', true, 'savedCount', v_count);
end;
$function$;

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
  v_has_existing boolean := false;
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
  v_has_existing := found;
  if v_has_existing and v_existing.status not in ('withdrawn','declined') then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'message', 'You already applied to this league.');
  end if;

  select count(*) into v_active from public.league_applications
   where applicant_account_id = p_account_id and status in ('new','shortlisted','invited');
  if v_active >= 3 then
    return jsonb_build_object('ok', false, 'code', 'limit', 'message', 'You have 3 open applications. Withdraw one to apply again.');
  end if;

  if v_has_existing then
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

revoke all on function public.server_league_submit_appeal(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.server_league_admin_resolve_appeal(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.server_league_toggle_save(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_league_apply(uuid, uuid, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.server_league_submit_appeal(uuid, uuid, text) to service_role;
grant execute on function public.server_league_admin_resolve_appeal(uuid, text, text, text) to service_role;
grant execute on function public.server_league_toggle_save(uuid, uuid) to service_role;
grant execute on function public.server_league_apply(uuid, uuid, text, text, boolean, boolean) to service_role;
notify pgrst, 'reload schema';
