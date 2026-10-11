import React, { useState } from 'react';
import { TournamentMatch, TournamentGroup, Team } from '../types';
import { TeamLogo } from './TeamLogo';
import { GroupPairsModal } from './GroupPairsModal';
import {
  Trophy,
  Play,
  CheckCircle2,
  XCircle,
  GitBranch,
  Flame,
  Award,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
  ArrowLeftRight
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface GslGroupsViewProps {
  groups: TournamentGroup[];
  teams: Team[];
  onOpenMatch: (match: TournamentMatch) => void;
  onQuickSimulateMatch?: (match: TournamentMatch) => void;
  onAdvanceToPlayoffs?: () => void;
  onToggleMatchFormat?: (matchId: string) => void;
  onUpdateGroupMatches?: (groupId: string, matches: TournamentMatch[]) => void;
}

export const GslGroupsView: React.FC<GslGroupsViewProps> = ({
  groups,
  teams,
  onOpenMatch,
  onQuickSimulateMatch,
  onAdvanceToPlayoffs,
  onToggleMatchFormat,
  onUpdateGroupMatches
}) => {
  const [editingGroup, setEditingGroup] = useState<TournamentGroup | null>(null);
  const getTeam = (id?: string) => teams.find((t) => t.id === id);

  // Check if all groups have determined their 2 playoff qualifiers
  const allGroupsComplete =
    groups.length > 0 &&
    groups.every((g) => g.qualifiedTeamIds && g.qualifiedTeamIds.length >= 2);

  const renderGslMatchCard = (
    match?: TournamentMatch,
    stageTitle?: string,
    isDeciderOrWinners?: boolean
  ) => {
    if (!match) return null;

    const teamA = getTeam(match.teamAId);
    const teamB = getTeam(match.teamBId);
    const isFinished = match.status === 'finished';
    const isReady = match.status === 'ready' && !!match.teamAId && !!match.teamBId;

    return (
      <div
        onClick={() => {
          if (isReady || isFinished) {
            soundFx.playClick();
            onOpenMatch(match);
          }
        }}
        className={`w-full max-w-[280px] rounded-2xl border transition-all overflow-hidden select-none cursor-pointer group shadow-md ${
          isFinished
            ? 'bg-[#111726]/95 border-slate-800 hover:border-slate-700'
            : isReady
            ? isDeciderOrWinners
              ? 'bg-[#161f36] border-amber-500/60 hover:border-amber-400 hover:shadow-amber-500/10 ring-1 ring-amber-500/20'
              : 'bg-[#131c31] border-blue-500/50 hover:border-blue-400 hover:shadow-blue-500/10'
            : 'bg-[#0c101c]/80 border-slate-800/80 opacity-75'
        }`}
      >
        {/* Header Bar */}
        <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="font-semibold text-slate-300 truncate max-w-[170px]">
            {stageTitle || match.name}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isFinished && onToggleMatchFormat ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMatchFormat(match.id);
                }}
                className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-extrabold text-[10px] border border-amber-500/40 hover:border-amber-400 transition-colors cursor-pointer"
                title="Нажмите, чтобы изменить формат матча"
              >
                {match.format}
              </button>
            ) : (
              <span className="font-bold text-slate-400 text-[10px]">{match.format}</span>
            )}
          </div>
        </div>

        {/* Teams Slots */}
        <div className="divide-y divide-slate-800/60 text-xs font-mono">
          {/* Team A */}
          <div
            className={`px-3 py-2 flex items-center justify-between gap-2 ${
              isFinished && match.winnerId === teamA?.id
                ? 'bg-emerald-950/30 text-emerald-300 font-bold'
                : isFinished
                ? 'text-slate-500 opacity-60'
                : 'text-white'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {teamA ? (
                <TeamLogo team={teamA} size="xs" />
              ) : (
                <span className="w-5 h-5 rounded bg-slate-800 text-[10px] font-mono flex items-center justify-center text-slate-500">
                  ?
                </span>
              )}
              <span className="truncate" title={teamA?.name}>
                {teamA ? (teamA.name.length > 14 && teamA.shortName ? teamA.shortName : teamA.name) : 'TBD'}
              </span>
            </div>
            <span className="font-bold text-sm tabular-nums shrink-0">
              {isFinished ? match.scoreA : '—'}
            </span>
          </div>

          {/* Team B */}
          <div
            className={`px-3 py-2 flex items-center justify-between gap-2 ${
              isFinished && match.winnerId === teamB?.id
                ? 'bg-emerald-950/30 text-emerald-300 font-bold'
                : isFinished
                ? 'text-slate-500 opacity-60'
                : 'text-white'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {teamB ? (
                <TeamLogo team={teamB} size="xs" />
              ) : (
                <span className="w-5 h-5 rounded bg-slate-800 text-[10px] font-mono flex items-center justify-center text-slate-500">
                  ?
                </span>
              )}
              <span className="truncate" title={teamB?.name}>
                {teamB ? (teamB.name.length > 14 && teamB.shortName ? teamB.shortName : teamB.name) : 'TBD'}
              </span>
            </div>
            <span className="font-bold text-sm tabular-nums shrink-0">
              {isFinished ? match.scoreB : '—'}
            </span>
          </div>
        </div>

        {/* Action Bottom Bar */}
        {isReady && !isFinished && (
          <div className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1">
              <Play className="w-3 h-3 fill-amber-400" />
              Готов к игре
            </span>
            {onQuickSimulateMatch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickSimulateMatch(match);
                }}
                className="text-[10px] font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Быстро
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Notification / Progression Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Групповой этап · GSL Double Elimination
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Формат соревнований: верхняя и нижняя сетка в каждой группе. Топ-2 из каждой группы выходят в плей-офф.
          </p>
        </div>

        {allGroupsComplete && onAdvanceToPlayoffs && (
          <button
            onClick={() => {
              soundFx.playVictory();
              onAdvanceToPlayoffs();
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-mono font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer animate-pulse transition-all"
          >
            <span>Сетка плей-офф сформирована · Перейти к плей-офф</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Grid of Groups: Matches User Screenshot Structure */}
      <div className={`grid grid-cols-1 ${groups.length >= 2 ? 'lg:grid-cols-2' : ''} gap-6`}>
        {groups.map((group) => {
          const gLetter = group.letter || group.name.replace('Группа ', '').trim();
          const m1 = group.matches.find((m) => m.poolKey === `gsl_${gLetter}_opening1`);
          const m2 = group.matches.find((m) => m.poolKey === `gsl_${gLetter}_opening2`);
          const winners = group.matches.find((m) => m.poolKey === `gsl_${gLetter}_winners`);
          const elim = group.matches.find((m) => m.poolKey === `gsl_${gLetter}_elim`);
          const decider = group.matches.find((m) => m.poolKey === `gsl_${gLetter}_decider`);

          const q1 = getTeam(group.qualifiedTeamIds?.[0]);
          const q2 = getTeam(group.qualifiedTeamIds?.[1]);

          return (
            <div
              key={group.id}
              className="p-5 sm:p-6 rounded-3xl bg-[#0b0f19] border border-slate-800 shadow-xl space-y-6"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-black flex items-center justify-center text-sm border border-amber-500/30">
                    {gLetter}
                  </span>
                  <h4 className="text-base font-extrabold text-white tracking-wide">
                    {group.name}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  {onUpdateGroupMatches && m1?.status !== 'finished' && m2?.status !== 'finished' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFx.playClick();
                        setEditingGroup(group);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Выбрать пары команд для этой группы"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Выбрать пары</span>
                    </button>
                  )}
                  <div className="text-[11px] font-mono text-slate-400">
                    {group.qualifiedTeamIds?.length === 2 ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Группа завершена
                      </span>
                    ) : (
                      <span>4 команды · 2 слота</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Upper Section: Opening Round & Winners' Match */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Column 1: Opening round (2 matches) */}
                  <div className="space-y-3">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span>Opening round</span>
                      </div>
                      {onUpdateGroupMatches && m1?.status !== 'finished' && m2?.status !== 'finished' && (
                        <button
                          onClick={() => {
                            soundFx.playClick();
                            setEditingGroup(group);
                          }}
                          className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <ArrowLeftRight className="w-2.5 h-2.5" />
                          <span>Сменить пары</span>
                        </button>
                      )}
                    </div>
                    {renderGslMatchCard(m1, 'Матч #1')}
                    {renderGslMatchCard(m2, 'Матч #2')}
                  </div>

                  {/* Column 2: Winners' match */}
                  <div className="space-y-3 flex flex-col justify-center">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Winners' match</span>
                    </div>
                    {renderGslMatchCard(winners, 'Победитель → Плей-офф #1', true)}
                    <span className="text-[10px] font-mono text-slate-500">
                      Победитель выходит в плей-офф с 1-го места группы
                    </span>
                  </div>
                </div>
              </div>

              {/* Lower Section: Elimination match & Decider match */}
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Elimination match */}
                  <div className="space-y-3">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400 font-bold flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Elimination match</span>
                    </div>
                    {renderGslMatchCard(elim, 'Матч на вылет')}
                    <span className="text-[10px] font-mono text-slate-500">
                      Проигравший выбывает из турнира
                    </span>
                  </div>

                  {/* Decider match */}
                  <div className="space-y-3">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>Decider match</span>
                    </div>
                    {renderGslMatchCard(decider, 'Решающий матч → Плей-офф #2', true)}
                    <span className="text-[10px] font-mono text-slate-500">
                      Победитель выходит в плей-офф со 2-го места группы
                    </span>
                  </div>
                </div>
              </div>

              {/* Group Qualification Results Card */}
              {(q1 || q2) && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/20 via-slate-900/60 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">
                        Выход в плей-офф из {group.name}:
                      </span>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {q1 && (
                          <div className="flex items-center gap-1.5 text-white font-bold">
                            <TeamLogo team={q1} size="xs" />
                            <span>1-е место: {q1.shortName || q1.name}</span>
                          </div>
                        )}
                        {q2 && (
                          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                            <TeamLogo team={q2} size="xs" />
                            <span>2-е место: {q2.shortName || q2.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Group Pairs Selection Modal */}
      {editingGroup && onUpdateGroupMatches && (
        <GroupPairsModal
          isOpen={!!editingGroup}
          onClose={() => setEditingGroup(null)}
          group={editingGroup}
          teams={teams}
          onSaveGroupMatches={(gId, updatedMatches) => {
            onUpdateGroupMatches(gId, updatedMatches);
            setEditingGroup(null);
          }}
        />
      )}
    </div>
  );
};
