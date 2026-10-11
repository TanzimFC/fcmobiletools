-- Retire sample league listings and hide public test tournament fixtures.
-- Preserve rows and related audit/application history; remove demos from all public surfaces.
update public.league_listings
set status = 'removed',
    is_sample = true,
    recruiting_open = false,
    moderation_note = coalesce(nullif(btrim(moderation_note), ''), 'Development listing retired from the public directory.'),
    updated_at = clock_timestamp()
where is_sample is true
   or slug = 'fcm-sample-league-demo'
   or lower(name) = 'fcm sample league';

update public.tournaments
set is_public = false,
    updated_at = clock_timestamp()
where slug like 'format-test-%'
   or slug = 'fcmobiletools-sample-championship';
