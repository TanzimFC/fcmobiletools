-- Find a League: league screenshots (permanent) + applicant screenshot retention (7 days).
-- Safe to run more than once. The app keeps working without it (gallery hidden, expiry derived from created_at).

-- 1) League screenshots: up to 4 permanent image links per listing.
alter table public.league_listings
  add column if not exists gallery_urls jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'league_listings_gallery_urls_chk') then
    alter table public.league_listings
      add constraint league_listings_gallery_urls_chk
      check (jsonb_typeof(gallery_urls) = 'array' and jsonb_array_length(gallery_urls) <= 4);
  end if;
end $$;

-- 2) Applicant screenshots: remember when the screenshot was uploaded, so expiry is exact even when
--    a player re-applies later (created_at would be too old in that case).
alter table public.league_applications
  add column if not exists screenshot_at timestamptz;

update public.league_applications
   set screenshot_at = coalesce(updated_at, created_at)
 where screenshot_url is not null and screenshot_at is null;

create or replace function public.league_applications_stamp_screenshot()
returns trigger
language plpgsql
as $fn$
begin
  if new.screenshot_url is null then
    new.screenshot_at := null;
  elsif tg_op = 'INSERT' or new.screenshot_url is distinct from old.screenshot_url then
    new.screenshot_at := now();
  end if;
  return new;
end;
$fn$;

drop trigger if exists league_applications_stamp_screenshot_trg on public.league_applications;
create trigger league_applications_stamp_screenshot_trg
  before insert or update of screenshot_url on public.league_applications
  for each row execute function public.league_applications_stamp_screenshot();

-- 3) Called by the Worker's hourly schedule. The image host deletes the file itself after 7 days;
--    this clears the dead link so owners never see a broken image.
create or replace function public.purge_expired_application_screenshots()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare n integer;
begin
  update public.league_applications
     set screenshot_url = null
   where screenshot_url is not null
     and screenshot_at is not null
     and screenshot_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$fn$;

revoke all on function public.purge_expired_application_screenshots() from public, anon, authenticated;
grant execute on function public.purge_expired_application_screenshots() to service_role;
