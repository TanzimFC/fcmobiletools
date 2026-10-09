alter table public.league_listings
  add column if not exists contact_discord text
  check (contact_discord is null or char_length(contact_discord) <= 100);
