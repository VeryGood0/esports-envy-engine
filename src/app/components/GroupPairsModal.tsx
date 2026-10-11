import React, { useState } from 'react';
import { TournamentMatch, TournamentGroup, Team } from '../types';
import { TeamLogo } from './TeamLogo';
import {
  X,
  RotateCcw,
  Shuffle,
  ArrowLeftRight,
  Check,
  SlidersHorizontal,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface GroupPairsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: TournamentGroup;
  teams: Team[];
  onSaveGroupMatches: (groupId: string, updatedMatches: TournamentMatch[]) => void;
}

export const GroupPairsModal: React.FC<GroupPairsModalProps> = ({
  isOpen,
  onClose,
  group,
  teams,
  onSaveGroupMatches
}) => {
  const gLetter = group.letter || group.name.replace('Группа ', '').trim();

  // Find opening matches of this group
  const m1 = group.matches.find(
    (m) =>
      m.poolKey === `gsl_${gLetter}_opening1` ||
      m.id.endsWith('_m1') ||
      m.id.includes('opening1')
  );
  const m2 = group.matches.find(
    (m) =>
      m.poolKey === `gsl_${gLetter}_opening2` ||
      m.id.endsWith('_m2') ||
      m.id.includes('opening2')
  );

  // Group teams
  const groupTeamIds = group.teamIds || [];
  const groupTeams = groupTeamIds
    .map((id) => teams.find((t) => t.id === id)!)
    .filter(Boolean);

  // Initial slot assignments
  const [match1TeamA, setMatch1TeamA] = useState<string>(
    m1?.teamAId || groupTeams[0]?.id || ''
  );
  const [match1TeamB, setMatch1TeamB] = useState<string>(
    m1?.teamBId || groupTeams[3]?.id || groupTeams[1]?.id || ''
  );
  const [match2TeamA, setMatch2TeamA] = useState<string>(
    m2?.teamAId || groupTeams[1]?.id || ''
  );
  const [match2TeamB, setMatch2TeamB] = useState<string>(
    m2?.teamBId || groupTeams[2]?.id || ''
  );

  const [activeSlot, setActiveSlot] = useState<
    'm1A' | 'm1B' | 'm2A' | 'm2B' | null
  >(null);

  if (!isOpen) return null;

  const getTeam = (id: string) => teams.find((t) => t.id === id);

  // Swap target team into slot, swapping whoever was there
  const handleSelectTeamForSlot = (
    slot: 'm1A' | 'm1B' | 'm2A' | 'm2B',
    selectedTeamId: string
  ) => {
    soundFx.playClick();
    const currentAssignments: Record<'m1A' | 'm1B' | 'm2A' | 'm2B', string> = {
      m1A: match1TeamA,
      m1B: match1TeamB,
      m2A: match2TeamA,
      m2B: match2TeamB
    };

    const displacedTeamId = currentAssignments[slot];

    // Find if selectedTeamId was in another slot
    const previousSlot = (Object.keys(currentAssignments) as ('m1A' | 'm1B' | 'm2A' | 'm2B')[]).find(
      (k) => k !== slot && currentAssignments[k] === selectedTeamId
    );

    const nextAssignments = { ...currentAssignments };
    nextAssignments[slot] = selectedTeamId;
    if (previousSlot) {
      nextAssignments[previousSlot] = displacedTeamId;
    }

    setMatch1TeamA(nextAssignments.m1A);
    setMatch1TeamB(nextAssignments.m1B);
    setMatch2TeamA(nextAssignments.m2A);
    setMatch2TeamB(nextAssignments.m2B);
    setActiveSlot(null);
  };

  // Preset 1: 1 vs 4, 2 vs 3 (VRS Standard)
  const handleResetToVrs = () => {
    soundFx.playClick();
    const sorted = [...groupTeams].sort((a, b) => b.points - a.points);
    setMatch1TeamA(sorted[0]?.id || '');
    setMatch1TeamB(sorted[3]?.id || sorted[1]?.id || '');
    setMatch2TeamA(sorted[1]?.id || '');
    setMatch2TeamB(sorted[2]?.id || '');
  };

  // Preset 2: 1 vs 2, 3 vs 4 (Top clash)
  const handleTopClash = () => {
    soundFx.playClick();
    const sorted = [...groupTeams].sort((a, b) => b.points - a.points);
    setMatch1TeamA(sorted[0]?.id || '');
    setMatch1TeamB(sorted[1]?.id || '');
    setMatch2TeamA(sorted[2]?.id || '');
    setMatch2TeamB(sorted[3]?.id || '');
  };

  // Preset 3: 1 vs 3, 2 vs 4
  const handleCrossPair = () => {
    soundFx.playClick();
    const sorted = [...groupTeams].sort((a, b) => b.points - a.points);
    setMatch1TeamA(sorted[0]?.id || '');
    setMatch1TeamB(sorted[2]?.id || '');
    setMatch2TeamA(sorted[1]?.id || '');
    setMatch2TeamB(sorted[3]?.id || '');
  };

  // Random shuffle
  const handleRandomize = () => {
    soundFx.playClick();
    const shuffled = [...groupTeams].sort(() => Math.random() - 0.5);
    setMatch1TeamA(shuffled[0]?.id || '');
    setMatch1TeamB(shuffled[1]?.id || '');
    setMatch2TeamA(shuffled[2]?.id || '');
    setMatch2TeamB(shuffled[3]?.id || '');
  };

  // Swap Match 1 and Match 2
  const handleSwapMatches = () => {
    soundFx.playClick();
    const tempA = match1TeamA;
    const tempB = match1TeamB;
    setMatch1TeamA(match2TeamA);
    setMatch1TeamB(match2TeamB);
    setMatch2TeamA(tempA);
    setMatch2TeamB(tempB);
  };

  const handleSave = () => {
    soundFx.playVictory();
    const updated = group.matches.map((m) => {
      if (m.id === m1?.id) {
        return {
          ...m,
          teamAId: match1TeamA,
          teamBId: match1TeamB,
          scoreA: 0,
          scoreB: 0,
          status: 'ready' as const
        };
      }
      if (m.id === m2?.id) {
        return {
          ...m,
          teamAId: match2TeamA,
          teamBId: match2TeamB,
          scoreA: 0,
          scoreB: 0,
          status: 'ready' as const
        };
      }
      return m;
    });

    onSaveGroupMatches(group.id, updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#101524] border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-black flex items-center justify-center text-sm border border-amber-500/30">
              {gLetter}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>Выбор пар команд · {group.name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase">
                  GSL Dual
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Настройте, какие пары команд будут играть в открывающем раунде
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Presets Toolbar */}
        <div className="px-6 py-2.5 bg-slate-900/40 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto text-xs font-mono shrink-0">
          <span className="text-slate-400 text-[11px] uppercase font-bold shrink-0">
            Быстрый посев:
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResetToVrs}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="1 vs 4 и 2 vs 3 по рейтингу VRS"
            >
              1 vs 4 & 2 vs 3
            </button>
            <button
              onClick={handleTopClash}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="1 vs 2 и 3 vs 4"
            >
              1 vs 2 & 3 vs 4
            </button>
            <button
              onClick={handleCrossPair}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="1 vs 3 и 2 vs 4"
            >
              1 vs 3 & 2 vs 4
            </button>
            <button
              onClick={handleRandomize}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1"
              title="Случайная жеребьевка"
            >
              <Shuffle className="w-3 h-3" />
              <span>Микс</span>
            </button>
            <button
              onClick={handleSwapMatches}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              title="Поменять Матч 1 и Матч 2 местами"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>Поменять</span>
            </button>
          </div>
        </div>

        {/* Body: Pairings Cards */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Match 1 Card */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                Матч #1 · Открывающий раунд
              </span>
              <button
                onClick={() => {
                  soundFx.playClick();
                  const temp = match1TeamA;
                  setMatch1TeamA(match1TeamB);
                  setMatch1TeamB(temp);
                }}
                className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowLeftRight className="w-2.5 h-2.5" />
                <span>Сменить стороны</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Slot A */}
              {(() => {
                const tA = getTeam(match1TeamA);
                const isSelected = activeSlot === 'm1A';
                return (
                  <div
                    onClick={() => setActiveSlot(isSelected ? null : 'm1A')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 shadow-md ring-1 ring-amber-400/30'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {tA && <TeamLogo team={tA} size="sm" />}
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">
                          Команда 1
                        </span>
                        <div className="font-bold text-white text-sm truncate">
                          {tA?.name || 'Выберите команду'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-amber-400 font-bold shrink-0">
                      {tA?.points} pts
                    </span>
                  </div>
                );
              })()}

              {/* Slot B */}
              {(() => {
                const tB = getTeam(match1TeamB);
                const isSelected = activeSlot === 'm1B';
                return (
                  <div
                    onClick={() => setActiveSlot(isSelected ? null : 'm1B')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 shadow-md ring-1 ring-amber-400/30'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {tB && <TeamLogo team={tB} size="sm" />}
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">
                          Команда 2
                        </span>
                        <div className="font-bold text-white text-sm truncate">
                          {tB?.name || 'Выберите команду'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-amber-400 font-bold shrink-0">
                      {tB?.points} pts
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Match 2 Card */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                Матч #2 · Открывающий раунд
              </span>
              <button
                onClick={() => {
                  soundFx.playClick();
                  const temp = match2TeamA;
                  setMatch2TeamA(match2TeamB);
                  setMatch2TeamB(temp);
                }}
                className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowLeftRight className="w-2.5 h-2.5" />
                <span>Сменить стороны</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Slot A */}
              {(() => {
                const tA = getTeam(match2TeamA);
                const isSelected = activeSlot === 'm2A';
                return (
                  <div
                    onClick={() => setActiveSlot(isSelected ? null : 'm2A')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-500/20 border-blue-400 shadow-md ring-1 ring-blue-400/30'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {tA && <TeamLogo team={tA} size="sm" />}
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">
                          Команда 3
                        </span>
                        <div className="font-bold text-white text-sm truncate">
                          {tA?.name || 'Выберите команду'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-blue-400 font-bold shrink-0">
                      {tA?.points} pts
                    </span>
                  </div>
                );
              })()}

              {/* Slot B */}
              {(() => {
                const tB = getTeam(match2TeamB);
                const isSelected = activeSlot === 'm2B';
                return (
                  <div
                    onClick={() => setActiveSlot(isSelected ? null : 'm2B')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-500/20 border-blue-400 shadow-md ring-1 ring-blue-400/30'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {tB && <TeamLogo team={tB} size="sm" />}
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">
                          Команда 4
                        </span>
                        <div className="font-bold text-white text-sm truncate">
                          {tB?.name || 'Выберите команду'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-blue-400 font-bold shrink-0">
                      {tB?.points} pts
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Team Quick Picker Panel if Slot Selected */}
          {activeSlot && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 animate-in fade-in duration-150">
              <span className="text-xs font-mono font-bold text-amber-300 block">
                Выберите команду для выбранного слота:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {groupTeams.map((gt) => {
                  return (
                    <button
                      key={gt.id}
                      onClick={() => handleSelectTeamForSlot(activeSlot, gt.id)}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center gap-2 text-left cursor-pointer transition-colors"
                    >
                      <TeamLogo team={gt} size="xs" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {gt.shortName || gt.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {gt.points} pts
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            Отмена
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-mono font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Сохранить пары группы</span>
          </button>
        </div>
      </div>
    </div>
  );
};
