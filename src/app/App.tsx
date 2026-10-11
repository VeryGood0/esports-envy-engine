import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Team, MatchFormat, MatchPrediction, Trophy as TrophyItem } from './types';
import { INITIAL_TEAMS } from './data/teams';
import {
  calculateTeamForm,
  calculateH2H,
  calculateEffectiveProbability,
  calculateSeriesOdds,
  calculatePointsStakes,
  calculateMatchFormDeltas,
  getRequiredWins
} from './utils/probability';
import { soundFx } from './utils/audio';

import { MatchArena } from './components/MatchArena';
import { MatchStakesTable } from './components/MatchStakesTable';
import { TeamsLeaderboard } from './components/TeamsLeaderboard';
import { TeamProfileModal } from './components/TeamProfileModal';
import { TeamSelector } from './components/TeamSelector';
import { PointsEditorModal } from './components/PointsEditorModal';
import { LogoHelperModal } from './components/LogoHelperModal';
import { PredictionHistory } from './components/PredictionHistory';
import { TournamentHub } from './components/TournamentHub';
import { MapMatchupComparisonView } from './components/MapMatchupComparisonView';
import { MapVetoModal } from './components/MapVetoModal';
import { TEAM_MAP_PROFILES, getBaselineMapProfile, createZeroMapProfile } from './data/mapPool';
import { createInitialSwissTournament } from './utils/tournament';
import { TournamentState, VetoState, MatchSeriesMapResult } from './types';
import { executeCompleteAutoVeto } from './utils/vetoEngine';
import {
  simulateCS2MapScore,
  applyDynamicMapOutcome,
  simulateSeriesOnVeto
} from './utils/mapSimulation';

import { Sliders, Image, Trophy, Swords, GitBranch, SlidersHorizontal } from 'lucide-react';
import arenaBg from './assets/images/cs2_arena_stage_1791213016355.jpg';
import { DataManagementModal } from './components/DataManagementModal';

export default function App() {
  // 1. Teams State with LocalStorage Persistence & Version Migration
  const CURRENT_TEAMS_VERSION = 'v12_pure_zero_maps_and_exact_initial_points';
  const [teams, setTeams] = useState<Team[]>(() => {
    try {
      const savedVersion = localStorage.getItem('cs2_teams_version');
      const saved = localStorage.getItem('cs2_teams_data');

      const filterOnlySiteTrophies = (trophiesList?: TrophyItem[]) => {
        if (!trophiesList || !Array.isArray(trophiesList)) return [];
        // Only count trophies actually won in championships simulated on this site
        return trophiesList.filter((t) => t && typeof t.id === 'string' && t.id.startsWith('tr_'));
      };

      // When version changes, enforce new official points & completely zero map profiles
      if (savedVersion !== CURRENT_TEAMS_VERSION) {
        let merged = INITIAL_TEAMS;
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            merged = INITIAL_TEAMS.map((initTeam) => {
              const found = parsed.find((p: Team) => p.id === initTeam.id);
              const siteTrophies = filterOnlySiteTrophies(found?.trophies);
              return {
                ...initTeam,
                shortName: initTeam.shortName || found?.shortName,
                customLogo: found?.customLogo,
                points: initTeam.points,
                defaultPoints: initTeam.defaultPoints,
                mapProfile: createZeroMapProfile(),
                trophiesCount: siteTrophies.length,
                trophies: siteTrophies
              };
            });
            // Preserve user-created custom teams
            const userCustomTeams = parsed
              .filter((p: Team) => p && p.id && !INITIAL_TEAMS.some((it) => it.id === p.id))
              .map((ct: Team) => ({
                ...ct,
                mapProfile: createZeroMapProfile()
              }));
            merged = [...merged, ...userCustomTeams];
          } catch {
            // Keep INITIAL_TEAMS
          }
        }
        localStorage.setItem('cs2_teams_version', CURRENT_TEAMS_VERSION);
        localStorage.setItem('cs2_teams_data', JSON.stringify(merged));
        return merged;
      }

      if (saved) {
        const parsed = JSON.parse(saved);
        return INITIAL_TEAMS.map((initTeam) => {
          const found = parsed.find((p: Team) => p.id === initTeam.id);
          if (found) {
            const siteTrophies = filterOnlySiteTrophies(found.trophies);
            return {
              ...initTeam,
              points: typeof found.points === 'number' ? found.points : initTeam.points,
              customLogo: found.customLogo,
              mapProfile: found.mapProfile || createZeroMapProfile(),
              trophiesCount: siteTrophies.length,
              trophies: siteTrophies
            };
          }
          return initTeam;
        });
      }
    } catch {
      // Fallback
    }
    return INITIAL_TEAMS;
  });

  // Save teams on change
  useEffect(() => {
    localStorage.setItem('cs2_teams_data', JSON.stringify(teams));
    localStorage.setItem('cs2_teams_version', CURRENT_TEAMS_VERSION);
  }, [teams]);

  // Tab State: 'predictor' | 'leaderboard' | 'tournament'
  const [activeTab, setActiveTab] = useState<'predictor' | 'leaderboard' | 'tournament'>('predictor');
  const [inspectTeam, setInspectTeam] = useState<Team | null>(null);

  // Tournament State (null by default until user creates one!)
  const [tournament, setTournament] = useState<TournamentState | null>(() => {
    try {
      const saved = localStorage.getItem('cs2_tournament_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.name) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return null;
  });

  useEffect(() => {
    try {
      if (tournament) {
        localStorage.setItem('cs2_tournament_state', JSON.stringify(tournament));
      } else {
        localStorage.removeItem('cs2_tournament_state');
      }
    } catch {
      // Ignore
    }
  }, [tournament]);

  // 2. Active Match Teams
  const [teamAId, setTeamAId] = useState<string>('vitality'); // Vitality
  const [teamBId, setTeamBId] = useState<string>('falcons'); // Falcons

  const teamA = useMemo(
    () => teams.find((t) => t.id === teamAId) || teams[0] || INITIAL_TEAMS[0],
    [teams, teamAId]
  );
  const teamB = useMemo(
    () => teams.find((t) => t.id === teamBId) || teams[1] || INITIAL_TEAMS[1],
    [teams, teamBId]
  );

  // 3. Format & Series Score
  const [format, setFormat] = useState<MatchFormat>('BO3');
  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);
  const [status, setStatus] = useState<'PENDING' | 'IN_PROGRESS' | 'FINISHED'>('PENDING');

  // Option: automatically update team VRS points after game
  const [autoUpdatePoints, setAutoUpdatePoints] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cs2_auto_update_points');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('cs2_auto_update_points', String(autoUpdatePoints));
  }, [autoUpdatePoints]);

  const [lastMatchResult, setLastMatchResult] = useState<{
    deltaPointsA?: number;
    deltaPointsB?: number;
    deltaFormA?: number;
    deltaFormB?: number;
    autoUpdatedPoints?: boolean;
  } | null>(null);

  // CS2 Map Veto & Series State
  const [vetoState, setVetoState] = useState<VetoState | null>(null);
  const [isVetoModalOpen, setIsVetoModalOpen] = useState(false);
  const [seriesMapsPlayed, setSeriesMapsPlayed] = useState<MatchSeriesMapResult[]>([]);

  // 4. Modals State
  const [isSelectorAOpen, setIsSelectorAOpen] = useState(false);
  const [isSelectorBOpen, setIsSelectorBOpen] = useState(false);
  const [isPointsEditorOpen, setIsPointsEditorOpen] = useState(false);
  const [isLogoHelperOpen, setIsLogoHelperOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  // 5. Sound Mute
  const [isMuted, setIsMuted] = useState(false);

  // 6. Match History with dynamic form impact
  const [history, setHistory] = useState<MatchPrediction[]>(() => {
    try {
      const saved = localStorage.getItem('cs2_match_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => ({
            id: item.id || `m_${Math.random()}`,
            timestamp: item.timestamp || Date.now(),
            format: item.format || 'BO3',
            teamAId: item.teamAId || item.teamA?.id || 'spirit',
            teamBId: item.teamBId || item.teamB?.id || 'vitality',
            teamAName: item.teamAName || item.teamA?.name || 'Spirit',
            teamBName: item.teamBName || item.teamB?.name || 'Vitality',
            scoreA: typeof item.scoreA === 'number' ? item.scoreA : 0,
            scoreB: typeof item.scoreB === 'number' ? item.scoreB : 0,
            winnerTeamId: item.winnerTeamId || (item.scoreA > item.scoreB ? (item.teamAId || item.teamA?.id || 'spirit') : (item.teamBId || item.teamB?.id || 'vitality')),
            deltaPointsA: item.deltaPointsA,
            deltaPointsB: item.deltaPointsB,
            deltaFormA: item.deltaFormA,
            deltaFormB: item.deltaFormB,
            isUpset: !!item.isUpset
          }));
        }
      }
    } catch {
      // Fallback
    }
    return [];
  });

  const saveHistory = useCallback((newHistory: MatchPrediction[]) => {
    setHistory(newHistory);
    localStorage.setItem('cs2_match_history', JSON.stringify(newHistory.slice(0, 40)));
  }, []);

  const requiredWins = getRequiredWins(format);

  // Reset match score & series progression
  const resetMatchState = useCallback((preserveVeto: boolean = false) => {
    setScoreA(0);
    setScoreB(0);
    setStatus('PENDING');
    setLastMatchResult(null);
    setSeriesMapsPlayed([]);
    if (!preserveVeto) {
      setVetoState(null);
    }
  }, []);

  const handleSelectFormat = (newFormat: MatchFormat) => {
    if (newFormat === format) return;
    setFormat(newFormat);
    resetMatchState(false);
  };

  const handleSwapTeams = () => {
    setTeamAId(teamBId);
    setTeamBId(teamAId);
    resetMatchState(false);
  };

  const handleRandomizeBothTeams = () => {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    setTeamAId(shuffled[0].id);
    setTeamBId(shuffled[1].id);
    resetMatchState(false);
  };

  const handleRandomizeTeamA = () => {
    const candidates = teams.filter((t) => t.id !== teamBId);
    if (candidates.length === 0) return;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    setTeamAId(picked.id);
    resetMatchState(false);
  };

  const handleRandomizeTeamB = () => {
    const candidates = teams.filter((t) => t.id !== teamAId);
    if (candidates.length === 0) return;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    setTeamBId(picked.id);
    resetMatchState(false);
  };

  // 7. Dynamic Team Form & H2H Calculation
  const formA = useMemo(() => calculateTeamForm(teamA.id, history), [teamA.id, history]);
  const formB = useMemo(() => calculateTeamForm(teamB.id, history), [teamB.id, history]);
  const h2h = useMemo(() => calculateH2H(teamA.id, teamB.id, history), [teamA.id, teamB.id, history]);

  // Points stakes for the match (IF TEAM WINS / IF TEAM LOSES)
  const stakes = useMemo(
    () => calculatePointsStakes(teamA, teamB, teams),
    [teamA, teamB, teams]
  );

  // Effective points = Base VRS + Form Modifier + Head-to-Head advantage
  const effectivePointsA = teamA.points + formA.formModifier + h2h.h2hModifierA;
  const effectivePointsB = teamB.points + formB.formModifier - h2h.h2hModifierA;

  const singleMapProbA = useMemo(
    () => calculateEffectiveProbability(effectivePointsA, effectivePointsB),
    [effectivePointsA, effectivePointsB]
  );
  const singleMapProbB = 1 - singleMapProbA;

  const { seriesProbA, seriesProbB, outcomeOdds } = useMemo(
    () => calculateSeriesOdds(singleMapProbA, format),
    [singleMapProbA, format]
  );

  // 8. Match Simulation on CS2 Veto Maps with Real MR12 Rounds & Dynamic Progression
  const handleSimulateNextPoint = () => {
    if (status === 'FINISHED') return;

    // Ensure we have a completed Veto. If not, auto-complete it via Smart AI
    let activeVeto = vetoState;
    if (
      !activeVeto ||
      !activeVeto.isCompleted ||
      activeVeto.teamAId !== teamA.id ||
      activeVeto.teamBId !== teamB.id ||
      activeVeto.format !== format
    ) {
      activeVeto = executeCompleteAutoVeto(format, teamA, teamB);
      setVetoState(activeVeto);
    }

    const mapIndex = seriesMapsPlayed.length;
    const targetMapObj = activeVeto.selectedMapsInOrder[mapIndex];
    if (!targetMapObj) return;

    // Simulate authentic CS2 MR12 score (e.g. 13:9, 16:14 overtime)
    const mapSimResult = simulateCS2MapScore(teamA, teamB, targetMapObj.mapName, {
      pickedBy: targetMapObj.pickedBy,
      isDecider: targetMapObj.isDecider
    });
    const aWon = mapSimResult.winnerTeamId === teamA.id;
    const newScoreA = aWon ? scoreA + 1 : scoreA;
    const newScoreB = !aWon ? scoreB + 1 : scoreB;

    const newMapRecord: MatchSeriesMapResult = {
      mapName: targetMapObj.mapName,
      mapOrder: mapIndex + 1,
      pickedBy: targetMapObj.pickedBy,
      isDecider: targetMapObj.isDecider,
      scoreA: mapSimResult.scoreA,
      scoreB: mapSimResult.scoreB,
      overtime: mapSimResult.overtime,
      half1A: mapSimResult.half1A,
      half1B: mapSimResult.half1B,
      half2A: mapSimResult.half2A,
      half2B: mapSimResult.half2B,
      otScoreA: mapSimResult.otScoreA,
      otScoreB: mapSimResult.otScoreB,
      winProbA: mapSimResult.winProbA,
      winProbB: mapSimResult.winProbB,
      winnerTeamId: mapSimResult.winnerTeamId,
      loserTeamId: mapSimResult.loserTeamId,
      narrative: mapSimResult.narrative,
      tacticalReason: mapSimResult.tacticalReason
    };

    const updatedSeriesMaps = [...seriesMapsPlayed, newMapRecord];
    setSeriesMapsPlayed(updatedSeriesMaps);

    // Apply dynamic map outcome: updates map rating, form and winrates for both teams
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamA.id && t.mapProfile) {
          return {
            ...t,
            mapProfile: applyDynamicMapOutcome(
              t.mapProfile,
              targetMapObj.mapName,
              aWon,
              mapSimResult.scoreA,
              mapSimResult.scoreB,
              teamB
            )
          };
        }
        if (t.id === teamB.id && t.mapProfile) {
          return {
            ...t,
            mapProfile: applyDynamicMapOutcome(
              t.mapProfile,
              targetMapObj.mapName,
              !aWon,
              mapSimResult.scoreB,
              mapSimResult.scoreA,
              teamA
            )
          };
        }
        return t;
      })
    );

    setScoreA(newScoreA);
    setScoreB(newScoreB);
    soundFx.playMapWin();

    if (newScoreA === requiredWins || newScoreB === requiredWins) {
      const winnerId = newScoreA === requiredWins ? teamA.id : teamB.id;
      const winnerTeam = newScoreA === requiredWins ? teamA : teamB;
      const loserTeam = newScoreA === requiredWins ? teamB : teamA;
      const isUpset =
        winnerTeam.points < loserTeam.points &&
        loserTeam.points - winnerTeam.points >= 80;

      setStatus('FINISHED');
      soundFx.playVictory();

      // Dynamic form deltas (contextual based on opponent strength and score)
      const { deltaFormA, deltaFormB } = calculateMatchFormDeltas(
        teamA.id,
        teamB.id,
        winnerId,
        singleMapProbA,
        newScoreA,
        newScoreB
      );

      // Handle live VRS point updates if toggle is ON
      let deltaPtsA = 0;
      let deltaPtsB = 0;
      if (autoUpdatePoints) {
        if (winnerId === teamA.id) {
          deltaPtsA = stakes.winA;
          deltaPtsB = -stakes.lossB;
        } else {
          deltaPtsB = stakes.winB;
          deltaPtsA = -stakes.lossA;
        }

        setTeams((prev) =>
          prev.map((t) => {
            if (t.id === teamA.id)
              return { ...t, points: Math.max(100, t.points + deltaPtsA) };
            if (t.id === teamB.id)
              return { ...t, points: Math.max(100, t.points + deltaPtsB) };
            return t;
          })
        );
      }

      setLastMatchResult({
        deltaPointsA: autoUpdatePoints ? deltaPtsA : undefined,
        deltaPointsB: autoUpdatePoints ? deltaPtsB : undefined,
        deltaFormA,
        deltaFormB,
        autoUpdatedPoints: autoUpdatePoints
      });

      const record: MatchPrediction = {
        id: `match_${Date.now()}`,
        timestamp: Date.now(),
        format,
        teamAId: teamA.id,
        teamBId: teamB.id,
        teamAName: teamA.name,
        teamBName: teamB.name,
        scoreA: newScoreA,
        scoreB: newScoreB,
        winnerTeamId: winnerId,
        deltaPointsA: autoUpdatePoints ? deltaPtsA : undefined,
        deltaPointsB: autoUpdatePoints ? deltaPtsB : undefined,
        deltaFormA,
        deltaFormB,
        mapsPlayed: updatedSeriesMaps,
        isUpset
      };
      saveHistory([record, ...history]);
    } else {
      setStatus('IN_PROGRESS');
    }
  };

  const handleSimulateFullMatch = () => {
    let activeVeto = vetoState;
    if (
      !activeVeto ||
      !activeVeto.isCompleted ||
      activeVeto.teamAId !== teamA.id ||
      activeVeto.teamBId !== teamB.id ||
      activeVeto.format !== format
    ) {
      activeVeto = executeCompleteAutoVeto(format, teamA, teamB);
      setVetoState(activeVeto);
    }

    const simResult = simulateSeriesOnVeto(
      format,
      teamA,
      teamB,
      activeVeto.selectedMapsInOrder
    );

    setScoreA(simResult.seriesScoreA);
    setScoreB(simResult.seriesScoreB);
    setSeriesMapsPlayed(simResult.mapsPlayed);
    setStatus('FINISHED');
    soundFx.playVictory();

    // Update dynamic map ratings for all maps played
    let updatedTeamA = teamA;
    let updatedTeamB = teamB;
    for (const played of simResult.mapsPlayed) {
      const aWon = played.winnerTeamId === teamA.id;
      if (updatedTeamA.mapProfile) {
        updatedTeamA = {
          ...updatedTeamA,
          mapProfile: applyDynamicMapOutcome(
            updatedTeamA.mapProfile,
            played.mapName,
            aWon,
            played.scoreA,
            played.scoreB,
            updatedTeamB
          )
        };
      }
      if (updatedTeamB.mapProfile) {
        updatedTeamB = {
          ...updatedTeamB,
          mapProfile: applyDynamicMapOutcome(
            updatedTeamB.mapProfile,
            played.mapName,
            !aWon,
            played.scoreB,
            played.scoreA,
            updatedTeamA
          )
        };
      }
    }

    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamA.id) return updatedTeamA;
        if (t.id === teamB.id) return updatedTeamB;
        return t;
      })
    );

    const winnerId = simResult.winnerTeamId;
    const winnerTeam = simResult.winnerTeamId === teamA.id ? teamA : teamB;
    const loserTeam = simResult.winnerTeamId === teamA.id ? teamB : teamA;
    const isUpset =
      winnerTeam.points < loserTeam.points &&
      loserTeam.points - winnerTeam.points >= 80;

    const { deltaFormA, deltaFormB } = calculateMatchFormDeltas(
      teamA.id,
      teamB.id,
      winnerId,
      singleMapProbA,
      simResult.seriesScoreA,
      simResult.seriesScoreB
    );

    let deltaPtsA = 0;
    let deltaPtsB = 0;
    if (autoUpdatePoints) {
      if (winnerId === teamA.id) {
        deltaPtsA = stakes.winA;
        deltaPtsB = -stakes.lossB;
      } else {
        deltaPtsB = stakes.winB;
        deltaPtsA = -stakes.lossA;
      }

      setTeams((prev) =>
        prev.map((t) => {
          if (t.id === teamA.id)
            return { ...t, points: Math.max(100, t.points + deltaPtsA) };
          if (t.id === teamB.id)
            return { ...t, points: Math.max(100, t.points + deltaPtsB) };
          return t;
        })
      );
    }

    setLastMatchResult({
      deltaPointsA: autoUpdatePoints ? deltaPtsA : undefined,
      deltaPointsB: autoUpdatePoints ? deltaPtsB : undefined,
      deltaFormA,
      deltaFormB,
      autoUpdatedPoints: autoUpdatePoints
    });

    const record: MatchPrediction = {
      id: `match_${Date.now()}`,
      timestamp: Date.now(),
      format,
      teamAId: teamA.id,
      teamBId: teamB.id,
      teamAName: teamA.name,
      teamBName: teamB.name,
      scoreA: simResult.seriesScoreA,
      scoreB: simResult.seriesScoreB,
      winnerTeamId: winnerId,
      deltaPointsA: autoUpdatePoints ? deltaPtsA : undefined,
      deltaPointsB: autoUpdatePoints ? deltaPtsB : undefined,
      deltaFormA,
      deltaFormB,
      mapsPlayed: simResult.mapsPlayed,
      isUpset
    };
    saveHistory([record, ...history]);
  };

  // 9. Point Editor Handlers
  const handleUpdateTeamPoints = (teamId: string, newPoints: number) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, points: newPoints } : t))
    );
  };

  const handleResetAllPoints = () => {
    setTeams((prev) =>
      prev.map((t) => ({ ...t, points: t.defaultPoints }))
    );
  };

  // 10. Custom Logo Handlers
  const handleUploadCustomLogo = (teamId: string, dataUrl: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, customLogo: dataUrl } : t))
    );
  };

  const handleResetCustomLogo = (teamId: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, customLogo: undefined } : t))
    );
  };

  const handleUpdateTeamAProfile = (updated: Team) => {
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleUpdateTeamBProfile = (updated: Team) => {
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleResetMapsToBaseline = () => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        mapProfile: createZeroMapProfile()
      }))
    );
  };

  const trophiesTotalCount = useMemo(
    () => teams.reduce((acc, t) => acc + (t.trophies?.length || t.trophiesCount || 0), 0),
    [teams]
  );

  // Individual reset actions
  const handleClearMatchHistoryOnly = () => {
    saveHistory([]);
    setLastMatchResult(null);
  };

  const handleResetTeamVrsPointsOnly = () => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        points: t.defaultPoints
      }))
    );
  };

  const handleResetTeamFormAndMapsOnly = () => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        mapProfile: createZeroMapProfile()
      }))
    );
  };

  const handleClearTeamTrophiesOnly = () => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        trophiesCount: 0,
        trophies: []
      }))
    );
  };

  const handleResetTournamentOnly = () => {
    setTournament(null);
    localStorage.removeItem('cs2_tournament_state');
  };

  // Full reset: History, Dynamic Forms, Map Statistics, VRS, Trophies, and Tournaments
  const handleResetAllData = () => {
    soundFx.playMapWin();
    saveHistory([]);
    const resetTeams = INITIAL_TEAMS.map((t) => ({
      ...t,
      trophiesCount: 0,
      trophies: [],
      mapProfile: createZeroMapProfile()
    }));
    setTeams(resetTeams);
    setTournament(null);
    localStorage.removeItem('cs2_teams_data');
    localStorage.removeItem('cs2_teams_version');
    localStorage.removeItem('cs2_match_history');
    localStorage.removeItem('cs2_tournament_state');

    resetMatchState(false);
    setSeriesMapsPlayed([]);
    setVetoState(null);
    setLastMatchResult(null);
    setScoreA(0);
    setScoreB(0);
    setStatus('PENDING');
  };

  const handleClearHistoryAndResetStats = () => {
    soundFx.playClick();
    handleResetAllData();
  };

  const handleSelectTeamFromLeaderboard = (team: Team) => {
    setTeamAId(team.id);
    if (teamBId === team.id) {
      const other = teams.find((t) => t.id !== team.id);
      if (other) setTeamBId(other.id);
    }
    setActiveTab('predictor');
    resetMatchState();
  };

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col relative selection:bg-amber-500 selection:text-black">
      {/* Background Esports Arena Backdrop */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src={arenaBg}
          alt=""
          className="w-full h-full object-cover object-center opacity-15 filter brightness-75 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a10]/80 via-[#070a10]/95 to-[#070a10]" />
      </div>

      {/* Top Bar Header with Tabs */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-[#0a0e17]/85 backdrop-blur-md px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Tabs */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-display font-extrabold text-lg sm:text-xl tracking-wider text-white">
              CS2 <span className="text-amber-400">PREDICTOR</span>
            </span>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-[#090d14] rounded-xl border border-slate-800">
            <button
              onClick={() => {
                soundFx.playClick();
                setActiveTab('predictor');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'predictor'
                  ? 'bg-amber-500 text-black shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Предиктор матча</span>
            </button>

            <button
              onClick={() => {
                soundFx.playClick();
                setActiveTab('leaderboard');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-amber-500 text-black shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Топ команд</span>
              <span className="text-[10px] opacity-75 font-mono">({teams.length})</span>
            </button>

            <button
              onClick={() => {
                soundFx.playClick();
                setActiveTab('tournament');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'tournament'
                  ? 'bg-amber-500 text-black shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Сетка турнира</span>
            </button>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              soundFx.playClick();
              setIsPointsEditorOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Изменить</span> поинты
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setIsLogoHelperOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <Image className="w-3.5 h-3.5" />
            <span>Логотипы</span>
          </button>

          {/* Data Reset & Management Modal Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setIsDataModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Управление данными: очистить историю, сбросить VRS, форму или удалить турниры"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Сброс данных</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`relative z-10 flex-1 w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 ${
        activeTab === 'tournament' ? 'max-w-6xl' : 'max-w-5xl'
      }`}>
        {activeTab === 'predictor' ? (
          <>
            {/* CS2 Match Stage */}
            <MatchArena
              teamA={teamA}
              teamB={teamB}
              format={format}
              onSelectFormat={handleSelectFormat}
              onOpenSelectorA={() => setIsSelectorAOpen(true)}
              onOpenSelectorB={() => setIsSelectorBOpen(true)}
              onSwapTeams={handleSwapTeams}
              onRandomizeBothTeams={handleRandomizeBothTeams}
              onRandomizeTeamA={handleRandomizeTeamA}
              onRandomizeTeamB={handleRandomizeTeamB}
              onOpenPointsEditor={() => setIsPointsEditorOpen(true)}
              scoreA={scoreA}
              scoreB={scoreB}
              requiredWins={requiredWins}
              seriesProbA={seriesProbA}
              seriesProbB={seriesProbB}
              singleMapProbA={singleMapProbA}
              singleMapProbB={singleMapProbB}
              outcomeOdds={outcomeOdds}
              formA={formA}
              formB={formB}
              h2h={h2h}
              isMuted={isMuted}
              onToggleMute={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                soundFx.setMuted(nextMuted);
              }}
              status={status}
              lastMatchResult={lastMatchResult}
              onSimulateNextPoint={handleSimulateNextPoint}
              onSimulateFullMatch={handleSimulateFullMatch}
              onResetMatch={() => resetMatchState(false)}
              vetoState={vetoState}
              onOpenVetoModal={() => setIsVetoModalOpen(true)}
              seriesMapsPlayed={seriesMapsPlayed}
            />

            {/* Active Duty 7 Maps Matchup Comparison */}
            <MapMatchupComparisonView
              teamA={teamA}
              teamB={teamB}
              onUpdateTeamAProfile={handleUpdateTeamAProfile}
              onUpdateTeamBProfile={handleUpdateTeamBProfile}
              onResetToBaseline={handleResetMapsToBaseline}
            />

            {/* VRS Points Stakes Table */}
            <MatchStakesTable
              teamA={teamA}
              teamB={teamB}
              stakes={stakes}
              autoUpdatePoints={autoUpdatePoints}
              onToggleAutoUpdatePoints={() => setAutoUpdatePoints((prev) => !prev)}
            />

            {/* Prediction History with Form Tracking */}
            <PredictionHistory
              history={history}
              teams={teams}
              onClearHistory={handleClearHistoryAndResetStats}
            />
          </>
        ) : activeTab === 'leaderboard' ? (
          /* Separate Leaderboard Tab */
          <TeamsLeaderboard
            teams={teams}
            history={history}
            onSelectTeamForProfile={(t) => setInspectTeam(t)}
            onSelectTeamForMatch={handleSelectTeamFromLeaderboard}
            onOpenPointsEditor={() => setIsPointsEditorOpen(true)}
          />
        ) : (
          /* Tournament Stage Brackets Tab */
          <TournamentHub
            teams={teams}
            tournament={tournament}
            onUpdateTournament={setTournament}
            onUpdateTeams={setTeams}
            onRecordMatchPrediction={(pred) => saveHistory([pred, ...history])}
            history={history}
            onOpenDataManagement={() => setIsDataModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-[#06080d] py-5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Counter-Strike 2 VRS Match Predictor · Valve Regional Standings</span>
          <div className="flex items-center gap-4 text-slate-400">
            <span>BO1 / BO3 / BO5</span>
            <span>·</span>
            <span>Динамическая форма</span>
            <span>·</span>
            <span>16 Команд</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <TeamSelector
        isOpen={isSelectorAOpen}
        onClose={() => setIsSelectorAOpen(false)}
        teams={teams}
        selectedTeamId={teamA.id}
        opponentTeamId={teamB.id}
        slotName="Team A"
        onSelectTeam={(team) => {
          setTeamAId(team.id);
          resetMatchState(false);
        }}
      />

      <TeamSelector
        isOpen={isSelectorBOpen}
        onClose={() => setIsSelectorBOpen(false)}
        teams={teams}
        selectedTeamId={teamB.id}
        opponentTeamId={teamA.id}
        slotName="Team B"
        onSelectTeam={(team) => {
          setTeamBId(team.id);
          resetMatchState(false);
        }}
      />

      <PointsEditorModal
        isOpen={isPointsEditorOpen}
        onClose={() => setIsPointsEditorOpen(false)}
        teams={teams}
        onUpdateTeamPoints={handleUpdateTeamPoints}
        onResetAllPoints={handleResetAllPoints}
      />

      <LogoHelperModal
        isOpen={isLogoHelperOpen}
        onClose={() => setIsLogoHelperOpen(false)}
        teams={teams}
        onUploadCustomLogo={handleUploadCustomLogo}
        onResetCustomLogo={handleResetCustomLogo}
      />

      {/* CS2 Map Veto Interactive Modal */}
      <MapVetoModal
        isOpen={isVetoModalOpen}
        onClose={() => setIsVetoModalOpen(false)}
        teamA={teamA}
        teamB={teamB}
        format={format}
        currentVetoState={vetoState}
        onVetoCompleted={(finalState) => {
          setVetoState(finalState);
          setSeriesMapsPlayed([]);
          setScoreA(0);
          setScoreB(0);
          setStatus('PENDING');
          setIsVetoModalOpen(false);
        }}
      />

      {/* Dedicated Team Profile & Match History Modal */}
      {inspectTeam && (
        <TeamProfileModal
          team={inspectTeam}
          onClose={() => setInspectTeam(null)}
          teams={teams}
          history={history}
          form={calculateTeamForm(inspectTeam.id, history)}
          rank={[...teams].sort((a, b) => b.points - a.points).findIndex((t) => t.id === inspectTeam.id) + 1}
          onSelectForMatch={(t) => {
            handleSelectTeamFromLeaderboard(t);
            setInspectTeam(null);
          }}
        />
      )}

      {/* Comprehensive Data Management & Granular Reset Modal */}
      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        onClearMatchHistory={handleClearMatchHistoryOnly}
        onResetTeamVrsPoints={handleResetTeamVrsPointsOnly}
        onResetTeamFormAndMaps={handleResetTeamFormAndMapsOnly}
        onClearTeamTrophies={handleClearTeamTrophiesOnly}
        onResetTournament={handleResetTournamentOnly}
        onResetAll={handleResetAllData}
        historyCount={history.length}
        trophiesTotalCount={trophiesTotalCount}
        hasActiveTournament={!!tournament}
        activeTournamentName={tournament?.name}
      />
    </div>
  );
}
