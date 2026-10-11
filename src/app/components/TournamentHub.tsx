// @ts-nocheck -- imported legacy code written for a looser tsconfig
import React, { useState } from 'react';
import {
  TournamentState,
  TournamentMatch,
  TournamentMode,
  Team,
  MatchPrediction,
  MatchSeriesMapResult,
  MatchFormat,
  VetoState
} from '../types';
import { SwissStageView } from './SwissStageView';
import { PlayoffsStageView } from './PlayoffsStageView';
import { GslGroupsView } from './GslGroupsView';
import { TournamentSimulationModal } from './TournamentSimulationModal';
import { TournamentResultsModal } from './TournamentResultsModal';
import { SwissPairsModal } from './SwissPairsModal';
import { TeamSelector } from './TeamSelector';
import { CreateTournamentModal } from './CreateTournamentModal';
import {
  createInitialSwissTournament,
  createPlayoffsOnlyTournament,
  advanceSwissRound,
  updatePlayoffMatchResult,
  updateGroupMatchResult,
  computeFinalTournamentStandings,
  calculateTournamentVrsBounties,
  createDefaultSwissRound1Matches,
  swapSwissRoundMatches,
  swapPlayoffMatches,
  calculateTournamentMatchDeltas,
  seedPlayoffsFromSwiss,
  extractTeamTournamentMatches,
  createCustomTournament
} from '../utils/tournament';
import { executeCompleteAutoVeto } from '../utils/vetoEngine';
import { simulateSeriesOnVeto, applyDynamicMapOutcome } from '../utils/mapSimulation';
import { soundFx } from '../utils/audio';
import {
  Trophy,
  Dices,
  RotateCcw,
  FastForward,
  Sparkles,
  GitBranch,
  Grid,
  Zap,
  SlidersHorizontal,
  Trash2,
  PlusCircle,
  Plus,
  Play
} from 'lucide-react';

interface TournamentHubProps {
  teams: Team[];
  tournament: TournamentState | null;
  onUpdateTournament: (tour: TournamentState | null) => void;
  onUpdateTeams?: (teams: Team[]) => void;
  onRecordMatchPrediction?: (prediction: MatchPrediction) => void;
  history?: MatchPrediction[];
  onOpenDataManagement?: () => void;
}

export const TournamentHub: React.FC<TournamentHubProps> = ({
  teams,
  tournament,
  onUpdateTournament,
  onUpdateTeams,
  onRecordMatchPrediction,
  history = [],
  onOpenDataManagement
}) => {
  const [activeStageTab, setActiveStageTab] = useState<'swiss' | 'playoffs' | 'groups'>(() => {
    if (tournament?.mode === 'gsl_groups' || tournament?.mode === 'groups_playoffs') {
      return tournament.currentStage === 'playoffs' ? 'playoffs' : 'groups';
    }
    return tournament?.mode === 'playoffs_only' ||
      tournament?.currentStage === 'playoffs' ||
      tournament?.currentStage === 'completed'
      ? 'playoffs'
      : 'swiss';
  });

  const [activeMatchToSimulate, setActiveMatchToSimulate] = useState<TournamentMatch | null>(null);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isPairsEditorOpen, setIsPairsEditorOpen] = useState(false);
  const [isCreateTournamentOpen, setIsCreateTournamentOpen] = useState(false);

  // Manual team slot picker state
  const [manualSlotPicker, setManualSlotPicker] = useState<{
    matchId: string;
    slot: 'A' | 'B';
  } | null>(null);

  // If no tournament has been created yet, show the Tournament Creation Hub
  if (!tournament) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-200">
        {/* Welcome Empty State Banner */}
        <div className="p-8 sm:p-12 bg-gradient-to-br from-[#0e1422] via-[#090d16] to-[#04060a] border border-amber-500/30 rounded-3xl shadow-2xl relative overflow-hidden text-center space-y-6">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Central Trophy Icon & Title */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-slate-900 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-2xl shadow-amber-500/20 mb-4 animate-bounce duration-1000">
              <Trophy className="w-10 h-10" />
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/25">
                CS2 Tournament Arena · Сетка и симуляция
              </span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Для симуляции матчей создайте турнир
            </h2>

            <p className="text-sm text-slate-300 max-w-2xl mx-auto mt-2 leading-relaxed">
              Чтобы сформировать турнирную сетку и начать симулировать матчи, создайте чемпионат.
              Выберите статус (Major, S-Tier, A-Tier...), регламент стадий (швейцарка, плей-офф, группы) и участников.
              Победитель получит динамические рейтинговые очки VRS, а кубок и все сыгранные матчи с этапами сохранятся в статистике команды!
            </p>
          </div>

          {/* Primary Action Button */}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                soundFx.playClick();
                setIsCreateTournamentOpen(true);
              }}
              className="px-7 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-2xl text-sm uppercase tracking-wider transition-all shadow-xl shadow-amber-500/25 active:scale-95 cursor-pointer flex items-center gap-2.5"
            >
              <Trophy className="w-5 h-5 fill-black" />
              <span>Создать турнир (Конструктор)</span>
            </button>
          </div>

          {/* Quick Presets Grid */}
          <div className="relative z-10 pt-8 border-t border-slate-800/80">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold mb-4">
              Либо выберите готовый чемпионат для мгновенного старта:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto text-left">
              {/* Preset 1: Valve Major */}
              <div
                onClick={() => {
                  soundFx.playClick();
                  const sorted = [...teams].sort((a, b) => b.points - a.points);
                  const tour = createCustomTournament({
                    name: 'Valve CS2 Major Championship 2026',
                    shortName: 'MAJOR 2026',
                    organizer: 'PGL / Valve',
                    prizePool: '$1,250,000',
                    tier: 'Major',
                    mode: 'swiss_playoffs',
                    teams: sorted.slice(0, 16),
                    stageFormats: {
                      swissNormalFormat: 'BO1',
                      swissDeciderFormat: 'BO3',
                      quarterfinalFormat: 'BO3',
                      semifinalFormat: 'BO3',
                      finalFormat: 'BO5'
                    },
                    includeThirdPlace: false
                  });
                  onUpdateTournament(tour);
                  soundFx.playVictory();
                }}
                className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 via-slate-900/60 to-slate-900/90 border border-purple-500/40 hover:border-purple-400 hover:scale-[1.02] transition-all cursor-pointer shadow-lg shadow-purple-500/5 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      MAJOR
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      +380..520 VRS
                    </span>
                  </div>
                  <h4 className="font-extrabold text-white text-sm mt-2 group-hover:text-purple-300 transition-colors">
                    Valve CS2 Major 2026
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    16 команд · Швейцарка BO1/BO3 и арена плей-офф Top-8 с финалом BO5
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-purple-500/20 text-[11px] font-mono font-bold text-purple-300 flex items-center justify-between">
                  <span>Запустить Major</span>
                  <span>→</span>
                </div>
              </div>

              {/* Preset 2: IEM Katowice */}
              <div
                onClick={() => {
                  soundFx.playClick();
                  const sorted = [...teams].sort((a, b) => b.points - a.points);
                  const tour = createCustomTournament({
                    name: 'Intel Extreme Masters Katowice 2026',
                    shortName: 'IEM KATO',
                    organizer: 'ESL',
                    prizePool: '$1,000,000',
                    tier: 'S-Tier',
                    mode: 'gsl_groups',
                    teams: sorted.slice(0, 16),
                    stageFormats: {
                      groupFormat: 'BO3',
                      quarterfinalFormat: 'BO3',
                      semifinalFormat: 'BO3',
                      finalFormat: 'BO5'
                    },
                    includeThirdPlace: true
                  });
                  onUpdateTournament(tour);
                  soundFx.playVictory();
                }}
                className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900/60 to-slate-900/90 border border-amber-500/40 hover:border-amber-400 hover:scale-[1.02] transition-all cursor-pointer shadow-lg shadow-amber-500/5 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      S-TIER
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      +260..350 VRS
                    </span>
                  </div>
                  <h4 className="font-extrabold text-white text-sm mt-2 group-hover:text-amber-300 transition-colors">
                    IEM Katowice 2026
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    16 команд · GSL Группы BO3 и плей-офф в Сподеке с гранд-финалом BO5
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-amber-500/20 text-[11px] font-mono font-bold text-amber-300 flex items-center justify-between">
                  <span>Запустить IEM</span>
                  <span>→</span>
                </div>
              </div>

              {/* Preset 3: AgeraPVP Championship */}
              <div
                onClick={() => {
                  soundFx.playClick();
                  const sorted = [...teams].sort((a, b) => b.points - a.points);
                  const tour = createCustomTournament({
                    name: 'AgeraPVP Championship 2026',
                    shortName: 'AGERA 2026',
                    organizer: 'Agera Gaming',
                    prizePool: '$1,250,000',
                    tier: 'S-Tier',
                    mode: 'swiss_playoffs',
                    teams: sorted.slice(0, 16),
                    stageFormats: {
                      swissNormalFormat: 'BO1',
                      swissDeciderFormat: 'BO3',
                      quarterfinalFormat: 'BO3',
                      semifinalFormat: 'BO3',
                      finalFormat: 'BO5'
                    },
                    includeThirdPlace: true
                  });
                  onUpdateTournament(tour);
                  soundFx.playVictory();
                }}
                className="p-4 rounded-2xl bg-gradient-to-br from-yellow-950/25 via-slate-900/60 to-slate-900/90 border border-yellow-500/40 hover:border-yellow-400 hover:scale-[1.02] transition-all cursor-pointer shadow-lg shadow-yellow-500/5 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                      S-TIER
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      +260..350 VRS
                    </span>
                  </div>
                  <h4 className="font-extrabold text-white text-sm mt-2 group-hover:text-yellow-300 transition-colors">
                    AgeraPVP Championship
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    16 команд · Полная швейцарка + плей-офф с матчем за 3-е место
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-yellow-500/20 text-[11px] font-mono font-bold text-yellow-300 flex items-center justify-between">
                  <span>Запустить Agera</span>
                  <span>→</span>
                </div>
              </div>

              {/* Preset 4: Masters Cup (Single Elimination) */}
              <div
                onClick={() => {
                  soundFx.playClick();
                  const sorted = [...teams].sort((a, b) => b.points - a.points);
                  const tour = createCustomTournament({
                    name: 'CS2 Masters Cup 2026',
                    shortName: 'MASTERS',
                    organizer: 'StarLadder',
                    prizePool: '$500,000',
                    tier: 'A-Tier',
                    mode: 'single_elimination',
                    teams: sorted.slice(0, 8),
                    stageFormats: {
                      quarterfinalFormat: 'BO3',
                      semifinalFormat: 'BO3',
                      finalFormat: 'BO5'
                    },
                    includeThirdPlace: true
                  });
                  onUpdateTournament(tour);
                  soundFx.playVictory();
                }}
                className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/25 via-slate-900/60 to-slate-900/90 border border-blue-500/40 hover:border-blue-400 hover:scale-[1.02] transition-all cursor-pointer shadow-lg shadow-blue-500/5 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      A-TIER
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      +140..220 VRS
                    </span>
                  </div>
                  <h4 className="font-extrabold text-white text-sm mt-2 group-hover:text-blue-300 transition-colors">
                    CS2 Masters Cup
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    8 команд · Быстрая олимпийская сетка плей-офф Single Elimination
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-blue-500/20 text-[11px] font-mono font-bold text-blue-300 flex items-center justify-between">
                  <span>Запустить Masters</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal for Creation */}
        {isCreateTournamentOpen && (
          <CreateTournamentModal
            teams={teams}
            onClose={() => setIsCreateTournamentOpen(false)}
            onCreateTournament={(createdTour) => {
              setIsCreateTournamentOpen(false);
              onUpdateTournament(createdTour);
              soundFx.playVictory();
            }}
          />
        )}
      </div>
    );
  }

  // 1. Switch tournament mode
  const handleChangeMode = (mode: TournamentMode) => {
    soundFx.playClick();
    if (mode === 'swiss_playoffs') {
      const newTour = createInitialSwissTournament(teams, false, tournament.includeThirdPlace);
      onUpdateTournament(newTour);
      setActiveStageTab('swiss');
    } else {
      const newTour = createPlayoffsOnlyTournament(teams, false, tournament.includeThirdPlace);
      onUpdateTournament(newTour);
      setActiveStageTab('playoffs');
    }
  };

  // 2. Randomize teams in tournament
  const handleRandomizeTournament = () => {
    soundFx.playClick();
    if (tournament.mode === 'swiss_playoffs') {
      const newTour = createInitialSwissTournament(teams, true, tournament.includeThirdPlace);
      onUpdateTournament(newTour);
      setActiveStageTab('swiss');
    } else {
      const newTour = createPlayoffsOnlyTournament(teams, true, tournament.includeThirdPlace);
      onUpdateTournament(newTour);
      setActiveStageTab('playoffs');
    }
  };

  // 3. Reset to default rating seeding
  const handleSeedByRating = () => {
    soundFx.playClick();
    if (tournament.mode === 'swiss_playoffs') {
      const newTour = createInitialSwissTournament(teams, false, tournament.includeThirdPlace);
      onUpdateTournament(newTour);
      setActiveStageTab('swiss');
    } else {
      const newTour = createPlayoffsOnlyTournament(teams, false, tournament.includeThirdPlace);
      onUpdateTournament(newTour);
      setActiveStageTab('playoffs');
    }
  };

  // 4. Reset Round 1 Swiss matches to default pairings
  const handleResetDefaultPairs = () => {
    soundFx.playClick();
    const defaultR1 = createDefaultSwissRound1Matches(teams);
    onUpdateTournament({
      ...tournament,
      swissMatches: defaultR1,
      swissRound: 1
    });
  };

  // 5. Swap Team A and Team B in a match
  const handleSwapMatchTeams = (matchId: string) => {
    soundFx.playClick();
    if (tournament.mode === 'swiss_playoffs' && tournament.currentStage === 'swiss') {
      const updated = tournament.swissMatches.map((m) => {
        if (m.id === matchId) {
          return { ...m, teamAId: m.teamBId, teamBId: m.teamAId };
        }
        return m;
      });
      onUpdateTournament({ ...tournament, swissMatches: updated });
    } else {
      const updated = tournament.playoffMatches.map((m) => {
        if (m.id === matchId) {
          return { ...m, teamAId: m.teamBId, teamBId: m.teamAId };
        }
        return m;
      });
      onUpdateTournament({ ...tournament, playoffMatches: updated });
    }
  };

  // 6. Toggle link to Swiss for playoffs
  const handleToggleLinkSwiss = () => {
    soundFx.playClick();
    const nextLink = tournament.linkPlayoffsToSwiss === false;
    if (nextLink) {
      // Re-seed from qualified Swiss records
      const qualified = Object.values(tournament.swissRecords).filter((r) => r.status === 'qualified');
      const seeded = seedPlayoffsFromSwiss(
        tournament.playoffMatches,
        qualified,
        teams,
        tournament.includeThirdPlace
      );
      onUpdateTournament({
        ...tournament,
        linkPlayoffsToSwiss: true,
        playoffMatches: seeded
      });
    } else {
      onUpdateTournament({
        ...tournament,
        linkPlayoffsToSwiss: false
      });
    }
  };

  // 7. Reset playoffs to Swiss official CS2 seeding
  const handleResetToSwissSeeding = () => {
    soundFx.playClick();
    const qualified = Object.values(tournament.swissRecords).filter((r) => r.status === 'qualified');
    const seeded = seedPlayoffsFromSwiss(
      tournament.playoffMatches,
      qualified,
      teams,
      tournament.includeThirdPlace
    );
    onUpdateTournament({
      ...tournament,
      linkPlayoffsToSwiss: true,
      playoffMatches: seeded
    });
  };

  // 8. Randomize playoff bracket (Free Mode)
  const handleRandomizePlayoffTeams = () => {
    soundFx.playClick();
    const newTour = createPlayoffsOnlyTournament(teams, true, tournament.includeThirdPlace);
    onUpdateTournament({
      ...tournament,
      linkPlayoffsToSwiss: false,
      playoffMatches: newTour.playoffMatches
    });
  };

  // 9. Seed Top 8 VRS into playoff bracket (Free Mode)
  const handleSeedTop8VRS = () => {
    soundFx.playClick();
    const newTour = createPlayoffsOnlyTournament(teams, false, tournament.includeThirdPlace);
    onUpdateTournament({
      ...tournament,
      linkPlayoffsToSwiss: false,
      playoffMatches: newTour.playoffMatches
    });
  };

  // 10. Toggle 3rd Place match
  const handleToggleThirdPlace = () => {
    const nextInclude = !tournament.includeThirdPlace;
    onUpdateTournament({
      ...tournament,
      includeThirdPlace: nextInclude
    });
  };

  // Helper to record match stats (VRS & Form)
  const applyMatchEffects = (
    match: TournamentMatch,
    scoreA: number,
    scoreB: number,
    winnerId: string,
    deltaPtsA?: number,
    deltaPtsB?: number,
    deltaFmA?: number,
    deltaFmB?: number,
    actualFormat?: MatchFormat,
    mapsPlayed?: MatchSeriesMapResult[]
  ) => {
    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);
    if (!teamA || !teamB) return { deltaPointsA: 0, deltaPointsB: 0, deltaFormA: 0, deltaFormB: 0 };

    let finalDeltaPtsA = deltaPtsA;
    let finalDeltaPtsB = deltaPtsB;
    let finalDeltaFmA = deltaFmA;
    let finalDeltaFmB = deltaFmB;

    if (finalDeltaPtsA === undefined || finalDeltaPtsB === undefined) {
      const calculated = calculateTournamentMatchDeltas(
        teamA,
        teamB,
        scoreA,
        scoreB,
        winnerId,
        teams
      );
      finalDeltaPtsA = calculated.deltaPointsA;
      finalDeltaPtsB = calculated.deltaPointsB;
      finalDeltaFmA = calculated.deltaFormA;
      finalDeltaFmB = calculated.deltaFormB;
    }

    // Live update VRS points
    if (onUpdateTeams && finalDeltaPtsA !== undefined && finalDeltaPtsB !== undefined) {
      const updated = teams.map((t) => {
        if (t.id === teamA.id) return { ...t, points: Math.max(100, t.points + finalDeltaPtsA!) };
        if (t.id === teamB.id) return { ...t, points: Math.max(100, t.points + finalDeltaPtsB!) };
        return t;
      });
      onUpdateTeams(updated);
    }

    // Live update match history for dynamic form tracking
    if (onRecordMatchPrediction) {
      const winnerTeam = winnerId === teamA.id ? teamA : teamB;
      const loserTeam = winnerId === teamA.id ? teamB : teamA;
      const effectiveFormat = actualFormat || match.format || 'BO3';
      onRecordMatchPrediction({
        id: `tour_${match.id}_${Date.now()}`,
        timestamp: Date.now(),
        format: effectiveFormat,
        teamAId: teamA.id,
        teamBId: teamB.id,
        teamAName: teamA.name,
        teamBName: teamB.name,
        scoreA,
        scoreB,
        winnerTeamId: winnerId,
        deltaPointsA: finalDeltaPtsA,
        deltaPointsB: finalDeltaPtsB,
        deltaFormA: finalDeltaFmA,
        deltaFormB: finalDeltaFmB,
        mapsPlayed: mapsPlayed || match.mapsPlayed,
        isUpset: winnerTeam.points < loserTeam.points && loserTeam.points - winnerTeam.points >= 80
      });
    }

    return {
      deltaPointsA: finalDeltaPtsA,
      deltaPointsB: finalDeltaPtsB,
      deltaFormA: finalDeltaFmA,
      deltaFormB: finalDeltaFmB
    };
  };

  // Helper to finalize tournament victory, award dynamic VRS points, and add trophy
  const finalizeTournamentVictory = (tourState: TournamentState): TournamentState => {
    // Guard: never award the title twice for the same tournament
    if (tourState.currentStage === 'completed') return tourState;
    const alreadyAwarded = teams.some((t) => (t.trophies || []).some((tr) => tr.tournamentId === tourState.id));
    const tourTier =
      tourState.tier ||
      (tourState.name?.toLowerCase().includes('major') ? 'Major' : 'S-Tier');
    const bounties = calculateTournamentVrsBounties(
      tourTier,
      teams,
      tourState.teamCount || 16
    );
    const standings = computeFinalTournamentStandings(tourState, teams, bounties);

    const champId = standings[0]?.teamId;
    const finalistId = standings[1]?.teamId;
    const thirdId = standings[2]?.teamId;
    const tourTitle = tourState.name || 'CS2 Championship';

    if (onUpdateTeams && champId && !alreadyAwarded) {
      const finalistTeam = teams.find((t) => t.id === finalistId);
      const updatedTeams = teams.map((t) => {
        if (t.id === champId) {
          const currentTrophies = t.trophies || [];
          const champMatches = extractTeamTournamentMatches(tourState, champId, teams);
          const newTrophy = {
            id: `tr_${Date.now()}`,
            tournamentId: tourState.id,
            name: tourTitle,
            year: new Date().getFullYear(),
            date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
            tier: tourTier,
            vrsPointsAwarded: bounties.championBonus,
            runnerUpTeamName: finalistTeam?.name,
            runnerUpTeamId: finalistId,
            teamCount: tourState.teamCount || 16,
            mode: tourState.mode,
            matchesPlayed: champMatches
          };
          return {
            ...t,
            points: t.points + bounties.championBonus,
            trophiesCount: currentTrophies.length + 1,
            trophies: [newTrophy, ...currentTrophies]
          };
        }
        if (t.id === finalistId) {
          return {
            ...t,
            points: t.points + bounties.finalistBonus
          };
        }
        if (t.id === thirdId && tourState.includeThirdPlace) {
          return {
            ...t,
            points: t.points + bounties.thirdPlaceBonus
          };
        }
        return t;
      });
      onUpdateTeams(updatedTeams);
    }

    const completedTour: TournamentState = {
      ...tourState,
      currentStage: 'completed',
      standings,
      tier: tourTier,
      championVrsBonus: bounties.championBonus
    };
    setIsResultsOpen(true);
    soundFx.playVictory();
    return completedTour;
  };

  // 11. Confirm Match Result from Simulation Modal
  const handleConfirmMatchResult = (
    matchId: string,
    scoreA: number,
    scoreB: number,
    winnerId: string,
    deltaPtsA?: number,
    deltaPtsB?: number,
    deltaFmA?: number,
    deltaFmB?: number,
    mapsPlayed?: MatchSeriesMapResult[],
    vetoState?: VetoState,
    actualFormat?: MatchFormat
  ) => {
    const isSwissMatch = tournament.swissMatches.some((m) => m.id === matchId);
    const isGroupMatch = tournament.groupMatches?.some((m) => m.id === matchId);

    if (isSwissMatch) {
      const matchToUpdate = tournament.swissMatches.find((m) => m.id === matchId);
      if (!matchToUpdate) return;

      const effectiveFormat = actualFormat || matchToUpdate.format;
      const matchWithFormat = { ...matchToUpdate, format: effectiveFormat };

      const deltas = applyMatchEffects(
        matchWithFormat,
        scoreA,
        scoreB,
        winnerId,
        deltaPtsA,
        deltaPtsB,
        deltaFmA,
        deltaFmB,
        effectiveFormat,
        mapsPlayed
      );

      const updatedMatches = tournament.swissMatches.map((m) => {
        if (m.id === matchId) {
          const loserId = m.teamAId === winnerId ? m.teamBId : m.teamAId;
          return {
            ...m,
            format: effectiveFormat,
            scoreA,
            scoreB,
            status: 'finished' as const,
            winnerId,
            loserId,
            deltaPointsA: deltas.deltaPointsA,
            deltaPointsB: deltas.deltaPointsB,
            deltaFormA: deltas.deltaFormA,
            deltaFormB: deltas.deltaFormB,
            mapsPlayed: mapsPlayed || m.mapsPlayed,
            vetoState: vetoState || m.vetoState
          };
        }
        return m;
      });

      let nextTour: TournamentState = {
        ...tournament,
        swissMatches: updatedMatches
      };

      // Check if current round has all matches finished
      const currentRoundMatches = updatedMatches.filter((m) => m.roundNumber === tournament.swissRound);
      const allCurrentRoundDone = currentRoundMatches.every((m) => m.status === 'finished');

      if (allCurrentRoundDone) {
        nextTour = advanceSwissRound(nextTour, teams);
        if (nextTour.currentStage === 'playoffs') {
          setActiveStageTab('playoffs');
        }
      }

      onUpdateTournament(nextTour);
    } else if (isGroupMatch) {
      const matchToUpdate = tournament.groupMatches?.find((m) => m.id === matchId);
      if (!matchToUpdate) return;

      const effectiveFormat = actualFormat || matchToUpdate.format;
      const matchWithFormat = { ...matchToUpdate, format: effectiveFormat };

      const deltas = applyMatchEffects(
        matchWithFormat,
        scoreA,
        scoreB,
        winnerId,
        deltaPtsA,
        deltaPtsB,
        deltaFmA,
        deltaFmB,
        effectiveFormat,
        mapsPlayed
      );

      const { updatedTournament, isGroupsCompleted } = updateGroupMatchResult(
        tournament,
        matchId,
        scoreA,
        scoreB,
        effectiveFormat
      );

      // Attach deltas & vetoState to the match in updatedTournament
      const enrichedGroupMatches = (updatedTournament.groupMatches || []).map((m) => {
        if (m.id === matchId) {
          return {
            ...m,
            deltaPointsA: deltas.deltaPointsA,
            deltaPointsB: deltas.deltaPointsB,
            deltaFormA: deltas.deltaFormA,
            deltaFormB: deltas.deltaFormB,
            mapsPlayed: mapsPlayed || m.mapsPlayed,
            vetoState: vetoState || m.vetoState
          };
        }
        return m;
      });

      const nextTour: TournamentState = {
        ...updatedTournament,
        groupMatches: enrichedGroupMatches
      };

      if (isGroupsCompleted) {
        setActiveStageTab('playoffs');
        soundFx.playVictory();
      }

      onUpdateTournament(nextTour);
    } else {
      const matchToUpdate = tournament.playoffMatches.find((m) => m.id === matchId);
      if (!matchToUpdate) return;

      const effectiveFormat = actualFormat || matchToUpdate.format;
      const matchWithFormat = { ...matchToUpdate, format: effectiveFormat };

      const deltas = applyMatchEffects(
        matchWithFormat,
        scoreA,
        scoreB,
        winnerId,
        deltaPtsA,
        deltaPtsB,
        deltaFmA,
        deltaFmB,
        effectiveFormat,
        mapsPlayed
      );

      const { updatedMatches, isTournamentOver } = updatePlayoffMatchResult(
        tournament.playoffMatches,
        matchId,
        scoreA,
        scoreB,
        tournament.includeThirdPlace,
        effectiveFormat
      );

      const withDeltas = updatedMatches.map((m) => {
        if (m.id === matchId) {
          return {
            ...m,
            format: effectiveFormat,
            deltaPointsA: deltas.deltaPointsA,
            deltaPointsB: deltas.deltaPointsB,
            deltaFormA: deltas.deltaFormA,
            deltaFormB: deltas.deltaFormB,
            mapsPlayed: mapsPlayed || m.mapsPlayed,
            vetoState: vetoState || m.vetoState
          };
        }
        return m;
      });

      let nextTour: TournamentState = {
        ...tournament,
        playoffMatches: withDeltas
      };

      if (isTournamentOver) {
        nextTour = finalizeTournamentVictory(nextTour);
      }

      onUpdateTournament(nextTour);
    }
  };

  // Toggle match format on ready match (BO1 <-> BO3 <-> BO5)
  const handleToggleMatchFormat = (matchId: string) => {
    soundFx.playClick();
    const cycleFormat = (fmt: MatchFormat): MatchFormat => {
      if (fmt === 'BO1') return 'BO3';
      if (fmt === 'BO3') return 'BO5';
      return 'BO1';
    };

    const isSwiss = tournament.swissMatches.some((m) => m.id === matchId);
    const isGroup = tournament.groupMatches?.some((m) => m.id === matchId);

    if (isSwiss) {
      const updated = tournament.swissMatches.map((m) =>
        m.id === matchId && m.status !== 'finished' ? { ...m, format: cycleFormat(m.format) } : m
      );
      onUpdateTournament({ ...tournament, swissMatches: updated });
    } else if (isGroup) {
      const updated = (tournament.groupMatches || []).map((m) =>
        m.id === matchId && m.status !== 'finished' ? { ...m, format: cycleFormat(m.format) } : m
      );
      const updatedGroups = (tournament.groups || []).map((g) => ({
        ...g,
        matches: g.matches.map((m) =>
          m.id === matchId && m.status !== 'finished' ? { ...m, format: cycleFormat(m.format) } : m
        )
      }));
      onUpdateTournament({ ...tournament, groupMatches: updated, groups: updatedGroups });
    } else {
      const updated = tournament.playoffMatches.map((m) =>
        m.id === matchId && m.status !== 'finished' ? { ...m, format: cycleFormat(m.format) } : m
      );
      onUpdateTournament({ ...tournament, playoffMatches: updated });
    }

    if (activeMatchToSimulate && activeMatchToSimulate.id === matchId) {
      setActiveMatchToSimulate((prev) =>
        prev ? { ...prev, format: cycleFormat(prev.format) } : null
      );
    }
  };

  // Update group matches when user customizes pairings
  const handleUpdateGroupMatches = (groupId: string, updatedGroupMatches: TournamentMatch[]) => {
    if (!tournament || !tournament.groups) return;
    const nextGroups = tournament.groups.map((g) => {
      if (g.id === groupId || g.letter === groupId) {
        return {
          ...g,
          matches: updatedGroupMatches
        };
      }
      return g;
    });

    const nextAllGroupMatches = (tournament.groupMatches || []).map((m) => {
      const matchInGroup = updatedGroupMatches.find((gm) => gm.id === m.id);
      return matchInGroup || m;
    });

    onUpdateTournament({
      ...tournament,
      groups: nextGroups,
      groupMatches: nextAllGroupMatches
    });
  };

  // 12. Quick simulate a single match with authentic CS2 Map Veto and realistic MR12 score
  const handleQuickSimulateMatch = (match: TournamentMatch) => {
    soundFx.playClick();
    if (!match.teamAId || !match.teamBId) return;

    const tA = teams.find((t) => t.id === match.teamAId);
    const tB = teams.find((t) => t.id === match.teamBId);
    if (!tA || !tB) return;

    const veto = executeCompleteAutoVeto(match.format, tA, tB);
    const seriesResult = simulateSeriesOnVeto(match.format, tA, tB, veto.selectedMapsInOrder);

    // Apply dynamic map outcomes
    if (tA.mapProfile && tB.mapProfile) {
      let profA = tA.mapProfile;
      let profB = tB.mapProfile;
      for (const m of seriesResult.mapsPlayed) {
        profA = applyDynamicMapOutcome(profA, m.mapName, m.winnerTeamId === tA.id, m.scoreA, m.scoreB, tB);
        profB = applyDynamicMapOutcome(profB, m.mapName, m.winnerTeamId === tB.id, m.scoreB, m.scoreA, tA);
      }
      if (onUpdateTeams) {
        onUpdateTeams(
          teams.map((t) => {
            if (t.id === tA.id) return { ...t, mapProfile: profA };
            if (t.id === tB.id) return { ...t, mapProfile: profB };
            return t;
          })
        );
      }
    }

    handleConfirmMatchResult(
      match.id,
      seriesResult.seriesScoreA,
      seriesResult.seriesScoreB,
      seriesResult.winnerTeamId,
      undefined,
      undefined,
      undefined,
      undefined,
      seriesResult.mapsPlayed,
      veto,
      match.format
    );
  };

  // 13. Fast simulate entire current active round on CS2 maps
  const handleFastSimulateRound = () => {
    soundFx.playClick();
    if (tournament.mode === 'swiss_playoffs' && tournament.currentStage === 'swiss') {
      const roundMatches = tournament.swissMatches.filter(
        (m) => m.roundNumber === tournament.swissRound && m.status !== 'finished' && m.teamAId && m.teamBId
      );

      let currentMatches = [...tournament.swissMatches];

      for (const m of roundMatches) {
        const tA = teams.find((t) => t.id === m.teamAId);
        const tB = teams.find((t) => t.id === m.teamBId);
        if (!tA || !tB) continue;

        const veto = executeCompleteAutoVeto(m.format, tA, tB);
        const seriesResult = simulateSeriesOnVeto(m.format, tA, tB, veto.selectedMapsInOrder);
        const sA = seriesResult.seriesScoreA;
        const sB = seriesResult.seriesScoreB;
        const winnerId = seriesResult.winnerTeamId;
        const loserId = winnerId === tA.id ? tB.id : tA.id;

        const deltas = applyMatchEffects(
          m,
          sA,
          sB,
          winnerId,
          undefined,
          undefined,
          undefined,
          undefined,
          m.format,
          seriesResult.mapsPlayed
        );

        currentMatches = currentMatches.map((existing) =>
          existing.id === m.id
            ? {
                ...existing,
                scoreA: sA,
                scoreB: sB,
                status: 'finished' as const,
                winnerId,
                loserId,
                deltaPointsA: deltas.deltaPointsA,
                deltaPointsB: deltas.deltaPointsB,
                deltaFormA: deltas.deltaFormA,
                deltaFormB: deltas.deltaFormB,
                mapsPlayed: seriesResult.mapsPlayed,
                vetoState: veto
              }
            : existing
        );
      }

      let nextTour: TournamentState = {
        ...tournament,
        swissMatches: currentMatches
      };
      nextTour = advanceSwissRound(nextTour, teams);
      if (nextTour.currentStage === 'playoffs') {
        setActiveStageTab('playoffs');
      }
      onUpdateTournament(nextTour);
      soundFx.playVictory();
    } else {
      // Simulate ready playoff matches
      let currentMatches = [...tournament.playoffMatches];
      let isDone = false;
      const readyMatches = currentMatches.filter((m) => m.status === 'ready' && m.teamAId && m.teamBId);

      for (const m of readyMatches) {
        const tA = teams.find((t) => t.id === m.teamAId);
        const tB = teams.find((t) => t.id === m.teamBId);
        if (!tA || !tB) continue;

        const veto = executeCompleteAutoVeto(m.format, tA, tB);
        const seriesResult = simulateSeriesOnVeto(m.format, tA, tB, veto.selectedMapsInOrder);
        const sA = seriesResult.seriesScoreA;
        const sB = seriesResult.seriesScoreB;
        const winnerId = seriesResult.winnerTeamId;
        const deltas = applyMatchEffects(
          m,
          sA,
          sB,
          winnerId,
          undefined,
          undefined,
          undefined,
          undefined,
          m.format,
          seriesResult.mapsPlayed
        );

        const res = updatePlayoffMatchResult(
          currentMatches,
          m.id,
          sA,
          sB,
          tournament.includeThirdPlace,
          m.format
        );
        currentMatches = res.updatedMatches.map((ex) =>
          ex.id === m.id
            ? {
                ...ex,
                deltaPointsA: deltas.deltaPointsA,
                deltaPointsB: deltas.deltaPointsB,
                deltaFormA: deltas.deltaFormA,
                deltaFormB: deltas.deltaFormB,
                mapsPlayed: seriesResult.mapsPlayed,
                vetoState: veto
              }
            : ex
        );
        if (res.isTournamentOver) isDone = true;
      }

      let nextTour: TournamentState = {
        ...tournament,
        playoffMatches: currentMatches
      };

      if (isDone) {
        nextTour = finalizeTournamentVictory(nextTour);
      }

      onUpdateTournament(nextTour);
      soundFx.playVictory();
    }
  };

  // 14. Fast simulate entire tournament until completion on CS2 maps
  const handleSimulateFullTournament = () => {
    soundFx.playClick();
    let currentTour = { ...tournament };

    // Advance swiss completely
    if (currentTour.mode === 'swiss_playoffs' && currentTour.currentStage === 'swiss') {
      let loops = 0;
      while (currentTour.currentStage === 'swiss' && loops < 10) {
        loops++;
        const activeRound = currentTour.swissRound;
        const matchesInRound = currentTour.swissMatches.filter(
          (m) => m.roundNumber === activeRound && m.status !== 'finished' && m.teamAId && m.teamBId
        );

        let updatedMatches = [...currentTour.swissMatches];
        for (const m of matchesInRound) {
          const tA = teams.find((t) => t.id === m.teamAId);
          const tB = teams.find((t) => t.id === m.teamBId);
          if (!tA || !tB) continue;

          const veto = executeCompleteAutoVeto(m.format, tA, tB);
          const seriesResult = simulateSeriesOnVeto(m.format, tA, tB, veto.selectedMapsInOrder);
          const sA = seriesResult.seriesScoreA;
          const sB = seriesResult.seriesScoreB;
          const winnerId = seriesResult.winnerTeamId;
          const loserId = winnerId === tA.id ? tB.id : tA.id;
          const deltas = applyMatchEffects(
            m,
            sA,
            sB,
            winnerId,
            undefined,
            undefined,
            undefined,
            undefined,
            m.format,
            seriesResult.mapsPlayed
          );

          updatedMatches = updatedMatches.map((ex) =>
            ex.id === m.id
              ? {
                  ...ex,
                  scoreA: sA,
                  scoreB: sB,
                  status: 'finished' as const,
                  winnerId,
                  loserId,
                  deltaPointsA: deltas.deltaPointsA,
                  deltaPointsB: deltas.deltaPointsB,
                  deltaFormA: deltas.deltaFormA,
                  deltaFormB: deltas.deltaFormB,
                  mapsPlayed: seriesResult.mapsPlayed,
                  vetoState: veto
                }
              : ex
          );
        }

        currentTour = { ...currentTour, swissMatches: updatedMatches };
        currentTour = advanceSwissRound(currentTour, teams);
      }
    }

    // Now advance playoffs completely
    let pMatches = [...currentTour.playoffMatches];
    let isDone = false;
    let pLoops = 0;
    while (!isDone && pLoops < 15) {
      pLoops++;
      const readyMatches = pMatches.filter((m) => m.status === 'ready' && m.teamAId && m.teamBId);
      if (readyMatches.length === 0) break;

      for (const m of readyMatches) {
        const tA = teams.find((t) => t.id === m.teamAId);
        const tB = teams.find((t) => t.id === m.teamBId);
        if (!tA || !tB) continue;

        const veto = executeCompleteAutoVeto(m.format, tA, tB);
        const seriesResult = simulateSeriesOnVeto(m.format, tA, tB, veto.selectedMapsInOrder);
        const sA = seriesResult.seriesScoreA;
        const sB = seriesResult.seriesScoreB;
        const winnerId = seriesResult.winnerTeamId;
        const deltas = applyMatchEffects(
          m,
          sA,
          sB,
          winnerId,
          undefined,
          undefined,
          undefined,
          undefined,
          m.format,
          seriesResult.mapsPlayed
        );

        const res = updatePlayoffMatchResult(
          pMatches,
          m.id,
          sA,
          sB,
          currentTour.includeThirdPlace,
          m.format
        );
        pMatches = res.updatedMatches.map((ex) =>
          ex.id === m.id
            ? {
                ...ex,
                deltaPointsA: deltas.deltaPointsA,
                deltaPointsB: deltas.deltaPointsB,
                deltaFormA: deltas.deltaFormA,
                deltaFormB: deltas.deltaFormB,
                mapsPlayed: seriesResult.mapsPlayed,
                vetoState: veto
              }
            : ex
        );
        if (res.isTournamentOver) isDone = true;
      }
    }

    currentTour = {
      ...currentTour,
      playoffMatches: pMatches
    };

    if (isDone) {
      currentTour = finalizeTournamentVictory(currentTour);
    }

    onUpdateTournament(currentTour);
    soundFx.playVictory();
  };

  // 15. Manual team placement in a slot (Swaps teams cleanly)
  const handleSelectTeamManually = (selectedTeam: Team) => {
    if (!manualSlotPicker) return;
    const { matchId, slot } = manualSlotPicker;

    const isGroupMatch = tournament.groupMatches?.some((m) => m.id === matchId);
    if (isGroupMatch) {
      const nextGroups = (tournament.groups || []).map((g) => {
        const hasMatch = g.matches.some((m) => m.id === matchId);
        if (!hasMatch) return g;
        const targetMatch = g.matches.find((m) => m.id === matchId)!;
        const currentTeamInSlot = slot === 'A' ? targetMatch.teamAId : targetMatch.teamBId;

        const updatedMatches = g.matches.map((m) => {
          if (m.id === matchId) {
            return {
              ...m,
              teamAId: slot === 'A' ? selectedTeam.id : m.teamAId,
              teamBId: slot === 'B' ? selectedTeam.id : m.teamBId,
              status: 'ready' as const
            };
          }
          if (m.teamAId === selectedTeam.id || m.teamBId === selectedTeam.id) {
            return {
              ...m,
              teamAId: m.teamAId === selectedTeam.id ? currentTeamInSlot : m.teamAId,
              teamBId: m.teamBId === selectedTeam.id ? currentTeamInSlot : m.teamBId,
              status: 'ready' as const
            };
          }
          return m;
        });

        return {
          ...g,
          matches: updatedMatches
        };
      });

      const nextAllGroupMatches = (tournament.groupMatches || []).map((m) => {
        const matchInGroup = nextGroups.flatMap((g) => g.matches).find((gm) => gm.id === m.id);
        return matchInGroup || m;
      });

      onUpdateTournament({
        ...tournament,
        groups: nextGroups,
        groupMatches: nextAllGroupMatches
      });
      setManualSlotPicker(null);
      return;
    }

    if (tournament.mode === 'swiss_playoffs' && tournament.currentStage === 'swiss') {
      const updated = swapSwissRoundMatches(tournament.swissMatches, matchId, slot, selectedTeam.id);
      onUpdateTournament({ ...tournament, swissMatches: updated });
    } else {
      const updated = swapPlayoffMatches(tournament.playoffMatches, matchId, slot, selectedTeam.id);
      onUpdateTournament({ ...tournament, playoffMatches: updated });
    }

    setManualSlotPicker(null);
  };

  // Qualified teams in Swiss
  const qualifiedSwissTeams = Object.values(tournament.swissRecords)
    .filter((r) => r.status === 'qualified')
    .map((r) => teams.find((t) => t.id === r.teamId))
    .filter(Boolean) as Team[];

  // Eligible teams for the picker:
  const groupOfCurrentPicker = manualSlotPicker
    ? tournament.groups?.find((g) => g.matches.some((m) => m.id === manualSlotPicker.matchId))
    : null;

  const eligiblePickerTeams = groupOfCurrentPicker
    ? (groupOfCurrentPicker.teamIds?.map((id) => teams.find((t) => t.id === id)).filter(Boolean) as Team[]) || teams
    : activeStageTab === 'playoffs' &&
      tournament.mode === 'swiss_playoffs' &&
      tournament.linkPlayoffsToSwiss !== false &&
      qualifiedSwissTeams.length === 8
    ? qualifiedSwissTeams
    : teams;

  const isCompleted = tournament.currentStage === 'completed';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Top Tournament Control Bar */}
      <div className="p-5 bg-[#0f1420]/95 border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Mode Switcher */}
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              Турнирные сетки CS2
            </h2>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>VRS & Форма активны</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-mono text-slate-400">Формат турнира:</span>
            <div className="flex items-center p-1 bg-[#090d14] rounded-xl border border-slate-800">
              <button
                onClick={() => handleChangeMode('swiss_playoffs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  tournament.mode === 'swiss_playoffs'
                    ? 'bg-amber-500 text-black font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Major (Швейцарка + Плей-офф)</span>
              </button>

              <button
                onClick={() => handleChangeMode('playoffs_only')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  tournament.mode === 'playoffs_only'
                    ? 'bg-amber-500 text-black font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Только Плей-офф (Сетка)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Actions (Seeding, Simulating, Reset, Results) */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          {/* Create Tournament Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setIsCreateTournamentOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
            title="Создать собственный турнир CS2"
          >
            <Trophy className="w-3.5 h-3.5 fill-black" />
            <span>Создать турнир</span>
          </button>

          {/* Seed by Rating */}
          <button
            onClick={handleSeedByRating}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            title="Сбросить посев к рейтингу VRS"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>По рейтингу</span>
          </button>

          {/* Randomize Teams */}
          <button
            onClick={handleRandomizeTournament}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            title="Случайно перемешать команды"
          >
            <Dices className="w-3.5 h-3.5 text-amber-400" />
            <span>Рандом команд</span>
          </button>

          {/* Simulate Current Round */}
          {!isCompleted && (
            <button
              onClick={handleFastSimulateRound}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded-xl text-xs font-bold border border-amber-500/40 transition-colors cursor-pointer"
              title="Быстро симулировать текущий активный раунд"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Раунд</span>
            </button>
          )}

          {/* Simulate Full Tournament */}
          {!isCompleted && (
            <button
              onClick={handleSimulateFullTournament}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
              title="Автоматически симулировать весь турнир до финала"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Весь турнир</span>
            </button>
          )}

          {/* View Final Standings / Results button */}
          {tournament.standings && (
            <button
              onClick={() => {
                soundFx.playClick();
                setIsResultsOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-black rounded-xl text-xs font-bold border border-emerald-500/40 transition-colors cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Итоги</span>
            </button>
          )}

          {/* Reset Tournament */}
          <button
            onClick={handleSeedByRating}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="Перезапустить турнир"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Delete / Clear Active Tournament */}
          <button
            onClick={() => {
              soundFx.playClick();
              onUpdateTournament(null);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl text-xs font-semibold border border-rose-500/30 transition-colors cursor-pointer"
            title="Удалить турнир и вернуться к экрану создания"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Удалить турнир</span>
          </button>

          {/* Data Management Modal trigger */}
          {onOpenDataManagement && (
            <button
              onClick={() => {
                soundFx.playClick();
                onOpenDataManagement();
              }}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Управление данными и выборочный сброс"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tournament Meta Info Banner */}
      {tournament.name && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#0e1422] to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400 shrink-0">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-white text-sm">{tournament.name}</span>
                {tournament.shortName && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                    {tournament.shortName}
                  </span>
                )}
                {tournament.tier && (
                  <span
                    className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full border ${
                      tournament.tier === 'Major'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : tournament.tier === 'S-Tier'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : tournament.tier === 'A-Tier'
                        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                        : tournament.tier === 'B-Tier'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {tournament.tier}
                  </span>
                )}
              </div>
              <div className="text-slate-400 text-[11px] mt-0.5 flex flex-wrap items-center gap-2">
                {tournament.organizer && <span>Организатор: {tournament.organizer}</span>}
                {tournament.prizePool && (
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Призовой фонд: {tournament.prizePool}
                  </span>
                )}
                {tournament.startDate && <span>Старт: {tournament.startDate}</span>}
                {tournament.championVrsBonus && (
                  <span className="text-emerald-300 font-bold bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                    🏆 Чемпиону: +{tournament.championVrsBonus} VRS
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-400">
              Участников: <span className="text-white font-bold">{tournament.teamCount || (tournament.participatingTeamIds?.length || 16)}</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400 font-bold uppercase text-[10px]">
              {tournament.mode.replace('_', ' ')}
            </span>
          </div>
        </div>
      )}

      {/* Stage Navigation Switcher (for Swiss + Playoffs Mode) */}
      {tournament.mode === 'swiss_playoffs' && (
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playClick();
                setActiveStageTab('swiss');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                activeStageTab === 'swiss'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>1. Swiss Stage (Швейцарка)</span>
              {tournament.currentStage === 'swiss' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/30 text-black font-mono">
                  Раунд {tournament.swissRound}/5
                </span>
              )}
            </button>

            <button
              onClick={() => {
                soundFx.playClick();
                setActiveStageTab('playoffs');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                activeStageTab === 'playoffs'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>2. Playoffs (Сетка)</span>
              {tournament.currentStage === 'playoffs' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-400 text-black font-mono font-bold">
                  Активно
                </span>
              )}
            </button>
          </div>

          <div className="text-xs font-mono text-slate-400 hidden sm:block">
            Кликните на любой матч для симуляции
          </div>
        </div>
      )}

      {/* Stage Navigation Switcher for Groups + Playoffs Mode */}
      {(tournament.mode === 'groups_playoffs' || tournament.mode === 'gsl_groups') && (
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playClick();
                setActiveStageTab('groups');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                activeStageTab === 'groups'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>1. Групповой этап (GSL Сетка)</span>
              {tournament.currentStage === 'groups' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/30 text-black font-mono">
                  Активно
                </span>
              )}
            </button>

            <button
              onClick={() => {
                soundFx.playClick();
                setActiveStageTab('playoffs');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                activeStageTab === 'playoffs'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>2. Playoffs (Сетка плей-офф)</span>
              {tournament.currentStage === 'playoffs' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-400 text-black font-mono font-bold">
                  Активно
                </span>
              )}
            </button>
          </div>

          <div className="text-xs font-mono text-slate-400 hidden sm:block">
            Кликните на любой матч для симуляции
          </div>
        </div>
      )}

      {/* Main Stage Rendering */}
      {tournament.mode === 'swiss_playoffs' && activeStageTab === 'swiss' ? (
        <SwissStageView
          matches={tournament.swissMatches}
          records={tournament.swissRecords}
          teams={teams}
          currentRound={tournament.swissRound}
          onOpenMatch={(m) => setActiveMatchToSimulate(m)}
          onQuickSimulateMatch={handleQuickSimulateMatch}
          onSelectManualSlot={(matchId, slot) => setManualSlotPicker({ matchId, slot })}
          onSwapMatchTeams={handleSwapMatchTeams}
          onResetDefaultPairs={handleResetDefaultPairs}
          onOpenPairsEditor={() => setIsPairsEditorOpen(true)}
          onAdvanceToPlayoffs={() => setActiveStageTab('playoffs')}
          onToggleMatchFormat={handleToggleMatchFormat}
        />
      ) : (tournament.mode === 'groups_playoffs' || tournament.mode === 'gsl_groups') && activeStageTab === 'groups' ? (
        <GslGroupsView
          groups={tournament.groups || []}
          teams={teams}
          onOpenMatch={(m) => setActiveMatchToSimulate(m)}
          onQuickSimulateMatch={handleQuickSimulateMatch}
          onAdvanceToPlayoffs={() => setActiveStageTab('playoffs')}
          onToggleMatchFormat={handleToggleMatchFormat}
          onUpdateGroupMatches={handleUpdateGroupMatches}
          onSelectManualSlot={(matchId, slot) => setManualSlotPicker({ matchId, slot })}
        />
      ) : (
        <PlayoffsStageView
          matches={tournament.playoffMatches}
          teams={teams}
          isFromSwiss={tournament.mode === 'swiss_playoffs'}
          linkPlayoffsToSwiss={tournament.linkPlayoffsToSwiss !== false}
          onToggleLinkSwiss={handleToggleLinkSwiss}
          qualifiedRecords={Object.values(tournament.swissRecords).filter((r) => r.status === 'qualified')}
          includeThirdPlace={tournament.includeThirdPlace}
          onToggleThirdPlace={handleToggleThirdPlace}
          onOpenMatch={(m) => setActiveMatchToSimulate(m)}
          onQuickSimulateMatch={handleQuickSimulateMatch}
          onSelectManualSlot={(matchId, slot) => setManualSlotPicker({ matchId, slot })}
          onResetToSwissSeeding={handleResetToSwissSeeding}
          onRandomizePlayoffTeams={handleRandomizePlayoffTeams}
          onSeedTop8VRS={handleSeedTop8VRS}
          onToggleMatchFormat={handleToggleMatchFormat}
        />
      )}

      {/* Modal: Interactive Match Simulation */}
      {activeMatchToSimulate && (
        <TournamentSimulationModal
          match={activeMatchToSimulate}
          teams={teams}
          onClose={() => setActiveMatchToSimulate(null)}
          onConfirmResult={handleConfirmMatchResult}
          onUpdateTeams={onUpdateTeams}
        />
      )}

      {/* Modal: Final Standings & Trophy Celebration */}
      {tournament.standings && (
        <TournamentResultsModal
          isOpen={isResultsOpen}
          onClose={() => setIsResultsOpen(false)}
          standings={tournament.standings}
          teams={teams}
          tournament={tournament}
          onStartNewTournament={() => {
            setIsResultsOpen(false);
            handleSeedByRating();
          }}
        />
      )}

      {/* Modal: Manual Team Slot Picker */}
      {manualSlotPicker && (
        <TeamSelector
          isOpen={true}
          onClose={() => setManualSlotPicker(null)}
          onSelectTeam={handleSelectTeamManually}
          teams={eligiblePickerTeams}
          slotName={manualSlotPicker.slot === 'A' ? 'Team A' : 'Team B'}
        />
      )}

      {/* Modal: Create Tournament Wizard */}
      {isCreateTournamentOpen && (
        <CreateTournamentModal
          teams={teams}
          onClose={() => setIsCreateTournamentOpen(false)}
          onCreateTournament={(newTour) => {
            onUpdateTournament(newTour);
            setIsCreateTournamentOpen(false);
            if (
              newTour.mode === 'playoffs_only' ||
              newTour.mode === 'single_elimination' ||
              newTour.mode === 'double_elimination'
            ) {
              setActiveStageTab('playoffs');
            } else {
              setActiveStageTab('swiss');
            }
          }}
        />
      )}

      {/* Modal: Custom Swiss Pairs Editor */}
      <SwissPairsModal
        isOpen={isPairsEditorOpen}
        onClose={() => setIsPairsEditorOpen(false)}
        matches={tournament.swissMatches.filter((m) => m.roundNumber === 1)}
        teams={teams}
        onSaveMatches={(newR1Matches) => {
          onUpdateTournament({
            ...tournament,
            swissMatches: [
              ...newR1Matches,
              ...tournament.swissMatches.filter((m) => m.roundNumber !== 1)
            ]
          });
        }}
      />
    </div>
  );
};
