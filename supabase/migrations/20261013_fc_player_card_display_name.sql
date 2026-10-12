alter table public.fc_player_cards
  add column if not exists card_display_name text;

update public.fc_player_cards
set card_display_name = player_name
where card_display_name is null;

alter table public.fc_player_cards
  alter column card_display_name set not null;

comment on column public.fc_player_cards.card_display_name is 'Short display name to render on the card face; player_name remains the full searchable name.';
