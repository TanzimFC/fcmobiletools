alter table public.league_profiles
  add column if not exists team_screenshot_url text,
  add column if not exists team_screenshot_note text,
  add column if not exists team_screenshot_show_to_owners boolean not null default false,
  add column if not exists team_screenshot_expires_at timestamptz;

alter table public.league_listings
  add column if not exists is_demo boolean not null default false;

create table if not exists public.league_team_shares (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.league_listings(id) on delete cascade,
  player_account_id uuid not null references public.accounts(id) on delete cascade,
  screenshot_url text not null,
  player_note text,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','expired')),
  submitted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reviewed_at timestamptz,
  review_note text,
  constraint league_team_share_not_self check (char_length(screenshot_url) between 10 and 2048),
  constraint league_team_share_note_length check (player_note is null or char_length(player_note) <= 300),
  constraint league_team_share_review_note_length check (review_note is null or char_length(review_note) <= 300)
);

create index if not exists league_team_shares_listing_queue_idx
  on public.league_team_shares(listing_id, status, submitted_at desc, expires_at);
create index if not exists league_team_shares_player_expiry_idx
  on public.league_team_shares(player_account_id, expires_at desc);

create unique index if not exists league_team_shares_one_pending_per_listing
  on public.league_team_shares(listing_id, player_account_id)
  where status = 'pending';

alter table public.league_profiles enable row level security;
alter table public.league_listings enable row level security;
alter table public.league_team_shares enable row level security;

revoke all on public.league_profiles from public, anon, authenticated;
revoke all on public.league_listings from public, anon, authenticated;
revoke all on public.league_team_shares from public, anon, authenticated;

grant select, insert, update, delete on public.league_profiles to service_role;
grant select, insert, update, delete on public.league_listings to service_role;
grant select, insert, update, delete on public.league_team_shares to service_role;
