// View helpers shared by /tournaments and /tournament/[slug].
// Pure functions only: everything here runs at build time against the
// published tournament snapshot in src/data/tournaments.js.

const HUES = [196, 214, 236, 262, 286, 168, 28, 344];

/** Deterministic initials + hue so every player gets a stable crest without avatars. */
export function monogram(player) {
  const name = String(player?.displayName || '').trim();
  const seed = name || String(player?.playerTag || '?');
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const letters = (name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '?').toUpperCase();
  return { letters, hue: HUES[h % HUES.length] };
}

export const hasBothPlayers = (m) => Boolean(m?.player1 && m?.player2);
const isBye = (m) => m?.status === 'completed' && !hasBothPlayers(m);

export function allMatches(t) {
  return (t?.stages || []).flatMap((s) => s.matches || []);
}

/** Counts real fixtures only (byes are not matches anyone plays). */
export function progressOf(t) {
  const real = allMatches(t).filter((m) => !isBye(m));
  const done = real.filter((m) => m.status === 'completed' && hasBothPlayers(m)).length;
  return { total: real.length, done, pct: real.length ? Math.round((done / real.length) * 100) : 0 };
}

export function formatLabel(key) {
  const map = {
    single_elimination: 'Single elimination',
    single_elimination_two_leg: 'Two-leg knockout',
    round_robin: 'Round robin',
    home_away_round_robin: 'Home and away league',
    group_knockout: 'Groups and knockout',
    fifa_asean_cup: 'ASEAN Cup style',
    asean_championship: 'ASEAN Championship style',
    world_cup_style: 'World Cup style',
    groups_home_away_knockout: 'Groups and two-leg knockout',
    champions_league: 'Champions League style',
    league_to_knockout: 'League and playoffs',
    swiss_system: 'Swiss system',
    swiss_to_knockout: 'Swiss and knockout',
    best_of_series: 'Best-of series',
    custom_builder: 'Custom competition'
  };
  return map[key] || String(key || 'Tournament').replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}

export function matchModeLabel(mode) {
  const m = String(mode || 'single');
  if (m === 'single') return 'single match';
  if (m === 'home_away') return 'home and away';
  if (m.startsWith('best_of_')) return `best of ${m.split('_')[2]}`;
  return m.replaceAll('_', ' ');
}

export function stageTypeLabel(type) {
  return { knockout: 'Knockout', group: 'Group stage', league: 'League', swiss: 'Swiss' }[type] || 'Stage';
}

export function formatDate(iso, withTime = false) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const opts = withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleString('en-GB', { ...opts, timeZone: 'UTC' });
}

/* ---------- knockout ---------- */

function roundName(fromEnd) {
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-finals';
  if (fromEnd === 2) return 'Quarter-finals';
  return `Round of ${2 ** (fromEnd + 1)}`;
}

function buildTie(matches) {
  const sorted = [...matches].sort((a, b) => (a.legNumber || 1) - (b.legNumber || 1));
  const first = sorted[0];
  const p1 = first.player1 || null;
  const p2 = first.player2 || null;
  const twoLeg = sorted.length > 1;
  let s1 = first.player1Score;
  let s2 = first.player2Score;
  let winnerId = null;

  if (twoLeg) {
    const [l1, l2] = sorted;
    const complete = sorted.every((m) => m.player1Score != null && m.player2Score != null);
    if (complete) {
      s1 = l1.player1Score + l2.player2Score;
      s2 = l1.player2Score + l2.player1Score;
    } else {
      s1 = null;
      s2 = null;
    }
    winnerId = sorted.map((m) => m.winnerPlayerId).find(Boolean) || null;
    if (!winnerId && complete && s1 !== s2) winnerId = s1 > s2 ? p1?.id : p2?.id;
  } else {
    winnerId = first.winnerPlayerId || null;
  }

  const pens = !twoLeg && first.penaltiesHome != null && first.penaltiesAway != null
    ? [first.penaltiesHome, first.penaltiesAway]
    : null;
  const bye = sorted.every(isBye);
  const status = sorted.every((m) => m.status === 'completed')
    ? 'completed'
    : sorted.some((m) => m.status === 'ready' || m.status === 'completed') && p1 && p2
      ? 'ready'
      : 'scheduled';

  return {
    key: first.tieId ?? `m${first.id}`,
    matchNumber: first.matchNumber,
    p1, p2, s1, s2, winnerId, pens, bye, status,
    legs: twoLeg ? sorted : null
  };
}

export function buildKnockout(stage) {
  const byRound = new Map();
  for (const m of stage.matches || []) {
    if (!byRound.has(m.roundNumber)) byRound.set(m.roundNumber, new Map());
    const ties = byRound.get(m.roundNumber);
    const key = m.tieId ?? `m${m.id}`;
    if (!ties.has(key)) ties.set(key, []);
    ties.get(key).push(m);
  }

  const numbers = [...byRound.keys()].sort((a, b) => a - b);
  const rounds = numbers.map((n) => ({
    number: n,
    ties: [...byRound.get(n).values()].map(buildTie).sort((a, b) => a.matchNumber - b.matchNumber)
  }));

  // A last round with more than one tie carries a third-place play-off after the final.
  let thirdPlace = null;
  const last = rounds[rounds.length - 1];
  if (last && last.ties.length > 1) thirdPlace = last.ties.splice(1)[0];

  rounds.forEach((r, i) => {
    r.label = roundName(rounds.length - 1 - i);
    r.done = r.ties.filter((t) => t.status === 'completed' && !t.bye).length;
    r.count = r.ties.filter((t) => !t.bye).length;
  });

  // Connector lines only make sense when each round halves cleanly.
  const paired = rounds.every((r, i) => i === rounds.length - 1 || r.ties.length === rounds[i + 1].ties.length * 2);

  const final = last?.ties[0] || null;
  const champion = final?.winnerId
    ? (final.p1?.id === final.winnerId ? final.p1 : final.p2)
    : null;

  return { rounds, thirdPlace, paired, champion };
}

/* ---------- tables + fixtures ---------- */

export function sortStandings(rows) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const ra = a.row.rank ?? Infinity;
      const rb = b.row.rank ?? Infinity;
      if (ra !== rb) return ra - rb;
      return (b.row.points - a.row.points) || (b.row.goalDifference - a.row.goalDifference) || (a.index - b.index);
    })
    .map((x) => x.row);
}

/** Group fixtures by matchday (leagues) or round (groups), ordered. */
export function groupByMatchday(matches) {
  const map = new Map();
  for (const m of matches) {
    const day = m.matchday ?? m.roundNumber ?? 1;
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(m);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, list]) => ({
      day,
      matches: list.sort((a, b) => a.matchNumber - b.matchNumber),
      pending: list.some((m) => m.status !== 'completed')
    }));
}

export function nextMatch(t) {
  for (const stage of t?.stages || []) {
    const next = [...(stage.matches || [])]
      .filter((m) => m.status === 'ready' && hasBothPlayers(m))
      .sort((a, b) => (a.matchday ?? a.roundNumber) - (b.matchday ?? b.roundNumber) || a.matchNumber - b.matchNumber)[0];
    if (next) return { match: next, stage };
  }
  return null;
}

export function championOf(t) {
  if (t?.winner) return t.winner;
  const ko = [...(t?.stages || [])].reverse().find((s) => s.type === 'knockout');
  return ko ? buildKnockout(ko).champion : null;
}

export function tournamentState(t) {
  if (championOf(t) || t.status === 'completed') return { key: 'finished', label: 'Finished' };
  if (progressOf(t).done > 0 || t.status === 'in_progress') return { key: 'live', label: 'Live' };
  return { key: 'upcoming', label: 'Upcoming' };
}
