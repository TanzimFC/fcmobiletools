-- Efficient filter facets and compatibility relations for the public player API.
create or replace function public.player_filter_options()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'positions', coalesce((select jsonb_agg(value order by value) from (select distinct position as value from public.players where is_active and position is not null) values), '[]'::jsonb),
    'clubs', coalesce((select jsonb_agg(value order by value) from (select distinct club as value from public.players where is_active and club is not null) values), '[]'::jsonb),
    'leagues', coalesce((select jsonb_agg(value order by value) from (select distinct league as value from public.players where is_active and league is not null) values), '[]'::jsonb),
    'nations', coalesce((select jsonb_agg(value order by value) from (select distinct nation as value from public.players where is_active and nation is not null) values), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(value order by value) from (select distinct event as value from public.players where is_active and event is not null) values), '[]'::jsonb)
  );
$$;

grant execute on function public.player_filter_options() to anon, authenticated;

create or replace view public.player_playstyles
with (security_invoker = true)
as
select link.player_id, link.ability_id, link.rank, ability.name, ability.slug, ability.is_plus, ability.description, ability.asset_key
from public.player_ability_links as link
join public.player_abilities as ability on ability.id = link.ability_id
where ability.ability_type = 'playstyle';

create or replace view public.player_traits
with (security_invoker = true)
as
select link.player_id, link.ability_id, link.rank, ability.name, ability.slug, ability.is_plus, ability.description, ability.asset_key
from public.player_ability_links as link
join public.player_abilities as ability on ability.id = link.ability_id
where ability.ability_type = 'trait';

grant select on public.player_playstyles, public.player_traits to anon, authenticated;
