-- Optional quest: "Tell players whether a redeem code worked".
-- Additive and safe to ship:
--   * the quest row is created DISABLED, an admin enables it from the quest tools when ready
--   * a separate fail-closed trigger enforces it, so the existing enforce_quest_action_conditions()
--     function is not modified
-- The reward is for REPORTING, whatever the verdict, so there is no incentive to lie "Worked".
-- The Worker only records the activity event after checking the vote exists in D1.

insert into public.reward_tasks (
  slug,title,description,task_type,reward_points,daily_limit,weekly_limit,completion_limit,
  cooldown_seconds,enabled,mission_type,xp_reward,token_reward,verification_method,
  conditions,priority,display_order,metadata
)
values (
  'daily-redeem-code-report',
  'Report a redeem code',
  'Try a redeem code, then tell other players whether it worked or not.',
  'daily',2,1,null,null,21600,false,'daily',15,2,'server_event',
  '{"event":"redeem_code_vote","entityType":"redeem_code","anyCode":true}',
  32,32,
  '{"weight":3,"quest_group":"daily-info"}'
)
on conflict (slug) do nothing;

create or replace function private.enforce_redeem_vote_quest()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, private, pg_temp
set "TimeZone" to 'UTC'
as $function$
declare
  v_conditions jsonb;
  v_mission_type text;
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

  if not found or coalesce(v_conditions->>'event','') <> 'redeem_code_vote' then
    return new;
  end if;

  if not exists (
    select 1
    from public.activity_events ae
    where ae.account_id = new.account_id
      and ae.event_type = 'redeem_code_vote'
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
      message='Report on a redeem code before claiming this Quest';
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_redeem_vote_quest() from public, anon, authenticated;

drop trigger if exists enforce_redeem_vote_quest on public.task_attempts;
create trigger enforce_redeem_vote_quest
before update of status, verification_status on public.task_attempts
for each row
execute function private.enforce_redeem_vote_quest();
