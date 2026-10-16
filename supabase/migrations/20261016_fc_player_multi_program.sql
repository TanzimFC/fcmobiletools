-- Extend the existing unpublished catalog to support non-Anniversary event cards.
-- This is additive: it does not delete, republish, or rewrite existing player rows.

alter table public.fc_player_cards
  drop constraint if exists fc_player_cards_template_key_check;

alter table public.fc_player_cards
  add constraint fc_player_cards_template_key_check
  check (template_key in ('anniversary27-live', 'anniversary27-base', 'event-generic'));

alter table public.fc_player_cards
  drop constraint if exists fc_player_cards_card_tier_check;

alter table public.fc_player_cards
  add constraint fc_player_cards_card_tier_check
  check (card_tier in ('high', 'base', 'event'));

alter table public.fc_player_cards
  add column if not exists card_category text not null default 'unknown';

alter table public.fc_player_cards
  drop constraint if exists fc_player_cards_card_category_check;

alter table public.fc_player_cards
  add constraint fc_player_cards_card_category_check
  check (card_category in ('icon', 'hero', 'base', 'player', 'event', 'unknown'));

create table if not exists public.fc_player_card_programs (
  source_card_id text not null references public.fc_player_cards(source_card_id) on update cascade on delete cascade,
  program_key text not null,
  program_name text not null,
  source_program_url text,
  release_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_card_id, program_key)
);

create index if not exists fc_player_card_programs_program_idx
  on public.fc_player_card_programs (program_key, source_card_id);

alter table public.fc_player_card_programs enable row level security;

drop policy if exists "Public can read associations for published player cards" on public.fc_player_card_programs;
create policy "Public can read associations for published player cards"
  on public.fc_player_card_programs
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.fc_player_cards c
      where c.source_card_id = fc_player_card_programs.source_card_id
        and c.is_published = true
    )
  );

revoke insert, update, delete, truncate, references, trigger
  on public.fc_player_card_programs from anon, authenticated;
grant select on public.fc_player_card_programs to anon, authenticated;
grant all on public.fc_player_card_programs to service_role;

comment on column public.fc_player_cards.card_category is
  'Source-derived card category, when identifiable; unknown is retained rather than inferred.';
comment on table public.fc_player_card_programs is
  'Many-to-many event membership for cards that appear in one or more RenderZ programs.';
