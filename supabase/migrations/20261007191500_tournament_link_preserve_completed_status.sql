-- Keep completed non-tie matches completed while making ready fixtures ready.\n\nCREATE OR REPLACE FUNCTION public.link_tournament_progression(p_tournament_id bigint)
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
    set status=case
          when next_m.status='completed' then 'completed'
          when next_m.player1_id is not null and next_m.player2_id is not null then 'ready'
          else next_m.status
        end,
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
$function$\n