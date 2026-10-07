-- Automatic byes are only valid in Round 1; later rounds must wait for both feeder winners.

-- Final linker fix: aggregate two feeder winners and preserve completed match status.

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

  -- A one-player tie is a true bye only in Round 1. Later rounds may
  -- temporarily have one feeder while the other preceding tie is still pending.
  update public.tournament_ties t
  set winner_player_id=coalesce(t.player1_id,t.player2_id),
      status='completed',
      updated_at=now()
  where t.tournament_id=p_tournament_id
    and t.round_number=1
    and t.status<>'completed'
    and ((t.player1_id is not null and t.player2_id is null)
      or (t.player1_id is null and t.player2_id is not null));

  for i in 1..10 loop
    update public.tournament_ties nt
    set player1_id=coalesce(nt.player1_id,feed.player1_id),
        player2_id=coalesce(nt.player2_id,feed.player2_id),
        status=case
          when coalesce(nt.player1_id,feed.player1_id) is not null
           and coalesce(nt.player2_id,feed.player2_id) is not null
          then 'ready' else nt.status end,
        updated_at=now()
    from (
      select next_tie_id,
             max(winner_player_id) filter (where next_slot=1) as player1_id,
             max(winner_player_id) filter (where next_slot=2) as player2_id
      from public.tournament_ties
      where tournament_id=p_tournament_id
        and status='completed'
        and winner_player_id is not null
        and next_tie_id is not null
      group by next_tie_id
    ) feed
    where nt.id=feed.next_tie_id;

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
