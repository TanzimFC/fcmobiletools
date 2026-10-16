-- Replace page-dwell incentives with real, verifiable player actions.
-- Thursday UTC remains the weekly boundary. Existing assignment IDs remain valid.

update public.reward_tasks
set slug='daily-playstyle-finder',
    title='Find your FC Mobile PlayStyles',
    description='Complete the short survey to get PlayStyle recommendations matched to your position and role.',
    reward_points=4, xp_reward=25, token_reward=4,
    task_type='daily', mission_type='daily', daily_limit=1, weekly_limit=null,
    cooldown_seconds=21600, verification_method='server_event',
    conditions='{"tool":"playstyle-finder","event":"calculator_use"}'::jsonb,
    priority=20, display_order=25,
    metadata='{"weight":5,"quest_group":"daily-tools"}'::jsonb,
    updated_at=clock_timestamp()
where slug='daily-events-check';

update public.reward_tasks
set title='Copy an FC Mobile redeem code',
    description='Copy an available redeem code so you can paste it into the official redemption page.',
    reward_points=2, xp_reward=15, token_reward=2,
    task_type='daily', mission_type='daily', daily_limit=1, weekly_limit=null,
    cooldown_seconds=21600, verification_method='server_event',
    conditions='{"event":"redeem_code_copy","entityType":"redeem_code","anyCode":true}'::jsonb,
    priority=30, display_order=30,
    metadata='{"weight":4,"quest_group":"daily-info"}'::jsonb,
    updated_at=clock_timestamp()
where slug='daily-redeem-codes-check';

-- Reuse the assigned task row but retire the article-reading reward.
update public.reward_tasks
set slug='daily-tool-combo',
    title='Use two different FC Mobile tools',
    description='Complete useful actions in two different tools today, such as building your squad and planning a rank up.',
    reward_points=4, xp_reward=30, token_reward=4,
    task_type='daily', mission_type='daily', daily_limit=1, weekly_limit=null,
    cooldown_seconds=21600, verification_method='server_event',
    conditions='{"event":"distinct_tools","target":2}'::jsonb,
    priority=18, display_order=18,
    metadata='{"weight":4,"quest_group":"daily-tools-combo"}'::jsonb,
    updated_at=clock_timestamp()
where slug='daily-article-read';

update public.reward_tasks
set reward_points=4, xp_reward=20, token_reward=4,
    description='Run a market calculation to compare options before committing coins.',
    updated_at=clock_timestamp()
where slug='daily-investment-check';

-- Weekly rewards should feel worthwhile without flooding the token balance.
update public.reward_tasks
set reward_points=12, xp_reward=60, token_reward=12,
    description='Finish five different assigned Daily Quests before the Thursday UTC reset.',
    updated_at=clock_timestamp()
where slug='weekly-quest-rush';

update public.reward_tasks
set title='Use 3 different FC Mobile tools',
    description='Complete useful actions in three different FC Mobile tools during the current weekly cycle.',
    reward_points=10, xp_reward=50, token_reward=10,
    conditions='{"event":"weekly_metric","metric":"distinct_calculators","target":3}'::jsonb,
    metadata='{"weight":4,"quest_group":"weekly-tools"}'::jsonb,
    updated_at=clock_timestamp()
where slug='weekly-tool-tour';

update public.reward_tasks
set slug='weekly-tools-on-three-days',
    title='Use tools on three different days',
    description='Use an FC Mobile tool on three different UTC days before the Thursday reset.',
    reward_points=10, xp_reward=50, token_reward=10,
    task_type='repeatable', mission_type='weekly', daily_limit=null, weekly_limit=1,
    cooldown_seconds=0, verification_method='server_event',
    conditions='{"event":"distinct_calculator_days","target":3}'::jsonb,
    priority=30, display_order=30,
    metadata='{"weight":3,"quest_group":"weekly-tools-days"}'::jsonb,
    updated_at=clock_timestamp()
where slug='weekly-events-watch';

update public.reward_tasks
set slug='weekly-code-copy',
    title='Copy 3 different redeem codes',
    description='Copy three different available redeem codes during the weekly cycle.',
    reward_points=8, xp_reward=35, token_reward=8,
    task_type='repeatable', mission_type='weekly', daily_limit=null, weekly_limit=1,
    cooldown_seconds=0, verification_method='server_event',
    conditions='{"event":"distinct_redeem_codes","target":3}'::jsonb,
    priority=40, display_order=40,
    metadata='{"weight":3,"quest_group":"weekly-codes"}'::jsonb,
    updated_at=clock_timestamp()
where slug='weekly-code-hunter';

-- Fail closed on the new action-based conditions before XP or tokens are awarded.
create or replace function private.enforce_quest_action_conditions()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, private, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_conditions jsonb;
  v_event text;
  v_mission_type text;
  v_target integer;
  v_progress integer := 0;
  v_day_start timestamptz := date_trunc('day', clock_timestamp());
  v_week_start timestamptz := date_trunc('week', clock_timestamp() - interval '3 days') + interval '3 days';
begin
  if new.status <> 'accepted' or new.verification_status <> 'verified' then
    return new;
  end if;

  select t.conditions, t.mission_type
  into v_conditions, v_mission_type
  from public.reward_tasks t
  where t.id = new.task_id;

  if not found then return new; end if;
  v_event := coalesce(v_conditions->>'event','');

  if v_event = 'redeem_code_copy' then
    if not exists (
      select 1
      from public.activity_events ae
      where ae.account_id = new.account_id
        and ae.event_type = 'redeem_code_copy'
        and ae.entity_type = 'redeem_code'
        and ae.source = 'server'
        and ae.created_at >= greatest(
          coalesce(new.started_at, clock_timestamp()) - interval '15 minutes',
          case
            when v_mission_type = 'daily' then v_day_start
            when v_mission_type = 'weekly' then v_week_start
            else '-infinity'::timestamptz
          end
        )
        and ae.created_at <= clock_timestamp()
    ) then
      raise exception using errcode='23514',
        message='Copy an available redeem code before claiming this Quest';
    end if;

  elsif v_event = 'distinct_tools' then
    v_target := greatest(1, coalesce((v_conditions->>'target')::integer, 2));
    select count(distinct ae.entity_id)::integer
    into v_progress
    from public.activity_events ae
    where ae.account_id = new.account_id
      and ae.event_type = 'calculator_use'
      and ae.entity_type = 'calculator'
      and ae.source = 'server'
      and ae.created_at >= v_day_start
      and ae.created_at <= clock_timestamp();

    if coalesce(v_progress,0) < v_target then
      raise exception using errcode='23514',
        message='Use ' || v_target::text || ' different FC Mobile tools today (' ||
          coalesce(v_progress,0)::text || '/' || v_target::text || ')';
    end if;

  elsif v_event = 'distinct_calculator_days' then
    v_target := greatest(1, coalesce((v_conditions->>'target')::integer, 3));
    select count(distinct (ae.created_at at time zone 'UTC')::date)::integer
    into v_progress
    from public.activity_events ae
    where ae.account_id = new.account_id
      and ae.event_type = 'calculator_use'
      and ae.entity_type = 'calculator'
      and ae.source = 'server'
      and ae.created_at >= v_week_start
      and ae.created_at <= clock_timestamp();

    if coalesce(v_progress,0) < v_target then
      raise exception using errcode='23514',
        message='Use an FC Mobile tool on ' || v_target::text || ' different UTC days (' ||
          coalesce(v_progress,0)::text || '/' || v_target::text || ')';
    end if;

  elsif v_event = 'distinct_redeem_codes' then
    v_target := greatest(1, coalesce((v_conditions->>'target')::integer, 3));
    select count(distinct ae.entity_id)::integer
    into v_progress
    from public.activity_events ae
    where ae.account_id = new.account_id
      and ae.event_type = 'redeem_code_copy'
      and ae.entity_type = 'redeem_code'
      and ae.source = 'server'
      and ae.created_at >= v_week_start
      and ae.created_at <= clock_timestamp();

    if coalesce(v_progress,0) < v_target then
      raise exception using errcode='23514',
        message='Copy ' || v_target::text || ' different available redeem codes (' ||
          coalesce(v_progress,0)::text || '/' || v_target::text || ')';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_quest_action_conditions() from public, anon, authenticated;

drop trigger if exists enforce_quest_action_conditions on public.task_attempts;
create trigger enforce_quest_action_conditions
before update of status, verification_status on public.task_attempts
for each row
execute function private.enforce_quest_action_conditions();
