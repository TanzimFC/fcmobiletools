# FCMobiletools Account System V1

## Goal

FCMobiletools remains fully usable without an account. The Account area adds identity, personalization, progression and future community features without turning normal browsing into a reward grind.

## Existing architecture used

- Supabase Auth remains the public authentication system.
- `public.accounts` remains the application account record linked to `auth.users`.
- Existing Worker-secret admin authentication remains the admin boundary.
- Existing tournament tables remain the tournament source of truth.
- The Worker uses the Supabase service key only on the server side.
- Public profile data is served through a safe projection and never through the raw `accounts` table.

## Account data

- `accounts`: identity, display name, avatar, account state.
- `profile_settings`: explicit public/private display preferences.
- `account_progress`: current XP/level/streak state.
- `xp_transactions`: append-only XP ledger.
- `activity_events`: meaningful account events with idempotency.
- `reward_accounts` + `reward_ledger`: token balance and transaction history.
- `reward_tasks` + `task_attempts`: configurable mission/task engine.
- `achievements` + `user_achievements`: configurable milestones.
- `streak_definitions` + `user_streaks`: configurable streak rules.
- `leaderboard_definitions` + `leaderboard_snapshots`: metric-driven ranking.
- `rewards` + `reward_redemptions`: optional catalogue/redemption layer.
- `community_submissions`: moderated contribution workflow.
- `account_email_domain_blocklist`: disposable-domain controls.

## Security boundaries

XP and token balances are never accepted from the browser as authoritative values. Rewarding operations use server-side verification and idempotency keys. Direct browser writes to sensitive ledgers, reward inventory and admin tables are blocked by privilege/RLS controls.

Public profiles expose only explicitly public fields. Email, authentication data, internal identifiers, moderation data, fraud/risk information and reward-delivery data stay private.

The public account signup flow rejects Gmail + aliases and enabled disposable-email domains. The UI warns users to use an email address they can keep accessing because verification may be required later.

## Current public routes

- `/account/`
- `/profile/`
- `/profile/<username>/`
- `/settings/`
- `/missions/`
- `/achievements/`
- `/leaderboard/`
- `/rewards/`

The last four pages stay effectively empty until their definitions are enabled.

## Admin

The existing protected Admin Workspace keeps its current Accounts section. A new `/admin/accounts/` Account System workspace adds configurable missions, achievements, rewards and community-review controls without replacing the existing admin authentication.

## Economy

No final XP economy is hard-coded. No XP/token cash conversion is defined. No reward funding guarantee is created. Token expiration is represented in the ledger/configuration but remains disabled until a real expiration accounting policy is chosen.

## Integrations

### Tournament

Tournament participants can be linked with `tournament_players.account_id`. Existing tournament match/player records remain canonical.

### Calculators

Calculators can later report verified account events through the Worker/event layer. Page loads are not rewards by themselves.

### Events and redeem codes

Both remain public without login. Future account features can consume verified, meaningful events without introducing login gates around the public content.

## Notes for future stages

Before enabling live missions/rewards, add the exact product rules in Admin, seed only intentional definitions, test anti-farming limits, and verify email delivery with the existing Supabase Auth mail configuration.

The current Supabase project already contains earlier account-security/reward foundation migrations that predate this V1 branch. This document describes the extension built on that existing production foundation rather than recreating it blindly.
