-- Final advanced tournament engine state.
alter table public.tournaments drop constraint if exists tournaments_format_check;
alter table public.tournaments add constraint tournaments_format_check check (format between 2 and 5000);
alter table public.tournaments drop constraint if exists tournaments_participant_count_check;
alter table public.tournaments add constraint tournaments_participant_count_check check (participant_count between 2 and 5000);
alter table public.tournament_players drop constraint if exists tournament_players_slot_check;
alter table public.tournament_players add constraint tournament_players_slot_check check (slot between 1 and 5000);
alter table public.tournament_players drop constraint if exists tournament_players_seed_check;
alter table public.tournament_players add constraint tournament_players_seed_check check (seed is null or seed between 1 and 5000);
alter table public.tournament_matches drop constraint if exists tournament_matches_round_number_check;
alter table public.tournament_matches add constraint tournament_matches_round_number_check check (round_number between 1 and 20);
alter table public.tournament_matches drop constraint if exists tournament_matches_match_number_check;
alter table public.tournament_matches add constraint tournament_matches_match_number_check check (match_number between 1 and 5000);
alter table public.tournament_matches drop constraint if exists tournament_matches_tournament_id_round_number_match_number_key;
alter table public.tournament_matches drop constraint if exists tournament_matches_stage_round_match_key;
alter table public.tournament_matches add constraint tournament_matches_stage_round_match_key unique (tournament_id,stage_id,round_number,match_number);

CREATE OR REPLACE FUNCTION public.advance_tournament_stage(p_tournament_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  current_stage public.tournament_stages%rowtype;
  next_stage public.tournament_stages%rowtype;
  league_stage public.tournament_stages%rowtype;
  g record;
  q record;
  qualifiers bigint[] := '{}';
  direct_players bigint[] := '{}';
  playoff_winners bigint[] := '{}';
  interleaved bigint[] := '{}';
  next_count integer := 0;
  direct_count integer := 0;
  rank_from integer;
  rank_to integer;
  bracket_size integer;
  original_size integer;
  round_count integer;
  round integer;
  matches_in_round integer;
  i integer;
  pair_a bigint;
  pair_b bigint;
  tie_id bigint;
  tie_no integer;
  next_match_count integer := 0;
  has_existing boolean;
  qual_per_group integer;
  stage_qualifiers integer;
  match_no integer;
begin
  select s.* into current_stage
  from public.tournament_stages s
  where s.tournament_id=p_tournament_id
    and exists(select 1 from public.tournament_matches m where m.stage_id=s.id)
    and not exists(select 1 from public.tournament_matches m where m.stage_id=s.id and m.status<>'completed')
  order by s.stage_order
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'advanced',false,'reason','No completed stage is ready to advance.');
  end if;

  select s.* into next_stage
  from public.tournament_stages s
  where s.tournament_id=p_tournament_id
    and s.stage_order=current_stage.stage_order+1
  limit 1;

  if not found then
    return jsonb_build_object('ok',true,'advanced',false,'reason','No next stage configured.');
  end if;

  select exists(select 1 from public.tournament_matches m where m.stage_id=next_stage.id) into has_existing;
  if has_existing then
    return jsonb_build_object('ok',true,'advanced',false,'reason','Next stage already initialized.');
  end if;

  -- Determine qualifiers from the completed stage.
  if current_stage.stage_type='group' then
    qual_per_group := case
      when coalesce(next_stage.config->>'qualifierMode','')='group-winners-and-runners-up' then 2
      else coalesce(current_stage.advance_per_group,2)
    end;

    for g in
      select id,group_number
      from public.tournament_groups
      where stage_id=current_stage.id
      order by group_number
    loop
      for q in
        select player_id
        from public.tournament_standings
        where stage_id=current_stage.id and group_id=g.id
        order by points desc,goal_difference desc,goals_for desc,player_id
        limit qual_per_group
      loop
        qualifiers:=array_append(qualifiers,q.player_id);
      end loop;
    end loop;

  elsif current_stage.stage_type in ('league','swiss') then
    if coalesce(next_stage.config->>'qualification','')='league-rank'
       and jsonb_typeof(next_stage.config->'seededRange')='array' then
      rank_from:=coalesce((next_stage.config->'seededRange'->>0)::integer,1);
      rank_to:=coalesce((next_stage.config->'seededRange'->>1)::integer,rank_from);
      select coalesce(array_agg(player_id order by rank),'{}'::bigint[])
      into qualifiers
      from public.tournament_standings
      where stage_id=current_stage.id and rank between rank_from and rank_to;

    else
      stage_qualifiers:=coalesce((next_stage.config->>'qualifiers')::integer,next_stage.advance_per_group,8);
      select coalesce(array_agg(player_id order by points desc,goal_difference desc,goals_for desc,player_id),'{}'::bigint[])
      into qualifiers
      from (
        select player_id,points,goal_difference,goals_for
        from public.tournament_standings
        where stage_id=current_stage.id
        order by points desc,goal_difference desc,goals_for desc,player_id
        limit stage_qualifiers
      ) ranked;
    end if;

  elsif current_stage.stage_type in ('playoff','knockout') then
    -- Champions League-style: direct top finishers plus play-off winners.
    if coalesce(next_stage.config->>'seededPairing','')='direct-top-vs-playoff-winners' then
      direct_count:=coalesce((next_stage.config->>'directCount')::integer,8);

      select s.* into league_stage
      from public.tournament_stages s
      where s.tournament_id=p_tournament_id
        and s.stage_type='league'
      order by s.stage_order
      limit 1;

      if league_stage.id is not null then
        select coalesce(array_agg(player_id order by rank),'{}'::bigint[])
        into direct_players
        from (
          select player_id,rank
          from public.tournament_standings
          where stage_id=league_stage.id and group_id is null and rank is not null
          order by rank
          limit direct_count
        ) top_direct;
      end if;

      select coalesce(array_agg(winner_player_id order by tie_number) filter (where winner_player_id is not null),'{}'::bigint[])
      into playoff_winners
      from public.tournament_ties
      where stage_id=current_stage.id and status='completed';

      if array_length(playoff_winners,1) is null or array_length(playoff_winners,1)=0 then
        select coalesce(array_agg(winner_player_id order by match_number) filter (where winner_player_id is not null),'{}'::bigint[])
        into playoff_winners
        from public.tournament_matches
        where stage_id=current_stage.id
          and round_number=(select max(round_number) from public.tournament_matches where stage_id=current_stage.id)
          and status='completed';
      end if;

      if array_length(direct_players,1) is not null and array_length(playoff_winners,1) is not null then
        for i in 1..least(array_length(direct_players,1),array_length(playoff_winners,1)) loop
          interleaved:=array_append(interleaved,direct_players[i]);
          interleaved:=array_append(interleaved,playoff_winners[i]);
        end loop;
      end if;
      qualifiers:=interleaved;

    elsif exists(select 1 from public.tournament_ties where stage_id=current_stage.id) then
      select coalesce(array_agg(winner_player_id order by tie_number) filter (where winner_player_id is not null),'{}'::bigint[])
      into qualifiers
      from public.tournament_ties
      where stage_id=current_stage.id and status='completed';

    else
      select coalesce(array_agg(winner_player_id order by match_number) filter (where winner_player_id is not null),'{}'::bigint[])
      into qualifiers
      from public.tournament_matches
      where stage_id=current_stage.id
        and round_number=(select max(round_number) from public.tournament_matches where stage_id=current_stage.id)
        and status='completed';
    end if;
  end if;

  next_count:=coalesce(array_length(qualifiers,1),0);
  if next_count<2 then
    raise exception 'Not enough qualified participants to initialize the next stage.';
  end if;

  if next_stage.stage_type in ('knockout','playoff') then
    tie_no:=coalesce((select max(tie_number) from public.tournament_ties where tournament_id=p_tournament_id),0)+1;

    -- Two-team final.
    if next_count=2 then
      if next_stage.match_mode='home_away' then
        insert into public.tournament_ties(
          tournament_id,stage_id,round_number,tie_number,player1_id,player2_id,legs_required,status
        ) values(
          p_tournament_id,next_stage.id,1,tie_no,qualifiers[1],qualifiers[2],2,'ready'
        ) returning id into tie_id;

        insert into public.tournament_matches(
          tournament_id,stage_id,tie_id,round_number,match_number,leg_number,
          player1_id,player2_id,status
        ) values(
          p_tournament_id,next_stage.id,tie_id,1,1,1,qualifiers[1],qualifiers[2],'ready'
        );

        insert into public.tournament_matches(
          tournament_id,stage_id,tie_id,round_number,match_number,leg_number,
          player1_id,player2_id,status
        ) values(
          p_tournament_id,next_stage.id,tie_id,1,2,2,qualifiers[2],qualifiers[1],'ready'
        );
        next_match_count:=2;
      else
        insert into public.tournament_matches(
          tournament_id,stage_id,round_number,match_number,player1_id,player2_id,status
        ) values(p_tournament_id,next_stage.id,1,1,qualifiers[1],qualifiers[2],'ready');
        next_match_count:=1;
      end if;

    -- FIFA ASEAN-style final + bronze match.
    elsif next_stage.config->>'thirdPlace'='true' and next_count>=4
      and coalesce(next_stage.config->>'qualifierMode','')='group-winners-and-runners-up' then

      insert into public.tournament_matches(
        tournament_id,stage_id,round_number,match_number,player1_id,player2_id,status
      ) values(
        p_tournament_id,next_stage.id,1,1,qualifiers[1],qualifiers[3],'ready'
      );

      insert into public.tournament_matches(
        tournament_id,stage_id,round_number,match_number,player1_id,player2_id,status
      ) values(
        p_tournament_id,next_stage.id,1,2,qualifiers[2],qualifiers[4],'ready'
      );
      next_match_count:=2;

    else
      original_size:=next_count;
      bracket_size:=1;
      while bracket_size<original_size loop
        bracket_size:=bracket_size*2;
      end loop;

      round_count:=case when coalesce((next_stage.config->>'singleRound')::boolean,false) then 1 else floor(log(bracket_size::numeric)/log(2::numeric)) end;
      match_no:=1;

      for round in 1..round_count loop
        matches_in_round:=bracket_size/power(2,round)::integer;

        if round=1 then
          for i in 1..matches_in_round loop
            pair_a:=case when (i*2-1)<=original_size then qualifiers[i*2-1] else null end;
            pair_b:=case when (i*2)<=original_size then qualifiers[i*2] else null end;

            if next_stage.match_mode='home_away' then
              insert into public.tournament_ties(
                tournament_id,stage_id,round_number,tie_number,player1_id,player2_id,legs_required,status
              ) values(
                p_tournament_id,next_stage.id,round,tie_no,pair_a,pair_b,2,
                case when pair_a is not null and pair_b is not null then 'ready' else 'scheduled' end
              ) returning id into tie_id;

              insert into public.tournament_matches(
                tournament_id,stage_id,tie_id,round_number,match_number,leg_number,player1_id,player2_id,status
              ) values(
                p_tournament_id,next_stage.id,tie_id,round,(i*2)-1,1,pair_a,pair_b,
                case when pair_a is not null and pair_b is not null then 'ready' else 'scheduled' end
              );

              insert into public.tournament_matches(
                tournament_id,stage_id,tie_id,round_number,match_number,leg_number,player1_id,player2_id,status
              ) values(
                p_tournament_id,next_stage.id,tie_id,round,i*2,2,pair_b,pair_a,
                case when pair_a is not null and pair_b is not null then 'ready' else 'scheduled' end
              );

              tie_no:=tie_no+1;
              next_match_count:=next_match_count+2;
            else
              insert into public.tournament_matches(
                tournament_id,stage_id,round_number,match_number,player1_id,player2_id,status
              ) values(
                p_tournament_id,next_stage.id,round,i,pair_a,pair_b,
                case when pair_a is not null and pair_b is not null then 'ready' else 'scheduled' end
              );
              next_match_count:=next_match_count+1;
            end if;
          end loop;
        else
          for i in 1..matches_in_round loop
            if next_stage.match_mode='home_away' then
              insert into public.tournament_ties(
                tournament_id,stage_id,round_number,tie_number,legs_required,status
              ) values(
                p_tournament_id,next_stage.id,round,tie_no,2,'scheduled'
              ) returning id into tie_id;

              insert into public.tournament_matches(
                tournament_id,stage_id,tie_id,round_number,match_number,leg_number,status
              ) values(p_tournament_id,next_stage.id,tie_id,round,(i*2)-1,1,'scheduled');

              insert into public.tournament_matches(
                tournament_id,stage_id,tie_id,round_number,match_number,leg_number,status
              ) values(p_tournament_id,next_stage.id,tie_id,round,i*2,2,'scheduled');

              tie_no:=tie_no+1;
              next_match_count:=next_match_count+2;
            else
              insert into public.tournament_matches(
                tournament_id,stage_id,round_number,match_number,status
              ) values(p_tournament_id,next_stage.id,round,i,'scheduled');
              next_match_count:=next_match_count+1;
            end if;
          end loop;
        end if;
      end loop;

      if next_stage.match_mode='home_away' then
        with pos as (
          select id,round_number,row_number() over(partition by round_number order by tie_number) as pos
          from public.tournament_ties
          where stage_id=next_stage.id
        ),
        map as (
          select p.id,n.id next_id,p.pos
          from pos p
          join pos n on n.round_number=p.round_number+1
            and n.pos=ceil(p.pos/2.0)
        )
        update public.tournament_ties t
        set next_tie_id=map.next_id,
            next_slot=case when map.pos%2=1 then 1 else 2 end,
            updated_at=now()
        from map
        where t.id=map.id;
      else
        update public.tournament_matches a
        set next_match_id=b.id,
            next_slot=case when a.match_number%2=1 then 1 else 2 end,
            updated_at=now()
        from public.tournament_matches b
        where a.stage_id=next_stage.id
          and b.stage_id=next_stage.id
          and a.round_number+1=b.round_number
          and b.match_number=ceil(a.match_number/2.0)::smallint;
      end if;
    end if;

    -- Process any deterministic first-round byes immediately.
    perform public.link_tournament_progression(p_tournament_id);
  else
    raise exception 'Stage advancement for % is not implemented yet.',next_stage.stage_type;
  end if;

  update public.tournaments
  set status='in_progress',updated_at=now()
  where id=p_tournament_id;

  return jsonb_build_object(
    'ok',true,'advanced',true,
    'fromStage',current_stage.stage_key,
    'toStage',next_stage.stage_key,
    'qualifiers',next_count,
    'matchesCreated',next_match_count
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.link_tournament_progression(p_tournament_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare i integer;
begin
  update public.tournament_matches a
  set next_match_id=b.id,next_slot=case when a.match_number%2=1 then 1 else 2 end,updated_at=now()
  from public.tournament_matches b
  where a.tournament_id=p_tournament_id and b.tournament_id=p_tournament_id
    and a.tie_id is null and b.tie_id is null and a.stage_id=b.stage_id
    and a.round_number+1=b.round_number
    and b.match_number=ceil(a.match_number/2.0)::smallint;

  for i in 1..20 loop
    update public.tournament_matches m
    set winner_player_id=coalesce(m.winner_player_id,m.player1_id,m.player2_id),
        status='completed',completed_at=coalesce(m.completed_at,now()),updated_at=now()
    where m.tournament_id=p_tournament_id and m.tie_id is null and m.status<>'completed'
      and ((m.player1_id is not null and m.player2_id is null)
        or (m.player1_id is null and m.player2_id is not null));

    update public.tournament_matches next_m
    set player1_id=case when a.next_slot=1 then coalesce(next_m.player1_id,a.winner_player_id) else next_m.player1_id end,
        player2_id=case when a.next_slot=2 then coalesce(next_m.player2_id,a.winner_player_id) else next_m.player2_id end,
        updated_at=now()
    from public.tournament_matches a
    where next_m.tournament_id=p_tournament_id
      and a.tournament_id=p_tournament_id and a.next_match_id=next_m.id
      and a.winner_player_id is not null and next_m.tie_id is null;

    update public.tournament_matches next_m
    set status=case when next_m.player1_id is not null and next_m.player2_id is not null then 'ready' else next_m.status end,
        updated_at=now()
    where next_m.tournament_id=p_tournament_id and next_m.tie_id is null;
  end loop;

  with tie_rounds as (
    select t.id,t.stage_id,min(m.round_number) round_number,t.tie_number
    from public.tournament_ties t
    join public.tournament_matches m on m.tie_id=t.id
    where t.tournament_id=p_tournament_id
    group by t.id,t.stage_id,t.tie_number
  ),
  pos as (
    select id,stage_id,round_number,row_number() over(partition by stage_id,round_number order by tie_number) pos
    from tie_rounds
  ),
  map as (
    select p.id,n.id next_id,p.pos
    from pos p join pos n
      on n.stage_id=p.stage_id and n.round_number=p.round_number+1 and n.pos=ceil(p.pos/2.0)
  )
  update public.tournament_ties t
  set next_tie_id=map.next_id,next_slot=case when map.pos%2=1 then 1 else 2 end,updated_at=now()
  from map
  where t.id=map.id;

  -- Automatic byes for two-leg ties when only one qualifier reaches a tie.
  update public.tournament_ties t
  set winner_player_id=coalesce(t.player1_id,t.player2_id),
      status='completed',
      updated_at=now()
  where t.tournament_id=p_tournament_id
    and t.status<>'completed'
    and ((t.player1_id is not null and t.player2_id is null)
      or (t.player1_id is null and t.player2_id is not null));

  for i in 1..10 loop
    update public.tournament_ties nt
    set player1_id=case when source.next_slot=1 then source.winner_player_id else nt.player1_id end,
        player2_id=case when source.next_slot=2 then source.winner_player_id else nt.player2_id end,
        status=case
          when (case when source.next_slot=1 then source.winner_player_id else nt.player1_id end) is not null
           and (case when source.next_slot=2 then source.winner_player_id else nt.player2_id end) is not null
          then 'ready' else nt.status end,
        updated_at=now()
    from public.tournament_ties source
    where source.tournament_id=p_tournament_id
      and source.status='completed'
      and source.winner_player_id is not null
      and source.next_tie_id=nt.id;

    update public.tournament_matches m
    set player1_id=case when m.leg_number=2 then t.player2_id else t.player1_id end,
        player2_id=case when m.leg_number=2 then t.player1_id else t.player2_id end,
        status='ready',
        updated_at=now()
    from public.tournament_ties t
    where m.tournament_id=p_tournament_id and m.tie_id=t.id
      and t.status='ready' and t.player1_id is not null and t.player2_id is not null
      and m.status<>'completed';
  end loop;

  return jsonb_build_object('ok',true,'linked',true);
end;
$function$


CREATE OR REPLACE FUNCTION public.record_tournament_match_result_v2(p_match_id bigint, p_player1_score integer, p_player2_score integer, p_deciding_winner_player_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  m public.tournament_matches%rowtype;
  tie public.tournament_ties%rowtype;
  winner_id bigint;
  next_ready boolean:=false;
  final_competition boolean:=false;
  agg1 integer;
  agg2 integer;
  stage_type text;
  next_tie public.tournament_ties%rowtype;
  advance_result jsonb:='{"advanced":false}'::jsonb;
  pending_matches integer:=0;
begin
  if p_player1_score is null or p_player2_score is null or p_player1_score<0 or p_player2_score<0 then
    raise exception 'Scores must be non-negative integers.';
  end if;

  select * into m from public.tournament_matches where id=p_match_id for update;
  if not found then raise exception 'Match not found.'; end if;
  if m.status='completed' then raise exception 'This match already has a result.'; end if;
  if m.player1_id is null or m.player2_id is null then raise exception 'Both players must be assigned.'; end if;

  update public.tournament_matches
  set player1_score=p_player1_score,
      player2_score=p_player2_score,
      home_score=p_player1_score,
      away_score=p_player2_score,
      status='completed',
      completed_at=now(),
      updated_at=now()
  where id=p_match_id;

  select s.stage_type into stage_type from public.tournament_stages s where s.id=m.stage_id;

  if stage_type in ('group','league','swiss') then
    update public.tournament_standings s
    set played=played+1,
        wins=wins+case when p_player1_score>p_player2_score then 1 else 0 end,
        draws=draws+case when p_player1_score=p_player2_score then 1 else 0 end,
        losses=losses+case when p_player1_score<p_player2_score then 1 else 0 end,
        goals_for=goals_for+p_player1_score,
        goals_against=goals_against+p_player2_score,
        points=points+case when p_player1_score>p_player2_score then 3 when p_player1_score=p_player2_score then 1 else 0 end,
        updated_at=now()
    where s.stage_id=m.stage_id and s.group_id is not distinct from m.group_id and s.player_id=m.player1_id;

    update public.tournament_standings s
    set played=played+1,
        wins=wins+case when p_player2_score>p_player1_score then 1 else 0 end,
        draws=draws+case when p_player1_score=p_player2_score then 1 else 0 end,
        losses=losses+case when p_player2_score<p_player1_score then 1 else 0 end,
        goals_for=goals_for+p_player2_score,
        goals_against=goals_against+p_player1_score,
        points=points+case when p_player2_score>p_player1_score then 3 when p_player1_score=p_player2_score then 1 else 0 end,
        updated_at=now()
    where s.stage_id=m.stage_id and s.group_id is not distinct from m.group_id and s.player_id=m.player2_id;

    update public.tournament_standings
    set goal_difference=goals_for-goals_against
    where stage_id=m.stage_id;

    with ranked as (
      select id,row_number() over(partition by stage_id,group_id order by points desc,goal_difference desc,goals_for desc,player_id) r
      from public.tournament_standings
      where stage_id=m.stage_id
    )
    update public.tournament_standings s
    set rank=ranked.r
    from ranked
    where s.id=ranked.id;

    if not exists(select 1 from public.tournament_matches where stage_id=m.stage_id and status<>'completed') then
      advance_result:=public.advance_tournament_stage(m.tournament_id);
    end if;
  end if;

  if m.tie_id is not null then
    select * into tie from public.tournament_ties where id=m.tie_id for update;

    if exists(select 1 from public.tournament_matches where tie_id=tie.id and status<>'completed') then
      return jsonb_build_object(
        'ok',true,'matchId',m.id,'tournamentId',m.tournament_id,
        'winnerPlayerId',null,'tieComplete',false,
        'advanced',advance_result->'advanced'
      );
    end if;

    select
      coalesce(sum(case when player1_id=tie.player1_id then player1_score else player2_score end),0),
      coalesce(sum(case when player1_id=tie.player2_id then player1_score else player2_score end),0)
    into agg1,agg2
    from public.tournament_matches
    where tie_id=tie.id;

    if agg1>agg2 then winner_id=tie.player1_id;
    elsif agg2>agg1 then winner_id=tie.player2_id;
    elsif p_deciding_winner_player_id in(tie.player1_id,tie.player2_id) then winner_id=p_deciding_winner_player_id;
    else raise exception 'Aggregate score is level. Supply the deciding winner after extra time/penalties.'; end if;

    update public.tournament_ties
    set winner_player_id=winner_id,status='completed',updated_at=now()
    where id=tie.id;

    if tie.next_tie_id is not null then
      if tie.next_slot=1 then
        update public.tournament_ties set player1_id=winner_id,updated_at=now() where id=tie.next_tie_id;
      else
        update public.tournament_ties set player2_id=winner_id,updated_at=now() where id=tie.next_tie_id;
      end if;

      select * into next_tie from public.tournament_ties where id=tie.next_tie_id;
      if next_tie.player1_id is not null and next_tie.player2_id is not null then
        update public.tournament_ties set status='ready',updated_at=now() where id=next_tie.id;
        update public.tournament_matches
        set player1_id=next_tie.player1_id,player2_id=next_tie.player2_id,status='ready',updated_at=now()
        where tie_id=next_tie.id and leg_number=1 and status<>'completed';
        update public.tournament_matches
        set player1_id=next_tie.player2_id,player2_id=next_tie.player1_id,status='ready',updated_at=now()
        where tie_id=next_tie.id and leg_number=2 and status<>'completed';
        next_ready:=true;
      end if;
    end if;
  else
    winner_id:=case when p_player1_score>p_player2_score then m.player1_id else m.player2_id end;

    update public.tournament_matches
    set winner_player_id=winner_id,updated_at=now()
    where id=m.id;

    if m.next_match_id is not null then
      if m.next_slot=1 then
        update public.tournament_matches
        set player1_id=winner_id,
            status=case when player2_id is not null then 'ready' else status end,
            updated_at=now()
        where id=m.next_match_id;
      else
        update public.tournament_matches
        set player2_id=winner_id,
            status=case when player1_id is not null then 'ready' else status end,
            updated_at=now()
        where id=m.next_match_id;
      end if;

      select(player1_id is not null and player2_id is not null)
      into next_ready
      from public.tournament_matches
      where id=m.next_match_id;
    end if;
  end if;

  select count(*) into pending_matches
  from public.tournament_matches
  where tournament_id=m.tournament_id and status<>'completed';

  if pending_matches=0 then
    final_competition:=true;
    update public.tournaments
    set status='completed',completed_at=now(),updated_at=now()
    where id=m.tournament_id;
  end if;

  return jsonb_build_object(
    'ok',true,
    'matchId',m.id,
    'tournamentId',m.tournament_id,
    'winnerPlayerId',winner_id,
    'tieComplete',m.tie_id is not null,
    'nextReady',next_ready,
    'final',final_competition,
    'advanced',advance_result->'advanced',
    'advancedTo',advance_result->'toStage'
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.save_tournament_draft(p_payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  t_id bigint; p jsonb; t_format integer; t_name text; t_slug text;
begin
  t_id := nullif(p_payload->>'id','')::bigint;
  t_name := trim(coalesce(p_payload->>'name',''));
  t_slug := trim(coalesce(p_payload->>'slug',''));
  t_format := coalesce(nullif(p_payload->>'participantCount','')::integer, jsonb_array_length(coalesce(p_payload->'players','[]'::jsonb)));

  if t_name='' then raise exception 'Tournament name is required.'; end if;
  if t_format < 2 or t_format > 5000 then raise exception 'Tournament must have between 2 and 5000 participants.'; end if;
  if t_slug='' then raise exception 'Tournament slug is required.'; end if;

  if t_id is null then
    insert into public.tournaments(slug,name,description,format,format_key,participant_count,format_config,status,is_public,starts_at,settings,owner_key,updated_at)
    values(
      t_slug,t_name,coalesce(p_payload->>'description',''),t_format,
      coalesce(p_payload->>'formatKey','single_elimination'),t_format,
      coalesce(p_payload->'formatConfig','{}'::jsonb),'draft',
      coalesce((p_payload->>'isPublic')::boolean,false),
      nullif(p_payload->>'startsAt','')::timestamptz,
      coalesce(p_payload->'settings','{}'::jsonb),
      coalesce(p_payload->>'ownerKey','organizer'),now()
    ) returning id into t_id;
  else
    if exists(select 1 from public.tournament_matches where tournament_id=t_id)
       or exists(select 1 from public.tournament_stages where tournament_id=t_id) then
      raise exception 'The tournament structure already exists. Stage settings and participants are locked after generation.';
    end if;
    update public.tournaments
    set slug=t_slug,name=t_name,description=coalesce(p_payload->>'description',''),
        format=t_format,format_key=coalesce(p_payload->>'formatKey','single_elimination'),
        participant_count=t_format,format_config=coalesce(p_payload->'formatConfig','{}'::jsonb),
        is_public=coalesce((p_payload->>'isPublic')::boolean,false),
        starts_at=nullif(p_payload->>'startsAt','')::timestamptz,
        settings=coalesce(p_payload->'settings','{}'::jsonb),updated_at=now()
    where id=t_id;
    if not found then raise exception 'Tournament not found.'; end if;
  end if;

  delete from public.tournament_players where tournament_id=t_id;

  for p in select * from jsonb_array_elements(coalesce(p_payload->'players','[]'::jsonb))
  loop
    insert into public.tournament_players(tournament_id,slot,display_name,player_tag,avatar_url,seed,metadata)
    values(
      t_id,(p->>'slot')::smallint,trim(coalesce(p->>'displayName','')),
      trim(coalesce(p->>'playerTag','')),coalesce(p->>'avatarUrl',''),
      nullif(p->>'seed','')::smallint,coalesce(p->'metadata','{}'::jsonb)
    );
  end loop;

  return t_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.save_tournament_structure(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_tournament_id bigint := (p_payload->>'tournamentId')::bigint;
  v_stage jsonb; v_group jsonb; v_match jsonb;
  v_tournament public.tournaments%rowtype;
  v_stage_id bigint; v_group_id bigint; v_tie_id bigint;
  v_existing integer; v_pid bigint;
begin
  select * into v_tournament from public.tournaments where id=v_tournament_id for update;
  if not found then raise exception 'Tournament not found.'; end if;

  select count(*) into v_existing from public.tournament_matches where tournament_id=v_tournament_id;
  if v_existing>0 then raise exception 'Tournament structure already exists.'; end if;

  delete from public.tournament_standings where tournament_id=v_tournament_id;
  delete from public.tournament_matches where tournament_id=v_tournament_id;
  delete from public.tournament_ties where tournament_id=v_tournament_id;
  delete from public.tournament_groups where tournament_groups.stage_id in (select s.id from public.tournament_stages s where s.tournament_id=v_tournament_id);
  delete from public.tournament_stages where tournament_stages.tournament_id=v_tournament_id;

  for v_stage in select * from jsonb_array_elements(coalesce(p_payload->'stages','[]'::jsonb))
  loop
    insert into public.tournament_stages(
      tournament_id,stage_order,stage_key,name,stage_type,match_mode,
      group_count,teams_per_group,advance_per_group,rounds,config
    )
    values(
      v_tournament_id,(v_stage->>'stageOrder')::smallint,v_stage->>'stageKey',v_stage->>'name',
      v_stage->>'stageType',coalesce(v_stage->>'matchMode','single'),
      nullif(v_stage->>'groupCount','')::integer,
      nullif(v_stage->>'teamsPerGroup','')::integer,
      nullif(v_stage->>'advancePerGroup','')::integer,
      nullif(v_stage->>'rounds','')::integer,
      coalesce(v_stage->'config','{}'::jsonb)
    ) returning id into v_stage_id;

    for v_group in select * from jsonb_array_elements(coalesce(v_stage->'groups','[]'::jsonb))
    loop
      insert into public.tournament_groups(stage_id,group_number,name)
      values(v_stage_id,(v_group->>'groupNumber')::smallint,v_group->>'name')
      returning id into v_group_id;

      for v_pid in select (jsonb_array_elements_text(coalesce(v_group->'playerIds','[]'::jsonb)))::bigint
      loop
        insert into public.tournament_standings(tournament_id,stage_id,group_id,player_id)
        values(v_tournament_id,v_stage_id,v_group_id,v_pid)
        on conflict(stage_id,group_id,player_id) do nothing;
      end loop;
    end loop;

    for v_pid in select (jsonb_array_elements_text(coalesce(v_stage->'standingsPlayerIds','[]'::jsonb)))::bigint
    loop
      if not exists(
        select 1 from public.tournament_standings s
        where s.stage_id=v_stage_id and s.player_id=v_pid and s.group_id is null
      ) then
        insert into public.tournament_standings(tournament_id,stage_id,group_id,player_id)
        values(v_tournament_id,v_stage_id,null,v_pid);
      end if;
    end loop;

    for v_match in select * from jsonb_array_elements(coalesce(v_stage->'matches','[]'::jsonb))
    loop
      v_group_id:=null;
      if v_match ? 'groupNumber' then
        select g.id into v_group_id
        from public.tournament_groups g
        where g.stage_id=v_stage_id and g.group_number=(v_match->>'groupNumber')::smallint;
      end if;

      v_tie_id:=null;
      if v_match ? 'tieNumber' then
        select t.id into v_tie_id
        from public.tournament_ties t
        where t.tournament_id=v_tournament_id and t.tie_number=(v_match->>'tieNumber')::integer;

        if v_tie_id is null then
          insert into public.tournament_ties(
            tournament_id,stage_id,tie_number,player1_id,player2_id,legs_required,status,winner_player_id
          )
          values(
            v_tournament_id,v_stage_id,(v_match->>'tieNumber')::integer,
            nullif(v_match->>'tiePlayer1Id','')::bigint,
            nullif(v_match->>'tiePlayer2Id','')::bigint,
            coalesce((v_match->>'legsRequired')::smallint,1),
            case when nullif(v_match->>'winnerPlayerId','')::bigint is not null then 'completed'
                 when nullif(v_match->>'tiePlayer1Id','')::bigint is not null
                   and nullif(v_match->>'tiePlayer2Id','')::bigint is not null then 'ready'
                 else 'scheduled' end,
            nullif(v_match->>'winnerPlayerId','')::bigint
          ) returning id into v_tie_id;
        end if;
      end if;

      insert into public.tournament_matches(
        tournament_id,stage_id,group_id,tie_id,round_number,match_number,matchday,leg_number,
        player1_id,player2_id,status,winner_player_id,home_score,away_score
      )
      values(
        v_tournament_id,v_stage_id,v_group_id,v_tie_id,
        coalesce((v_match->>'roundNumber')::smallint,1),
        coalesce((v_match->>'matchNumber')::smallint,1),
        nullif(v_match->>'matchday','')::smallint,
        coalesce((v_match->>'legNumber')::smallint,1),
        nullif(v_match->>'player1Id','')::bigint,
        nullif(v_match->>'player2Id','')::bigint,
        coalesce(v_match->>'status','scheduled'),
        nullif(v_match->>'winnerPlayerId','')::bigint,
        nullif(v_match->>'homeScore','')::integer,
        nullif(v_match->>'awayScore','')::integer
      );
    end loop;

    update public.tournament_matches a
    set next_match_id=b.id,
        next_slot=case when a.match_number%2=1 then 1 else 2 end,
        updated_at=now()
    from public.tournament_matches b
    where a.tournament_id=v_tournament_id
      and b.tournament_id=v_tournament_id
      and a.stage_id=v_stage_id and b.stage_id=v_stage_id
      and a.tie_id is null and b.tie_id is null
      and a.round_number+1=b.round_number
      and b.match_number=ceil(a.match_number/2.0)::smallint;
  end loop;

  update public.tournaments set updated_at=now() where id=v_tournament_id;
  return jsonb_build_object('ok',true,'tournamentId',v_tournament_id);
end;
$function$


revoke all on function public.save_tournament_draft(jsonb),public.save_tournament_structure(jsonb),public.link_tournament_progression(bigint),public.advance_tournament_stage(bigint),public.record_tournament_match_result_v2(bigint,integer,integer,bigint) from public,anon,authenticated;
grant execute on function public.save_tournament_draft(jsonb),public.save_tournament_structure(jsonb),public.link_tournament_progression(bigint),public.advance_tournament_stage(bigint),public.record_tournament_match_result_v2(bigint,integer,integer,bigint) to service_role;
