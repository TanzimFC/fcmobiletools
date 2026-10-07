-- Propagate match/tie winners into following fixtures after every recorded result.\n\nCREATE OR REPLACE FUNCTION public.update_tournament_match_result_v2(p_match_id bigint, p_player1_score integer, p_player2_score integer, p_deciding_winner_player_id bigint DEFAULT NULL::bigint, p_expected_player1_id bigint DEFAULT NULL::bigint, p_expected_player2_id bigint DEFAULT NULL::bigint)
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
            select id,next_tie_id
            from public.tournament_ties
            where id=tie.next_tie_id
            union all
            select child.id,child.next_tie_id
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

        null;
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

        null;
      end if;
    end if;
  end if;

  -- Initialize the next configured stage as soon as the current stage is fully complete.
  -- This keeps group/league -> knockout formats flowing without a manual admin step.
  if not exists(
       select 1
       from public.tournament_matches x
       where x.stage_id=m.stage_id
         and x.status<>'completed'
     )
     and exists(
       select 1
       from public.tournament_stages ns
       join public.tournament_stages cs on cs.id=m.stage_id
       where ns.tournament_id=m.tournament_id
         and ns.stage_order>cs.stage_order
         and not exists(
           select 1 from public.tournament_matches x where x.stage_id=ns.id
         )
     ) then
    perform public.advance_tournament_stage(m.tournament_id);
  end if;

  -- FIFA ASEAN Cup sample/preset uses a semifinal stage first. Once both
  -- semifinals are complete, create the final and optional third-place match.
  if m.stage_id is not null
     and v_stage_type='knockout'
     and exists(
       select 1
       from public.tournament_stages fs
       where fs.id=m.stage_id
         and fs.stage_key='fifa_final'
     )
     and not exists(
       select 1
       from public.tournament_matches x
       where x.stage_id=m.stage_id
         and x.round_number=1
         and x.status<>'completed'
     )
     and not exists(
       select 1
       from public.tournament_matches x
       where x.stage_id=m.stage_id
         and x.round_number=2
     ) then
    insert into public.tournament_matches(
      tournament_id,stage_id,round_number,match_number,
      player1_id,player2_id,status
    )
    select m.tournament_id,m.stage_id,2,1,
           a.winner_player_id,b.winner_player_id,'ready'
    from public.tournament_matches a
    join public.tournament_matches b
      on b.tournament_id=a.tournament_id
     and b.stage_id=a.stage_id
     and b.round_number=1
     and b.match_number=2
    where a.tournament_id=m.tournament_id
      and a.stage_id=m.stage_id
      and a.round_number=1
      and a.match_number=1;

    if coalesce((
      select (fs.config->>'thirdPlace')::boolean
      from public.tournament_stages fs
      where fs.id=m.stage_id
      limit 1
    ),false) then
      insert into public.tournament_matches(
        tournament_id,stage_id,round_number,match_number,
        player1_id,player2_id,status
      )
      select m.tournament_id,m.stage_id,2,2,
             a.player2_id,b.player2_id,'ready'
      from public.tournament_matches a
      join public.tournament_matches b
        on b.tournament_id=a.tournament_id
       and b.stage_id=a.stage_id
       and b.round_number=1
       and b.match_number=2
      where a.tournament_id=m.tournament_id
        and a.stage_id=m.stage_id
        and a.round_number=1
        and a.match_number=1;
    end if;
  end if;

  -- Propagate completed match/tie winners into the next ready fixture.
  perform public.link_tournament_progression(m.tournament_id);

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
revoke all on function public.update_tournament_match_result_v2(bigint,integer,integer,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.update_tournament_match_result_v2(bigint,integer,integer,bigint,bigint,bigint) to service_role;
