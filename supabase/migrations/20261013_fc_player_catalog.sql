-- FC Mobile player catalog: Supabase stores searchable metadata; image bytes live in Backblaze B2.
create table if not exists public.fc_player_assets (
  asset_key text primary key,
  kind text not null check (kind in ('player-card-background', 'player-image', 'club-logo', 'league-logo', 'nation-flag')),
  canonical_source_url text,
  object_key text not null unique,
  public_url text not null,
  content_type text not null,
  byte_size bigint not null default 0 check (byte_size >= 0),
  sha256 text,
  width integer,
  height integer,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fc_player_cards (
  source_card_id text primary key,
  source_slug text not null,
  player_name text not null,
  card_display_name text not null,
  ovr smallint not null check (ovr between 1 and 150),
  position text not null,
  alternate_positions text[] not null default '{}',
  program_name text not null default '3rd Anniversary',
  program_key text not null default 'anniversary-3rd-2026',
  card_tier text not null check (card_tier in ('high', 'base')),
  template_key text not null check (template_key in ('anniversary27-live', 'anniversary27-base')),
  source_url text not null,
  source_program_url text,
  stats jsonb not null default '{}'::jsonb,
  stat_extraction jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  play_styles jsonb not null default '[]'::jsonb,
  skill_points_to_spend integer,
  skill_points_to_spend_label text not null default 'Skill Points to Spend',
  player_image_asset_key text references public.fc_player_assets(asset_key) on update cascade on delete restrict,
  card_background_asset_key text references public.fc_player_assets(asset_key) on update cascade on delete restrict,
  club_logo_asset_key text references public.fc_player_assets(asset_key) on update cascade on delete restrict,
  league_logo_asset_key text references public.fc_player_assets(asset_key) on update cascade on delete restrict,
  nation_flag_asset_key text references public.fc_player_assets(asset_key) on update cascade on delete restrict,
  player_image_url text,
  card_background_url text,
  club_logo_url text,
  league_logo_url text,
  nation_flag_url text,
  is_published boolean not null default false,
  collected_at timestamptz,
  stats_collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fc_player_cards_public_ovr_idx
  on public.fc_player_cards (ovr desc, player_name)
  where is_published = true;

create index if not exists fc_player_cards_public_position_ovr_idx
  on public.fc_player_cards (position, ovr desc)
  where is_published = true;

create index if not exists fc_player_cards_program_idx
  on public.fc_player_cards (program_key, ovr desc);

create index if not exists fc_player_cards_stats_gin_idx
  on public.fc_player_cards using gin (stats);

alter table public.fc_player_assets enable row level security;
alter table public.fc_player_cards enable row level security;

drop policy if exists "Public can read published catalog assets" on public.fc_player_assets;
create policy "Public can read published catalog assets"
  on public.fc_player_assets for select to anon, authenticated
  using (is_public = true);

drop policy if exists "Public can read published player cards" on public.fc_player_cards;
create policy "Public can read published player cards"
  on public.fc_player_cards for select to anon, authenticated
  using (is_published = true);

revoke insert, update, delete, truncate, references, trigger on public.fc_player_assets from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.fc_player_cards from anon, authenticated;
grant select on public.fc_player_assets to anon, authenticated;
grant select on public.fc_player_cards to anon, authenticated;
grant all on public.fc_player_assets to service_role;
grant all on public.fc_player_cards to service_role;

comment on table public.fc_player_assets is 'Deduplicated metadata for externally hosted image URLs, including Cloudinary and RenderZ; binary image content is not stored in Supabase.';
comment on table public.fc_player_cards is 'Searchable FC Mobile player card records. Only validated records should be published.';
comment on column public.fc_player_cards.template_key is 'Template selected from the card-specific Anniversary BASE/LIVE family.';
comment on column public.fc_player_cards.stats is 'Structured base attribute groups; training calculations are intentionally maintained separately.';
