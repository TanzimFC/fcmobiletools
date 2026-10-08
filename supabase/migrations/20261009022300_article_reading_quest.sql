-- Replace the social YouTube quest with a server-tracked article-reading quest.
-- The reading milestone stays internal and is not exposed in the quest copy.

update public.reward_tasks
set enabled=false,
    updated_at=clock_timestamp()
where slug='subscribe-youtube';

insert into public.reward_tasks (
  slug,title,description,task_type,reward_points,xp_reward,token_reward,
  daily_limit,weekly_limit,completion_limit,cooldown_seconds,enabled,mission_type,
  verification_method,conditions,priority,display_order,metadata
)
values (
  'daily-article-read',
  'Read a new FCMobiletools article',
  'Read through a FCMobiletools article to complete today’s reading quest.',
  'daily',5,20,5,
  1,null,null,21600,true,'daily',
  'server_event',
  '{"event":"article_read","anyArticle":true}',
  15,18,
  '{"weight":4,"quest_group":"daily-content","new_article":true}'
)
on conflict (slug) do update set
  title=excluded.title,
  description=excluded.description,
  task_type=excluded.task_type,
  reward_points=excluded.reward_points,
  xp_reward=excluded.xp_reward,
  token_reward=excluded.token_reward,
  daily_limit=excluded.daily_limit,
  weekly_limit=excluded.weekly_limit,
  completion_limit=excluded.completion_limit,
  cooldown_seconds=excluded.cooldown_seconds,
  enabled=excluded.enabled,
  mission_type=excluded.mission_type,
  verification_method=excluded.verification_method,
  conditions=excluded.conditions,
  priority=excluded.priority,
  display_order=excluded.display_order,
  metadata=excluded.metadata,
  updated_at=clock_timestamp();

create or replace function private.enforce_article_read_task_completion()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, private, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_task record;
begin
  if new.status='accepted' and new.verification_status='verified' then
    select t.slug,t.conditions
    into v_task
    from public.reward_tasks t
    where t.id=new.task_id;

    if coalesce(v_task.conditions->>'event','')='article_read'
       and coalesce((v_task.conditions->>'anyArticle')::boolean,false) then
      if not exists (
        select 1
        from public.activity_events ae
        where ae.account_id=new.account_id
          and ae.event_type='article_read'
          and ae.entity_type='article'
          and ae.created_at >= new.started_at - interval '15 minutes'
          and ae.created_at <= clock_timestamp()
          and case
            when coalesce(ae.metadata->>'duration_ms','') ~ '^[0-9]+$'
              then (ae.metadata->>'duration_ms')::integer
            else 0
          end >= 10000
      ) then
        raise exception using
          errcode='23514',
          message='Read through an article before claiming this Quest';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_article_read_task_completion on public.task_attempts;
create trigger enforce_article_read_task_completion
before update of status, verification_status on public.task_attempts
for each row
execute function private.enforce_article_read_task_completion();
