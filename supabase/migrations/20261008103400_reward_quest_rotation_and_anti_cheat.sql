-- Quest rotation, weekly Thursday reset, and server-side anti-farming hardening.
-- Applied to the production Supabase project on 2026-10-08.
-- Daily quests remain lazy-assigned on first account access. Weekly quests use
-- the Thursday 00:00 UTC boundary, so no admin cron/update is required.

create table if not exists public.weekly_quest_assignments (
  account_id uuid not null references public.accounts(id) on delete cascade,
  week_start date not null,
  slot smallint not null check (slot between 1 and 3),
  task_id uuid not null references public.reward_tasks(id) on delete cascade,
  assigned_at timestamptz not null default clock_timestamp(),
  status text not null default 'assigned' check (status in ('assigned','completed','expired')),
  primary key (account_id, week_start, slot),
  unique (account_id, week_start, task_id)
);

create index if not exists weekly_quest_assignments_account_week_idx
  on public.weekly_quest_assignments(account_id, week_start desc);

create index if not exists weekly_quest_assignments_task_week_idx
  on public.weekly_quest_assignments(task_id, week_start desc);

alter table public.weekly_quest_assignments enable row level security;

create or replace function private.pick_weekly_quest_candidates(
  p_account_id uuid,
  p_week_start date
) returns table(task_id uuid)
language sql
security definer
set search_path to pg_catalog, public, private, pg_temp
set "TimeZone" to 'UTC'
as $function$
  with candidates as (
    select
      t.id as task_id,
      coalesce(nullif(t.metadata->>'quest_group',''),'general') as quest_group,
      coalesce(nullif(t.priority,0),100) as priority_rank,
      t.created_at,
      (
        select count(*)
        from public.weekly_quest_assignments q
        where q.account_id=p_account_id
          and q.task_id=t.id
          and q.week_start between (p_week_start-interval '14 days')::date
                               and (p_week_start-interval '7 days')::date
      ) as recent_assignments,
      md5(p_account_id::text||':'||p_week_start::text||':'||t.id::text) as shuffle_key
    from public.reward_tasks t
    where t.enabled
      and t.mission_type='weekly'
      and (t.starts_at is null or t.starts_at <= clock_timestamp())
      and (t.ends_at is null or t.ends_at > clock_timestamp())
      and lower(coalesce(t.metadata->>'quest_group','')) <> 'tournament'
      and t.slug <> 'first-tournament-match'
  ),
  ranked as (
    select *,
      row_number() over (
        partition by quest_group
        order by recent_assignments asc, shuffle_key, priority_rank, created_at, task_id
      ) as group_rank
    from candidates
  ),
  diverse as (
    select task_id, recent_assignments, shuffle_key
    from ranked
    where group_rank=1
    order by recent_assignments asc, shuffle_key
    limit 3
  ),
  fill as (
    select task_id, recent_assignments, shuffle_key
    from ranked
    where task_id not in (select task_id from diverse)
    order by group_rank asc, recent_assignments asc, shuffle_key
    limit 3
  ),
  combined as (
    select task_id, recent_assignments, shuffle_key from diverse
    union all
    select task_id, recent_assignments, shuffle_key from fill
  )
  select task_id
  from combined
  order by recent_assignments asc, shuffle_key
  limit 3;
$function$;

create or replace function private.ensure_weekly_quests(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, private, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_week_start date := (
    date_trunc('week', clock_timestamp() - interval '3 days') + interval '3 days'
  )::date;
  v_count integer;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode='28000', message='Authentication required';
  end if;

  if not exists (
    select 1
    from public.accounts a
    where a.id=p_account_id
      and (a.auth_user_id=auth.uid() or private.can_manage_accounts())
      and a.system_account=false
      and a.state='active'
  ) then
    raise exception using errcode='42501', message='Account is not eligible for quests';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_account_id::text||':weekly:'||v_week_start::text,0)
  );

  select count(*) into v_count
  from public.weekly_quest_assignments
  where account_id=p_account_id and week_start=v_week_start;

  if v_count < 3 then
    insert into public.weekly_quest_assignments(account_id,week_start,slot,task_id)
    select
      p_account_id,
      v_week_start,
      row_number() over(order by q.task_id)::smallint,
      q.task_id
    from private.pick_weekly_quest_candidates(p_account_id,v_week_start) q
    on conflict (account_id,week_start,task_id) do nothing;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'slot',q.slot,
      'task_id',q.task_id,
      'status',q.status,
      'week_start',q.week_start,
      'task',jsonb_build_object(
        'id',t.id,
        'slug',t.slug,
        'title',t.title,
        'description',t.description,
        'xpReward',coalesce(t.xp_reward,0),
        'tokenReward',coalesce(nullif(t.token_reward,0),t.reward_points,0),
        'dailyLimit',t.daily_limit,
        'weeklyLimit',t.weekly_limit,
        'cooldownSeconds',coalesce(t.cooldown_seconds,0),
        'verificationMethod',t.verification_method,
        'conditions',t.conditions
      )
    ) order by q.slot
  ) into v_result
  from public.weekly_quest_assignments q
  join public.reward_tasks t on t.id=q.task_id
  where q.account_id=p_account_id
    and q.week_start=v_week_start;

  return coalesce(v_result,'[]'::jsonb);
end;
$function$;

create or replace function public.ensure_weekly_quests(p_account_id uuid)
returns jsonb
language sql
security definer
set search_path to pg_catalog, public, private, pg_temp
as $function$
  select private.ensure_weekly_quests($1);
$function$;

insert into public.reward_tasks (
  slug,title,description,task_type,reward_points,daily_limit,weekly_limit,completion_limit,
  cooldown_seconds,enabled,mission_type,xp_reward,token_reward,verification_method,
  conditions,priority,display_order,metadata
)
values
(
  'daily-redeem-codes-check',
  'Check the Redeem Codes hub',
  'Check the latest FC Mobile redeem codes and stay on the page long enough for the visit to count.',
  'daily',10,1,null,null,21600,true,'daily',15,10,'server_event',
  '{"page":"/redeem-codes","event":"page_dwell","seconds":8}',30,30,
  '{"weight":4,"quest_group":"daily-info"}'
),
(
  'daily-investment-check',
  'Use the Investment Calculator',
  'Run an actual market calculation to plan your next FC Mobile investment.',
  'daily',12,1,null,null,21600,true,'daily',20,12,'server_event',
  '{"tool":"investment-calculator","event":"calculator_use"}',20,25,
  '{"weight":4,"quest_group":"daily-tools"}'
),
(
  'weekly-quest-rush',
  'Complete 5 Daily Quests this week',
  'Finish five different assigned Daily Quests before the Thursday UTC reset.',
  'repeatable',50,null,1,null,0,true,'weekly',50,50,'server_event',
  '{"event":"weekly_metric","metric":"distinct_daily_quests","target":5}',10,10,
  '{"weight":5,"quest_group":"weekly-progress"}'
),
(
  'weekly-tool-tour',
  'Use 3 different FC Mobile calculators',
  'Use three different calculators during the current weekly cycle.',
  'repeatable',40,null,1,null,0,true,'weekly',40,40,'server_event',
  '{"event":"weekly_metric","metric":"distinct_calculators","target":3}',20,20,
  '{"weight":4,"quest_group":"weekly-tools"}'
),
(
  'weekly-events-watch',
  'Check Events & Reset on 3 days',
  'Visit the Events & Reset hub on three different UTC days this week.',
  'repeatable',35,null,1,null,0,true,'weekly',35,35,'server_event',
  '{"event":"weekly_metric","metric":"distinct_page_days","page":"/events","target":3}',30,30,
  '{"weight":3,"quest_group":"weekly-info"}'
),
(
  'weekly-code-hunter',
  'Check Redeem Codes on 2 days',
  'Check the Redeem Codes hub on two different UTC days this week.',
  'repeatable',30,null,1,null,0,true,'weekly',30,30,'server_event',
  '{"event":"weekly_metric","metric":"distinct_page_days","page":"/redeem-codes","target":2}',40,40,
  '{"weight":3,"quest_group":"weekly-info"}'
)
on conflict (slug) do update set
  title=excluded.title,
  description=excluded.description,
  task_type=excluded.task_type,
  reward_points=excluded.reward_points,
  daily_limit=excluded.daily_limit,
  weekly_limit=excluded.weekly_limit,
  completion_limit=excluded.completion_limit,
  cooldown_seconds=excluded.cooldown_seconds,
  enabled=excluded.enabled,
  mission_type=excluded.mission_type,
  xp_reward=excluded.xp_reward,
  token_reward=excluded.token_reward,
  verification_method=excluded.verification_method,
  conditions=excluded.conditions,
  priority=excluded.priority,
  display_order=excluded.display_order,
  metadata=excluded.metadata,
  updated_at=clock_timestamp();

create or replace function private.start_task(p_task_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path to pg_catalog, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_account_id uuid;
  v_existing_attempt_id uuid;
  v_task record;
  v_attempt_id uuid;
  v_day_start timestamptz;
  v_week_start timestamptz;
begin
  if auth.uid() is null then raise exception using errcode='28000', message='Authentication required'; end if;
  if not private.auth_email_verified() then raise exception using errcode='28000', message='Verified email required'; end if;

  v_account_id := private.auth_account_id();
  if v_account_id is null then raise exception using errcode='28000', message='Account not provisioned'; end if;
  if exists (select 1 from public.accounts a where a.id=v_account_id and a.state<>'active') then
    raise exception using errcode='42501', message='Account is not eligible for tasks';
  end if;

  select t.id,t.enabled,t.starts_at,t.ends_at,t.task_type,t.mission_type
  into v_task
  from public.reward_tasks t
  where t.id=p_task_id;

  if not found then raise exception using errcode='22023', message='Task not found'; end if;
  if not v_task.enabled
     or (v_task.starts_at is not null and v_task.starts_at > pg_catalog.clock_timestamp())
     or (v_task.ends_at is not null and v_task.ends_at <= pg_catalog.clock_timestamp()) then
    raise exception using errcode='22023', message='Task is not currently active';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_account_id::text||':'||p_task_id::text,0)
  );

  v_day_start := date_trunc('day', pg_catalog.clock_timestamp());
  v_week_start := date_trunc('week', pg_catalog.clock_timestamp() - interval '3 days') + interval '3 days';

  if v_task.mission_type='daily' then
    perform private.ensure_daily_quests(v_account_id);
    if not exists (
      select 1 from public.daily_quest_assignments q
      where q.account_id=v_account_id and q.utc_date=v_day_start::date and q.task_id=p_task_id
    ) then
      raise exception using errcode='42501', message='Quest is not in today''s Daily rotation';
    end if;

    select ta.id into v_existing_attempt_id
    from public.task_attempts ta
    where ta.account_id=v_account_id and ta.task_id=p_task_id
      and ta.status='accepted' and ta.completed_at>=v_day_start
    order by ta.completed_at desc limit 1;
    if v_existing_attempt_id is not null then return v_existing_attempt_id; end if;

  elsif v_task.mission_type='weekly' then
    perform private.ensure_weekly_quests(v_account_id);
    if not exists (
      select 1 from public.weekly_quest_assignments q
      where q.account_id=v_account_id and q.week_start=v_week_start::date and q.task_id=p_task_id
    ) then
      raise exception using errcode='42501', message='Quest is not in this week''s rotation';
    end if;

    select ta.id into v_existing_attempt_id
    from public.task_attempts ta
    where ta.account_id=v_account_id and ta.task_id=p_task_id
      and ta.status='accepted' and ta.completed_at>=v_week_start
    order by ta.completed_at desc limit 1;
    if v_existing_attempt_id is not null then return v_existing_attempt_id; end if;
  end if;

  select ta.id into v_existing_attempt_id
  from public.task_attempts ta
  where ta.account_id=v_account_id and ta.task_id=p_task_id and ta.status='started'
    and ta.created_at>=pg_catalog.clock_timestamp()-interval '10 minutes'
  order by ta.created_at desc limit 1;
  if v_existing_attempt_id is not null then return v_existing_attempt_id; end if;

  select ta.id into v_existing_attempt_id
  from public.task_attempts ta
  where ta.idempotency_key=p_idempotency_key and ta.account_id=v_account_id
  limit 1;
  if v_existing_attempt_id is not null then return v_existing_attempt_id; end if;

  begin
    insert into public.task_attempts(account_id,task_id,idempotency_key)
    values(v_account_id,p_task_id,p_idempotency_key)
    returning id into v_attempt_id;
  exception when unique_violation then
    select ta.id into v_attempt_id
    from public.task_attempts ta
    where ta.idempotency_key=p_idempotency_key and ta.account_id=v_account_id
    limit 1;
    if v_attempt_id is null then raise; end if;
  end;

  return v_attempt_id;
end;
$function$;

create or replace function private.complete_task(p_attempt_id uuid, p_client_elapsed_ms integer)
returns bigint
language plpgsql
security definer
set search_path to pg_catalog, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_account_id uuid;
  v_task_id uuid;
  v_task_slug text;
  v_attempt_account_id uuid;
  v_status public.task_attempt_status;
  v_started_at timestamptz;
  v_task_type public.task_type;
  v_mission_type text;
  v_conditions jsonb;
  v_reward_points bigint;
  v_xp_reward bigint;
  v_token_reward bigint;
  v_daily_limit integer;
  v_weekly_limit integer;
  v_completion_limit integer;
  v_cooldown_seconds integer;
  v_verification_method text;
  v_enabled boolean;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_server_elapsed_ms integer;
  v_last_completed_at timestamptz;
  v_existing_reward bigint;
  v_period_start timestamptz;
  v_next_token_key uuid;
  v_week_start timestamptz;
  v_metric_target integer;
  v_metric_progress integer;
begin
  if auth.uid() is null then raise exception using errcode='28000',message='Authentication required'; end if;
  if not private.auth_email_verified() then raise exception using errcode='28000',message='Verified email required'; end if;
  if p_client_elapsed_ms is null or p_client_elapsed_ms<0 or p_client_elapsed_ms>86400000 then
    raise exception using errcode='22023',message='Invalid task timing';
  end if;

  v_account_id:=private.auth_account_id();
  if v_account_id is null then raise exception using errcode='28000',message='Account not provisioned'; end if;
  if exists(select 1 from public.accounts where id=v_account_id and state<>'active') then
    raise exception using errcode='42501',message='Account is not eligible for tasks';
  end if;

  select
    ta.account_id,ta.task_id,ta.status,ta.started_at,
    t.task_type,t.mission_type,t.slug,t.conditions,t.reward_points,t.xp_reward,t.token_reward,t.daily_limit,
    t.weekly_limit,t.completion_limit,t.cooldown_seconds,t.verification_method,t.enabled,t.starts_at,t.ends_at
  into
    v_attempt_account_id,v_task_id,v_status,v_started_at,
    v_task_type,v_mission_type,v_task_slug,v_conditions,v_reward_points,v_xp_reward,v_token_reward,v_daily_limit,
    v_weekly_limit,v_completion_limit,v_cooldown_seconds,v_verification_method,v_enabled,v_starts_at,v_ends_at
  from public.task_attempts ta
  join public.reward_tasks t on t.id=ta.task_id
  where ta.id=p_attempt_id
  for update of ta;

  if not found then raise exception using errcode='22023',message='Task attempt not found'; end if;
  if v_attempt_account_id<>v_account_id then raise exception using errcode='42501',message='Task attempt does not belong to this account'; end if;

  if v_status='accepted' then
    select coalesce(sum(rl.amount),0) into v_existing_reward
    from public.reward_ledger rl
    where rl.task_attempt_id=p_attempt_id and rl.entry_type='task_reward';
    return v_existing_reward;
  end if;

  if v_status<>'started' then raise exception using errcode='22023',message='Task attempt is already finalized'; end if;

  if not v_enabled
     or (v_starts_at is not null and v_starts_at>pg_catalog.clock_timestamp())
     or (v_ends_at is not null and v_ends_at<=pg_catalog.clock_timestamp()) then
    update public.task_attempts
    set status='rejected',verification_status='rejected',completed_at=pg_catalog.clock_timestamp(),
        client_elapsed_ms=p_client_elapsed_ms,
        server_elapsed_ms=greatest(0,floor(extract(epoch from(pg_catalog.clock_timestamp()-v_started_at))*1000)::integer)
    where id=p_attempt_id;
    raise exception using errcode='22023',message='Task is no longer active';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_account_id::text||':'||v_task_id::text,0)
  );

  v_week_start:=date_trunc('week',pg_catalog.clock_timestamp()-interval '3 days')+interval '3 days';

  if v_mission_type='daily' then
    perform private.ensure_daily_quests(v_account_id);
    if not exists (
      select 1 from public.daily_quest_assignments q
      where q.account_id=v_account_id
        and q.utc_date=date_trunc('day',pg_catalog.clock_timestamp())::date
        and q.task_id=v_task_id
    ) then
      raise exception using errcode='42501',message='Quest is not in today''s Daily rotation';
    end if;
    if v_started_at<date_trunc('day',pg_catalog.clock_timestamp()) then
      update public.task_attempts
      set status='rejected',verification_status='rejected',completed_at=pg_catalog.clock_timestamp()
      where id=p_attempt_id;
      raise exception using errcode='23514',message='This Daily Quest expired at the UTC reset';
    end if;

  elsif v_mission_type='weekly' then
    perform private.ensure_weekly_quests(v_account_id);
    if not exists (
      select 1 from public.weekly_quest_assignments q
      where q.account_id=v_account_id and q.week_start=v_week_start::date and q.task_id=v_task_id
    ) then
      raise exception using errcode='42501',message='Quest is not in this week''s rotation';
    end if;
    if v_started_at<v_week_start then
      update public.task_attempts
      set status='rejected',verification_status='rejected',completed_at=pg_catalog.clock_timestamp()
      where id=p_attempt_id;
      raise exception using errcode='23514',message='This Weekly Quest expired at the Thursday UTC reset';
    end if;
  end if;

  v_server_elapsed_ms:=greatest(0,floor(extract(epoch from(pg_catalog.clock_timestamp()-v_started_at))*1000)::integer);
  if p_client_elapsed_ms>0 and p_client_elapsed_ms>v_server_elapsed_ms+5000 then
    raise exception using errcode='22023',message='Invalid task timing';
  end if;

  if v_task_type='one_time' and exists(
    select 1 from public.task_attempts
    where account_id=v_account_id and task_id=v_task_id and status='accepted'
  ) then
    update public.task_attempts
    set status='rejected',verification_status='rejected',completed_at=pg_catalog.clock_timestamp(),
        client_elapsed_ms=p_client_elapsed_ms,server_elapsed_ms=v_server_elapsed_ms
    where id=p_attempt_id;
    raise exception using errcode='23505',message='Task already completed';
  end if;

  if v_completion_limit is not null and (
    select count(*) from public.task_attempts
    where account_id=v_account_id and task_id=v_task_id and status='accepted'
  )>=v_completion_limit then
    update public.task_attempts
    set status='rejected',verification_status='rejected',completed_at=pg_catalog.clock_timestamp(),
        client_elapsed_ms=p_client_elapsed_ms,server_elapsed_ms=v_server_elapsed_ms
    where id=p_attempt_id;
    raise exception using errcode='23514',message='Task completion limit reached';
  end if;

  if v_mission_type='daily' and v_daily_limit is not null then
    v_period_start:=date_trunc('day',pg_catalog.clock_timestamp());
    if (
      select count(*) from public.task_attempts
      where account_id=v_account_id and task_id=v_task_id and status='accepted' and completed_at>=v_period_start
    )>=v_daily_limit then
      update public.task_attempts
      set status='rejected',verification_status='rejected',completed_at=pg_catalog.clock_timestamp(),
          client_elapsed_ms=p_client_elapsed_ms,server_elapsed_ms=v_server_elapsed_ms
      where id=p_attempt_id;
      raise exception using errcode='23514',message='Daily Quest limit reached';
    end if;
  end if;

  if v_mission_type='weekly' and v_weekly_limit is not null then
    if (
      select count(*) from public.task_attempts
      where account_id=v_account_id and task_id=v_task_id and status='accepted' and completed_at>=v_week_start
    )>=v_weekly_limit then
      update public.task_attempts
      set status='rejected',verification_status='rejected',completed_at=pg_catalog.clock_timestamp(),
          client_elapsed_ms=p_client_elapsed_ms,server_elapsed_ms=v_server_elapsed_ms
      where id=p_attempt_id;
      raise exception using errcode='23514',message='Weekly Quest limit reached';
    end if;
  end if;

  if v_cooldown_seconds>0 then
    select max(completed_at) into v_last_completed_at
    from public.task_attempts
    where account_id=v_account_id and task_id=v_task_id and status='accepted';
    if v_last_completed_at is not null
       and v_last_completed_at+make_interval(secs=>v_cooldown_seconds)>pg_catalog.clock_timestamp() then
      update public.task_attempts
      set status='rejected',verification_status='rejected',completed_at=pg_catalog.clock_timestamp(),
          client_elapsed_ms=p_client_elapsed_ms,server_elapsed_ms=v_server_elapsed_ms
      where id=p_attempt_id;
      raise exception using errcode='23514',message='Task cooldown is active';
    end if;
  end if;

  if v_mission_type='weekly' and coalesce(v_conditions->>'event','')='weekly_metric' then
    v_metric_target:=greatest(1,coalesce((v_conditions->>'target')::integer,1));
    case coalesce(v_conditions->>'metric','')
      when 'distinct_daily_quests' then
        select count(distinct ta.task_id)::integer into v_metric_progress
        from public.task_attempts ta
        join public.reward_tasks rt on rt.id=ta.task_id
        where ta.account_id=v_account_id
          and ta.status='accepted'
          and rt.mission_type='daily'
          and ta.completed_at>=v_week_start;
      when 'distinct_calculators' then
        select count(distinct ae.entity_id)::integer into v_metric_progress
        from public.activity_events ae
        where ae.account_id=v_account_id
          and ae.event_type='calculator_use'
          and ae.entity_type='calculator'
          and ae.source='server'
          and ae.created_at>=v_week_start;
      when 'distinct_page_days' then
        select count(distinct (ae.created_at at time zone 'UTC')::date)::integer into v_metric_progress
        from public.activity_events ae
        where ae.account_id=v_account_id
          and ae.event_type='page_dwell'
          and ae.entity_type='page'
          and ae.entity_id=coalesce(v_conditions->>'page','')
          and ae.source='server'
          and ae.created_at>=v_week_start;
      else
        v_metric_progress:=0;
    end case;

    if coalesce(v_metric_progress,0)<v_metric_target then
      raise exception using errcode='23514',
        message='Weekly Quest progress is '||coalesce(v_metric_progress,0)::text||'/'||v_metric_target::text;
    end if;
  end if;

  if v_task_slug='reach-level-3' then
    if coalesce((select level from public.account_progress where account_id=v_account_id limit 1),1)<3 then
      raise exception using errcode='23514',message='Reach Level 3 before claiming this mission';
    end if;
  elsif v_task_slug='build-three-day-streak' then
    if coalesce((select current_streak from public.account_progress where account_id=v_account_id limit 1),0)<3 then
      raise exception using errcode='23514',message='Build a 3-day activity streak before claiming this mission';
    end if;
  elsif v_task_slug='complete-three-mission-types' then
    if (select count(distinct task_id) from public.task_attempts where account_id=v_account_id and status='accepted')<3 then
      raise exception using errcode='23514',message='Complete 3 different missions before claiming this mission';
    end if;
  elsif v_task_slug='complete-five-missions' then
    if (select count(distinct task_id) from public.task_attempts where account_id=v_account_id and status='accepted')<5 then
      raise exception using errcode='23514',message='Complete 5 different missions before claiming this mission';
    end if;
  elsif v_task_slug='approved-community-contribution' then
    if not exists (
      select 1 from public.community_submissions
      where account_id=v_account_id and status='approved'
    ) then
      raise exception using errcode='23514',message='An approved community contribution is required before claiming this mission';
    end if;
  end if;

  if coalesce(v_conditions->>'event','') in ('page_dwell','calculator_use') then
    if not exists (
      select 1 from public.activity_events ae
      where ae.account_id=v_account_id
        and ae.event_type=v_conditions->>'event'
        and ae.entity_type=case when v_conditions->>'event'='page_dwell' then 'page' else 'calculator' end
        and ae.entity_id=coalesce(v_conditions->>'page',v_conditions->>'tool','')
        and ae.source='server'
        and ae.created_at>=greatest(
          v_started_at-interval '15 minutes',
          case when v_mission_type='daily' then date_trunc('day',pg_catalog.clock_timestamp()) else v_week_start end
        )
        and ae.created_at<=pg_catalog.clock_timestamp()
    ) then
      raise exception using errcode='23514',message='Complete the qualifying activity first, then check this Quest again';
    end if;
  end if;

  if coalesce(v_verification_method,'server_event') in ('moderated','manual') then
    update public.task_attempts
    set status='accepted',verification_status='pending',
        completed_at=pg_catalog.clock_timestamp(),
        client_elapsed_ms=p_client_elapsed_ms,server_elapsed_ms=v_server_elapsed_ms
    where id=p_attempt_id;

    insert into public.activity_events(
      account_id,event_type,entity_type,entity_id,metadata,source,idempotency_key
    )
    values(
      v_account_id,'mission_submitted','mission',v_task_id::text,
      jsonb_build_object('task_attempt_id',p_attempt_id),'server',
      md5('activity-task-pending:'||p_attempt_id::text)::uuid
    )
    on conflict(idempotency_key) do nothing;
    return 0;
  end if;

  if coalesce(v_xp_reward,0)>0 then
    perform private.record_xp(
      v_account_id,v_xp_reward,'mission',p_attempt_id::text,'Mission XP reward',
      md5('xp-task:'||p_attempt_id::text)::uuid,v_account_id,
      jsonb_build_object('task_id',v_task_id,'task_attempt_id',p_attempt_id),null
    );
  end if;

  update public.task_attempts
  set status='accepted',verification_status='verified',
      completed_at=pg_catalog.clock_timestamp(),
      client_elapsed_ms=p_client_elapsed_ms,server_elapsed_ms=v_server_elapsed_ms
  where id=p_attempt_id;

  v_token_reward:=coalesce(v_token_reward,0);
  if v_token_reward=0 then v_token_reward:=coalesce(v_reward_points,0); end if;
  if v_token_reward>0 then
    v_next_token_key:=md5('token-task:'||p_attempt_id::text)::uuid;
    insert into public.reward_ledger(
      account_id,entry_type,amount,task_attempt_id,idempotency_key,
      created_by_account_id,memo,metadata
    )
    values(
      v_account_id,'task_reward',v_token_reward,p_attempt_id,v_next_token_key,v_account_id,
      'Mission token reward',jsonb_build_object('task_id',v_task_id)
    )
    on conflict(task_attempt_id) where task_attempt_id is not null and entry_type='task_reward'
    do nothing;
  end if;

  insert into public.activity_events(
    account_id,event_type,entity_type,entity_id,metadata,source,idempotency_key
  )
  values(
    v_account_id,'mission_completed','mission',v_task_id::text,
    jsonb_build_object(
      'task_attempt_id',p_attempt_id,
      'xp_reward',coalesce(v_xp_reward,0),
      'token_reward',coalesce(v_token_reward,0)
    ),
    'server',md5('activity-task:'||p_attempt_id::text)::uuid
  )
  on conflict(idempotency_key) do nothing;

  return coalesce(v_token_reward,0);
end;
$function$;

revoke execute on function public.ensure_daily_quests(uuid) from public, anon;
grant execute on function public.ensure_daily_quests(uuid) to authenticated;
revoke execute on function public.ensure_weekly_quests(uuid) from public, anon;
grant execute on function public.ensure_weekly_quests(uuid) to authenticated;
