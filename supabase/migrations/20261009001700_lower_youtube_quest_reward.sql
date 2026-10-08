-- Lower the YouTube social quest reward and keep it manual-only.
-- A submitted handle is review evidence, not automatic proof of subscription.

update public.reward_tasks
set
  title = 'Subscribe to FCMobiletools on YouTube',
  description = 'Subscribe to the FCMobiletools YouTube channel and submit your YouTube handle. Because subscriptions cannot be reliably confirmed from a handle alone, this quest uses a smaller reward and manual admin review.',
  reward_points = 5,
  xp_reward = 15,
  token_reward = 5,
  verification_method = 'manual',
  conditions = '{"event":"social_connect","network":"youtube","review":"manual"}',
  metadata = '{"proof_type":"handle","quest_group":"social","manual_review":true,"reward_class":"low"}',
  updated_at = clock_timestamp()
where slug = 'subscribe-youtube';
