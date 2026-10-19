-- Winner claim verification and official community invite refresh.
-- Claim codes use a cryptographically random key created by the Worker and held in
-- the private giveaway_settings table. Do not grant browser roles access to that row.

alter table public.giveaway_winners
  add column if not exists fc_uid text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'giveaway_winners_fc_uid_format'
      and conrelid = 'public.giveaway_winners'::regclass
  ) then
    alter table public.giveaway_winners
      add constraint giveaway_winners_fc_uid_format
      check (fc_uid is null or fc_uid ~ '^[0-9]{6,20}$');
  end if;
end $$;

comment on column public.giveaway_winners.fc_uid is
  'Private FC Mobile UID provided by the authenticated winner for claim verification. Never include it in public giveaway payloads.';

insert into public.giveaway_settings (key, value, updated_at)
values ('official', jsonb_build_object('discord_invite', 'https://discord.gg/nRzsqCurUb'), now())
on conflict (key) do update
set value = public.giveaway_settings.value || jsonb_build_object('discord_invite', 'https://discord.gg/nRzsqCurUb'),
    updated_at = now();
