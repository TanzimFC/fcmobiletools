-- Player-card database v2.
-- Every source card remains its own row; player identities only group related card versions.
create table if not exists public.players (
  player_key text primary key,
  game_player_id text,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists players_game_player_id_uidx
  on public.players (game_player_id)
  where game_player_id is not null;
create index if not exists players_normalized_name_idx
  on public.players (normalized_name);

create table if not exists public.player_cards (
  id text primary key,
  player_key text not null references public.players(player_key) on delete cascade,
  source_slug text,
  name text not null,
  normalized_name text not null,
  ovr smallint not null check (ovr between 1 and 200),
  position text not null,
  alternate_positions text[] not null default '{}',
  program text,
  club text,
  league text,
  nation text,
  source_url text,
  source_program_url text,
  source_page_status integer,
  source_page_title text,
  collected_at timestamptz,
  stats_collected_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  stat_extraction jsonb,
  skill_points_to_spend integer,
  skill_points_to_spend_label text,
  play_styles jsonb not null default '[]'::jsonb,
  skill_tree jsonb not null default '{}'::jsonb,
  game_traits jsonb not null default '[]'::jsonb,
  requested_view_state jsonb,
  progression jsonb,
  raw_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_cards_player_key_idx on public.player_cards (player_key);
create index if not exists player_cards_ovr_idx on public.player_cards (ovr desc);
create index if not exists player_cards_position_ovr_idx on public.player_cards (position, ovr desc);
create index if not exists player_cards_program_ovr_idx on public.player_cards (program, ovr desc);
create index if not exists player_cards_normalized_name_idx on public.player_cards (normalized_name);
create index if not exists player_cards_club_idx on public.player_cards (club);
create index if not exists player_cards_league_idx on public.player_cards (league);
create index if not exists player_cards_nation_idx on public.player_cards (nation);
create index if not exists player_cards_stats_gin_idx on public.player_cards using gin (stats jsonb_path_ops);

create table if not exists public.player_assets (
  asset_key text primary key,
  kind text not null check (kind in ('player-image', 'player-card-background', 'club-logo', 'league-logo', 'nation-flag')),
  canonical_source_url text,
  alt text,
  content_type text,
  content_hash text,
  file_bytes bigint,
  width integer,
  height integer,
  b2_object_key text,
  public_url text,
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'unavailable')),
  download_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_assets_content_hash_idx on public.player_assets (content_hash);
create index if not exists player_assets_kind_idx on public.player_assets (kind);
create index if not exists player_assets_status_idx on public.player_assets (status);

create table if not exists public.player_card_assets (
  card_id text not null references public.player_cards(id) on delete cascade,
  asset_key text not null references public.player_assets(asset_key) on delete restrict,
  role text not null,
  asset_order smallint not null default 0,
  is_primary boolean not null default false,
  primary key (card_id, asset_key)
);

create index if not exists player_card_assets_asset_key_idx on public.player_card_assets (asset_key);
create index if not exists player_card_assets_primary_idx on public.player_card_assets (card_id) where is_primary;

-- Player card data and asset references are public. Writes stay server-side
-- through a Supabase secret/service-role key; no anonymous write policies exist.
alter table public.players enable row level security;
alter table public.player_cards enable row level security;
alter table public.player_assets enable row level security;
alter table public.player_card_assets enable row level security;

grant select on public.players, public.player_cards, public.player_assets, public.player_card_assets to anon, authenticated;
grant all on public.players, public.player_cards, public.player_assets, public.player_card_assets to service_role;

drop policy if exists "Public can read player identities" on public.players;
create policy "Public can read player identities" on public.players for select to anon, authenticated using (true);
drop policy if exists "Public can read player cards" on public.player_cards;
create policy "Public can read player cards" on public.player_cards for select to anon, authenticated using (true);
drop policy if exists "Public can read player assets" on public.player_assets;
create policy "Public can read player assets" on public.player_assets for select to anon, authenticated using (true);
drop policy if exists "Public can read player card asset links" on public.player_card_assets;
create policy "Public can read player card asset links" on public.player_card_assets for select to anon, authenticated using (true);
