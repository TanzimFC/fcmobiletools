-- Tournament result editing and safe metadata updates.

CREATE OR REPLACE FUNCTION public.recalculate_tournament_stage_standings(p_stage_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update public.tournament_standings
  set played=0,wins=0,draws=0,losses=0,
      goals_for=0,goals_against=0,goal_difference=0,points=0,rank=null,updated_at=now()
  where stage_id=p_stage_id;

  with game_rows as (
    select
      m.stage_id,m.group_id,m.player1_id as player_id,
      m.player1_score as gf,m.player2_score as ga,
      case when m.player1_score>m.player2_score then 1 else 0 end as win,
      case when m.player1_score=m.player2_score then 1 else 0 end as draw,
      case when m.player1_score<m.player2_score then 1 else 0 end as loss
    from public.tournament_matches m
    where m.stage_id=p_stage_id
      and m.status='completed'
      and m.player1_id is not null and m.player2_id is not null
      and m.player1_score is not null and m.player2_score is not null

    union all

    select
      m.stage_id,m.group_id,m.player2_id as player_id,
      m.player2_score as gf,m.player1_score as ga,
      case when m.player2_score>m.player1_score then 1 else 0 end as win,
      case when m.player1_score=m.player2_score then 1 else 0 end as draw,
      case when m.player2_score<m.player1_score then 1 else 0 end as loss
    from public.tournament_matches m
    where m.stage_id=p_stage_id
      and m.status='completed'
      and m.player1_id is not null and m.player2_id is not null
      and m.player1_score is not null and m.player2_score is not null
  ),
  agg as (
    select stage_id,group_id,player_id,
           count(*)::integer as played,
           coalesce(sum(win),0)::integer as wins,
           coalesce(sum(draw),0)::integer as draws,
           coalesce(sum(loss),0)::integer as losses,
           coalesce(sum(gf),0)::integer as goals_for,
           coalesce(sum(ga),0)::integer as goals_against,
           coalesce(sum(win*3+draw),0)::integer as points
    from game_rows
    group by stage_id,group_id,player_id
  )
  update public.tournament_standings s
  set played=a.played,wins=a.wins,draws=a.draws,losses=a.losses,
      goals_for=a.goals_for,goals_against=a.goals_against,
      goal_difference=a.goals_for-a.goals_against,
      points=a.points,updated_at=now()
  from agg a
  where s.stage_id=a.stage_id
    and s.group_id is not distinct from a.group_id
    and s.player_id=a.player_id;

  with ranked as (
    select id,row_number() over(
      partition by stage_id,group_id
      order by points desc,goal_difference desc,goals_for desc,player_id
    ) r
    from public.tournament_standings
    where stage_id=p_stage_id
  )
  update public.tournament_standings s
  set rank=ranked.r,updated_at=now()
  from ranked
  where s.id=ranked.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_tournament_details(p_tournament_id bigint, p_name text, p_description text DEFAULT ''::text, p_slug text DEFAULT NULL::text, p_is_public boolean DEFAULT false, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
  v_slug text;
begin
  v_slug := nullif(trim(coalesce(p_slug,'')),'');
  if trim(coalesce(p_name,''))='' then
    raise exception 'Tournament name is required.';
  end if;

  select id into v_id from public.tournaments where id=p_tournament_id for update;
  if not found then raise exception 'Tournament not found.'; end if;

  if v_slug is null then
    select slug into v_slug from public.tournaments where id=p_tournament_id;
  end if;

  update public.tournaments
  set name=trim(p_name),
      description=coalesce(p_description,''),
      slug=v_slug,
      is_public=coalesce(p_is_public,false),
      starts_at=p_starts_at,
      updated_at=now()
  where id=p_tournament_id;

  return jsonb_build_object('ok',true,'tournamentId',p_tournament_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.update_tournament_match_result_v2(p_match_id bigint, p_player1_score integer, p_player2_score integer, p_deciding_winner_player_id bigint DEFAULT NULL::bigint, p_expected_player1_id bigint DEFAULT NULL::bigint, p_expected_player2_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  m public.tournament_matches%rowtype;
  t public.tournaments%rowtype;
  tie public.tournament_ties%rowtype;
  v_stage_type text;
  old_winner bigint;
  new_winner bigint;
  old_tie_winner bigint;
  new_tie_winner bigint;
  agg1 integer;
  agg2 integer;
  incomplete_legs integer;
  pending_matches integer;
  waiting_stage boolean;
  affected_ids bigint[] := '{}'::bigint[];
  dep record;
  feed1 bigint;
  feed2 bigint;
  dep_tie_ids bigint[] := '{}'::bigint[];
begin
  if p_player1_score is null or p_player2_score is null
     or p_player1_score<0 or p_player2_score<0 then
    raise exception 'Scores must be non-negative integers.';
  end if;

  select * into m
  from public.tournament_matches
  where id=p_match_id
  for update;

  if not found then raise exception 'Match not found.'; end if;

  if m.player1_id is null or m.player2_id is null then
    raise exception 'Both players must be assigned before entering a result.';
  end if;

  if p_expected_player1_id is not null
     and m.player1_id is distinct from p_expected_player1_id then
    raise exception 'The match participants changed. Refresh before saving this result.';
  end if;
  if p_expected_player2_id is not null
     and m.player2_id is distinct from p_expected_player2_id then
    raise exception 'The match participants changed. Refresh before saving this result.';
  end if;

  select s.stage_type into v_stage_type from public.tournament_stages s where s.id=m.stage_id;

  select * into t from public.tournaments where id=m.tournament_id for update;

  if v_stage_type in ('group','league','swiss') then
    new_winner := case
      when p_player1_score>p_player2_score then m.player1_id
      when p_player2_score>p_player1_score then m.player2_id
      else null
    end;

    update public.tournament_matches
    set player1_score=p_player1_score,
        player2_score=p_player2_score,
        home_score=p_player1_score,
        away_score=p_player2_score,
        winner_player_id=new_winner,
        status='completed',
        completed_at=coalesce(completed_at,now()),
        updated_at=now()
    where id=p_match_id;

    perform public.recalculate_tournament_stage_standings(m.stage_id);
  else
    old_winner := m.winner_player_id;
    if p_player1_score=p_player2_score then
      if p_deciding_winner_player_id not in (m.player1_id,m.player2_id) then
        raise exception 'The score is level. Supply the player who won after extra time or penalties.';
      end if;
      new_winner := p_deciding_winner_player_id;
    else
      new_winner := case
        when p_player1_score>p_player2_score then m.player1_id
        else m.player2_id
      end;
    end if;

    update public.tournament_matches
    set player1_score=p_player1_score,
        player2_score=p_player2_score,
        home_score=p_player1_score,
        away_score=p_player2_score,
        winner_player_id=new_winner,
        status='completed',
        completed_at=coalesce(completed_at,now()),
        updated_at=now()
    where id=p_match_id;

    if m.tie_id is not null then
      select * into tie
      from public.tournament_ties
      where id=m.tie_id
      for update;

      old_tie_winner := tie.winner_player_id;

      select count(*) into incomplete_legs
      from public.tournament_matches
      where tie_id=tie.id and status<>'completed';

      if incomplete_legs>0 then
        update public.tournament_ties
        set winner_player_id=null,
            status=case when player1_id is not null and player2_id is not null then 'ready' else 'scheduled' end,
            updated_at=now()
        where id=tie.id;
        new_tie_winner := null;
      else
        select
          coalesce(sum(case when player1_id=tie.player1_id then player1_score else player2_score end),0),
          coalesce(sum(case when player1_id=tie.player2_id then player1_score else player2_score end),0)
        into agg1,agg2
        from public.tournament_matches
        where tie_id=tie.id
          and player1_score is not null
          and player2_score is not null;

        if agg1>agg2 then
          new_tie_winner:=tie.player1_id;
        elsif agg2>agg1 then
          new_tie_winner:=tie.player2_id;
        elsif p_deciding_winner_player_id in (tie.player1_id,tie.player2_id) then
          new_tie_winner:=p_deciding_winner_player_id;
        else
          raise exception 'Aggregate score is level. Supply the deciding winner after extra time or penalties.';
        end if;

        update public.tournament_ties
        set winner_player_id=new_tie_winner,status='completed',updated_at=now()
        where id=tie.id;

        if old_tie_winner is distinct from new_tie_winner and tie.next_tie_id is not null then
          with recursive deps as (
            select id from public.tournament_ties
            where id=tie.next_tie_id
            union all
            select child.id
            from public.tournament_ties child
            join deps parent on child.id=parent.next_tie_id
            where child.tournament_id=m.tournament_id
          )
          select coalesce(array_agg(id),'{}'::bigint[]) into dep_tie_ids from deps;

          update public.tournament_matches
          set player1_score=null,player2_score=null,home_score=null,away_score=null,
              winner_player_id=null,status=case when player1_id is not null and player2_id is not null then 'ready' else 'scheduled' end,
              completed_at=null,updated_at=now()
          where tournament_id=m.tournament_id and tie_id=any(dep_tie_ids);

          update public.tournament_ties
          set player1_id=null,player2_id=null,winner_player_id=null,status='scheduled',updated_at=now()
          where tournament_id=m.tournament_id and id=any(dep_tie_ids);
        end if;

        perform public.link_tournament_progression(m.tournament_id);
      end if;
    else
      if old_winner is distinct from new_winner and m.next_match_id is not null then
        with recursive deps as (
          select id,next_match_id
          from public.tournament_matches
          where id=m.next_match_id
          union all
          select child.id,child.next_match_id
          from public.tournament_matches child
          join deps parent on child.id=parent.next_match_id
          where child.tournament_id=m.tournament_id
            and child.tie_id is null
        )
        select coalesce(array_agg(id),'{}'::bigint[]) into affected_ids from deps;

        update public.tournament_matches
        set player1_score=null,player2_score=null,home_score=null,away_score=null,
            winner_player_id=null,
            status=case when player1_id is not null and player2_id is not null then 'ready' else 'scheduled' end,
            completed_at=null,updated_at=now()
        where tournament_id=m.tournament_id and id=any(affected_ids);

        for dep in
          select *
          from public.tournament_matches
          where tournament_id=m.tournament_id and id=any(affected_ids)
          order by round_number,match_number,leg_number
        loop
          select
            max(winner_player_id) filter (where next_slot=1),
            max(winner_player_id) filter (where next_slot=2)
          into feed1,feed2
          from public.tournament_matches
          where next_match_id=dep.id
            and tournament_id=m.tournament_id;

          update public.tournament_matches
          set player1_id=feed1,
              player2_id=feed2,
              status=case when feed1 is not null and feed2 is not null then 'ready' else 'scheduled' end,
              updated_at=now()
          where id=dep.id;
        end loop;

        perform public.link_tournament_progression(m.tournament_id);
      end if;
    end if;
  end if;

  select count(*) into pending_matches
  from public.tournament_matches
  where tournament_id=m.tournament_id and status<>'completed';

  select exists(
    select 1
    from public.tournament_stages s
    where s.tournament_id=m.tournament_id
      and s.stage_order > coalesce((select stage_order from public.tournament_stages where id=m.stage_id),0)
      and not exists(select 1 from public.tournament_matches x where x.stage_id=s.id)
  ) into waiting_stage;

  if pending_matches=0 and not waiting_stage then
    update public.tournaments
    set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
    where id=m.tournament_id;
  else
    update public.tournaments
    set status=case when status='completed' then 'in_progress' else status end,
        updated_at=now()
    where id=m.tournament_id;
  end if;

  return jsonb_build_object(
    'ok',true,
    'matchId',m.id,
    'tournamentId',m.tournament_id,
    'winnerPlayerId',new_winner,
    'final',pending_matches=0 and not waiting_stage
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.update_tournament_match_results_v2(p_tournament_id bigint, p_updates jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  item jsonb;
  v_count integer:=0;
  v_match_id bigint;
  v_result jsonb;
  v_match_tournament bigint;
begin
  if coalesce(jsonb_typeof(p_updates),'null')<>'array' then
    raise exception 'Result updates must be an array.';
  end if;
  if jsonb_array_length(p_updates)>1000 then
    raise exception 'A single result update batch cannot contain more than 1000 matches.';
  end if;

  perform 1 from public.tournaments where id=p_tournament_id for update;
  if not found then raise exception 'Tournament not found.'; end if;

  for item in select * from jsonb_array_elements(p_updates) loop
    v_match_id := nullif(item->>'matchId','')::bigint;

    select tournament_id into v_match_tournament
    from public.tournament_matches
    where id=v_match_id;

    if v_match_tournament is null then
      raise exception 'Match % not found.',v_match_id;
    end if;
    if v_match_tournament<>p_tournament_id then
      raise exception 'Match % belongs to another tournament.',v_match_id;
    end if;

    v_result := public.update_tournament_match_result_v2(
      v_match_id,
      nullif(item->>'player1Score','')::integer,
      nullif(item->>'player2Score','')::integer,
      nullif(item->>'decidingWinnerPlayerId','')::bigint,
      nullif(item->>'expectedPlayer1Id','')::bigint,
      nullif(item->>'expectedPlayer2Id','')::bigint
    );
    v_count := v_count+1;
  end loop;

  return jsonb_build_object('ok',true,'tournamentId',p_tournament_id,'updatedCount',v_count);
end $function$
;

revoke all on function public.update_tournament_details(bigint,text,text,text,boolean,timestamptz), public.recalculate_tournament_stage_standings(bigint), public.update_tournament_match_result_v2(bigint,integer,integer,bigint,bigint,bigint), public.update_tournament_match_results_v2(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.update_tournament_details(bigint,text,text,text,boolean,timestamptz), public.recalculate_tournament_stage_standings(bigint), public.update_tournament_match_result_v2(bigint,integer,integer,bigint,bigint,bigint), public.update_tournament_match_results_v2(bigint,jsonb) to service_role;
