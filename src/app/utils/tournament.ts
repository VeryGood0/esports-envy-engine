// @ts-nocheck -- imported legacy code written for a looser tsconfig
import {
  Team,
  TournamentState,
  TournamentMatch,
  TournamentMode,
  TournamentTier,
  TournamentGroup,
  RoundRobinTableRow,
  SwissTeamRecord,
  TournamentFinalStanding,
  MatchFormat,
  TrophyMatchSummary,
  StageFormatSettings
} from '../types';
import { calculatePointsStakes, calculateMatchFormDeltas } from './probability';

export interface DestinationInfo {
  label: string;
  type: 'qualified' | 'eliminated' | 'pool';
  nextPool?: string;
  badgeClass: string;
}

/**
 * Returns destination of a team after winning or losing a Swiss match.
 */
export function getTeamDestination(poolKey: string, isWinner: boolean): DestinationInfo {
  const [w, l] = poolKey.split(':').map(Number);
  if (isNaN(w) || isNaN(l)) {
    return { label: '', type: 'pool', badgeClass: '' };
  }

  if (isWinner) {
    if (w === 2) {
      return {
        label: `В плей-офф (3:${l})`,
        type: 'qualified',
        badgeClass: 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
      };
    }
    const nextPool = `${w + 1}:${l}`;
    return {
      label: `В пул ${nextPool}`,
      type: 'pool',
      nextPool,
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    };
  } else {
    if (l === 2) {
      return {
        label: `Выбывание (${w}:3)`,
        type: 'eliminated',
        badgeClass: 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
      };
    }
    const nextPool = `${w}:${l + 1}`;
    return {
      label: `В пул ${nextPool}`,
      type: 'pool',
      nextPool,
      badgeClass: 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
    };
  }
}

/**
 * Generates default Round 1 Swiss matches sorted by VRS rank:
 * 1 vs 16, 2 vs 15, 3 vs 14, 4 vs 13, 5 vs 12, 6 vs 11, 7 vs 10, 8 vs 9.
 */
export function createDefaultSwissRound1Matches(teams: Team[]): TournamentMatch[] {
  const sorted = [...teams].sort((a, b) => b.points - a.points);
  const pairings = [
    [0, 15], // #1 vs #16
    [1, 14], // #2 vs #15
    [2, 13], // #3 vs #14
    [3, 12], // #4 vs #13
    [4, 11], // #5 vs #12
    [5, 10], // #6 vs #11
    [6, 9],  // #7 vs #10
    [7, 8]   // #8 vs #9
  ];

  return pairings.map(([idxA, idxB], i) => ({
    id: `swiss_r1_m${i + 1}`,
    stage: 'swiss',
    poolKey: '0:0',
    roundNumber: 1,
    name: `Раунд 1 (0:0) · Матч ${i + 1}`,
    teamAId: sorted[idxA]?.id,
    teamBId: sorted[idxB]?.id,
    scoreA: 0,
    scoreB: 0,
    format: 'BO1',
    status: 'ready'
  }));
}

/**
 * Swaps or assigns a team into a Swiss match slot, ensuring no team is duplicated.
 * If targetTeamId was in another match in the same round, the previous occupant swaps into its place.
 */
export function swapSwissRoundMatches(
  matches: TournamentMatch[],
  matchId: string,
  slot: 'A' | 'B',
  targetTeamId: string
): TournamentMatch[] {
  const targetMatch = matches.find((m) => m.id === matchId);
  if (!targetMatch) return matches;

  const currentTeamInSlot = slot === 'A' ? targetMatch.teamAId : targetMatch.teamBId;
  const roundNum = targetMatch.roundNumber;

  // Find if targetTeamId already occupies a slot in this same round
  const existingMatch = matches.find(
    (m) =>
      m.roundNumber === roundNum &&
      m.id !== matchId &&
      (m.teamAId === targetTeamId || m.teamBId === targetTeamId)
  );

  return matches.map((m) => {
    if (m.id === matchId) {
      return {
        ...m,
        teamAId: slot === 'A' ? targetTeamId : m.teamAId,
        teamBId: slot === 'B' ? targetTeamId : m.teamBId
      };
    }
    if (existingMatch && m.id === existingMatch.id) {
      // Put the displaced team into the existing match's vacated slot
      return {
        ...m,
        teamAId: m.teamAId === targetTeamId ? currentTeamInSlot : m.teamAId,
        teamBId: m.teamBId === targetTeamId ? currentTeamInSlot : m.teamBId
      };
    }
    return m;
  });
}

/**
 * Swaps or assigns a team into a Quarterfinal playoff match slot without duplicates.
 */
export function swapPlayoffMatches(
  matches: TournamentMatch[],
  matchId: string,
  slot: 'A' | 'B',
  targetTeamId: string
): TournamentMatch[] {
  const targetMatch = matches.find((m) => m.id === matchId);
  if (!targetMatch) return matches;

  const currentTeamInSlot = slot === 'A' ? targetMatch.teamAId : targetMatch.teamBId;

  // Find if targetTeamId already occupies a slot in any QF match
  const existingMatch = matches.find(
    (m) =>
      m.poolKey.startsWith('qf') &&
      m.id !== matchId &&
      (m.teamAId === targetTeamId || m.teamBId === targetTeamId)
  );

  return matches.map((m) => {
    if (m.id === matchId) {
      const nextA = slot === 'A' ? targetTeamId : m.teamAId;
      const nextB = slot === 'B' ? targetTeamId : m.teamBId;
      return {
        ...m,
        teamAId: nextA,
        teamBId: nextB,
        status: nextA && nextB ? ('ready' as const) : m.status
      };
    }
    if (existingMatch && m.id === existingMatch.id) {
      const nextA = m.teamAId === targetTeamId ? currentTeamInSlot : m.teamAId;
      const nextB = m.teamBId === targetTeamId ? currentTeamInSlot : m.teamBId;
      return {
        ...m,
        teamAId: nextA,
        teamBId: nextB,
        status: nextA && nextB ? ('ready' as const) : m.status
      };
    }
    return m;
  });
}

/**
 * Swaps or assigns a team into a GSL group opening match slot without duplicates inside the group.
 */
export function swapGroupOpeningMatches(
  matches: TournamentMatch[],
  matchId: string,
  slot: 'A' | 'B',
  targetTeamId: string
): TournamentMatch[] {
  const targetMatch = matches.find((m) => m.id === matchId);
  if (!targetMatch) return matches;

  const currentTeamInSlot = slot === 'A' ? targetMatch.teamAId : targetMatch.teamBId;

  // Find if targetTeamId already occupies a slot in opening matches of this group
  const existingMatch = matches.find(
    (m) =>
      m.id !== matchId &&
      (m.poolKey?.includes('opening') || m.id.includes('opening') || m.id.includes('_m1') || m.id.includes('_m2')) &&
      (m.teamAId === targetTeamId || m.teamBId === targetTeamId)
  );

  return matches.map((m) => {
    if (m.id === matchId) {
      const nextA = slot === 'A' ? targetTeamId : m.teamAId;
      const nextB = slot === 'B' ? targetTeamId : m.teamBId;
      return {
        ...m,
        teamAId: nextA,
        teamBId: nextB,
        status: nextA && nextB ? ('ready' as const) : m.status
      };
    }
    if (existingMatch && m.id === existingMatch.id) {
      const nextA = m.teamAId === targetTeamId ? currentTeamInSlot : m.teamAId;
      const nextB = m.teamBId === targetTeamId ? currentTeamInSlot : m.teamBId;
      return {
        ...m,
        teamAId: nextA,
        teamBId: nextB,
        status: nextA && nextB ? ('ready' as const) : m.status
      };
    }
    return m;
  });
}

/**
 * Computes live VRS Stakes and Form deltas for any tournament match.
 */
export function calculateTournamentMatchDeltas(
  teamA: Team,
  teamB: Team,
  scoreA: number,
  scoreB: number,
  winnerId: string,
  allTeams: Team[]
): {
  deltaPointsA: number;
  deltaPointsB: number;
  deltaFormA: number;
  deltaFormB: number;
  isUpset: boolean;
} {
  const stakes = calculatePointsStakes(teamA, teamB, allTeams);
  const probA = (teamA.points || 1500) / ((teamA.points || 1500) + (teamB.points || 1500));

  let deltaPointsA = 0;
  let deltaPointsB = 0;
  if (winnerId === teamA.id) {
    deltaPointsA = stakes.winA;
    deltaPointsB = -stakes.lossB;
  } else {
    deltaPointsB = stakes.winB;
    deltaPointsA = -stakes.lossA;
  }

  const { deltaFormA, deltaFormB } = calculateMatchFormDeltas(
    teamA.id,
    teamB.id,
    winnerId,
    probA,
    scoreA,
    scoreB
  );

  const winnerTeam = winnerId === teamA.id ? teamA : teamB;
  const loserTeam = winnerId === teamA.id ? teamB : teamA;
  const isUpset =
    winnerTeam.points < loserTeam.points && loserTeam.points - winnerTeam.points >= 80;

  return { deltaPointsA, deltaPointsB, deltaFormA, deltaFormB, isUpset };
}

/**
 * Creates initial Swiss Tournament state with 16 teams.
 * Pairs Top 8 seeds against Bottom 8 seeds (matching photo 1 and official Major rules).
 */
export function createInitialSwissTournament(
  teams: Team[],
  randomize: boolean = false,
  includeThirdPlace: boolean = true
): TournamentState {
  const sorted = [...teams].sort((a, b) => b.points - a.points);
  const activeTeams = randomize
    ? [...teams].sort(() => Math.random() - 0.5)
    : sorted;

  // Initialize Swiss team tracking
  const swissRecords: Record<string, SwissTeamRecord> = {};
  activeTeams.forEach((team, idx) => {
    swissRecords[team.id] = {
      teamId: team.id,
      wins: 0,
      losses: 0,
      opponentsPlayed: [],
      status: 'active',
      seedRank: idx + 1
    };
  });

  // Round 1 pairings (0:0): 8 matches
  let r1Matches: TournamentMatch[] = [];
  if (randomize) {
    for (let i = 0; i < 8; i++) {
      r1Matches.push({
        id: `swiss_r1_m${i + 1}`,
        stage: 'swiss',
        poolKey: '0:0',
        roundNumber: 1,
        name: `Раунд 1 (0:0) · Матч ${i + 1}`,
        teamAId: activeTeams[i * 2]?.id,
        teamBId: activeTeams[i * 2 + 1]?.id,
        scoreA: 0,
        scoreB: 0,
        format: 'BO1',
        status: 'ready'
      });
    }
  } else {
    r1Matches = createDefaultSwissRound1Matches(activeTeams);
  }

  // Create initial empty playoff bracket structure
  const playoffMatches = createEmptyPlayoffBracket(includeThirdPlace);

  return {
    id: `tour_${Date.now()}`,
    mode: 'swiss_playoffs',
    includeThirdPlace,
    linkPlayoffsToSwiss: true,
    currentStage: 'swiss',
    swissRound: 1,
    swissMatches: r1Matches,
    swissRecords,
    playoffMatches
  };
}

/**
 * Creates Playoffs-only tournament state (8 teams directly in bracket).
 */
export function createPlayoffsOnlyTournament(
  teams: Team[],
  randomize: boolean = false,
  includeThirdPlace: boolean = true
): TournamentState {
  const sorted = [...teams].sort((a, b) => b.points - a.points);
  const selectedTeams = randomize
    ? [...teams].sort(() => Math.random() - 0.5).slice(0, 8)
    : sorted.slice(0, 8);

  const playoffMatches = createEmptyPlayoffBracket(includeThirdPlace);

  // Seed top 8 into Quarter-finals:
  // QF1: 1 vs 8, QF2: 4 vs 5, QF3: 2 vs 7, QF4: 3 vs 6
  const qfPairs = [
    [0, 7], // 1 vs 8
    [3, 4], // 4 vs 5
    [1, 6], // 2 vs 7
    [2, 5]  // 3 vs 6
  ];

  qfPairs.forEach(([idxA, idxB], i) => {
    const qf = playoffMatches.find((m) => m.id === `playoff_qf${i + 1}`);
    if (qf) {
      qf.teamAId = selectedTeams[idxA]?.id;
      qf.teamBId = selectedTeams[idxB]?.id;
      qf.status = 'ready';
    }
  });

  return {
    id: `tour_${Date.now()}`,
    mode: 'playoffs_only',
    includeThirdPlace,
    currentStage: 'playoffs',
    swissRound: 1,
    swissMatches: [],
    swissRecords: {},
    playoffMatches
  };
}

/**
 * Creates empty 8-team single elimination playoff structure (matches photo 2).
 */
export function createEmptyPlayoffBracket(includeThirdPlace: boolean = true): TournamentMatch[] {
  const matches: TournamentMatch[] = [
    // Quarter-finals (BO3)
    {
      id: 'playoff_qf1',
      stage: 'playoffs',
      poolKey: 'qf1',
      roundNumber: 1,
      name: 'Четвертьфинал 1',
      scoreA: 0,
      scoreB: 0,
      format: 'BO3',
      status: 'scheduled'
    },
    {
      id: 'playoff_qf2',
      stage: 'playoffs',
      poolKey: 'qf2',
      roundNumber: 1,
      name: 'Четвертьфинал 2',
      scoreA: 0,
      scoreB: 0,
      format: 'BO3',
      status: 'scheduled'
    },
    {
      id: 'playoff_qf3',
      stage: 'playoffs',
      poolKey: 'qf3',
      roundNumber: 1,
      name: 'Четвертьфинал 3',
      scoreA: 0,
      scoreB: 0,
      format: 'BO3',
      status: 'scheduled'
    },
    {
      id: 'playoff_qf4',
      stage: 'playoffs',
      poolKey: 'qf4',
      roundNumber: 1,
      name: 'Четвертьфинал 4',
      scoreA: 0,
      scoreB: 0,
      format: 'BO3',
      status: 'scheduled'
    },

    // Semi-finals (BO3)
    {
      id: 'playoff_sf1',
      stage: 'playoffs',
      poolKey: 'sf1',
      roundNumber: 2,
      name: 'Полуфинал 1',
      scoreA: 0,
      scoreB: 0,
      format: 'BO3',
      status: 'scheduled'
    },
    {
      id: 'playoff_sf2',
      stage: 'playoffs',
      poolKey: 'sf2',
      roundNumber: 2,
      name: 'Полуфинал 2',
      scoreA: 0,
      scoreB: 0,
      format: 'BO3',
      status: 'scheduled'
    },

    // Grand final (BO5 as in photo 2, or BO3)
    {
      id: 'playoff_final',
      stage: 'playoffs',
      poolKey: 'final',
      roundNumber: 3,
      name: 'Гранд-финал',
      scoreA: 0,
      scoreB: 0,
      format: 'BO5',
      status: 'scheduled'
    }
  ];

  if (includeThirdPlace) {
    matches.push({
      id: 'playoff_3rd',
      stage: 'playoffs',
      poolKey: 'third_place',
      roundNumber: 3,
      name: 'Матч за 3-е место (Tiebreaker)',
      scoreA: 0,
      scoreB: 0,
      format: 'BO3',
      status: 'scheduled'
    });
  }

  return matches;
}

/**
 * Advances Swiss Stage to the next round when current round is complete.
 * Automatically checks 3:0/3:1/3:2 qualifications and 0:3/1:3/2:3 eliminations.
 */
/**
 * Advances Swiss Stage to the next round when current round is complete.
 * Automatically checks 3:0/3:1/3:2 qualifications and 0:3/1:3/2:3 eliminations.
 */
export function advanceSwissRound(
  currentState: TournamentState,
  allTeams: Team[]
): TournamentState {
  const { swissMatches, swissRecords, swissRound, playoffMatches, includeThirdPlace } = currentState;

  // Clone state
  const updatedRecords: Record<string, SwissTeamRecord> = JSON.parse(JSON.stringify(swissRecords));
  const updatedMatches: TournamentMatch[] = [...swissMatches];

  // Ground-truth recompute from ALL finished swiss matches to prevent desync
  Object.values(updatedRecords).forEach((rec) => {
    rec.wins = 0;
    rec.losses = 0;
    rec.opponentsPlayed = [];
    rec.status = 'active';
  });

  for (const m of updatedMatches) {
    if (m.status !== 'finished' || !m.winnerId || !m.loserId) continue;
    const winnerRec = updatedRecords[m.winnerId];
    const loserRec = updatedRecords[m.loserId];

    if (winnerRec) {
      winnerRec.wins += 1;
      if (!winnerRec.opponentsPlayed.includes(m.loserId)) {
        winnerRec.opponentsPlayed.push(m.loserId);
      }
    }
    if (loserRec) {
      loserRec.losses += 1;
      if (!loserRec.opponentsPlayed.includes(m.winnerId)) {
        loserRec.opponentsPlayed.push(m.winnerId);
      }
    }
  }

  // Check qualifications & eliminations
  Object.values(updatedRecords).forEach((rec) => {
    if (rec.wins >= 3) {
      rec.status = 'qualified';
      rec.qualifiedScore = `${rec.wins}:${rec.losses}` as '3:0' | '3:1' | '3:2';
    } else if (rec.losses >= 3) {
      rec.status = 'eliminated';
      rec.eliminatedScore = `${rec.wins}:${rec.losses}` as '0:3' | '1:3' | '2:3';
    }
  });

  const nextRoundNumber = swissRound + 1;

  // Check if Swiss is completed (5 rounds finished, or 8 qualified)
  const qualifiedTeams = Object.values(updatedRecords).filter((r) => r.status === 'qualified');

  if (nextRoundNumber > 5 || qualifiedTeams.length === 8) {
    // Swiss is done! Populate Playoffs bracket according to official seeding!
    const seededPlayoffMatches = seedPlayoffsFromSwiss(
      playoffMatches,
      qualifiedTeams,
      allTeams,
      includeThirdPlace
    );

    return {
      ...currentState,
      currentStage: 'playoffs',
      swissRound: 5,
      swissRecords: updatedRecords,
      swissMatches: updatedMatches,
      playoffMatches: seededPlayoffMatches
    };
  }

  // Generate matches for next round with STRICT rematch prevention and user-selected formats
  const nextMatches = generateSwissNextRoundMatches(
    nextRoundNumber,
    updatedRecords,
    allTeams,
    updatedMatches,
    currentState.stageFormats
  );

  return {
    ...currentState,
    swissRound: nextRoundNumber,
    swissRecords: updatedRecords,
    swissMatches: [...updatedMatches, ...nextMatches]
  };
}

/**
 * Generates pairing matches for a Swiss round based on identical score pools.
 * Strictly guarantees ZERO REMATCHES (teams never face each other twice in Swiss).
 */
function generateSwissNextRoundMatches(
  roundNumber: number,
  records: Record<string, SwissTeamRecord>,
  allTeams: Team[],
  allPreviousMatches: TournamentMatch[] = [],
  stageFormats?: StageFormatSettings
): TournamentMatch[] {
  const newMatches: TournamentMatch[] = [];

  // Ground-truth check if two teams have ever met in any swiss match or record
  const hasEverPlayed = (teamA: string, teamB: string): boolean => {
    if (!teamA || !teamB || teamA === teamB) return true;
    const matchFound = allPreviousMatches.some(
      (m) =>
        (m.stage === 'swiss' || !m.stage) &&
        ((m.teamAId === teamA && m.teamBId === teamB) ||
          (m.teamAId === teamB && m.teamBId === teamA))
    );
    if (matchFound) return true;
    if (records[teamA]?.opponentsPlayed?.includes(teamB)) return true;
    if (records[teamB]?.opponentsPlayed?.includes(teamA)) return true;
    return false;
  };

  // Group active teams by [wins, losses]
  const pools: Record<string, string[]> = {};
  Object.values(records)
    .filter((r) => r.status === 'active')
    .forEach((r) => {
      const key = `${r.wins}:${r.losses}`;
      if (!pools[key]) pools[key] = [];
      pools[key].push(r.teamId);
    });

  // Helper to get VRS points for tiebreaks
  const getPoints = (id: string) => allTeams.find((t) => t.id === id)?.points || 0;

  // Complete rematch-free backtracking algorithm for any list of teams
  const solveRematchFreePairing = (remaining: string[]): [string, string][] | null => {
    if (remaining.length === 0) return [];
    if (remaining.length % 2 !== 0) return null;

    const first = remaining[0];
    const candidates = remaining.slice(1);

    // In official CS Major Swiss, prefer high seed vs low seed within the score pool
    // Sort candidates by lowest points first (high vs low)
    candidates.sort((c1, c2) => getPoints(c1) - getPoints(c2));

    for (const opp of candidates) {
      if (!hasEverPlayed(first, opp)) {
        const nextRemaining = remaining.filter((id) => id !== first && id !== opp);
        const subSolution = solveRematchFreePairing(nextRemaining);
        if (subSolution !== null) {
          return [[first, opp], ...subSolution];
        }
      }
    }
    return null;
  };

  Object.entries(pools).forEach(([poolKey, teamIds]) => {
    // Sort pool by VRS points descending (seed order)
    const sortedPool = [...teamIds].sort((a, b) => getPoints(b) - getPoints(a));

    // Determine match format: Decider/Elimination matches (with 2 wins or 2 losses) use decider format, others use normal format
    const [w, l] = poolKey.split(':').map(Number);
    const isAdvancementOrElimination = w === 2 || l === 2;
    const normalFormat: MatchFormat =
      stageFormats?.swissNormalFormat ||
      allPreviousMatches.find((m) => m.roundNumber === 1)?.format ||
      'BO1';
    const deciderFormat: MatchFormat = stageFormats?.swissDeciderFormat || 'BO3';
    const format: MatchFormat = isAdvancementOrElimination ? deciderFormat : normalFormat;

    let paired = solveRematchFreePairing(sortedPool);

    // If initial high-vs-low search couldn't find a solution, try all permutations of candidates
    if (!paired) {
      const bruteForcePairing = (rem: string[]): [string, string][] | null => {
        if (rem.length === 0) return [];
        for (let i = 0; i < rem.length; i++) {
          for (let j = i + 1; j < rem.length; j++) {
            const tA = rem[i];
            const tB = rem[j];
            if (!hasEverPlayed(tA, tB)) {
              const nextRem = rem.filter((_, idx) => idx !== i && idx !== j);
              const sub = bruteForcePairing(nextRem);
              if (sub !== null) {
                return [[tA, tB], ...sub];
              }
            }
          }
        }
        return null;
      };
      paired = bruteForcePairing(sortedPool);
    }

    // Absolute fallback: guaranteed minimal rematches with strict priority against repeat opponents
    if (!paired) {
      paired = [];
      const available = [...sortedPool];
      while (available.length >= 2) {
        const teamA = available.shift()!;
        let oppIdx = available.findIndex((cand) => !hasEverPlayed(teamA, cand));
        if (oppIdx === -1) {
          oppIdx = 0;
        }
        const [teamB] = available.splice(oppIdx, 1);
        paired.push([teamA, teamB]);
      }
    }

    paired.forEach(([teamAId, teamBId], mIdx) => {
      newMatches.push({
        id: `swiss_r${roundNumber}_${poolKey.replace(':', '_')}_m${mIdx + 1}`,
        stage: 'swiss',
        poolKey,
        roundNumber,
        name: `Раунд ${roundNumber} (${poolKey}) · Матч ${mIdx + 1}`,
        teamAId,
        teamBId,
        scoreA: 0,
        scoreB: 0,
        format,
        status: 'ready'
      });
    });
  });

  return newMatches;
}

/**
 * Seeds qualified Swiss teams into Playoffs according to Major / HLTV bracket layout:
 * - 1st & 2nd seed: 3-0 teams
 * - 3rd, 4th, 5th seed: 3-1 teams
 * - 6th, 7th, 8th seed: 3-2 teams
 *
 * Bracket layout (matches photo 2):
 * QF1: Seed 1 (3-0) vs Seed 8 (3-2)
 * QF2: Seed 4 (3-1) vs Seed 5 (3-1)
 * QF3: Seed 2 (3-0) vs Seed 7 (3-2)
 * QF4: Seed 3 (3-1) vs Seed 6 (3-2)
 */
export function seedPlayoffsFromSwiss(
  playoffMatches: TournamentMatch[],
  qualifiedRecords: SwissTeamRecord[],
  allTeams: Team[],
  includeThirdPlace: boolean
): TournamentMatch[] {
  const getPoints = (id: string) => allTeams.find((t) => t.id === id)?.points || 0;

  // Group by qualified score
  const pool3_0 = qualifiedRecords.filter((r) => r.qualifiedScore === '3:0').sort((a, b) => getPoints(b.teamId) - getPoints(a.teamId));
  const pool3_1 = qualifiedRecords.filter((r) => r.qualifiedScore === '3:1').sort((a, b) => getPoints(b.teamId) - getPoints(a.teamId));
  const pool3_2 = qualifiedRecords.filter((r) => r.qualifiedScore === '3:2').sort((a, b) => getPoints(b.teamId) - getPoints(a.teamId));

  // Seeds 1 & 2
  const seed1 = pool3_0[0]?.teamId;
  const seed2 = pool3_0[1]?.teamId || pool3_1[0]?.teamId;

  // Seeds 3, 4, 5
  const remaining3_1 = pool3_1.filter((r) => r.teamId !== seed2);
  const seed3 = remaining3_1[0]?.teamId;
  const seed4 = remaining3_1[1]?.teamId;
  const seed5 = remaining3_1[2]?.teamId;

  // Seeds 6, 7, 8
  const seed6 = pool3_2[0]?.teamId;
  const seed7 = pool3_2[1]?.teamId;
  const seed8 = pool3_2[2]?.teamId;

  const matches = createEmptyPlayoffBracket(includeThirdPlace);

  // QF1: Seed 1 vs Seed 8
  const qf1 = matches.find((m) => m.id === 'playoff_qf1');
  if (qf1) {
    qf1.teamAId = seed1;
    qf1.teamBId = seed8;
    qf1.status = 'ready';
  }

  // QF2: Seed 4 vs Seed 5
  const qf2 = matches.find((m) => m.id === 'playoff_qf2');
  if (qf2) {
    qf2.teamAId = seed4;
    qf2.teamBId = seed5;
    qf2.status = 'ready';
  }

  // QF3: Seed 2 vs Seed 7
  const qf3 = matches.find((m) => m.id === 'playoff_qf3');
  if (qf3) {
    qf3.teamAId = seed2;
    qf3.teamBId = seed7;
    qf3.status = 'ready';
  }

  // QF4: Seed 3 vs Seed 6
  const qf4 = matches.find((m) => m.id === 'playoff_qf4');
  if (qf4) {
    qf4.teamAId = seed3;
    qf4.teamBId = seed6;
    qf4.status = 'ready';
  }

  return matches;
}

/**
 * Updates a playoff match result and automatically propagates winners and losers
 * to the next rounds (Semi-finals, Grand Final, and 3rd place decider).
 */
/** Strict Grand Final detection (never matches quarter/semi/UB/LB finals). */
export function isGrandFinalMatch(m: { id: string; poolKey?: string }): boolean {
  const pk = (m.poolKey || '').toLowerCase();
  if (pk) return pk === 'final' || pk === 'playoff_final' || pk === 'grand_final';
  const id = m.id.toLowerCase();
  return id === 'playoff_final' || (id.endsWith('_final') && !id.endsWith('_ub_final') && !id.endsWith('_lb_final'));
}

export function updatePlayoffMatchResult(
  playoffMatches: TournamentMatch[],
  matchId: string,
  scoreA: number,
  scoreB: number,
  includeThirdPlace: boolean,
  actualFormat?: MatchFormat
): { updatedMatches: TournamentMatch[]; isTournamentOver: boolean } {
  const matches = JSON.parse(JSON.stringify(playoffMatches)) as TournamentMatch[];
  const match = matches.find((m) => m.id === matchId);
  if (!match || !match.teamAId || !match.teamBId) {
    return { updatedMatches: matches, isTournamentOver: false };
  }

  if (actualFormat) {
    match.format = actualFormat;
  }
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.status = 'finished';

  const requiredWins = match.format === 'BO1' ? 1 : match.format === 'BO3' ? 2 : 3;
  const aWon = scoreA >= requiredWins;
  match.winnerId = aWon ? match.teamAId : match.teamBId;
  match.loserId = aWon ? match.teamBId : match.teamAId;

  // Propagate to Semi-Finals
  const qf1 = matches.find((m) => m.id === 'playoff_qf1' || m.poolKey === 'qf1');
  const qf2 = matches.find((m) => m.id === 'playoff_qf2' || m.poolKey === 'qf2');
  const sf1 = matches.find((m) => m.id === 'playoff_sf1' || m.poolKey === 'sf1');
  if (sf1) {
    if (qf1?.winnerId) sf1.teamAId = qf1.winnerId;
    if (qf2?.winnerId) sf1.teamBId = qf2.winnerId;
    if (sf1.teamAId && sf1.teamBId && sf1.status === 'scheduled') {
      sf1.status = 'ready';
    }
  }

  const qf3 = matches.find((m) => m.id === 'playoff_qf3' || m.poolKey === 'qf3');
  const qf4 = matches.find((m) => m.id === 'playoff_qf4' || m.poolKey === 'qf4');
  const sf2 = matches.find((m) => m.id === 'playoff_sf2' || m.poolKey === 'sf2');
  if (sf2) {
    if (qf3?.winnerId) sf2.teamAId = qf3.winnerId;
    if (qf4?.winnerId) sf2.teamBId = qf4.winnerId;
    if (sf2.teamAId && sf2.teamBId && sf2.status === 'scheduled') {
      sf2.status = 'ready';
    }
  }

  // Propagate to Grand Final
  const final = matches.find((m) => isGrandFinalMatch(m));
  if (final) {
    if (sf1?.winnerId) final.teamAId = sf1.winnerId;
    if (sf2?.winnerId) final.teamBId = sf2.winnerId;
    if (final.teamAId && final.teamBId && final.status !== 'finished') {
      final.status = 'ready';
    }
  }

  // Propagate to 3rd Place Match if enabled
  const thirdMatch = matches.find(
    (m) =>
      m.id === 'playoff_3rd' ||
      m.poolKey === 'third_place' ||
      m.poolKey === 'third' ||
      m.id.endsWith('_third_place') ||
      m.name.toLowerCase().includes('3-е') ||
      m.name.toLowerCase().includes('3rd')
  );
  if (includeThirdPlace && thirdMatch) {
    if (sf1?.loserId) thirdMatch.teamAId = sf1.loserId;
    if (sf2?.loserId) thirdMatch.teamBId = sf2.loserId;
    if (thirdMatch.teamAId && thirdMatch.teamBId && thirdMatch.status !== 'finished') {
      thirdMatch.status = 'ready';
    }
  }

  // Tournament is completed when the Grand Final is finished
  const finalFinished = final?.status === 'finished' && !!final.winnerId && match.id === final.id;
  const isTournamentOver = !!finalFinished;

  return { updatedMatches: matches, isTournamentOver };
}

/**
 * Calculates realistic dynamic VRS ranking bonus awarded to the champion (and podium teams),
 * taking into account tournament tier (Major, S-Tier, A-Tier, B-Tier, Community),
 * tournament size, strength of competing teams, and realistic organic variance.
 */
export function calculateTournamentVrsBounties(
  tier: TournamentTier = 'S-Tier',
  participatingTeams: Team[],
  teamCount: number = 16
): { championBonus: number; finalistBonus: number; thirdPlaceBonus: number } {
  // 1. Base points by tier
  let baseChampion = 290;
  if (tier === 'Major') baseChampion = 440;
  else if (tier === 'S-Tier') baseChampion = 300;
  else if (tier === 'A-Tier' || tier === 'Championship') baseChampion = 175;
  else if (tier === 'B-Tier') baseChampion = 95;
  else if (tier === 'Community') baseChampion = 45;

  // 2. Average field strength modifier
  const avgPoints =
    participatingTeams.length > 0
      ? participatingTeams.reduce((sum, t) => sum + (t.points || 1500), 0) / participatingTeams.length
      : 1600;
  const fieldFactor = Math.max(0.85, Math.min(1.25, 0.85 + (avgPoints / 1600) * 0.25));

  // 3. Tournament bracket scale modifier
  const sizeFactor = teamCount >= 24 ? 1.12 : teamCount >= 16 ? 1.05 : teamCount <= 4 ? 0.85 : 1.0;

  // 4. Organic natural variance (±8% and integer jitter so it's always varied)
  const varianceFactor = 1 + (Math.random() * 0.16 - 0.08);
  const jitter = Math.floor(Math.random() * 11) - 5;

  const rawChampion = Math.round(baseChampion * fieldFactor * sizeFactor * varianceFactor + jitter);
  const championBonus = Math.max(25, rawChampion);

  // Finalist receives ~42% of champion bounty with variance
  const finalistBonus = Math.max(15, Math.round(championBonus * 0.42 + (Math.random() * 8 - 4)));

  // 3rd place receives ~21% of champion bounty with variance
  const thirdPlaceBonus = Math.max(8, Math.round(championBonus * 0.21 + (Math.random() * 6 - 3)));

  return { championBonus, finalistBonus, thirdPlaceBonus };
}

/**
 * Computes complete final tournament standings for all participating teams.
 */
export function computeFinalTournamentStandings(
  tournament: TournamentState,
  allTeams: Team[],
  customBounties?: { championBonus: number; finalistBonus: number; thirdPlaceBonus: number }
): TournamentFinalStanding[] {
  const standings: TournamentFinalStanding[] = [];
  const { playoffMatches, swissRecords, mode, includeThirdPlace, tier = 'S-Tier', teamCount = 16 } = tournament;

  const vrsBounties =
    customBounties ||
    calculateTournamentVrsBounties(tier, allTeams, teamCount);

  const finalMatch = playoffMatches.find((m) => isGrandFinalMatch(m));
  const thirdMatch = playoffMatches.find(
    (m) =>
      m.id === 'playoff_3rd' ||
      m.poolKey === 'third_place' ||
      m.poolKey === 'third' ||
      m.id.endsWith('_third_place') ||
      m.name.toLowerCase().includes('3-е') ||
      m.name.toLowerCase().includes('3rd')
  );
  const sf1 = playoffMatches.find((m) => m.id === 'playoff_sf1' || m.poolKey === 'sf1');
  const sf2 = playoffMatches.find((m) => m.id === 'playoff_sf2' || m.poolKey === 'sf2');
  const qfMatches = playoffMatches.filter((m) => m.id.startsWith('playoff_qf') || m.poolKey.startsWith('qf'));

  // 1st Place (Champion)
  if (finalMatch?.winnerId) {
    standings.push({
      place: 1,
      placeLabel: '1-е место · ЧЕМПИОН',
      teamId: finalMatch.winnerId,
      badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/40',
      vrsAwarded: vrsBounties.championBonus,
      details: `+${vrsBounties.championBonus} VRS очков чемпиону`
    });
  }

  // 2nd Place (Finalist)
  if (finalMatch?.loserId) {
    standings.push({
      place: 2,
      placeLabel: '2-е место · Финалист',
      teamId: finalMatch.loserId,
      badgeColor: 'text-slate-300 bg-slate-300/10 border-slate-300/40',
      vrsAwarded: vrsBounties.finalistBonus,
      details: `+${vrsBounties.finalistBonus} VRS очков финалисту`
    });
  }

  // 3rd & 4th Place
  if (includeThirdPlace && thirdMatch?.winnerId && thirdMatch?.loserId) {
    standings.push({
      place: 3,
      placeLabel: '3-е место · Бронзовый призёр',
      teamId: thirdMatch.winnerId,
      badgeColor: 'text-amber-600 bg-amber-600/10 border-amber-600/40',
      vrsAwarded: vrsBounties.thirdPlaceBonus,
      details: `+${vrsBounties.thirdPlaceBonus} VRS очков за 3-е место`
    });
    standings.push({
      place: 4,
      placeLabel: '4-е место',
      teamId: thirdMatch.loserId
    });
  } else {
    if (sf1?.loserId) {
      standings.push({
        place: 3,
        placeLabel: '3-4-е место (Полуфинал)',
        teamId: sf1.loserId,
        vrsAwarded: Math.round(vrsBounties.thirdPlaceBonus * 0.8),
        details: `+${Math.round(vrsBounties.thirdPlaceBonus * 0.8)} VRS очков`
      });
    }
    if (sf2?.loserId && sf2.loserId !== sf1?.loserId) {
      standings.push({
        place: 3,
        placeLabel: '3-4-е место (Полуфинал)',
        teamId: sf2.loserId,
        vrsAwarded: Math.round(vrsBounties.thirdPlaceBonus * 0.8),
        details: `+${Math.round(vrsBounties.thirdPlaceBonus * 0.8)} VRS очков`
      });
    }
  }

  // 5-8th Places (Quarter-finalists)
  qfMatches.forEach((qf) => {
    if (qf.loserId && !standings.some((s) => s.teamId === qf.loserId)) {
      standings.push({
        place: 5,
        placeLabel: '5-8-е место (Четвертьфинал)',
        teamId: qf.loserId
      });
    }
  });

  // Swiss stage eliminations (if Swiss was played)
  if (mode === 'swiss_playoffs' && swissRecords) {
    const eliminated2_3 = Object.values(swissRecords).filter((r) => r.eliminatedScore === '2:3');
    eliminated2_3.forEach((r) => {
      standings.push({
        place: 9,
        placeLabel: '9-11-е место (Швейцарка 2:3)',
        teamId: r.teamId,
        details: '2 победы · 3 поражения'
      });
    });

    const eliminated1_3 = Object.values(swissRecords).filter((r) => r.eliminatedScore === '1:3');
    eliminated1_3.forEach((r) => {
      standings.push({
        place: 12,
        placeLabel: '12-14-е место (Швейцарка 1:3)',
        teamId: r.teamId,
        details: '1 победа · 3 поражения'
      });
    });

    const eliminated0_3 = Object.values(swissRecords).filter((r) => r.eliminatedScore === '0:3');
    eliminated0_3.forEach((r) => {
      standings.push({
        place: 15,
        placeLabel: '15-16-е место (Швейцарка 0:3)',
        teamId: r.teamId,
        details: '0 побед · 3 поражения'
      });
    });
  }

  return standings;
}

/**
 * Unified chronological priority for tournament matches.
 * Returns higher rank for matches played LATER in the tournament,
 * so sorting descending (rankB - rankA) puts Grand Final at the VERY TOP,
 * down to the opening round / round 1 at the VERY BOTTOM.
 */
export function getTournamentMatchChronologicalRank(m: {
  stage?: string;
  stageName?: string;
  poolKey?: string;
  roundNumber?: number;
  name?: string;
  id?: string;
}): number {
  const pk = (m.poolKey || '').toLowerCase();
  const nm = (m.name || m.stageName || '').toLowerCase();
  const id = (m.id || '').toLowerCase();

  // 1. Grand Final: Absolute last match of tournament (Rank 1000)
  const isGrand =
    pk === 'final' ||
    pk === 'playoff_final' ||
    pk === 'grand_final' ||
    (id.includes('final') && !id.includes('semi') && !id.includes('quarter') && !id.includes('ub') && !id.includes('lb')) ||
    nm.includes('гранд-финал') ||
    nm.includes('гранд финал') ||
    (nm.includes('финал') &&
      !nm.includes('1/2') &&
      !nm.includes('1/4') &&
      !nm.includes('1/8') &&
      !nm.includes('четверть') &&
      !nm.includes('полу') &&
      !nm.includes('3-е') &&
      !nm.includes('бронз') &&
      !nm.includes('верхн') &&
      !nm.includes('нижн') &&
      !nm.includes('ub') &&
      !nm.includes('lb'));
  if (isGrand) return 1000;

  // 2. 3rd place decider (Rank 950)
  if (pk.includes('3rd') || pk.includes('third') || nm.includes('3-е') || nm.includes('бронз')) {
    return 950;
  }

  // 3. Semifinals (1/2 финала, Rank 900)
  if (pk.startsWith('sf') || pk.includes('sf') || nm.includes('полуфинал') || nm.includes('1/2')) {
    return 900;
  }

  // 4. Quarterfinals (1/4 финала, Rank 800)
  if (pk.startsWith('qf') || pk.includes('qf') || nm.includes('четвертьфинал') || nm.includes('1/4')) {
    return 800;
  }

  // 5. Round of 16 (1/8 финала, Rank 700)
  if (pk.startsWith('r16') || pk.includes('r16') || nm.includes('1/8')) {
    return 700;
  }

  // Upper / Lower playoff finals
  if (pk.includes('ub_final')) return 680;
  if (pk.includes('lb_final')) return 660;
  if (pk.includes('upper') || nm.includes('верхняя')) return 640;
  if (pk.includes('lower') || nm.includes('нижняя')) return 620;

  // GSL Group matches: Decider -> Winners/Elim -> Opening
  if (pk.includes('decider') || nm.includes('решающий') || nm.includes('decider')) return 550;
  if (pk.includes('winners') || nm.includes('победителей')) return 520;
  if (pk.includes('elim') || nm.includes('вылет')) return 510;
  if (pk.includes('opening') || nm.includes('открывающий')) return 480;

  // Swiss rounds: Round 5 down to Round 1
  if (m.stage === 'swiss' || id.includes('swiss') || nm.includes('швейцар')) {
    return 300 + (m.roundNumber || 1) * 20; // R5 = 400, R4 = 380, R3 = 360, R2 = 340, R1 = 320
  }

  // Group stage & Round robin
  if (m.stage === 'groups' || nm.includes('групп')) {
    return 200 + (m.roundNumber || 1) * 10;
  }
  if (m.stage === 'round_robin' || nm.includes('тур')) {
    return 100 + (m.roundNumber || 1) * 5;
  }

  return m.roundNumber || 1;
}

/**
 * Extracts all matches played by a specific team in a tournament,
 * with clearly labeled stages (e.g. "Швейцарская система — Раунд 1", "1/4 финала (Четвертьфинал)", "Гранд-Финал"),
 * opponent information, score, format, and individual map results.
 * Strictly ordered in reverse chronological order: Grand Final at the very top (#1) down to round 1!
 */
export function extractTeamTournamentMatches(
  tournament: TournamentState,
  teamId: string,
  allTeams: Team[]
): TrophyMatchSummary[] {
  const summaries: TrophyMatchSummary[] = [];

  const getOpponent = (oppId: string) => allTeams.find((t) => t.id === oppId);

  const getStageTitle = (match: TournamentMatch): string => {
    if (match.stage === 'swiss') {
      const pool = match.poolKey || '0:0';
      if (match.roundNumber === 5) {
        return 'Швейцарская система — Раунд 5 (Decider 2:2)';
      }
      return `Швейцарская система — Раунд ${match.roundNumber} (Пул ${pool})`;
    }
    if (match.stage === 'playoffs' || match.stage === 'grand_final') {
      const pk = match.poolKey?.toLowerCase() || '';
      const nm = match.name?.toLowerCase() || '';

      // Check quarter and semi FIRST so they don't match general "финал"
      if (pk.startsWith('qf') || pk.includes('qf') || nm.includes('четвертьфинал') || nm.includes('1/4')) {
        return '1/4 финала (Четвертьфинал)';
      }
      if (pk.startsWith('sf') || pk.includes('sf') || nm.includes('полуфинал') || nm.includes('1/2')) {
        return '1/2 финала (Полуфинал)';
      }
      if (pk.includes('3rd') || pk.includes('third') || nm.includes('3-е') || nm.includes('бронз')) {
        return 'Матч за 3-е место (Бронзовый финал)';
      }
      if (
        pk === 'playoff_final' ||
        pk === 'final' ||
        pk === 'grand_final' ||
        nm.includes('гранд') ||
        nm === 'финал'
      ) {
        return 'Гранд-Финал (Матч за чемпионство)';
      }
      if (pk.includes('upper') || nm.includes('верхняя')) {
        return `Верхняя сетка · ${match.name}`;
      }
      if (pk.includes('lower') || nm.includes('нижняя')) {
        return `Нижняя сетка · ${match.name}`;
      }
      return match.name || 'Плей-офф';
    }
    if (match.stage === 'groups') {
      const pk = match.poolKey?.toLowerCase() || '';
      const nm = match.name?.toLowerCase() || '';
      const grp = match.groupLetter ? `Группа ${match.groupLetter} · ` : '';
      if (pk.includes('opening') || nm.includes('открывающий')) {
        return `${grp}Открывающий матч`;
      }
      if (pk.includes('winners') || nm.includes('победителей')) {
        return `${grp}Матч победителей (За выход #1)`;
      }
      if (pk.includes('elim') || nm.includes('вылет')) {
        return `${grp}Матч на вылет`;
      }
      if (pk.includes('decider') || nm.includes('решающий')) {
        return `${grp}Решающий матч (Decider)`;
      }
      return `${grp}Групповой этап · ${match.name || 'Раунд ' + match.roundNumber}`;
    }
    if (match.stage === 'round_robin') {
      return `Круговой турнир · ${match.name || 'Тур ' + match.roundNumber}`;
    }
    return match.name || 'Турнирный матч';
  };

  // Combine all matches and sort descending by chronological rank:
  // Latest matches (Grand Final = 1000) at index 0 down to round 1 (300)!
  const allFinished = [
    ...(tournament.playoffMatches || []),
    ...(tournament.swissMatches || []),
    ...(tournament.groupMatches || []),
    ...(tournament.roundRobinMatches || [])
  ]
    .filter((m) => (m.teamAId === teamId || m.teamBId === teamId) && m.status === 'finished')
    .sort((a, b) => getTournamentMatchChronologicalRank(b) - getTournamentMatchChronologicalRank(a));

  allFinished.forEach((m) => {
    const isTeamA = m.teamAId === teamId;
    const oppId = isTeamA ? m.teamBId : m.teamAId;
    if (!oppId) return;

    const oppTeam = getOpponent(oppId);
    const scoreFor = isTeamA ? m.scoreA : m.scoreB;
    const scoreAgainst = isTeamA ? m.scoreB : m.scoreA;
    const isWinner = m.winnerId === teamId;
    const delta = isTeamA
      ? (isWinner ? m.deltaPointsA : -(m.deltaPointsA || 16))
      : (isWinner ? m.deltaPointsB : -(m.deltaPointsB || 16));

    summaries.push({
      id: m.id,
      stageName: getStageTitle(m),
      roundNumber: m.roundNumber,
      poolKey: m.poolKey,
      opponentId: oppId,
      opponentName: oppTeam?.name || 'Оппонент',
      opponentLogo: oppTeam?.customLogo || oppTeam?.logoUrl,
      opponentPoints: oppTeam?.points,
      result: isWinner ? 'W' : 'L',
      scoreSeries: `${scoreFor} : ${scoreAgainst}`,
      scoreA: scoreFor,
      scoreB: scoreAgainst,
      format: m.format,
      deltaPoints: delta,
      mapsPlayed: m.mapsPlayed
    });
  });

  return summaries;
}

export interface CreateTournamentParams {
  name: string;
  shortName?: string;
  organizer?: string;
  prizePool?: string;
  startDate?: string;
  description?: string;
  tier?: TournamentTier;
  mode: TournamentMode;
  teams: Team[]; // in seeded order (index 0 = Seed 1)
  stageFormats?: StageFormatSettings;
  includeThirdPlace?: boolean;
}

/**
 * Creates a fully customized tournament state based on user parameters, format, and seeding.
 */
export function createCustomTournament(params: CreateTournamentParams): TournamentState {
  const {
    name,
    shortName = name.slice(0, 6).toUpperCase(),
    organizer = 'CS2 Organizer',
    prizePool = '$1,000,000',
    startDate = new Date().toISOString().split('T')[0],
    description = '',
    tier = name.toLowerCase().includes('major') ? 'Major' : 'S-Tier',
    mode,
    teams: seededTeams,
    stageFormats = {},
    includeThirdPlace = true
  } = params;

  const teamCount = seededTeams.length;
  const teamSeeds: Record<string, number> = {};
  seededTeams.forEach((t, idx) => {
    teamSeeds[t.id] = idx + 1;
  });

  const tourId = `tour_${Date.now()}`;
  const baseState: TournamentState = {
    id: tourId,
    name,
    shortName,
    organizer,
    prizePool,
    startDate,
    description,
    tier,
    mode,
    teamCount,
    participatingTeamIds: seededTeams.map((t) => t.id),
    teamSeeds,
    stageFormats,
    includeThirdPlace,
    currentStage: mode === 'playoffs_only' || mode === 'single_elimination' || mode === 'double_elimination'
      ? 'playoffs'
      : mode === 'round_robin'
      ? 'round_robin'
      : mode === 'groups_playoffs' || mode === 'gsl_groups'
      ? 'groups'
      : 'swiss',
    swissRound: 1,
    swissMatches: [],
    swissRecords: {},
    playoffMatches: []
  };

  // 1. Single Elimination (4, 8, 16, or 32 teams)
  if (mode === 'single_elimination' || mode === 'playoffs_only') {
    const qfFmt = stageFormats.quarterfinalFormat || 'BO3';
    const sfFmt = stageFormats.semifinalFormat || 'BO3';
    const finalFmt = stageFormats.finalFormat || 'BO5';

    if (teamCount <= 4) {
      // 4-team bracket: SF1, SF2 -> Final (+ 3rd place)
      const matches: TournamentMatch[] = [
        {
          id: `${tourId}_sf1`,
          stage: 'playoffs',
          poolKey: 'sf1',
          roundNumber: 1,
          name: 'Полуфинал 1',
          teamAId: seededTeams[0]?.id,
          teamBId: seededTeams[3]?.id,
          scoreA: 0,
          scoreB: 0,
          format: sfFmt,
          status: 'ready'
        },
        {
          id: `${tourId}_sf2`,
          stage: 'playoffs',
          poolKey: 'sf2',
          roundNumber: 1,
          name: 'Полуфинал 2',
          teamAId: seededTeams[1]?.id,
          teamBId: seededTeams[2]?.id,
          scoreA: 0,
          scoreB: 0,
          format: sfFmt,
          status: 'ready'
        },
        {
          id: `${tourId}_final`,
          stage: 'playoffs',
          poolKey: 'final',
          roundNumber: 2,
          name: 'Гранд-финал',
          scoreA: 0,
          scoreB: 0,
          format: finalFmt,
          status: 'scheduled'
        }
      ];
      if (includeThirdPlace) {
        matches.push({
          id: `${tourId}_third_place`,
          stage: 'playoffs',
          poolKey: 'third_place',
          roundNumber: 2,
          name: 'Матч за 3-е место',
          scoreA: 0,
          scoreB: 0,
          format: sfFmt,
          status: 'scheduled'
        });
      }
      return { ...baseState, playoffMatches: matches };
    }

    if (teamCount <= 8) {
      // 8-team standard bracket: QF1..4 -> SF1, SF2 -> Final (+ 3rd place)
      const qfPairs = [
        [0, 7], // 1 vs 8
        [3, 4], // 4 vs 5
        [1, 6], // 2 vs 7
        [2, 5]  // 3 vs 6
      ];

      const matches: TournamentMatch[] = [
        ...qfPairs.map(([idxA, idxB], i) => ({
          id: `${tourId}_qf${i + 1}`,
          stage: 'playoffs' as const,
          poolKey: `qf${i + 1}`,
          roundNumber: 1,
          name: `Четвертьфинал ${i + 1}`,
          teamAId: seededTeams[idxA]?.id,
          teamBId: seededTeams[idxB]?.id,
          scoreA: 0,
          scoreB: 0,
          format: qfFmt,
          status: 'ready' as const
        })),
        {
          id: `${tourId}_sf1`,
          stage: 'playoffs',
          poolKey: 'sf1',
          roundNumber: 2,
          name: 'Полуфинал 1',
          scoreA: 0,
          scoreB: 0,
          format: sfFmt,
          status: 'scheduled'
        },
        {
          id: `${tourId}_sf2`,
          stage: 'playoffs',
          poolKey: 'sf2',
          roundNumber: 2,
          name: 'Полуфинал 2',
          scoreA: 0,
          scoreB: 0,
          format: sfFmt,
          status: 'scheduled'
        },
        {
          id: `${tourId}_final`,
          stage: 'playoffs',
          poolKey: 'final',
          roundNumber: 3,
          name: 'Гранд-финал',
          scoreA: 0,
          scoreB: 0,
          format: finalFmt,
          status: 'scheduled'
        }
      ];

      if (includeThirdPlace) {
        matches.push({
          id: `${tourId}_third_place`,
          stage: 'playoffs',
          poolKey: 'third_place',
          roundNumber: 3,
          name: 'Матч за 3-е место',
          scoreA: 0,
          scoreB: 0,
          format: sfFmt,
          status: 'scheduled'
        });
      }

      return { ...baseState, playoffMatches: matches };
    }

    // 16-team single elimination
    const r16Pairs = [
      [0, 15], [7, 8], [3, 12], [4, 11],
      [1, 14], [6, 9], [2, 13], [5, 10]
    ];
    const matches: TournamentMatch[] = [
      ...r16Pairs.map(([idxA, idxB], i) => ({
        id: `${tourId}_r16_${i + 1}`,
        stage: 'playoffs' as const,
        poolKey: `r16_${i + 1}`,
        roundNumber: 1,
        name: `1/8 финала #${i + 1}`,
        teamAId: seededTeams[idxA]?.id,
        teamBId: seededTeams[idxB]?.id,
        scoreA: 0,
        scoreB: 0,
        format: qfFmt,
        status: 'ready' as const
      })),
      ...[1, 2, 3, 4].map((i) => ({
        id: `${tourId}_qf${i}`,
        stage: 'playoffs' as const,
        poolKey: `qf${i}`,
        roundNumber: 2,
        name: `Четвертьфинал ${i}`,
        scoreA: 0,
        scoreB: 0,
        format: qfFmt,
        status: 'scheduled' as const
      })),
      {
        id: `${tourId}_sf1`,
        stage: 'playoffs',
        poolKey: 'sf1',
        roundNumber: 3,
        name: 'Полуфинал 1',
        scoreA: 0,
        scoreB: 0,
        format: sfFmt,
        status: 'scheduled'
      },
      {
        id: `${tourId}_sf2`,
        stage: 'playoffs',
        poolKey: 'sf2',
        roundNumber: 3,
        name: 'Полуфинал 2',
        scoreA: 0,
        scoreB: 0,
        format: sfFmt,
        status: 'scheduled'
      },
      {
        id: `${tourId}_final`,
        stage: 'playoffs',
        poolKey: 'final',
        roundNumber: 4,
        name: 'Гранд-финал',
        scoreA: 0,
        scoreB: 0,
        format: finalFmt,
        status: 'scheduled'
      }
    ];

    if (includeThirdPlace) {
      matches.push({
        id: `${tourId}_third_place`,
        stage: 'playoffs',
        poolKey: 'third_place',
        roundNumber: 4,
        name: 'Матч за 3-е место',
        scoreA: 0,
        scoreB: 0,
        format: sfFmt,
        status: 'scheduled'
      });
    }

    return { ...baseState, playoffMatches: matches };
  }

  // 2. Double Elimination Bracket (8 or 4 teams)
  if (mode === 'double_elimination') {
    const qfFmt = stageFormats.quarterfinalFormat || 'BO3';
    const sfFmt = stageFormats.semifinalFormat || 'BO3';
    const finalFmt = stageFormats.finalFormat || 'BO5';

    // Upper Bracket (QF1..4, UB SF1..2, UB Final) + Lower Bracket + Grand Final
    const ubPairs = [
      [0, 7], // 1 vs 8
      [3, 4], // 4 vs 5
      [1, 6], // 2 vs 7
      [2, 5]  // 3 vs 6
    ];

    const playoffMatches: TournamentMatch[] = [
      // Upper Bracket QF
      ...ubPairs.map(([idxA, idxB], i) => ({
        id: `${tourId}_ub_qf${i + 1}`,
        stage: 'playoffs' as const,
        poolKey: `qf${i + 1}`,
        roundNumber: 1,
        name: `Upper Bracket · Четвертьфинал ${i + 1}`,
        teamAId: seededTeams[idxA]?.id,
        teamBId: seededTeams[idxB]?.id,
        scoreA: 0,
        scoreB: 0,
        format: qfFmt,
        status: 'ready' as const
      })),
      // Upper Bracket Semifinals
      {
        id: `${tourId}_sf1`,
        stage: 'playoffs',
        poolKey: 'sf1',
        roundNumber: 2,
        name: 'Upper Bracket · Полуфинал 1',
        scoreA: 0,
        scoreB: 0,
        format: sfFmt,
        status: 'scheduled'
      },
      {
        id: `${tourId}_sf2`,
        stage: 'playoffs',
        poolKey: 'sf2',
        roundNumber: 2,
        name: 'Upper Bracket · Полуфинал 2',
        scoreA: 0,
        scoreB: 0,
        format: sfFmt,
        status: 'scheduled'
      },
      // Upper Bracket Final
      {
        id: `${tourId}_ub_final`,
        stage: 'playoffs',
        poolKey: 'ub_final',
        roundNumber: 3,
        name: 'Финал верхней сетки (UB Final)',
        scoreA: 0,
        scoreB: 0,
        format: sfFmt,
        status: 'scheduled'
      },
      // Lower Bracket Matches
      {
        id: `${tourId}_lb_r1_1`,
        stage: 'playoffs',
        poolKey: 'lb_r1_1',
        roundNumber: 2,
        name: 'Lower Bracket · Раунд 1 (Матч 1)',
        scoreA: 0,
        scoreB: 0,
        format: qfFmt,
        status: 'scheduled'
      },
      {
        id: `${tourId}_lb_r1_2`,
        stage: 'playoffs',
        poolKey: 'lb_r1_2',
        roundNumber: 2,
        name: 'Lower Bracket · Раунд 1 (Матч 2)',
        scoreA: 0,
        scoreB: 0,
        format: qfFmt,
        status: 'scheduled'
      },
      {
        id: `${tourId}_lb_final`,
        stage: 'playoffs',
        poolKey: 'lb_final',
        roundNumber: 4,
        name: 'Финал нижней сетки (LB Final)',
        scoreA: 0,
        scoreB: 0,
        format: sfFmt,
        status: 'scheduled'
      },
      // Grand Final
      {
        id: `${tourId}_final`,
        stage: 'playoffs',
        poolKey: 'final',
        roundNumber: 5,
        name: 'Гранд-финал (UB Winner vs LB Winner)',
        scoreA: 0,
        scoreB: 0,
        format: finalFmt,
        status: 'scheduled'
      }
    ];

    return { ...baseState, playoffMatches };
  }

  // 3. Swiss System & Swiss + Playoffs
  if (mode === 'swiss_playoffs' || mode === 'swiss_system') {
    const swissNormalFmt = stageFormats.swissNormalFormat || 'BO1';
    const swissRecords: Record<string, SwissTeamRecord> = {};
    seededTeams.forEach((team, idx) => {
      swissRecords[team.id] = {
        teamId: team.id,
        wins: 0,
        losses: 0,
        opponentsPlayed: [],
        status: 'active',
        seedRank: idx + 1
      };
    });

    // 1 vs 16, 2 vs 15, etc.
    const swissRound1Matches: TournamentMatch[] = [];
    const half = Math.floor(teamCount / 2);
    for (let i = 0; i < half; i++) {
      const idxA = i;
      const idxB = teamCount - 1 - i;
      swissRound1Matches.push({
        id: `${tourId}_swiss_r1_m${i + 1}`,
        stage: 'swiss',
        poolKey: '0:0',
        roundNumber: 1,
        name: `Раунд 1 (0:0) · Матч ${i + 1}`,
        teamAId: seededTeams[idxA]?.id,
        teamBId: seededTeams[idxB]?.id,
        scoreA: 0,
        scoreB: 0,
        format: swissNormalFmt,
        status: 'ready'
      });
    }

    const playoffMatches = mode === 'swiss_playoffs'
      ? createEmptyPlayoffBracket(includeThirdPlace)
      : [];

    return {
      ...baseState,
      swissMatches: swissRound1Matches,
      swissRecords,
      playoffMatches
    };
  }

  // 4. Round Robin System
  if (mode === 'round_robin') {
    const roundRobinTable: RoundRobinTableRow[] = seededTeams.map((t) => ({
      teamId: t.id,
      played: 0,
      wins: 0,
      losses: 0,
      mapDiff: 0,
      points: 0
    }));

    // Generate full round robin schedule (all vs all)
    const matches: TournamentMatch[] = [];
    let matchIdx = 1;
    for (let i = 0; i < seededTeams.length; i++) {
      for (let j = i + 1; j < seededTeams.length; j++) {
        matches.push({
          id: `${tourId}_rr_m${matchIdx}`,
          stage: 'round_robin',
          poolKey: `rr_r${Math.floor((matchIdx - 1) / (seededTeams.length / 2)) + 1}`,
          roundNumber: Math.floor((matchIdx - 1) / Math.max(1, Math.floor(seededTeams.length / 2))) + 1,
          name: `Тур ${Math.floor((matchIdx - 1) / Math.max(1, Math.floor(seededTeams.length / 2))) + 1} · Матч ${matchIdx}`,
          teamAId: seededTeams[i].id,
          teamBId: seededTeams[j].id,
          scoreA: 0,
          scoreB: 0,
          format: stageFormats.groupFormat || 'BO1',
          status: 'ready'
        });
        matchIdx++;
      }
    }

    return {
      ...baseState,
      roundRobinTable,
      roundRobinMatches: matches,
      playoffMatches: matches // reuse playoffMatches so standard handlers can locate them
    };
  }

  // 5. Groups + Playoffs & GSL Groups (Configurable 2 or 4 groups)
  if (mode === 'groups_playoffs' || mode === 'gsl_groups') {
    // User configured group count (default 2 groups for 8 teams, 4 groups for 16 teams)
    const reqGroupCount = stageFormats.groupCount || (teamCount <= 8 ? 2 : 4);
    const groupCount = Math.max(2, Math.min(reqGroupCount, Math.floor(teamCount / 4) || 2));
    const isGsl = mode === 'gsl_groups' || stageFormats.groupStyle !== 'round_robin';

    const groups: TournamentGroup[] = [];
    const allGroupMatches: TournamentMatch[] = [];
    const groupLetters = ['A', 'B', 'C', 'D'];

    // Snake seeding distribution into groups:
    // Group A gets seeds 0, 3, 4, 7... Group B gets seeds 1, 2, 5, 6...
    for (let g = 0; g < groupCount; g++) {
      const gLetter = groupLetters[g];
      const gName = `Группа ${gLetter}`;
      const groupTeams: Team[] = [];

      for (let i = 0; i < seededTeams.length; i++) {
        const round = Math.floor(i / groupCount);
        const pos = round % 2 === 0 ? i % groupCount : groupCount - 1 - (i % groupCount);
        if (pos === g) {
          groupTeams.push(seededTeams[i]);
        }
      }

      const gMatches: TournamentMatch[] = [];

      if (isGsl) {
        // GSL Dual Tournament Format (Matches Photo):
        // Opening Round (Match 1: Seed 1 vs 4, Match 2: Seed 2 vs 3)
        // Winners' Match (Winner M1 vs Winner M2 -> Winner qualifies #1)
        // Elimination Match (Loser M1 vs Loser M2 -> Loser out)
        // Decider Match (Loser Winners vs Winner Elim -> Winner qualifies #2)
        const openingFmt = stageFormats.groupFormat || 'BO3';
        const deciderFmt = stageFormats.groupFormat || 'BO3';

        const m1: TournamentMatch = {
          id: `${tourId}_gsl_${gLetter}_m1`,
          stage: 'groups',
          poolKey: `gsl_${gLetter}_opening1`,
          roundNumber: 1,
          groupLetter: gLetter,
          name: `${gName} · Открывающий матч 1`,
          teamAId: groupTeams[0]?.id,
          teamBId: groupTeams[3]?.id || groupTeams[groupTeams.length - 1]?.id,
          scoreA: 0,
          scoreB: 0,
          format: openingFmt,
          status: 'ready'
        };

        const m2: TournamentMatch = {
          id: `${tourId}_gsl_${gLetter}_m2`,
          stage: 'groups',
          poolKey: `gsl_${gLetter}_opening2`,
          roundNumber: 1,
          groupLetter: gLetter,
          name: `${gName} · Открывающий матч 2`,
          teamAId: groupTeams[1]?.id,
          teamBId: groupTeams[2]?.id,
          scoreA: 0,
          scoreB: 0,
          format: openingFmt,
          status: 'ready'
        };

        const winners: TournamentMatch = {
          id: `${tourId}_gsl_${gLetter}_winners`,
          stage: 'groups',
          poolKey: `gsl_${gLetter}_winners`,
          roundNumber: 2,
          groupLetter: gLetter,
          name: `${gName} · Матч победителей (За выход #1)`,
          scoreA: 0,
          scoreB: 0,
          format: deciderFmt,
          status: 'scheduled'
        };

        const elim: TournamentMatch = {
          id: `${tourId}_gsl_${gLetter}_elim`,
          stage: 'groups',
          poolKey: `gsl_${gLetter}_elim`,
          roundNumber: 2,
          groupLetter: gLetter,
          name: `${gName} · Матч на вылет`,
          scoreA: 0,
          scoreB: 0,
          format: deciderFmt,
          status: 'scheduled'
        };

        const decider: TournamentMatch = {
          id: `${tourId}_gsl_${gLetter}_decider`,
          stage: 'groups',
          poolKey: `gsl_${gLetter}_decider`,
          roundNumber: 3,
          groupLetter: gLetter,
          name: `${gName} · Решающий матч (За выход #2)`,
          scoreA: 0,
          scoreB: 0,
          format: deciderFmt,
          status: 'scheduled'
        };

        gMatches.push(m1, m2, winners, elim, decider);
      } else {
        // Standard Round Robin inside group
        for (let i = 0; i < groupTeams.length; i++) {
          for (let j = i + 1; j < groupTeams.length; j++) {
            gMatches.push({
              id: `${tourId}_grp_${gLetter}_${i}_${j}`,
              stage: 'groups',
              poolKey: `grp_${gLetter}`,
              roundNumber: 1,
              groupLetter: gLetter,
              name: `${gName} · ${groupTeams[i].name} vs ${groupTeams[j].name}`,
              teamAId: groupTeams[i].id,
              teamBId: groupTeams[j].id,
              scoreA: 0,
              scoreB: 0,
              format: stageFormats.groupFormat || 'BO1',
              status: 'ready'
            });
          }
        }
      }

      groups.push({
        id: `group_${gLetter}`,
        name: gName,
        letter: gLetter,
        teamIds: groupTeams.map((t) => t.id),
        matches: gMatches
      });
      allGroupMatches.push(...gMatches);
    }

    // Playoff bracket based on number of groups:
    // If 2 groups (A & B): 4 teams in playoffs (SF1: 1A vs 2B, SF2: 1B vs 2A -> Grand Final)
    // If 4 groups (A, B, C, D): 8 teams in playoffs (QF1: 1A vs 2B, QF2: 1C vs 2D, QF3: 1B vs 2A, QF4: 1D vs 2C -> SF -> Grand Final)
    const sfFmt = stageFormats.semifinalFormat || 'BO3';
    const finalFmt = stageFormats.finalFormat || 'BO5';
    const qfFmt = stageFormats.quarterfinalFormat || 'BO3';

    let playoffMatches: TournamentMatch[] = [];

    if (groupCount === 2) {
      // 4-team playoff bracket
      playoffMatches = [
        {
          id: 'playoff_sf1',
          stage: 'playoffs',
          poolKey: 'sf1',
          roundNumber: 1,
          name: 'Полуфинал 1 (1-е место Группы A vs 2-е место Группы B)',
          scoreA: 0,
          scoreB: 0,
          format: sfFmt,
          status: 'scheduled'
        },
        {
          id: 'playoff_sf2',
          stage: 'playoffs',
          poolKey: 'sf2',
          roundNumber: 1,
          name: 'Полуфинал 2 (1-е место Группы B vs 2-е место Группы A)',
          scoreA: 0,
          scoreB: 0,
          format: sfFmt,
          status: 'scheduled'
        },
        {
          id: 'playoff_final',
          stage: 'playoffs',
          poolKey: 'final',
          roundNumber: 2,
          name: 'Гранд-финал (Матч за чемпионство)',
          scoreA: 0,
          scoreB: 0,
          format: finalFmt,
          status: 'scheduled'
        }
      ];

      if (includeThirdPlace) {
        playoffMatches.push({
          id: 'playoff_3rd',
          stage: 'playoffs',
          poolKey: 'third_place',
          roundNumber: 2,
          name: 'Матч за 3-е место (Бронзовый финал)',
          scoreA: 0,
          scoreB: 0,
          format: sfFmt,
          status: 'scheduled'
        });
      }
    } else {
      // 8-team playoff bracket
      playoffMatches = createEmptyPlayoffBracket(includeThirdPlace);
    }

    return {
      ...baseState,
      groupCount,
      groupStyle: isGsl ? 'gsl' : 'round_robin',
      groups,
      groupMatches: allGroupMatches,
      playoffMatches
    };
  }

  // Fallback to standard Swiss Playoffs
  return createInitialSwissTournament(seededTeams, false, includeThirdPlace);
}

/**
 * Updates a Group stage match (GSL or Round Robin) and propagates winners/losers
 * through the GSL tree (Opening -> Winners/Elim -> Decider -> Playoffs).
 */
export function updateGroupMatchResult(
  tournament: TournamentState,
  matchId: string,
  scoreA: number,
  scoreB: number,
  actualFormat?: MatchFormat
): { updatedTournament: TournamentState; isGroupsCompleted: boolean } {
  const currentTour = JSON.parse(JSON.stringify(tournament)) as TournamentState;
  const allGroupMatches = currentTour.groupMatches || [];
  const targetMatch = allGroupMatches.find((m) => m.id === matchId);

  if (!targetMatch || !targetMatch.teamAId || !targetMatch.teamBId) {
    return { updatedTournament: currentTour, isGroupsCompleted: false };
  }

  if (actualFormat) targetMatch.format = actualFormat;
  targetMatch.scoreA = scoreA;
  targetMatch.scoreB = scoreB;
  targetMatch.status = 'finished';

  const requiredWins = targetMatch.format === 'BO1' ? 1 : targetMatch.format === 'BO3' ? 2 : 3;
  const aWon = scoreA >= requiredWins;
  targetMatch.winnerId = aWon ? targetMatch.teamAId : targetMatch.teamBId;
  targetMatch.loserId = aWon ? targetMatch.teamBId : targetMatch.teamAId;

  // GSL Group progression logic
  const gLetter = targetMatch.groupLetter || 'A';
  const group = currentTour.groups?.find((g) => g.letter === gLetter || g.name.includes(gLetter));

  if (group) {
    // Sync matches in group object
    group.matches = group.matches.map((m) => (m.id === matchId ? targetMatch : m));

    const m1 = group.matches.find((m) => m.poolKey === `gsl_${gLetter}_opening1`);
    const m2 = group.matches.find((m) => m.poolKey === `gsl_${gLetter}_opening2`);
    const winners = group.matches.find((m) => m.poolKey === `gsl_${gLetter}_winners`);
    const elim = group.matches.find((m) => m.poolKey === `gsl_${gLetter}_elim`);
    const decider = group.matches.find((m) => m.poolKey === `gsl_${gLetter}_decider`);

    // 1. If Opening matches finished, populate Winners and Elimination
    if (m1?.status === 'finished' && m2?.status === 'finished') {
      if (winners && winners.status === 'scheduled') {
        winners.teamAId = m1.winnerId;
        winners.teamBId = m2.winnerId;
        winners.status = 'ready';
      }
      if (elim && elim.status === 'scheduled') {
        elim.teamAId = m1.loserId;
        elim.teamBId = m2.loserId;
        elim.status = 'ready';
      }
    }

    // 2. If Winners match finished -> Winner is #1 seed qualified! Loser goes to Decider (slot A)
    if (winners?.status === 'finished') {
      if (decider) {
        decider.teamAId = winners.loserId;
        if (decider.teamAId && decider.teamBId && decider.status === 'scheduled') {
          decider.status = 'ready';
        }
      }
    }

    // 3. If Elimination match finished -> Loser is eliminated! Winner goes to Decider (slot B)
    if (elim?.status === 'finished') {
      if (decider) {
        decider.teamBId = elim.winnerId;
        if (decider.teamAId && decider.teamBId && decider.status === 'scheduled') {
          decider.status = 'ready';
        }
      }
    }

    // Update group qualified teams
    const qualified: string[] = [];
    const eliminated: string[] = [];

    if (winners?.status === 'finished' && winners.winnerId) {
      qualified.push(winners.winnerId); // 1st seed
    }
    if (decider?.status === 'finished' && decider.winnerId) {
      qualified.push(decider.winnerId); // 2nd seed
    }
    if (elim?.status === 'finished' && elim.loserId) {
      eliminated.push(elim.loserId);
    }
    if (decider?.status === 'finished' && decider.loserId) {
      eliminated.push(decider.loserId);
    }

    group.qualifiedTeamIds = qualified;
    group.eliminatedTeamIds = eliminated;
  }

  // Update overall groupMatches array
  currentTour.groupMatches = allGroupMatches.map((m) => {
    const updatedInGroup = currentTour.groups
      ?.flatMap((g) => g.matches)
      .find((gm) => gm.id === m.id);
    return updatedInGroup || (m.id === matchId ? targetMatch : m);
  });

  // Check if ALL groups have determined their 2 qualified teams!
  const groupsList = currentTour.groups || [];
  const allGroupsFinished =
    groupsList.length > 0 &&
    groupsList.every((g) => g.qualifiedTeamIds && g.qualifiedTeamIds.length >= 2);

  if (allGroupsFinished) {
    // Populate playoff bracket with group qualifiers!
    const groupA = groupsList.find((g) => g.letter === 'A' || g.name.includes('A'));
    const groupB = groupsList.find((g) => g.letter === 'B' || g.name.includes('B'));
    const groupC = groupsList.find((g) => g.letter === 'C' || g.name.includes('C'));
    const groupD = groupsList.find((g) => g.letter === 'D' || g.name.includes('D'));

    const seed1A = groupA?.qualifiedTeamIds?.[0];
    const seed2A = groupA?.qualifiedTeamIds?.[1];
    const seed1B = groupB?.qualifiedTeamIds?.[0];
    const seed2B = groupB?.qualifiedTeamIds?.[1];

    if (groupsList.length === 2 && currentTour.playoffMatches) {
      // 2 Groups -> 4 teams into Semifinals
      const sf1 = currentTour.playoffMatches.find((m) => m.poolKey === 'sf1');
      const sf2 = currentTour.playoffMatches.find((m) => m.poolKey === 'sf2');

      if (sf1) {
        sf1.teamAId = seed1A;
        sf1.teamBId = seed2B;
        sf1.status = 'ready';
      }
      if (sf2) {
        sf2.teamAId = seed1B;
        sf2.teamBId = seed2A;
        sf2.status = 'ready';
      }
    } else if (groupsList.length === 4 && currentTour.playoffMatches) {
      // 4 Groups -> 8 teams into Quarterfinals
      const seed1C = groupC?.qualifiedTeamIds?.[0];
      const seed2C = groupC?.qualifiedTeamIds?.[1];
      const seed1D = groupD?.qualifiedTeamIds?.[0];
      const seed2D = groupD?.qualifiedTeamIds?.[1];

      const qf1 = currentTour.playoffMatches.find((m) => m.poolKey === 'qf1');
      const qf2 = currentTour.playoffMatches.find((m) => m.poolKey === 'qf2');
      const qf3 = currentTour.playoffMatches.find((m) => m.poolKey === 'qf3');
      const qf4 = currentTour.playoffMatches.find((m) => m.poolKey === 'qf4');

      if (qf1) {
        qf1.teamAId = seed1A;
        qf1.teamBId = seed2B;
        qf1.status = 'ready';
      }
      if (qf2) {
        qf2.teamAId = seed1C;
        qf2.teamBId = seed2D;
        qf2.status = 'ready';
      }
      if (qf3) {
        qf3.teamAId = seed1B;
        qf3.teamBId = seed2A;
        qf3.status = 'ready';
      }
      if (qf4) {
        qf4.teamAId = seed1D;
        qf4.teamBId = seed2C;
        qf4.status = 'ready';
      }
    }

    currentTour.currentStage = 'playoffs';
    return { updatedTournament: currentTour, isGroupsCompleted: true };
  }

  return { updatedTournament: currentTour, isGroupsCompleted: false };
}

