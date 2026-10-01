export function buildBracket(format, players) {
  if (![8, 16, 32].includes(Number(format))) throw new Error('Tournament format must be 8, 16, or 32.');
  const list = [...players].sort((a,b) => Number(a.seed ?? a.slot) - Number(b.seed ?? b.slot));
  if (list.length !== Number(format)) throw new Error(`Expected ${format} players.`);
  const rounds = [];
  let size = Number(format);
  let previous = [];
  while (size >= 2) {
    const matches = Array.from({ length: size / 2 }, (_, index) => ({
      round: rounds.length + 1,
      match: index + 1,
      player1: rounds.length === 0 ? list[index * 2] : null,
      player2: rounds.length === 0 ? list[index * 2 + 1] : null,
      winner: null,
      status: rounds.length === 0 ? 'ready' : 'scheduled'
    }));
    rounds.push(matches);
    previous = matches;
    size /= 2;
  }
  return rounds;
}
