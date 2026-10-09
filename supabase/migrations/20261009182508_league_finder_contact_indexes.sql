create index if not exists league_outreach_player_account_idx
  on public.league_outreach(player_account_id);

create index if not exists league_active_confirmation_account_idx
  on public.league_active_confirmations(account_id, created_at desc);
