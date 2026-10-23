-- Store organiser-confirmed livestream wheel results separately from the seeded site draw.
alter table public.giveaways
  add column if not exists livestream_winner_name text,
  add column if not exists livestream_winner_source text,
  add column if not exists livestream_winner_note text,
  add column if not exists livestream_participant_count integer,
  add column if not exists livestream_result_recorded_at timestamptz;
