-- Keep the security helper's name resolution deterministic.
alter function public.player_search_key(text) set search_path = pg_catalog;

-- Public readers already have a SELECT policy. Keep admin privileges to writes
-- so admins do not create a second permissive SELECT policy on every table.
do $$ declare tbl text; admin_predicate text; begin
  foreach tbl in array array['players','player_stats','player_ranks','player_prices','player_shard_costs','player_assets','player_abilities','player_ability_links'] loop
    execute format('drop policy if exists "admin manage player data" on public.%I', tbl);
    execute format('drop policy if exists "admin insert player data" on public.%I', tbl);
    execute format('drop policy if exists "admin update player data" on public.%I', tbl);
    execute format('drop policy if exists "admin delete player data" on public.%I', tbl);
    admin_predicate := '(select auth.jwt() -> ''app_metadata'' ->> ''role'') = ''admin''';
    execute format('create policy "admin insert player data" on public.%I for insert to authenticated with check (%s)', tbl, admin_predicate);
    execute format('create policy "admin update player data" on public.%I for update to authenticated using (%s) with check (%s)', tbl, admin_predicate, admin_predicate);
    execute format('create policy "admin delete player data" on public.%I for delete to authenticated using (%s)', tbl, admin_predicate);
  end loop;
end $$;

create index if not exists player_assets_player_id_idx on public.player_assets (player_id) where player_id is not null;
create index if not exists player_abilities_asset_key_idx on public.player_abilities (asset_key) where asset_key is not null;
