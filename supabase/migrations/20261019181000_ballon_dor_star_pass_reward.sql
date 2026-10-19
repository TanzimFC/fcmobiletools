-- FCMobiletools: clarify the Ballon d'Or event's Star Pass reward.
-- This reward is an in-game item and has no real cash value.
-- Safe for the current empty draft records and fresh installs using the updated seed migration.


alter table public.giveaways alter column prize_label set default 'In-game reward';

insert into public.giveaway_settings (key, value, updated_at)
values ('official', jsonb_build_object('discord_invite', 'https://discord.com/invite/B4a7AxuU69'), now())
on conflict (key) do update
set value = jsonb_set(
  coalesce(public.giveaway_settings.value, '{}'::jsonb),
  '{discord_invite}',
  to_jsonb('https://discord.com/invite/B4a7AxuU69'::text),
  true
),
updated_at = now();

update public.giveaways g
set slug = 'ballon-dor-star-pass-giveaway',
    kind = 'ballon_dor',
    title = 'Ballon d''Or Star Pass Giveaway',
    tagline = 'Win the in-game Star Pass from the Ballon d''Or event. Free to enter.',
    description = 'The reward is the in-game Star Pass associated with the Ballon d''Or event. It has no real cash value, cannot be redeemed for cash and has no cash alternative.',
    prize_label = 'Star Pass',
    prize_cents = 0,
    bonus_prize_cents = 0,
    winner_count = 1,
    alternate_count = 3,
    requirements = '[]'::jsonb,
    milestones = '[]'::jsonb,
    status = 'draft',
    starts_at = null,
    ends_at = null,
    seed_commit = null,
    draw_seed = null,
    draw_snapshot = null,
    entries_hash = null,
    drawn_at = null,
    results_published_at = null,
    seed_revealed_at = null,
    rules_version = ''
where g.slug in ('ballon-dor-giveaway', 'ballon-dor-star-pass-giveaway')
  and g.status = 'draft'
  and not exists (select 1 from public.giveaway_entries e where e.giveaway_id = g.id)
  and not exists (select 1 from public.giveaway_winners w where w.giveaway_id = g.id)
  and (
    g.slug = 'ballon-dor-star-pass-giveaway'
    or not exists (
      select 1 from public.giveaways other
      where other.slug = 'ballon-dor-star-pass-giveaway' and other.id <> g.id
    )
  );

delete from public.giveaways g
where g.slug in ('star-pass-giveaway', 'ballon-dor-giveaway')
  and g.status = 'draft'
  and not exists (select 1 from public.giveaway_entries e where e.giveaway_id = g.id)
  and not exists (select 1 from public.giveaway_winners w where w.giveaway_id = g.id);

insert into public.giveaways
  (slug, kind, title, tagline, description, prize_label, prize_cents, bonus_prize_cents,
   accent, requirements, milestones, status, rules_version)
select
  'ballon-dor-star-pass-giveaway', 'ballon_dor', 'Ballon d''Or Star Pass Giveaway',
  'Win the in-game Star Pass from the Ballon d''Or event. Free to enter.',
  'The reward is the in-game Star Pass associated with the Ballon d''Or event. It has no real cash value, cannot be redeemed for cash and has no cash alternative.',
  'Star Pass', 0, 0, '#f6c453', '[]'::jsonb, '[]'::jsonb, 'draft', ''
where not exists (
  select 1 from public.giveaways where slug = 'ballon-dor-star-pass-giveaway'
);

