alter table public.player_assets add column if not exists match_field text, add column if not exists match_key text;

do $$ begin
 if not exists (select 1 from pg_constraint where conname='player_assets_match_field_check') then
  alter table public.player_assets add constraint player_assets_match_field_check check (match_field is null or match_field in ('event','club','nation','league','player_id','playstyle','trait','rank'));
 end if;
 if not exists (select 1 from pg_constraint where conname='player_assets_global_match_check') then
  alter table public.player_assets add constraint player_assets_global_match_check check ((match_field is null and match_key is null) or (match_field is not null and match_key is not null and player_id is null));
 end if;
end $$;

create index if not exists player_assets_global_match_idx on public.player_assets (asset_type,match_field,match_key) where player_id is null and match_key is not null;
comment on column public.player_assets.match_field is 'Metadata field used to resolve reusable global artwork.';
comment on column public.player_assets.match_key is 'Normalized value used to resolve reusable global artwork.';
-- Assign only the identifiable TOTS nominee event family; ambiguous events stay unmapped.
insert into public.player_assets (asset_key,player_id,asset_type,match_field,match_key,local_path,source_name,source_url,license,attribution)
select 'global-card-background-event-'||lower(regexp_replace(event,'[^a-zA-Z0-9]+','-','g')),null,'card_background','event',
 lower(trim(both '-' from regexp_replace(event,'[^a-zA-Z0-9]+','-','g'))),
 '/assets/player-cards/team-of-the-season-base.png','Sappurit S10 Image Archive',
 'https://sappurit.github.io/s10img/index-CARDS.htm','unverified',
 'Community archive; project owner reports permission; per-file terms not independently verified.'
from public.players where event ilike 'TOTS 26%Premium Nominee%' group by event
on conflict(asset_key) do update set match_field=excluded.match_field,match_key=excluded.match_key,local_path=excluded.local_path,source_name=excluded.source_name,source_url=excluded.source_url,license=excluded.license,attribution=excluded.attribution;
grant select on public.player_assets to anon,authenticated;
