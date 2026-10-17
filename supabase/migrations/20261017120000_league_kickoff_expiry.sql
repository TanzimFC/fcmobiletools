-- Listings with no kickoff in 30 days are removed from the public list.
-- Baseline when a league never pressed Kickoff: reviewed_at, then created_at.
alter table public.league_listings add column if not exists removal_reason text;

create or replace function public.expire_inactive_league_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with gone as (
    update public.league_listings
       set status = 'removed',
           recruiting_open = false,
           removal_reason = 'no_kickoff_30_days',
           updated_at = now()
     where status = 'approved'
       and coalesce(is_sample, false) = false
       and coalesce(last_kickoff_at, reviewed_at, created_at) < now() - interval '30 days'
    returning 1
  )
  select count(*) into v_count from gone;
  return v_count;
end $$;

revoke all on function public.expire_inactive_league_listings() from public, anon, authenticated;
grant execute on function public.expire_inactive_league_listings() to service_role;
