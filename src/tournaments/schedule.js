export function nextPowerOfTwo(value) {
  let n = 2;
  while (n < Number(value)) n *= 2;
  return n;
}

export function circleRounds(playerIds) {
  const ids = [...playerIds];
  if (ids.length < 2) return [];
  if (ids.length % 2) ids.push(null);
  const n = ids.length;
  const rounds = [];
  let ring = ids.slice();
  for (let round = 0; round < n - 1; round++) {
    const fixtures = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a != null && b != null) fixtures.push({ round: round + 1, player1Id: a, player2Id: b });
    }
    rounds.push(fixtures);
    ring = [ring[0], ring[n - 1], ...ring.slice(1, n - 1)];
  }
  return rounds;
}

export function limitedLeagueRounds(playerIds, matchesPerTeam) {
  const all = circleRounds(playerIds);
  const roundsNeeded = Math.min(all.length, Math.max(1, Number(matchesPerTeam) || 1));
  return all.slice(0, roundsNeeded);
}

export function normalizeParticipantCount(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 2 || n > 5000) throw new Error('Participant count must be an integer between 2 and 5000.');
  return n;
}
