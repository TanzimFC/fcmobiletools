-- Remove the retired player database system without touching unrelated site data.
drop view if exists public.player_playstyles;
drop view if exists public.player_traits;
drop function if exists public.player_filter_options();
drop function if exists public.player_search_key(text);

drop table if exists public.player_import_quarantine;
drop table if exists public.player_ability_links;
drop table if exists public.player_ranks;
drop table if exists public.player_prices;
drop table if exists public.player_shard_costs;
drop table if exists public.player_stats;
drop table if exists public.player_assets;
drop table if exists public.player_abilities;
drop table if exists public.players;
drop table if exists public.player_sync_runs;
