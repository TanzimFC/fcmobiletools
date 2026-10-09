-- Survey system for FCMobiletools accounts.
--
-- Run this file once in the Supabase SQL editor. It is safe to run again.
-- It only creates new objects. It does not change any existing table or function.
--
-- Access model: every table here has row level security enabled with no policies,
-- and every function is executable by service_role only. The Cloudflare Worker is
-- the only caller (it already authenticates the user and uses SUPABASE_SECRET_KEY).
--
-- Rewards: payouts use the same insert shapes the admin API already uses for
-- xp_transactions and reward_ledger (source/entry type 'admin_adjustment', created
-- by the fcmt-system account). The survey id and response id are stored in metadata
-- so survey payouts can always be told apart from manual adjustments.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 400),
  intro text not null default '' check (char_length(intro) <= 1200),
  status text not null default 'draft' check (status in ('draft','live','closed','archived')),
  reward_xp integer not null default 0 check (reward_xp between 0 and 100000),
  reward_tokens integer not null default 0 check (reward_tokens between 0 and 100000),
  anonymous boolean not null default false,
  max_responses integer check (max_responses is null or max_responses >= 1),
  min_seconds integer check (min_seconds is null or min_seconds between 0 and 3600),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  position smallint not null check (position between 1 and 30),
  question_type text not null check (question_type in ('single','multiple','yes_no','rating','text')),
  prompt text not null check (char_length(prompt) between 3 and 300),
  help_text text not null default '' check (char_length(help_text) <= 300),
  required boolean not null default true,
  options jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  unique (survey_id, position)
);

create table if not exists public.survey_sessions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'open' check (status in ('open','submitted','expired')),
  honesty_ack_at timestamptz not null,
  started_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  submitted_at timestamptz
);

create unique index if not exists survey_sessions_one_open_idx
  on public.survey_sessions(survey_id, account_id) where status = 'open';
create index if not exists survey_sessions_account_idx
  on public.survey_sessions(account_id);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  session_id uuid references public.survey_sessions(id) on delete set null,
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  reward_xp integer not null default 0,
  reward_tokens integer not null default 0,
  submitted_at timestamptz not null default clock_timestamp(),
  unique (survey_id, account_id)
);

create index if not exists survey_responses_survey_idx
  on public.survey_responses(survey_id, submitted_at desc);
create index if not exists survey_responses_account_idx
  on public.survey_responses(account_id, submitted_at desc);

create table if not exists public.survey_answers (
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  value jsonb not null,
  primary key (response_id, question_id)
);

create index if not exists survey_answers_question_idx
  on public.survey_answers(question_id);

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_sessions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;

revoke all on table public.surveys from anon, authenticated;
revoke all on table public.survey_questions from anon, authenticated;
revoke all on table public.survey_sessions from anon, authenticated;
revoke all on table public.survey_responses from anon, authenticated;
revoke all on table public.survey_answers from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Member side: list, start, submit
-- ---------------------------------------------------------------------------

create or replace function public.server_list_surveys(p_account_id uuid, p_slug text default null)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_items jsonb;
  v_summary jsonb;
begin
  if not exists (
    select 1 from public.accounts a where a.id = p_account_id and a.system_account = false
  ) then
    raise exception using errcode = '42501', message = 'Account not found.';
  end if;

  select coalesce(jsonb_agg(x.item order by x.sort_group, x.sort_date desc), '[]'::jsonb)
  into v_items
  from (
    select
      jsonb_build_object(
        'id', s.id,
        'slug', s.slug,
        'title', s.title,
        'description', s.description,
        'intro', s.intro,
        'rewardXp', s.reward_xp,
        'rewardTokens', s.reward_tokens,
        'anonymous', s.anonymous,
        'questionCount', qc.n,
        'estimatedMinutes', greatest(1, ceil(qc.n * 0.5))::int,
        'startsAt', s.starts_at,
        'endsAt', s.ends_at,
        'maxResponses', s.max_responses,
        'spotsLeft', case when s.max_responses is null then null
                          else greatest(0, s.max_responses - rc.n) end,
        'state', case
          when r.id is not null then 'completed'
          when s.starts_at is not null and s.starts_at > v_now then 'upcoming'
          when s.max_responses is not null and rc.n >= s.max_responses then 'full'
          else 'available' end,
        'completedAt', r.submitted_at,
        'earnedXp', r.reward_xp,
        'earnedTokens', r.reward_tokens
      ) as item,
      case when r.id is null then 0 else 1 end as sort_group,
      coalesce(r.submitted_at, s.created_at) as sort_date
    from public.surveys s
    left join public.survey_responses r
      on r.survey_id = s.id and r.account_id = p_account_id
    cross join lateral (
      select count(*)::int as n from public.survey_questions q where q.survey_id = s.id
    ) qc
    cross join lateral (
      select count(*)::int as n from public.survey_responses x where x.survey_id = s.id
    ) rc
    where (p_slug is null or s.slug = p_slug)
      and (
        r.id is not null
        or (s.status = 'live' and (s.ends_at is null or s.ends_at > v_now) and qc.n > 0)
      )
  ) x;

  select jsonb_build_object(
    'completed', count(*),
    'xpEarned', coalesce(sum(r.reward_xp), 0),
    'tokensEarned', coalesce(sum(r.reward_tokens), 0)
  )
  into v_summary
  from public.survey_responses r
  where r.account_id = p_account_id;

  return jsonb_build_object('surveys', v_items, 'summary', v_summary);
end;
$function$;

create or replace function public.server_start_survey(
  p_account_id uuid,
  p_survey_id uuid,
  p_ack boolean
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_state text;
  v_survey public.surveys%rowtype;
  v_session public.survey_sessions%rowtype;
  v_found boolean;
  v_questions jsonb;
begin
  if p_ack is distinct from true then
    raise exception using errcode = '22023',
      message = 'Please confirm the honesty notice before starting.';
  end if;

  select a.state into v_state
  from public.accounts a
  where a.id = p_account_id and a.system_account = false;
  if not found then
    raise exception using errcode = '42501', message = 'Account not found.';
  end if;
  if v_state <> 'active' then
    raise exception using errcode = '42501', message = 'Your account cannot take surveys right now.';
  end if;

  select * into v_survey from public.surveys where id = p_survey_id;
  if not found or v_survey.status <> 'live' then
    raise exception using errcode = '22023', message = 'This survey is not open.';
  end if;
  if v_survey.starts_at is not null and v_survey.starts_at > v_now then
    raise exception using errcode = '22023', message = 'This survey has not opened yet.';
  end if;
  if v_survey.ends_at is not null and v_survey.ends_at <= v_now then
    raise exception using errcode = '22023', message = 'This survey has closed.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('survey-start:' || p_account_id::text || ':' || p_survey_id::text, 0)
  );

  if exists (
    select 1 from public.survey_responses r
    where r.survey_id = p_survey_id and r.account_id = p_account_id
  ) then
    raise exception using errcode = '23505', message = 'You have already completed this survey.';
  end if;

  if v_survey.max_responses is not null and (
    select count(*) from public.survey_responses r where r.survey_id = p_survey_id
  ) >= v_survey.max_responses then
    raise exception using errcode = '23514', message = 'This survey has reached its response limit.';
  end if;

  if not exists (select 1 from public.survey_questions q where q.survey_id = p_survey_id) then
    raise exception using errcode = '22023', message = 'This survey is not open.';
  end if;

  update public.survey_sessions
  set status = 'expired'
  where survey_id = p_survey_id and account_id = p_account_id
    and status = 'open' and expires_at <= v_now;

  select * into v_session
  from public.survey_sessions s
  where s.survey_id = p_survey_id and s.account_id = p_account_id and s.status = 'open'
  limit 1;
  v_found := found;

  if not v_found then
    insert into public.survey_sessions(survey_id, account_id, honesty_ack_at, started_at, expires_at)
    values (p_survey_id, p_account_id, v_now, v_now, v_now + interval '2 hours')
    returning * into v_session;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'position', q.position,
      'type', q.question_type,
      'prompt', q.prompt,
      'helpText', q.help_text,
      'required', q.required,
      'options', q.options,
      'config', q.config
    ) order by q.position
  ), '[]'::jsonb)
  into v_questions
  from public.survey_questions q
  where q.survey_id = p_survey_id;

  return jsonb_build_object(
    'sessionId', v_session.id,
    'startedAt', v_session.started_at,
    'expiresAt', v_session.expires_at,
    'survey', jsonb_build_object(
      'id', v_survey.id,
      'slug', v_survey.slug,
      'title', v_survey.title,
      'rewardXp', v_survey.reward_xp,
      'rewardTokens', v_survey.reward_tokens,
      'anonymous', v_survey.anonymous
    ),
    'questions', v_questions
  );
end;
$function$;

create or replace function public.server_submit_survey(
  p_account_id uuid,
  p_survey_id uuid,
  p_session_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_state text;
  v_survey public.surveys%rowtype;
  v_session public.survey_sessions%rowtype;
  v_existing public.survey_responses%rowtype;
  v_response_id uuid;
  v_actor uuid;
  v_elapsed integer;
  v_min integer;
  v_qcount integer;
  v_q public.survey_questions%rowtype;
  v_val jsonb;
  v_text text;
  v_num numeric;
  v_n integer;
  v_max integer;
  v_clean jsonb := '{}'::jsonb;
begin
  select a.state into v_state
  from public.accounts a
  where a.id = p_account_id and a.system_account = false;
  if not found then
    raise exception using errcode = '42501', message = 'Account not found.';
  end if;
  if v_state <> 'active' then
    raise exception using errcode = '42501', message = 'Your account cannot take surveys right now.';
  end if;

  -- One submission at a time per survey keeps the response cap exact.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('survey-submit:' || p_survey_id::text, 0)
  );

  -- A repeated submit returns the stored result instead of paying twice.
  select * into v_existing
  from public.survey_responses r
  where r.survey_id = p_survey_id and r.account_id = p_account_id;
  if found then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'responseId', v_existing.id,
      'rewardXp', v_existing.reward_xp,
      'rewardTokens', v_existing.reward_tokens,
      'submittedAt', v_existing.submitted_at
    );
  end if;

  select * into v_survey from public.surveys where id = p_survey_id;
  if not found or v_survey.status <> 'live' then
    raise exception using errcode = '22023', message = 'This survey is no longer open.';
  end if;
  if v_survey.starts_at is not null and v_survey.starts_at > v_now then
    raise exception using errcode = '22023', message = 'This survey has not opened yet.';
  end if;
  if v_survey.ends_at is not null and v_survey.ends_at <= v_now then
    raise exception using errcode = '22023', message = 'This survey closed before you submitted.';
  end if;
  if v_survey.max_responses is not null and (
    select count(*) from public.survey_responses r where r.survey_id = p_survey_id
  ) >= v_survey.max_responses then
    raise exception using errcode = '23514', message = 'This survey has reached its response limit.';
  end if;

  select * into v_session
  from public.survey_sessions s
  where s.id = p_session_id and s.survey_id = p_survey_id and s.account_id = p_account_id
  for update;
  if not found then
    raise exception using errcode = '22023',
      message = 'We could not find your survey session. Start the survey again.';
  end if;
  if v_session.status <> 'open' or v_session.expires_at <= v_now then
    raise exception using errcode = '22023',
      message = 'Your survey session expired. Start the survey again.';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception using errcode = '22023', message = 'Your answers could not be read.';
  end if;
  if jsonb_array_length(p_answers) > 60 then
    raise exception using errcode = '22023', message = 'Your answers could not be read.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_answers) a
    where jsonb_typeof(a) <> 'object'
       or not exists (
         select 1 from public.survey_questions q
         where q.survey_id = p_survey_id and q.id::text = (a ->> 'questionId')
       )
  ) then
    raise exception using errcode = '22023',
      message = 'Your answers do not match this survey. Reload the page and try again.';
  end if;

  if (select count(*) from jsonb_array_elements(p_answers))
     <> (select count(distinct a ->> 'questionId') from jsonb_array_elements(p_answers) a) then
    raise exception using errcode = '22023', message = 'Your answers could not be read.';
  end if;

  select count(*)::int into v_qcount from public.survey_questions q where q.survey_id = p_survey_id;

  for v_q in
    select * from public.survey_questions q where q.survey_id = p_survey_id order by q.position
  loop
    select a -> 'value' into v_val
    from jsonb_array_elements(p_answers) a
    where a ->> 'questionId' = v_q.id::text
    limit 1;

    if v_val is null or jsonb_typeof(v_val) = 'null' then
      if v_q.required then
        raise exception using errcode = '22023',
          message = 'Question ' || v_q.position || ' needs an answer.';
      end if;
      continue;
    end if;

    if v_q.question_type = 'single' then
      if jsonb_typeof(v_val) <> 'string' then
        raise exception using errcode = '22023', message = 'Question ' || v_q.position || ' has an invalid answer.';
      end if;
      if not exists (
        select 1 from jsonb_array_elements(v_q.options) o where o ->> 'id' = (v_val #>> '{}')
      ) then
        raise exception using errcode = '22023', message = 'Question ' || v_q.position || ' has an invalid answer.';
      end if;

    elsif v_q.question_type = 'multiple' then
      if jsonb_typeof(v_val) <> 'array' then
        raise exception using errcode = '22023', message = 'Question ' || v_q.position || ' has an invalid answer.';
      end if;
      v_n := jsonb_array_length(v_val);
      if v_n = 0 then
        if v_q.required then
          raise exception using errcode = '22023',
            message = 'Question ' || v_q.position || ' needs an answer.';
        end if;
        continue;
      end if;
      v_max := coalesce((v_q.config ->> 'maxSelect')::int, jsonb_array_length(v_q.options));
      if v_n > v_max then
        raise exception using errcode = '22023',
          message = 'Question ' || v_q.position || ' allows at most ' || v_max || ' choices.';
      end if;
      if exists (
        select 1 from jsonb_array_elements(v_val) e
        where jsonb_typeof(e) <> 'string'
           or not exists (
             select 1 from jsonb_array_elements(v_q.options) o where o ->> 'id' = (e #>> '{}')
           )
      ) then
        raise exception using errcode = '22023', message = 'Question ' || v_q.position || ' has an invalid answer.';
      end if;
      if (select count(distinct e #>> '{}') from jsonb_array_elements(v_val) e) <> v_n then
        raise exception using errcode = '22023', message = 'Question ' || v_q.position || ' has an invalid answer.';
      end if;

    elsif v_q.question_type = 'yes_no' then
      if jsonb_typeof(v_val) <> 'boolean' then
        raise exception using errcode = '22023', message = 'Question ' || v_q.position || ' has an invalid answer.';
      end if;

    elsif v_q.question_type = 'rating' then
      if jsonb_typeof(v_val) <> 'number' then
        raise exception using errcode = '22023', message = 'Question ' || v_q.position || ' has an invalid answer.';
      end if;
      v_num := (v_val #>> '{}')::numeric;
      v_max := coalesce((v_q.config ->> 'max')::int, 5);
      if v_num <> trunc(v_num) or v_num < 1 or v_num > v_max then
        raise exception using errcode = '22023', message = 'Question ' || v_q.position || ' has an invalid answer.';
      end if;
      v_val := to_jsonb(trunc(v_num)::int);

    elsif v_q.question_type = 'text' then
      if jsonb_typeof(v_val) <> 'string' then
        raise exception using errcode = '22023', message = 'Question ' || v_q.position || ' has an invalid answer.';
      end if;
      v_text := btrim(regexp_replace(v_val #>> '{}', '[\x01-\x08\x0b\x0c\x0e-\x1f]', '', 'g'));
      if v_text = '' then
        if v_q.required then
          raise exception using errcode = '22023',
            message = 'Question ' || v_q.position || ' needs an answer.';
        end if;
        continue;
      end if;
      v_max := coalesce((v_q.config ->> 'maxLength')::int, 1000);
      if char_length(v_text) > v_max then
        raise exception using errcode = '22023',
          message = 'Question ' || v_q.position || ' is limited to ' || v_max || ' characters.';
      end if;
      if v_q.required and char_length(v_text) < 2 then
        raise exception using errcode = '22023',
          message = 'Question ' || v_q.position || ' needs a real answer.';
      end if;
      v_val := to_jsonb(v_text);
    end if;

    v_clean := v_clean || jsonb_build_object(v_q.id::text, v_val);
  end loop;

  if v_clean = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Answer at least one question before submitting.';
  end if;

  v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_session.started_at)))::int);
  v_min := coalesce(v_survey.min_seconds, greatest(5, least(180, v_qcount * 3)));
  if v_elapsed < v_min then
    raise exception using errcode = '23514',
      message = 'That was too quick to be a careful answer. Take your time and submit again.';
  end if;

  if v_survey.reward_xp > 0 or v_survey.reward_tokens > 0 then
    select a.id into v_actor
    from public.accounts a
    where a.system_account = true and a.username = 'fcmt-system'
    limit 1;
    if v_actor is null then
      raise exception using errcode = 'P0001', message = 'The reward system is not configured yet.';
    end if;
  end if;

  insert into public.survey_responses(
    survey_id, account_id, session_id, elapsed_seconds, reward_xp, reward_tokens, submitted_at
  )
  values (
    p_survey_id, p_account_id, v_session.id, v_elapsed,
    v_survey.reward_xp, v_survey.reward_tokens, v_now
  )
  returning id into v_response_id;

  insert into public.survey_answers(response_id, question_id, value)
  select v_response_id, e.key::uuid, e.value
  from jsonb_each(v_clean) e;

  update public.survey_sessions
  set status = 'submitted', submitted_at = v_now
  where id = v_session.id;

  if v_survey.reward_xp > 0 then
    insert into public.xp_transactions(
      account_id, amount, source_type, source_id, reason,
      idempotency_key, created_by_account_id, metadata
    )
    values (
      p_account_id, v_survey.reward_xp, 'admin_adjustment', v_response_id,
      'Survey reward: ' || v_survey.title,
      md5('survey-xp:' || v_response_id::text)::uuid, v_actor,
      jsonb_build_object('kind', 'survey_reward', 'survey_id', v_survey.id,
                         'survey_response_id', v_response_id)
    );
  end if;

  if v_survey.reward_tokens > 0 then
    insert into public.reward_ledger(
      account_id, entry_type, amount, idempotency_key,
      created_by_account_id, memo, metadata
    )
    values (
      p_account_id, 'admin_adjustment', v_survey.reward_tokens,
      md5('survey-tokens:' || v_response_id::text)::uuid, v_actor,
      'Survey reward: ' || v_survey.title,
      jsonb_build_object('kind', 'survey_reward', 'survey_id', v_survey.id,
                         'survey_response_id', v_response_id)
    );
  end if;

  -- Activity feed entry. Best effort: if the activity table rejects this event
  -- type the survey and its rewards are still saved.
  begin
    insert into public.activity_events(
      account_id, event_type, entity_type, entity_id, metadata, source, idempotency_key
    )
    values (
      p_account_id, 'survey_completed', 'survey', v_survey.id::text,
      jsonb_build_object('survey_response_id', v_response_id,
                         'title', v_survey.title,
                         'xp_reward', v_survey.reward_xp,
                         'token_reward', v_survey.reward_tokens),
      'server', md5('activity-survey:' || v_response_id::text)::uuid
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'responseId', v_response_id,
    'rewardXp', v_survey.reward_xp,
    'rewardTokens', v_survey.reward_tokens,
    'submittedAt', v_now
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Admin side: list, read, save, status, delete, results, responses
-- ---------------------------------------------------------------------------

create or replace function public.server_admin_list_surveys()
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_items jsonb;
  v_totals jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'slug', s.slug,
      'title', s.title,
      'description', s.description,
      'status', s.status,
      'rewardXp', s.reward_xp,
      'rewardTokens', s.reward_tokens,
      'anonymous', s.anonymous,
      'maxResponses', s.max_responses,
      'startsAt', s.starts_at,
      'endsAt', s.ends_at,
      'createdAt', s.created_at,
      'updatedAt', s.updated_at,
      'questionCount', qc.n,
      'responseCount', rc.n,
      'xpPaid', rc.xp,
      'tokensPaid', rc.tk,
      'lastResponseAt', rc.last_at
    ) order by s.created_at desc
  ), '[]'::jsonb)
  into v_items
  from public.surveys s
  cross join lateral (
    select count(*)::int as n from public.survey_questions q where q.survey_id = s.id
  ) qc
  cross join lateral (
    select count(*)::int as n,
           coalesce(sum(r.reward_xp), 0)::bigint as xp,
           coalesce(sum(r.reward_tokens), 0)::bigint as tk,
           max(r.submitted_at) as last_at
    from public.survey_responses r where r.survey_id = s.id
  ) rc;

  select jsonb_build_object(
    'surveys', (select count(*) from public.surveys),
    'live', (select count(*) from public.surveys where status = 'live'),
    'responses', (select count(*) from public.survey_responses),
    'xpPaid', (select coalesce(sum(reward_xp), 0) from public.survey_responses),
    'tokensPaid', (select coalesce(sum(reward_tokens), 0) from public.survey_responses)
  ) into v_totals;

  return jsonb_build_object('surveys', v_items, 'totals', v_totals);
end;
$function$;

create or replace function public.server_admin_get_survey(p_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_s public.surveys%rowtype;
  v_questions jsonb;
  v_responses integer;
begin
  select * into v_s from public.surveys where id = p_survey_id;
  if not found then
    raise exception using errcode = '22023', message = 'Survey not found.';
  end if;

  select count(*)::int into v_responses
  from public.survey_responses r where r.survey_id = p_survey_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'position', q.position,
      'type', q.question_type,
      'prompt', q.prompt,
      'helpText', q.help_text,
      'required', q.required,
      'options', q.options,
      'config', q.config
    ) order by q.position
  ), '[]'::jsonb)
  into v_questions
  from public.survey_questions q where q.survey_id = p_survey_id;

  return jsonb_build_object(
    'survey', jsonb_build_object(
      'id', v_s.id,
      'slug', v_s.slug,
      'title', v_s.title,
      'description', v_s.description,
      'intro', v_s.intro,
      'status', v_s.status,
      'rewardXp', v_s.reward_xp,
      'rewardTokens', v_s.reward_tokens,
      'anonymous', v_s.anonymous,
      'maxResponses', v_s.max_responses,
      'minSeconds', v_s.min_seconds,
      'startsAt', v_s.starts_at,
      'endsAt', v_s.ends_at,
      'createdAt', v_s.created_at,
      'updatedAt', v_s.updated_at
    ),
    'questions', v_questions,
    'responseCount', v_responses,
    'questionsLocked', v_responses > 0
  );
end;
$function$;

create or replace function public.server_admin_save_survey(
  p_survey_id uuid,
  p_survey jsonb,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_id uuid := p_survey_id;
  v_existing public.surveys%rowtype;
  v_slug text;
  v_title text;
  v_desc text;
  v_intro text;
  v_status text;
  v_xp integer;
  v_tokens integer;
  v_anon boolean;
  v_max integer;
  v_min integer;
  v_starts timestamptz;
  v_ends timestamptz;
  v_locked boolean := false;
  v_q jsonb;
  v_pos integer := 0;
  v_type text;
  v_prompt text;
  v_help text;
  v_req boolean;
  v_opts jsonb;
  v_opt jsonb;
  v_clean_opts jsonb;
  v_ids text[];
  v_oid text;
  v_label text;
  v_cfg jsonb;
  v_n integer;
  v_qcount integer;
begin
  if p_survey is null or jsonb_typeof(p_survey) <> 'object' then
    raise exception using errcode = '22023', message = 'Survey details are missing.';
  end if;

  v_title := btrim(coalesce(p_survey ->> 'title', ''));
  v_desc := btrim(coalesce(p_survey ->> 'description', ''));
  v_intro := btrim(coalesce(p_survey ->> 'intro', ''));
  v_status := coalesce(p_survey ->> 'status', 'draft');
  v_xp := coalesce((p_survey ->> 'rewardXp')::int, 0);
  v_tokens := coalesce((p_survey ->> 'rewardTokens')::int, 0);
  v_anon := coalesce((p_survey ->> 'anonymous')::boolean, false);
  v_max := nullif(p_survey ->> 'maxResponses', '')::int;
  v_min := nullif(p_survey ->> 'minSeconds', '')::int;
  v_starts := nullif(p_survey ->> 'startsAt', '')::timestamptz;
  v_ends := nullif(p_survey ->> 'endsAt', '')::timestamptz;

  if char_length(v_title) < 3 or char_length(v_title) > 120 then
    raise exception using errcode = '22023', message = 'The title needs 3 to 120 characters.';
  end if;
  if char_length(v_desc) > 400 then
    raise exception using errcode = '22023', message = 'The short description is limited to 400 characters.';
  end if;
  if char_length(v_intro) > 1200 then
    raise exception using errcode = '22023', message = 'The intro is limited to 1200 characters.';
  end if;
  if v_status not in ('draft','live','closed','archived') then
    raise exception using errcode = '22023', message = 'Invalid survey status.';
  end if;
  if v_xp < 0 or v_xp > 100000 or v_tokens < 0 or v_tokens > 100000 then
    raise exception using errcode = '22023', message = 'Rewards must be between 0 and 100000.';
  end if;
  if v_max is not null and v_max < 1 then
    raise exception using errcode = '22023', message = 'The response limit must be at least 1.';
  end if;
  if v_min is not null and (v_min < 0 or v_min > 3600) then
    raise exception using errcode = '22023', message = 'Minimum time must be between 0 and 3600 seconds.';
  end if;
  if v_starts is not null and v_ends is not null and v_ends <= v_starts then
    raise exception using errcode = '22023', message = 'The end time must be after the start time.';
  end if;

  if v_id is null then
    v_slug := lower(btrim(coalesce(p_survey ->> 'slug', '')));
    if v_slug !~ '^[a-z0-9][a-z0-9-]{2,63}$' then
      raise exception using errcode = '22023',
        message = 'The slug needs 3 to 64 characters: lowercase letters, numbers and hyphens.';
    end if;
    if exists (select 1 from public.surveys where slug = v_slug) then
      raise exception using errcode = '23505', message = 'That slug is already used by another survey.';
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('survey-submit:' || v_id::text, 0)
    );
    select * into v_existing from public.surveys where id = v_id;
    if not found then
      raise exception using errcode = '22023', message = 'Survey not found.';
    end if;
    v_slug := v_existing.slug;
    v_locked := exists (select 1 from public.survey_responses r where r.survey_id = v_id);
    if v_locked and v_existing.anonymous is distinct from v_anon then
      raise exception using errcode = '22023',
        message = 'Anonymity cannot be changed after people have responded.';
    end if;
  end if;

  if v_id is null then
    insert into public.surveys(
      slug, title, description, intro, status, reward_xp, reward_tokens,
      anonymous, max_responses, min_seconds, starts_at, ends_at
    )
    values (
      v_slug, v_title, v_desc, v_intro, v_status, v_xp, v_tokens,
      v_anon, v_max, v_min, v_starts, v_ends
    )
    returning id into v_id;
  else
    update public.surveys
    set title = v_title, description = v_desc, intro = v_intro, status = v_status,
        reward_xp = v_xp, reward_tokens = v_tokens, anonymous = v_anon,
        max_responses = v_max, min_seconds = v_min, starts_at = v_starts, ends_at = v_ends,
        updated_at = clock_timestamp()
    where id = v_id;
  end if;

  if not v_locked then
    if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
      raise exception using errcode = '22023', message = 'Questions are missing.';
    end if;
    if jsonb_array_length(p_questions) > 30 then
      raise exception using errcode = '22023', message = 'A survey can have at most 30 questions.';
    end if;

    delete from public.survey_questions where survey_id = v_id;
    update public.survey_sessions set status = 'expired'
    where survey_id = v_id and status = 'open';

    for v_q in select value from jsonb_array_elements(p_questions)
    loop
      v_pos := v_pos + 1;
      if jsonb_typeof(v_q) <> 'object' then
        raise exception using errcode = '22023', message = 'Question ' || v_pos || ' is invalid.';
      end if;

      v_type := coalesce(v_q ->> 'type', '');
      if v_type not in ('single','multiple','yes_no','rating','text') then
        raise exception using errcode = '22023', message = 'Question ' || v_pos || ' has an unknown type.';
      end if;
      v_prompt := btrim(coalesce(v_q ->> 'prompt', ''));
      if char_length(v_prompt) < 3 or char_length(v_prompt) > 300 then
        raise exception using errcode = '22023',
          message = 'Question ' || v_pos || ' needs a prompt of 3 to 300 characters.';
      end if;
      v_help := btrim(coalesce(v_q ->> 'helpText', ''));
      if char_length(v_help) > 300 then
        raise exception using errcode = '22023',
          message = 'Question ' || v_pos || ' help text is limited to 300 characters.';
      end if;
      v_req := coalesce((v_q ->> 'required')::boolean, true);
      v_clean_opts := '[]'::jsonb;
      v_cfg := '{}'::jsonb;

      if v_type in ('single','multiple') then
        v_opts := v_q -> 'options';
        if v_opts is null or jsonb_typeof(v_opts) <> 'array'
           or jsonb_array_length(v_opts) < 2 or jsonb_array_length(v_opts) > 12 then
          raise exception using errcode = '22023',
            message = 'Question ' || v_pos || ' needs 2 to 12 options.';
        end if;
        v_ids := array[]::text[];
        for v_opt in select value from jsonb_array_elements(v_opts)
        loop
          if jsonb_typeof(v_opt) <> 'object' then
            raise exception using errcode = '22023', message = 'Question ' || v_pos || ' has an invalid option.';
          end if;
          v_oid := btrim(coalesce(v_opt ->> 'id', ''));
          v_label := btrim(coalesce(v_opt ->> 'label', ''));
          if v_oid !~ '^[a-z0-9_-]{1,24}$' then
            raise exception using errcode = '22023', message = 'Question ' || v_pos || ' has an invalid option id.';
          end if;
          if char_length(v_label) < 1 or char_length(v_label) > 120 then
            raise exception using errcode = '22023',
              message = 'Question ' || v_pos || ' options need a label of 1 to 120 characters.';
          end if;
          if v_oid = any(v_ids) then
            raise exception using errcode = '22023', message = 'Question ' || v_pos || ' has duplicate option ids.';
          end if;
          v_ids := v_ids || v_oid;
          v_clean_opts := v_clean_opts || jsonb_build_array(jsonb_build_object('id', v_oid, 'label', v_label));
        end loop;
        if v_type = 'multiple' then
          v_n := coalesce(nullif(v_q -> 'config' ->> 'maxSelect', '')::int, jsonb_array_length(v_clean_opts));
          v_n := greatest(1, least(v_n, jsonb_array_length(v_clean_opts)));
          v_cfg := jsonb_build_object('maxSelect', v_n);
        end if;

      elsif v_type = 'rating' then
        v_n := coalesce(nullif(v_q -> 'config' ->> 'max', '')::int, 5);
        if v_n not in (5, 10) then
          raise exception using errcode = '22023', message = 'Question ' || v_pos || ' rating scale must be 5 or 10.';
        end if;
        v_cfg := jsonb_build_object(
          'max', v_n,
          'lowLabel', left(btrim(coalesce(v_q -> 'config' ->> 'lowLabel', '')), 40),
          'highLabel', left(btrim(coalesce(v_q -> 'config' ->> 'highLabel', '')), 40)
        );

      elsif v_type = 'text' then
        v_n := coalesce(nullif(v_q -> 'config' ->> 'maxLength', '')::int, 600);
        v_n := greatest(20, least(v_n, 2000));
        v_cfg := jsonb_build_object('maxLength', v_n);
      end if;

      insert into public.survey_questions(
        survey_id, position, question_type, prompt, help_text, required, options, config
      )
      values (v_id, v_pos, v_type, v_prompt, v_help, v_req, v_clean_opts, v_cfg);
    end loop;
  end if;

  select count(*)::int into v_qcount from public.survey_questions where survey_id = v_id;
  if v_status = 'live' and v_qcount < 1 then
    raise exception using errcode = '22023', message = 'Add at least one question before setting a survey live.';
  end if;

  return jsonb_build_object('id', v_id, 'slug', v_slug, 'questionsLocked', v_locked);
end;
$function$;

create or replace function public.server_admin_set_survey_status(p_survey_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
set "TimeZone" to 'UTC'
as $function$
begin
  if p_status not in ('draft','live','closed','archived') then
    raise exception using errcode = '22023', message = 'Invalid survey status.';
  end if;
  if not exists (select 1 from public.surveys where id = p_survey_id) then
    raise exception using errcode = '22023', message = 'Survey not found.';
  end if;
  if p_status = 'live' and not exists (
    select 1 from public.survey_questions where survey_id = p_survey_id
  ) then
    raise exception using errcode = '22023', message = 'Add at least one question before setting a survey live.';
  end if;
  if p_status = 'draft' and exists (
    select 1 from public.survey_responses where survey_id = p_survey_id
  ) then
    raise exception using errcode = '22023',
      message = 'A survey with responses cannot go back to draft. Close it instead.';
  end if;
  update public.surveys
  set status = p_status, updated_at = clock_timestamp()
  where id = p_survey_id;
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$function$;

create or replace function public.server_admin_delete_survey(p_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
set "TimeZone" to 'UTC'
as $function$
begin
  if not exists (select 1 from public.surveys where id = p_survey_id) then
    raise exception using errcode = '22023', message = 'Survey not found.';
  end if;
  if exists (select 1 from public.survey_responses where survey_id = p_survey_id) then
    raise exception using errcode = '22023',
      message = 'A survey with responses cannot be deleted. Close or archive it instead.';
  end if;
  delete from public.surveys where id = p_survey_id;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.server_admin_survey_results(p_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_s public.surveys%rowtype;
  v_totals jsonb;
  v_questions jsonb := '[]'::jsonb;
  v_q public.survey_questions%rowtype;
  v_item jsonb;
  v_answered integer;
  v_opts jsonb;
  v_dist jsonb;
  v_avg numeric;
  v_texts jsonb;
  v_rmax integer;
  v_yes integer;
  v_no integer;
begin
  select * into v_s from public.surveys where id = p_survey_id;
  if not found then
    raise exception using errcode = '22023', message = 'Survey not found.';
  end if;

  select jsonb_build_object(
    'responses', count(*),
    'avgSeconds', coalesce(round(avg(r.elapsed_seconds))::int, 0),
    'xpPaid', coalesce(sum(r.reward_xp), 0),
    'tokensPaid', coalesce(sum(r.reward_tokens), 0),
    'lastResponseAt', max(r.submitted_at)
  )
  into v_totals
  from public.survey_responses r
  where r.survey_id = p_survey_id;

  for v_q in
    select * from public.survey_questions q where q.survey_id = p_survey_id order by q.position
  loop
    select count(*)::int into v_answered
    from public.survey_answers a where a.question_id = v_q.id;

    v_item := jsonb_build_object(
      'id', v_q.id,
      'position', v_q.position,
      'type', v_q.question_type,
      'prompt', v_q.prompt,
      'required', v_q.required,
      'answered', v_answered
    );

    if v_q.question_type in ('single', 'multiple') then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', o.oid, 'label', o.label, 'count', o.n,
          'pct', case when v_answered > 0 then round(o.n * 100.0 / v_answered, 1) else 0 end
        ) order by o.ord
      ), '[]'::jsonb)
      into v_opts
      from (
        select
          t.opt ->> 'id' as oid,
          t.opt ->> 'label' as label,
          t.ord,
          (
            select count(*) from public.survey_answers a
            where a.question_id = v_q.id
              and case when v_q.question_type = 'single'
                       then (a.value #>> '{}') = (t.opt ->> 'id')
                       else a.value @> to_jsonb(t.opt ->> 'id') end
          )::int as n
        from jsonb_array_elements(v_q.options) with ordinality as t(opt, ord)
      ) o;
      v_item := v_item || jsonb_build_object('options', v_opts);

    elsif v_q.question_type = 'yes_no' then
      select count(*)::int into v_yes
      from public.survey_answers a where a.question_id = v_q.id and a.value = 'true'::jsonb;
      select count(*)::int into v_no
      from public.survey_answers a where a.question_id = v_q.id and a.value = 'false'::jsonb;
      v_item := v_item || jsonb_build_object('options', jsonb_build_array(
        jsonb_build_object('id', 'yes', 'label', 'Yes', 'count', v_yes,
          'pct', case when v_answered > 0 then round(v_yes * 100.0 / v_answered, 1) else 0 end),
        jsonb_build_object('id', 'no', 'label', 'No', 'count', v_no,
          'pct', case when v_answered > 0 then round(v_no * 100.0 / v_answered, 1) else 0 end)
      ));

    elsif v_q.question_type = 'rating' then
      v_rmax := coalesce((v_q.config ->> 'max')::int, 5);
      select coalesce(jsonb_agg(
        jsonb_build_object('value', g.v, 'count', coalesce(c.n, 0)) order by g.v
      ), '[]'::jsonb)
      into v_dist
      from generate_series(1, v_rmax) as g(v)
      left join (
        select (a.value #>> '{}')::int as val, count(*)::int as n
        from public.survey_answers a
        where a.question_id = v_q.id
        group by 1
      ) c on c.val = g.v;
      select round(avg((a.value #>> '{}')::numeric), 2) into v_avg
      from public.survey_answers a where a.question_id = v_q.id;
      v_item := v_item || jsonb_build_object(
        'max', v_rmax, 'average', v_avg, 'distribution', v_dist
      );

    else
      select coalesce(jsonb_agg(
        jsonb_build_object('text', x.t, 'submittedAt', x.sub_at, 'username', x.u)
        order by x.sub_at desc
      ), '[]'::jsonb)
      into v_texts
      from (
        select
          (a.value #>> '{}') as t,
          r.submitted_at as sub_at,
          case when v_s.anonymous then null else ac.username end as u
        from public.survey_answers a
        join public.survey_responses r on r.id = a.response_id
        join public.accounts ac on ac.id = r.account_id
        where a.question_id = v_q.id
        order by r.submitted_at desc
        limit 60
      ) x;
      v_item := v_item || jsonb_build_object('texts', v_texts);
    end if;

    v_questions := v_questions || jsonb_build_array(v_item);
  end loop;

  return jsonb_build_object(
    'survey', jsonb_build_object(
      'id', v_s.id, 'slug', v_s.slug, 'title', v_s.title, 'status', v_s.status,
      'anonymous', v_s.anonymous, 'rewardXp', v_s.reward_xp,
      'rewardTokens', v_s.reward_tokens, 'maxResponses', v_s.max_responses
    ),
    'totals', v_totals,
    'questions', v_questions
  );
end;
$function$;

create or replace function public.server_admin_survey_responses(
  p_survey_id uuid,
  p_limit integer default 500,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_s public.surveys%rowtype;
  v_total integer;
  v_rows jsonb;
begin
  select * into v_s from public.surveys where id = p_survey_id;
  if not found then
    raise exception using errcode = '22023', message = 'Survey not found.';
  end if;

  select count(*)::int into v_total from public.survey_responses where survey_id = p_survey_id;

  select coalesce(jsonb_agg(x.obj order by x.sub_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      jsonb_build_object(
        'id', r.id,
        'submittedAt', r.submitted_at,
        'elapsedSeconds', r.elapsed_seconds,
        'rewardXp', r.reward_xp,
        'rewardTokens', r.reward_tokens,
        'username', case when v_s.anonymous then null else ac.username end,
        'answers', coalesce((
          select jsonb_object_agg(a.question_id::text, a.value)
          from public.survey_answers a where a.response_id = r.id
        ), '{}'::jsonb)
      ) as obj,
      r.submitted_at as sub_at
    from public.survey_responses r
    join public.accounts ac on ac.id = r.account_id
    where r.survey_id = p_survey_id
    order by r.submitted_at desc
    limit greatest(1, least(coalesce(p_limit, 500), 1000))
    offset greatest(0, coalesce(p_offset, 0))
  ) x;

  return jsonb_build_object('total', v_total, 'anonymous', v_s.anonymous, 'responses', v_rows);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Function permissions: service_role only
-- ---------------------------------------------------------------------------

revoke all on function public.server_list_surveys(uuid, text) from public, anon, authenticated;
revoke all on function public.server_start_survey(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.server_submit_survey(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.server_admin_list_surveys() from public, anon, authenticated;
revoke all on function public.server_admin_get_survey(uuid) from public, anon, authenticated;
revoke all on function public.server_admin_save_survey(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.server_admin_set_survey_status(uuid, text) from public, anon, authenticated;
revoke all on function public.server_admin_delete_survey(uuid) from public, anon, authenticated;
revoke all on function public.server_admin_survey_results(uuid) from public, anon, authenticated;
revoke all on function public.server_admin_survey_responses(uuid, integer, integer) from public, anon, authenticated;

grant execute on function public.server_list_surveys(uuid, text) to service_role;
grant execute on function public.server_start_survey(uuid, uuid, boolean) to service_role;
grant execute on function public.server_submit_survey(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.server_admin_list_surveys() to service_role;
grant execute on function public.server_admin_get_survey(uuid) to service_role;
grant execute on function public.server_admin_save_survey(uuid, jsonb, jsonb) to service_role;
grant execute on function public.server_admin_set_survey_status(uuid, text) to service_role;
grant execute on function public.server_admin_delete_survey(uuid) to service_role;
grant execute on function public.server_admin_survey_results(uuid) to service_role;
grant execute on function public.server_admin_survey_responses(uuid, integer, integer) to service_role;

grant select, insert, update, delete on public.surveys to service_role;
grant select, insert, update, delete on public.survey_questions to service_role;
grant select, insert, update, delete on public.survey_sessions to service_role;
grant select, insert, update, delete on public.survey_responses to service_role;
grant select, insert, update, delete on public.survey_answers to service_role;
