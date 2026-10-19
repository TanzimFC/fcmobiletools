-- FCMobiletools Giveaway System
--
-- Entries with automated checks and human review, a provably fair draw, secret
-- claim codes, temporary proof images, penalties, referrals, daily boosts and a
-- full audit trail.
--
-- Safe to run more than once. Every table is closed to the browser: RLS is on and
-- anon/authenticated have no grants. Only the Worker (service key) reads and writes.

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

create or replace function public.giveaway_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

create or replace function public.giveaway_block_update()
returns trigger language plpgsql as $$
begin
  raise exception 'This table is append only.';
end $$;

-- ---------------------------------------------------------------------------
-- Giveaways
-- ---------------------------------------------------------------------------

create table if not exists public.giveaways (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  kind text not null default 'custom' check (kind in ('ballon_dor','star_pass','custom')),
  title text not null check (char_length(title) between 3 and 120),
  tagline text not null default '' check (char_length(tagline) <= 200),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'draft'
    check (status in ('draft','live','closed','drawn','completed','cancelled')),
  prize_label text not null default 'Cash prize' check (char_length(prize_label) <= 80),
  prize_cents integer not null default 0 check (prize_cents between 0 and 100000000),
  bonus_prize_cents integer not null default 0 check (bonus_prize_cents between 0 and 100000000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  winner_count smallint not null default 1 check (winner_count between 1 and 50),
  alternate_count smallint not null default 3 check (alternate_count between 0 and 50),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  accent text not null default '#f6c453' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  starts_at timestamptz,
  ends_at timestamptz,
  proof_ttl_hours integer not null default 24 check (proof_ttl_hours between 1 and 720),
  claim_window_hours integer not null default 72 check (claim_window_hours between 1 and 720),
  requirements jsonb not null default '[]'::jsonb,
  milestones jsonb not null default '[]'::jsonb,
  bonus jsonb not null default '{"daily":true,"dailyCap":7,"referral":true,"referralCap":10}'::jsonb,
  rules_version text not null default '',
  seed_commit text,
  draw_seed text,
  draw_snapshot jsonb,
  entries_hash text,
  drawn_at timestamptz,
  results_published_at timestamptz,
  seed_revealed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists giveaways_status_idx on public.giveaways(status, ends_at);

drop trigger if exists giveaways_touch on public.giveaways;
create trigger giveaways_touch before update on public.giveaways
  for each row execute function public.giveaway_touch();

-- ---------------------------------------------------------------------------
-- Entries
-- ---------------------------------------------------------------------------

create table if not exists public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'provisional'
    check (status in ('provisional','approved','needs_proof','rejected','withdrawn','disqualified')),
  discord_username text not null default '' check (char_length(discord_username) <= 64),
  discord_norm text not null default '',
  proof jsonb not null default '[]'::jsonb,
  proof_hashes text[] not null default '{}',
  proof_expires_at timestamptz,
  checks jsonb not null default '{}'::jsonb,
  checks_passed boolean not null default false,
  checks_at timestamptz,
  flags text[] not null default '{}',
  ip_hash text,
  referred_by uuid references public.accounts(id) on delete set null,
  fix_deadline timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  review_reason text,
  rules_version text not null default '',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (giveaway_id, account_id)
);

create index if not exists giveaway_entries_queue_idx on public.giveaway_entries(giveaway_id, status, created_at);
create index if not exists giveaway_entries_account_idx on public.giveaway_entries(account_id, created_at desc);
create index if not exists giveaway_entries_hashes_idx on public.giveaway_entries using gin (proof_hashes);
create index if not exists giveaway_entries_discord_idx on public.giveaway_entries(giveaway_id, discord_norm) where discord_norm <> '';
create index if not exists giveaway_entries_ip_idx on public.giveaway_entries(giveaway_id, ip_hash) where ip_hash is not null;
create index if not exists giveaway_entries_expiry_idx on public.giveaway_entries(proof_expires_at) where status = 'provisional';

drop trigger if exists giveaway_entries_touch on public.giveaway_entries;
create trigger giveaway_entries_touch before update on public.giveaway_entries
  for each row execute function public.giveaway_touch();

-- Every decision about an entry is written here with a reason and a timestamp.
create table if not exists public.giveaway_entry_events (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.giveaway_entries(id) on delete cascade,
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  actor text not null check (actor in ('system','user','admin')),
  action text not null check (char_length(action) between 2 and 40),
  reason text not null default '' check (char_length(reason) <= 600),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists giveaway_entry_events_entry_idx on public.giveaway_entry_events(entry_id, created_at);

drop trigger if exists giveaway_entry_events_lock on public.giveaway_entry_events;
create trigger giveaway_entry_events_lock before update on public.giveaway_entry_events
  for each row execute function public.giveaway_block_update();

-- One boost per account per day per giveaway.
create table if not exists public.giveaway_checkins (
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (giveaway_id, account_id, day)
);

create table if not exists public.giveaway_referrals (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  referrer_account_id uuid not null references public.accounts(id) on delete cascade,
  referred_account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'counted' check (status in ('counted','void')),
  created_at timestamptz not null default clock_timestamp(),
  unique (giveaway_id, referred_account_id),
  check (referrer_account_id <> referred_account_id)
);
create index if not exists giveaway_referrals_referrer_idx on public.giveaway_referrals(giveaway_id, referrer_account_id, status);

-- ---------------------------------------------------------------------------
-- Penalties
-- ---------------------------------------------------------------------------

create table if not exists public.giveaway_bans (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  giveaway_id uuid references public.giveaways(id) on delete set null,
  strike integer not null default 1 check (strike >= 1),
  reason text not null check (char_length(reason) between 3 and 600),
  starts_at timestamptz not null default clock_timestamp(),
  ends_at timestamptz,
  issued_by text not null default 'admin',
  lifted_at timestamptz,
  lifted_by text,
  lifted_reason text,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists giveaway_bans_account_idx on public.giveaway_bans(account_id, ends_at);

-- ---------------------------------------------------------------------------
-- Winners and claims
-- ---------------------------------------------------------------------------

create table if not exists public.giveaway_winners (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  entry_id uuid not null references public.giveaway_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  slot integer check (slot is null or slot >= 1),
  rank_position integer not null check (rank_position >= 1),
  status text not null default 'selected'
    check (status in ('alternate','selected','awaiting_claim','code_verified','paid','forfeited','replaced')),
  prize_cents integer not null default 0 check (prize_cents >= 0),
  -- Secret claim code. The hash lets admins verify a code they receive; the cipher lets
  -- the winner see their own code again. Admin screens never show it.
  claim_code_hash text,
  claim_code_enc text,
  code_reveals integer not null default 0,
  last_revealed_at timestamptz,
  claim_attempts integer not null default 0,
  contact_channel text check (contact_channel is null or contact_channel in ('discord','instagram')),
  contact_handle text check (contact_handle is null or char_length(contact_handle) <= 64),
  contact_set_at timestamptz,
  announced_at timestamptz,
  claim_deadline timestamptz,
  overdue_flagged boolean not null default false,
  verified_at timestamptz,
  verified_by text,
  verified_handle text,
  handle_matched boolean,
  paid_at timestamptz,
  paid_by text,
  payout_method text,
  payout_reference text,
  payout_proof_url text check (payout_proof_url is null or payout_proof_url ~ '^https://'),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (giveaway_id, entry_id)
);
create unique index if not exists giveaway_winners_code_idx on public.giveaway_winners(claim_code_hash) where claim_code_hash is not null;
-- One active holder per prize slot. Forfeited and replaced rows free the slot for the next entry.
create unique index if not exists giveaway_winners_slot_idx on public.giveaway_winners(giveaway_id, slot)
  where slot is not null and status not in ('forfeited','replaced','alternate');
create index if not exists giveaway_winners_giveaway_idx on public.giveaway_winners(giveaway_id, status, slot);
create index if not exists giveaway_winners_account_idx on public.giveaway_winners(account_id);

drop trigger if exists giveaway_winners_touch on public.giveaway_winners;
create trigger giveaway_winners_touch before update on public.giveaway_winners
  for each row execute function public.giveaway_touch();

-- ---------------------------------------------------------------------------
-- Audit, settings, metrics
-- ---------------------------------------------------------------------------

create table if not exists public.giveaway_audit (
  id bigint generated always as identity primary key,
  giveaway_id uuid references public.giveaways(id) on delete set null,
  actor text not null default 'admin',
  action text not null check (char_length(action) between 2 and 60),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists giveaway_audit_idx on public.giveaway_audit(giveaway_id, created_at desc);

drop trigger if exists giveaway_audit_lock on public.giveaway_audit;
create trigger giveaway_audit_lock before update on public.giveaway_audit
  for each row execute function public.giveaway_block_update();

create table if not exists public.giveaway_settings (
  key text primary key check (char_length(key) between 2 and 40),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.giveaway_metrics (
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  day date not null,
  event text not null check (event in ('view','start','entry','boost','share','referral')),
  n integer not null default 0,
  primary key (giveaway_id, day, event)
);

-- ---------------------------------------------------------------------------
-- Lock everything away from the browser
-- ---------------------------------------------------------------------------

alter table public.giveaways enable row level security;
alter table public.giveaway_entries enable row level security;
alter table public.giveaway_entry_events enable row level security;
alter table public.giveaway_checkins enable row level security;
alter table public.giveaway_referrals enable row level security;
alter table public.giveaway_bans enable row level security;
alter table public.giveaway_winners enable row level security;
alter table public.giveaway_audit enable row level security;
alter table public.giveaway_settings enable row level security;
alter table public.giveaway_metrics enable row level security;

revoke all on table public.giveaways from anon, authenticated;
revoke all on table public.giveaway_entries from anon, authenticated;
revoke all on table public.giveaway_entry_events from anon, authenticated;
revoke all on table public.giveaway_checkins from anon, authenticated;
revoke all on table public.giveaway_referrals from anon, authenticated;
revoke all on table public.giveaway_bans from anon, authenticated;
revoke all on table public.giveaway_winners from anon, authenticated;
revoke all on table public.giveaway_audit from anon, authenticated;
revoke all on table public.giveaway_settings from anon, authenticated;
revoke all on table public.giveaway_metrics from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions (Worker only)
-- ---------------------------------------------------------------------------

create or replace function public.giveaway_bump_metric(p_giveaway uuid, p_event text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.giveaway_metrics(giveaway_id, day, event, n)
  values (p_giveaway, (now() at time zone 'utc')::date, p_event, 1)
  on conflict (giveaway_id, day, event) do update set n = public.giveaway_metrics.n + 1;
$$;

create or replace function public.giveaway_public_stats(p_giveaway uuid)
returns json language sql stable security definer set search_path = public, pg_temp as $$
  select json_build_object(
    'entries', count(*) filter (where status in ('provisional','approved','needs_proof')),
    'approved', count(*) filter (where status = 'approved')
  ) from public.giveaway_entries where giveaway_id = p_giveaway;
$$;

-- The frozen list for a draw: entries that are still in good standing, with their tickets.
-- Tickets = 1 + daily boosts (capped) + counted referrals (capped).
create or replace function public.giveaway_eligible_tickets(
  p_giveaway uuid, p_daily_cap integer default 7, p_ref_cap integer default 10
) returns table(entry_id uuid, account_id uuid, tickets integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id, e.account_id,
    (1 + least(coalesce(c.n, 0), greatest(p_daily_cap, 0)) + least(coalesce(r.n, 0), greatest(p_ref_cap, 0)))::integer
  from public.giveaway_entries e
  left join (
    select account_id, count(*) as n from public.giveaway_checkins
    where giveaway_id = p_giveaway group by account_id
  ) c on c.account_id = e.account_id
  left join (
    select referrer_account_id, count(*) as n from public.giveaway_referrals
    where giveaway_id = p_giveaway and status = 'counted' group by referrer_account_id
  ) r on r.referrer_account_id = e.account_id
  where e.giveaway_id = p_giveaway
    and e.status in ('provisional','approved')
    and not exists (
      select 1 from public.giveaway_bans b
      where b.account_id = e.account_id and b.lifted_at is null
        and b.starts_at <= now() and (b.ends_at is null or b.ends_at > now())
        and (b.giveaway_id is null or b.giveaway_id = p_giveaway)
    );
$$;

create or replace function public.giveaway_admin_counts()
returns table(giveaway_id uuid, status text, n bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select giveaway_id, status, count(*) from public.giveaway_entries group by giveaway_id, status;
$$;

revoke all on function public.giveaway_admin_counts() from public, anon, authenticated;
grant execute on function public.giveaway_admin_counts() to service_role;
revoke all on function public.giveaway_bump_metric(uuid, text) from public, anon, authenticated;
revoke all on function public.giveaway_public_stats(uuid) from public, anon, authenticated;
revoke all on function public.giveaway_eligible_tickets(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.giveaway_bump_metric(uuid, text) to service_role;
grant execute on function public.giveaway_public_stats(uuid) to service_role;
grant execute on function public.giveaway_eligible_tickets(uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Starting settings and two drafts. Nothing is public until an admin publishes.
-- ---------------------------------------------------------------------------

insert into public.giveaway_settings(key, value) values
  ('official', '{"discord_invite":"","discord_handle":"","instagram_handle":"","instagram_url":"","notice":""}'::jsonb),
  ('roi', '{"rpm_usd":0,"pages_per_entrant":6}'::jsonb)
on conflict (key) do nothing;

insert into public.giveaways
  (slug, kind, title, tagline, description, prize_label, prize_cents, bonus_prize_cents, accent, requirements, milestones)
values
  ('ballon-dor-giveaway', 'ballon_dor', 'Ballon d''Or Giveaway',
   'Win a $20 prize. Free to enter, drawn in public.',
   'Complete the steps, upload your proof and you are in the draw. Winners are picked by a provably fair draw you can verify yourself.',
   'Cash prize', 2000, 500, '#f6c453', '[]'::jsonb,
   '[{"entries":300,"label":"Second winner unlocked","bonus_winners":1},{"entries":1000,"label":"Two more winners unlocked","bonus_winners":2}]'::jsonb),
  ('star-pass-giveaway', 'star_pass', 'Star Pass Giveaway',
   'Win a $20 prize. Free to enter, drawn in public.',
   'Complete the steps, upload your proof and you are in the draw. Winners are picked by a provably fair draw you can verify yourself.',
   'Cash prize', 2000, 500, '#4cc9ff', '[]'::jsonb,
   '[{"entries":300,"label":"Second winner unlocked","bonus_winners":1},{"entries":1000,"label":"Two more winners unlocked","bonus_winners":2}]'::jsonb)
on conflict (slug) do nothing;
