import { nextPowerOfTwo, circleRounds, limitedLeagueRounds, normalizeParticipantCount } from './schedule.js';
import { getTournamentFormat } from './formats.js';

function playerId(p) {
  return Number(p.id || p.playerId);
}

function seedPlayers(players) {
  return [...players].sort((a, b) => Number(a.seed || a.slot) - Number(b.seed || b.slot));
}

function stageBase(stageOrder, key, name, stageType, matchMode, config = {}) {
  return {
    stageOrder,
    stageKey: key,
    name,
    stageType,
    matchMode,
    rounds: config.rounds ?? null,
    groupCount: config.groups ?? null,
    teamsPerGroup: config.teamsPerGroup ?? null,
    advancePerGroup: config.advancePerGroup ?? null,
    config,
    groups: [],
    standingsPlayerIds: [],
    matches: []
  };
}

function buildKnockout(players, { twoLeg = false, bestOf = 1 } = {}) {
  const seeded = seedPlayers(players);
  const slots = [];
  const bracketSize = nextPowerOfTwo(seeded.length);
  for (let i = 0; i < bracketSize; i++) slots.push(seeded[i] || null);

  const rounds = [];
  let size = bracketSize;
  let firstRound = [];
  for (let i = 0; i < size / 2; i++) {
    firstRound.push([slots[i * 2], slots[i * 2 + 1]]);
  }
  rounds.push(firstRound);
  while (size > 2) {
    size /= 2;
    rounds.push(Array.from({ length: size / 2 }, () => [null, null]));
  }

  const stage = stageBase(1, 'knockout', 'Knockout Stage', 'knockout', twoLeg ? 'home_away' : (bestOf > 1 ? `best_of_${bestOf}` : 'single'), {
    bracketSize,
    participantCount: seeded.length,
    byes: bracketSize - seeded.length,
    bestOf
  });

  let tieNumber = 1;
  for (let r = 0; r < rounds.length; r++) {
    let roundMatchNumber = 1;
    for (let i = 0; i < rounds[r].length; i++) {
      const a = rounds[r][i][0] ? playerId(rounds[r][i][0]) : null;
      const b = rounds[r][i][1] ? playerId(rounds[r][i][1]) : null;
      if (twoLeg) {
        stage.matches.push({
          roundNumber: r + 1,
          matchNumber: roundMatchNumber,
          legNumber: 1,
          tieNumber,
          tiePlayer1Id: a,
          tiePlayer2Id: b,
          player1Id: a,
          player2Id: b,
          status: a && b ? 'ready' : 'completed',
          legsRequired: 2,
          winnerPlayerId: a && !b ? a : null
        });
        stage.matches.push({
          roundNumber: r + 1,
          matchNumber: roundMatchNumber + 1,
          legNumber: 2,
          tieNumber,
          tiePlayer1Id: a,
          tiePlayer2Id: b,
          player1Id: b,
          player2Id: a,
          status: a && b ? 'ready' : 'completed',
          legsRequired: 2,
          winnerPlayerId: a && !b ? a : null,
          config: { returnLeg: true }
        });
        roundMatchNumber += 2;
        tieNumber++;
      } else {
        stage.matches.push({
          roundNumber: r + 1,
          matchNumber: roundMatchNumber++,
          legNumber: 1,
          player1Id: a,
          player2Id: b,
          status: a && b ? 'ready' : 'completed',
          winnerPlayerId: a && !b ? a : null
        });
      }
    }
  }
  return stage;
}

function buildRoundRobin(players, { homeAway = false, stageKey = 'league', stageName = 'League Phase', roundLimit = null } = {}) {
  const ids = seedPlayers(players).map(playerId);
  const rounds = roundLimit ? limitedLeagueRounds(ids, roundLimit) : circleRounds(ids);
  const stage = stageBase(1, stageKey, stageName, stageKey === 'swiss' ? 'swiss' : 'league', homeAway ? 'home_away' : 'single', {
    standingsPlayerIds: ids,
    matchesPerTeam: homeAway ? rounds.length * 2 : rounds.length,
    points: { win: 3, draw: 1, loss: 0 }
  });
  let matchNumber = 1;
  rounds.forEach((fixtures, roundIndex) => fixtures.forEach((fixture) => {
    stage.matches.push({
      roundNumber: 1,
      matchNumber: matchNumber++,
      matchday: roundIndex + 1,
      player1Id: fixture.player1Id,
      player2Id: fixture.player2Id,
      legNumber: 1,
      status: 'ready'
    });
    if (homeAway) {
      stage.matches.push({
        roundNumber: 1,
        matchNumber: matchNumber++,
        matchday: rounds.length + roundIndex + 1,
        player1Id: fixture.player2Id,
        player2Id: fixture.player1Id,
        legNumber: 2,
        status: 'ready'
      });
    }
  }));
  stage.standingsPlayerIds = ids;
  return stage;
}

function buildGroupStage(players, groups, teamsPerGroup, groupHomeAway = false) {
  const seeded = seedPlayers(players);
  const groupCount = Number(groups);
  const actualTeamsPerGroup = teamsPerGroup || Math.ceil(seeded.length / groupCount);
  const stage = stageBase(1, 'group_stage', 'Group Stage', 'group', groupHomeAway ? 'home_away' : 'single', {
    groups: groupCount,
    teamsPerGroup: actualTeamsPerGroup
  });
  const buckets = Array.from({ length: groupCount }, () => []);
  seeded.forEach((p, index) => buckets[index % groupCount].push(playerId(p)));
  buckets.forEach((bucket, index) => {
    stage.groups.push({ groupNumber: index + 1, name: `Group ${String.fromCharCode(65 + (index % 26))}`, playerIds: bucket });
    const rounds = circleRounds(bucket);
    let matchNumber = stage.matches.length + 1;
    rounds.forEach((fixtures, roundIndex) => fixtures.forEach((fixture) => {
      stage.matches.push({
        roundNumber: 1,
        matchNumber: matchNumber++,
        matchday: roundIndex + 1,
        groupNumber: index + 1,
        player1Id: fixture.player1Id,
        player2Id: fixture.player2Id,
        legNumber: 1,
        status: 'ready'
      });
      if (groupHomeAway) {
        stage.matches.push({
          roundNumber: 1,
          matchNumber: matchNumber++,
          matchday: rounds.length + roundIndex + 1,
          groupNumber: index + 1,
          player1Id: fixture.player2Id,
          player2Id: fixture.player1Id,
          legNumber: 2,
          status: 'ready'
        });
      }
    }));
  });
  return stage;
}

export function buildTournamentStructure(tournament, players) {
  const format = getTournamentFormat(tournament.formatKey || 'single_elimination');
  const count = normalizeParticipantCount(players.length);
  if (count !== Number(tournament.participantCount || count)) {
    throw new Error(`Expected ${tournament.participantCount} participants, received ${count}.`);
  }
  const cfg = { ...format.defaults, ...(tournament.formatConfig || {}) };

  switch (format.key) {
    case 'single_elimination':
      return [buildKnockout(players, { twoLeg: cfg.matchMode === 'home_away' })];
    case 'single_elimination_two_leg':
      return [buildKnockout(players, { twoLeg: true })];
    case 'round_robin':
      return [buildRoundRobin(players)];
    case 'home_away_round_robin':
      return [buildRoundRobin(players, { homeAway: true })];
    case 'group_knockout':
    case 'groups_home_away_knockout':
    case 'asean_championship': {

      const groupStage = buildGroupStage(players, Number(cfg.groups || 2), Number(cfg.teamsPerGroup || 4), Boolean(cfg.groupHomeAway));
      if (format.key === 'asean_championship') {
        groupStage.config = { ...groupStage.config, preset: 'ASEAN Championship style', advancePerGroup: Number(cfg.advancePerGroup || 2) };
      }
      if (format.key === 'groups_home_away_knockout') {
        groupStage.config = { ...groupStage.config, preset: 'Groups + two-leg knockout' };
      }
      const knockout = stageBase(2, 'knockout', format.key === 'asean_championship' ? 'Semi-finals & Final' : 'Knockout Stage', 'knockout', cfg.knockoutMatchMode || 'single', {
        startsAfterStage: 1,
        advancePerGroup: Number(cfg.advancePerGroup || 2),
        legs: cfg.knockoutMatchMode === 'home_away' ? 2 : 1
      });
      return [groupStage, knockout];
    }
    case 'fifa_asean_cup': {
      const groupStage = buildGroupStage(players, Number(cfg.groups || 2), Number(cfg.teamsPerGroup || 4), false);
      groupStage.config = { ...groupStage.config, preset: 'FIFA ASEAN Cup style', advancePerGroup: 1 };
      const final = stageBase(2, 'fifa_final', 'Final & Third Place', 'knockout', 'single', {
        advancePerGroup: 1,
        thirdPlace: Boolean(cfg.thirdPlace),
        qualifierMode: 'group-winners-and-runners-up'
      });
      return [groupStage, final];
    }
    case 'champions_league': {
      const league = buildRoundRobin(players, { stageKey: 'league_phase', stageName: 'League Phase', roundLimit: Number(cfg.leagueRounds || 8) });
      league.config = {
        ...league.config,
        preset: 'Champions League style',
        matchesPerTeam: Number(cfg.leagueMatchesPerTeam || 8),
        topDirect: Number(cfg.topDirect || 8),
        playoffFrom: Number(cfg.playoffFrom || 9),
        playoffTo: Number(cfg.playoffTo || 24)
      };
      const playoffs = stageBase(2, 'knockout_playoff', 'Knockout Play-offs', 'playoff', cfg.playoffMatchMode || 'home_away', {
        qualification: 'league-rank',
        qualifiers: Math.max(0, Math.min(Number(cfg.playoffTo || 24), count) - Number(cfg.playoffFrom || 9) + 1),
        seededRange: [Number(cfg.playoffFrom || 9), Math.min(Number(cfg.playoffTo || 24), count)],
        seededPairing: 'rank-half-vs-rank-half'
      });
      const knockout = buildKnockout([], { twoLeg: true });
      knockout.stageOrder = 3;
      knockout.stageKey = 'final_knockout';
      knockout.name = 'Round of 16 to Final';
      knockout.config = { startsAfterPlayoff: true, seededPairing: 'direct-top-vs-playoff-winners', qualifiers: Number(cfg.topDirect || 8) * 2 };
      return [league, playoffs, knockout];
    }
    case 'league_to_knockout': {
      const league = buildRoundRobin(players, { stageKey: 'league', stageName: 'League Phase' });
      league.config = { ...league.config, qualifiers: Number(cfg.qualifiers || 8) };
      const playoff = buildKnockout([], { twoLeg: Number(cfg.playoffLegs || 2) === 2 });
      playoff.stageOrder = 2;
      playoff.stageKey = 'playoffs';
      playoff.name = 'Playoffs';
      return [league, playoff];
    }

    case 'custom_builder':
      return (cfg.stages || []).map((stage, index) => ({ ...stage, stageOrder: index + 1, groups: stage.groups || [], matches: stage.matches || [] }));
    default:
      throw new Error(`Format ${format.key} is not supported.`);
  }
}
