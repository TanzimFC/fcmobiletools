-- Curated local FC Mobile card backgrounds scraped from the Season 10 catalog.
-- The UI composes each card with FCMOBILETOOLS typography and player metadata.
insert into public.player_assets
  (asset_key, player_id, asset_type, local_path, public_url, source_name, source_url, license, attribution)
values
  ('fc26-card-toty-base', null, 'card_background', '/assets/player-cards/team-of-the-year-base.png', null, 'Sappurit s10img Season 10 asset index', 'https://github.com/Sappurit/s10img/blob/main/png/CARDS/backgrounds_TOTY26_BASE.png', 'EA game art; upload permission reported by project owner; source file terms unverified', 'Sappurit/s10img index; original game asset attributed to EA'),
  ('fc26-card-tots-base', null, 'card_background', '/assets/player-cards/team-of-the-season-base.png', null, 'Sappurit s10img Season 10 asset index', 'https://github.com/Sappurit/s10img/blob/main/png/CARDS/backgrounds_TOTS26_BASE.png', 'EA game art; upload permission reported by project owner; source file terms unverified', 'Sappurit/s10img index; original game asset attributed to EA'),
  ('fc26-card-star-signings-live', null, 'card_background', '/assets/player-cards/star-signings-live.png', null, 'Sappurit s10img Season 10 asset index', 'https://github.com/Sappurit/s10img/blob/main/png/CARDS/backgrounds_SS26_LIVE.png', 'EA game art; upload permission reported by project owner; source file terms unverified', 'Sappurit/s10img index; original game asset attributed to EA'),
  ('fc26-card-champions-league-live', null, 'card_background', '/assets/player-cards/champions-league-live.png', null, 'Sappurit s10img Season 10 asset index', 'https://github.com/Sappurit/s10img/blob/main/png/CARDS/backgrounds_CL26_LIVE.png', 'EA game art; upload permission reported by project owner; source file terms unverified', 'Sappurit/s10img index; original game asset attributed to EA'),
  ('fc26-card-anniversary-live', null, 'card_background', '/assets/player-cards/anniversary-live.png', null, 'Sappurit s10img Season 10 asset index', 'https://github.com/Sappurit/s10img/blob/main/png/CARDS/backgrounds_ANN26_LIVE.png', 'EA game art; upload permission reported by project owner; source file terms unverified', 'Sappurit/s10img index; original game asset attributed to EA')
on conflict (asset_key) do update set local_path = excluded.local_path, public_url = excluded.public_url, source_name = excluded.source_name, source_url = excluded.source_url, license = excluded.license, attribution = excluded.attribution;

-- Associate the locally bundled Star Signings background with the already imported card slice.
-- Asset IDs and event text are sourced from the current player rows; no player record is changed.
insert into public.player_assets
  (asset_key, player_id, asset_type, local_path, public_url, source_name, source_url, license, attribution)
select
  'fc26-card-background-player-' || p.player_id::text,
  p.player_id,
  'card_background',
  '/assets/player-cards/star-signings-live.png',
  null,
  'Sappurit s10img Season 10 asset index',
  'https://github.com/Sappurit/s10img/blob/main/png/CARDS/backgrounds_SS26_LIVE.png',
  'EA game art; upload permission reported by project owner; source file terms unverified',
  'Sappurit/s10img index; original game asset attributed to EA'
from public.players p
where p.is_active and p.event ilike '%Star Signings%'
on conflict (asset_key) do update set
  local_path = excluded.local_path,
  public_url = excluded.public_url,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  license = excluded.license,
  attribution = excluded.attribution;
