// Match Center API: player-driven results. Mirrors leagueWorkerRoute's injected-helper pattern.
// Flow: claim seat -> chat/schedule -> report score+screenshot -> opponent confirms (auto-applies result) or disputes (admin queue).
const q = encodeURIComponent;
const num = (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < 100 ? Number(v) : null);

export async function matchCenterRoute({ request, env, url, accountContext, supabaseRest, json }) {
  if (!url.pathname.startsWith('/api/match-center/')) return null;
  const ctx = await accountContext(request, env);
  if (!ctx) return json({ error: 'Sign in to use the Match Center.' }, 401);
  const { account } = ctx;
  const path = url.pathname.replace('/api/match-center/', '');
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const rest = (p, o) => supabaseRest(env, p, o);
  const post = (p, data, prefer = 'return=representation') => rest(p, { method: 'POST', headers: { Prefer: prefer }, body: JSON.stringify(data) });
  const patch = (p, data) => rest(p, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(data) });

  try {
    const mine = (await rest(`tournament_players?account_id=eq.${q(account.id)}&status=eq.active&select=id,tournament_id,display_name,discord_handle,fc_uid&limit=50`)) || [];
    const ids = mine.map((p) => p.id);

    // Claim an unclaimed seat by exact player tag, and share Discord / UID with opponents.
    if (path === 'claim' && request.method === 'POST') {
      const tag = String(body.playerTag || '').trim();
      if (!tag) return json({ error: 'Enter the player tag you registered with.' }, 400);
      const seats = (await rest(`tournament_players?player_tag=ilike.${q(tag)}&account_id=is.null&select=id&limit=5`)) || [];
      if (!seats.length) return json({ error: 'No open seat matches that tag. Ask an admin to check your registration.' }, 404);
      for (const s of seats) await patch(`tournament_players?id=eq.${s.id}`, { account_id: account.id, discord_handle: String(body.discord || '').slice(0, 40), fc_uid: String(body.uid || '').slice(0, 24) });
      return json({ ok: true, claimed: seats.length });
    }

    if (path === 'mine' && request.method === 'GET') {
      if (!ids.length) return json({ seats: [], matches: [] });
      const list = ids.join(',');
      const ms = (await rest(`tournament_matches?or=(player1_id.in.(${list}),player2_id.in.(${list}))&status=in.(scheduled,ready,live)&player1_id=not.is.null&player2_id=not.is.null&select=*&order=round_number.asc&limit=50`)) || [];
      const mids = ms.map((m) => m.id).join(',') || '0';
      const pids = [...new Set(ms.flatMap((m) => [m.player1_id, m.player2_id]))].join(',') || '0';
      const [players, reports, msgs, tours] = await Promise.all([
        rest(`tournament_players?id=in.(${pids})&select=id,display_name,discord_handle,fc_uid,account_id`),
        rest(`tournament_match_reports?match_id=in.(${mids})&order=created_at.desc&select=*`),
        rest(`tournament_match_messages?match_id=in.(${mids})&order=created_at.asc&select=*`),
        rest(`tournaments?id=in.(${[...new Set(ms.map((m) => m.tournament_id))].join(',') || '0'})&select=id,name,slug`),
      ]);
      const now = Date.now();
      for (const r of reports || []) if (r.status === 'pending' && new Date(r.expires_at).getTime() < now) { r.status = 'escalated'; await patch(`tournament_match_reports?id=eq.${r.id}`, { status: 'escalated' }); }
      const P = Object.fromEntries((players || []).map((p) => [p.id, p]));
      const out = ms.map((m) => {
        const meId = ids.includes(m.player1_id) ? m.player1_id : m.player2_id;
        const oppId = meId === m.player1_id ? m.player2_id : m.player1_id;
        const opp = P[oppId] || {};
        return { ...m, meId, tournament: (tours || []).find((t) => t.id === m.tournament_id),
          opponent: { name: opp.display_name, discord: opp.discord_handle, uid: opp.fc_uid },
          report: (reports || []).find((r) => r.match_id === m.id && r.status !== 'superseded') || null,
          messages: (msgs || []).filter((x) => x.match_id === m.id).slice(-30) };
      });
      return json({ seats: mine, matches: out });
    }

    const matchOf = async (id) => {
      const m = (await rest(`tournament_matches?id=eq.${Number(id)}&select=*&limit=1`))?.[0];
      const meId = m && ids.find((i) => i === m.player1_id || i === m.player2_id);
      return m && meId ? { m, meId } : null;
    };

    if (path === 'message' && request.method === 'POST') {
      const x = await matchOf(body.matchId); if (!x) return json({ error: 'This is not your match.' }, 403);
      const text = String(body.body || '').trim().slice(0, 400); if (!text) return json({ error: 'Write a message first.' }, 400);
      const kind = body.kind === 'schedule' ? 'schedule' : 'chat';
      await post('tournament_match_messages', { match_id: x.m.id, sender_player_id: x.meId, kind, body: text, proposed_at: kind === 'schedule' ? body.proposedAt || null : null }, 'return=minimal');
      return json({ ok: true });
    }

    if (path === 'report' && request.method === 'POST') {
      const x = await matchOf(body.matchId); if (!x) return json({ error: 'This is not your match.' }, 403);
      const mine1 = x.meId === x.m.player1_id, a = num(body.myScore), b = num(body.oppScore);
      if (a === null || b === null) return json({ error: 'Enter whole-number scores.' }, 400);
      if (!/^https:\/\//.test(String(body.screenshotUrl || ''))) return json({ error: 'Upload the full-time screenshot first.' }, 400);
      await patch(`tournament_match_reports?match_id=eq.${x.m.id}&status=in.(pending,disputed,escalated)`, { status: 'superseded' });
      await post('tournament_match_reports', { match_id: x.m.id, reporter_player_id: x.meId, player1_score: mine1 ? a : b, player2_score: mine1 ? b : a, screenshot_url: body.screenshotUrl }, 'return=minimal');
      return json({ ok: true });
    }

    if (path === 'respond' && request.method === 'POST') {
      const r = (await rest(`tournament_match_reports?id=eq.${Number(body.reportId)}&select=*&limit=1`))?.[0];
      const x = r && (await matchOf(r.match_id));
      if (!x || r.reporter_player_id === x.meId) return json({ error: 'Only the opponent can respond to this report.' }, 403);
      if (r.status !== 'pending') return json({ error: 'This report is no longer waiting for a response.' }, 409);
      if (body.action === 'dispute') {
        await patch(`tournament_match_reports?id=eq.${r.id}`, { status: 'disputed', response_note: String(body.note || '').slice(0, 300), responded_at: new Date().toISOString() });
        return json({ ok: true, status: 'disputed' });
      }
      // Both parties agree: apply through the existing, tested engine RPC so brackets advance exactly as admin entry would.
      await rest('rpc/update_tournament_match_result_v2', { method: 'POST', body: JSON.stringify({ p_match_id: r.match_id, p_player1_score: r.player1_score, p_player2_score: r.player2_score, p_deciding_winner_player_id: null }) });
      await patch(`tournament_match_reports?id=eq.${r.id}`, { status: 'confirmed', responded_at: new Date().toISOString() });
      return json({ ok: true, status: 'confirmed' });
    }
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    return json({ error: e?.message || 'Match Center is unavailable right now.' }, 500);
  }
}
