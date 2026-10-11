-- FCMobiletools Inbox moderation and 48-hour message retention.
-- New tables are reachable only through the authenticated Worker using the service role.

create table if not exists public.league_inbox_restrictions (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  suspended_until timestamptz not null,
  updated_by text not null default 'site-admin',
  updated_at timestamptz not null default now()
);

create index if not exists league_inbox_restrictions_expiry_idx
  on public.league_inbox_restrictions(suspended_until);

alter table public.league_inbox_restrictions enable row level security;
revoke all on public.league_inbox_restrictions from public, anon, authenticated;
grant select, insert, update, delete on public.league_inbox_restrictions to service_role;

comment on table public.league_inbox_restrictions is
  'Worker-enforced Inbox suspensions. Only the authenticated admin Worker may read or change these records.';

-- Apply the 48-hour rule immediately to any existing messages. The scheduled Worker
-- repeats this deletion every hour, so each message is removed soon after it reaches 48 hours.
delete from public.league_messages
where created_at < now() - interval '48 hours';

notify pgrst, 'reload schema';
