import React from 'react';
import { TournamentMatch, Team, SwissTeamRecord } from '../types';
import { TeamLogo } from './TeamLogo';
import {
  Trophy,
  Play,
  CheckCircle2,
  Medal,
  SlidersHorizontal,
  Link2,
  Link2Off,
  RotateCcw,
  Shuffle,
  Sparkles
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface PlayoffsStageViewProps {
  matches: TournamentMatch[];
  teams: Team[];
  isFromSwiss?: boolean;
  linkPlayoffsToSwiss?: boolean;
  onToggleLinkSwiss?: () => void;
  qualifiedRecords?: SwissTeamRecord[];
  includeThirdPlace: boolean;
  thirdPlaceRequired?: boolean;
  hideThirdPlaceToggle?: boolean;
  onToggleThirdPlace: () => void;
  onOpenMatch: (match: TournamentMatch) => void;
  onQuickSimulateMatch?: (match: TournamentMatch) => void;
  onSelectManualSlot?: (matchId: string, slot: 'A' | 'B') => void;
  onResetToSwissSeeding?: () => void;
  onRandomizePlayoffTeams?: () => void;
  onSeedTop8VRS?: () => void;
  onToggleMatchFormat?: (matchId: string) => void;
}

export const PlayoffsStageView: React.FC<PlayoffsStageViewProps> = ({
  matches,
  teams,
  isFromSwiss = true,
  linkPlayoffsToSwiss = true,
  onToggleLinkSwiss,
  qualifiedRecords = [],
  includeThirdPlace,
  thirdPlaceRequired = false,
  hideThirdPlaceToggle = false,
  onToggleThirdPlace,
  onOpenMatch,
  onQuickSimulateMatch,
  onSelectManualSlot,
  onResetToSwissSeeding,
  onRandomizePlayoffTeams,
  onSeedTop8VRS,
  onToggleMatchFormat
}) => {
  const getTeam = (id?: string) => teams.find((t) => t.id === id);

  const r12Matches = matches.filter((m) => m.poolKey.startsWith('r12'));
  const qfMatches = matches.filter((m) => m.poolKey.startsWith('qf'));
  const sfMatches = matches.filter((m) => m.poolKey.startsWith('sf'));
  const finalMatch = matches.find((m) => m.poolKey === 'final');
  const thirdMatch = matches.find((m) => m.poolKey === 'third_place');

  // Render individual bracket match card matching Photo 2
  const renderBracketMatch = (
    match?: TournamentMatch,
    labelTime?: string,
    extraHeader?: string
  ) => {
    if (!match) return null;

    const teamA = getTeam(match.teamAId);
    const teamB = getTeam(match.teamBId);
    const isFinished = match.status === 'finished';
    const isReady = match.status === 'ready' && !!match.teamAId && !!match.teamBId;

    return (
      <div
        key={match.id}
        onClick={() => {
          if (isReady || isFinished) {
            soundFx.playClick();
            onOpenMatch(match);
          }
        }}
        className={`w-64 rounded-2xl border transition-all overflow-hidden select-none cursor-pointer group shadow-lg ${
          isFinished
            ? 'bg-[#111726]/95 border-slate-800 hover:border-slate-700'
            : isReady
            ? 'bg-[#131c31] border-amber-500/60 hover:border-amber-400 hover:shadow-amber-500/10'
            : 'bg-[#0f1422]/80 border-slate-800/80 hover:border-slate-700'
        }`}
      >
        {/* Match Header Bar (Time & Format as in Photo 2) */}
        <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="font-semibold text-slate-300 truncate max-w-[140px]">{extraHeader || match.name}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {labelTime && <span className="text-slate-500 text-[10px]">{labelTime}</span>}
            {!isFinished && onToggleMatchFormat ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMatchFormat(match.id);
                }}
                className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-extrabold text-[10px] border border-amber-500/40 hover:border-amber-400 transition-colors cursor-pointer"
                title="Нажмите, чтобы изменить формат матча: BO1 / BO3 / BO5"
              >
                {match.format}
              </button>
            ) : (
              <span className="font-bold text-slate-400">
                {match.format}
              </span>
            )}
          </div>
        </div>

        {/* Team Slots */}
        <div className="divide-y divide-slate-800/60 text-xs">
          {/* Team A Slot */}
          <div
            onClick={(e) => {
              if (onSelectManualSlot && !isFinished) {
                e.stopPropagation();
                onSelectManualSlot(match.id, 'A');
              }
            }}
            className={`px-3 py-2 flex items-center justify-between gap-2 transition-colors relative group/slot ${
              onSelectManualSlot && !isFinished ? 'hover:bg-slate-800/80 cursor-pointer' : ''
            } ${
              isFinished && match.winnerId === teamA?.id
                ? 'bg-emerald-950/20 text-emerald-400 font-bold'
                : isFinished
                ? 'text-slate-500 opacity-70'
                : 'text-white'
            }`}
            title={onSelectManualSlot && !isFinished ? 'Нажмите, чтобы сменить команду' : undefined}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {teamA ? (
                <TeamLogo team={teamA} size="xs" />
              ) : (
                <span className="w-5 h-5 rounded bg-slate-800 text-[10px] font-mono flex items-center justify-center text-slate-500">
                  ?
                </span>
              )}
              <span className="font-mono text-xs truncate" title={teamA?.name}>
                {teamA ? (teamA.name.length > 12 && teamA.shortName ? teamA.shortName : teamA.name) : 'TBD (Выбрать)'}
              </span>
            </div>

            {/* Score or Change Hint */}
            <div className="flex items-center gap-1.5 font-mono">
              {onSelectManualSlot && !isFinished && (
                <span className="text-[10px] text-slate-500 group-hover/slot:text-amber-400 transition-colors hidden sm:inline">
                  изм.
                </span>
              )}
              <span className="font-bold text-sm tabular-nums">
                {isFinished ? match.scoreA : '—'}
              </span>
            </div>
          </div>

          {/* Team B Slot */}
          <div
            onClick={(e) => {
              if (onSelectManualSlot && !isFinished) {
                e.stopPropagation();
                onSelectManualSlot(match.id, 'B');
              }
            }}
            className={`px-3 py-2 flex items-center justify-between gap-2 transition-colors relative group/slot ${
              onSelectManualSlot && !isFinished ? 'hover:bg-slate-800/80 cursor-pointer' : ''
            } ${
              isFinished && match.winnerId === teamB?.id
                ? 'bg-emerald-950/20 text-emerald-400 font-bold'
                : isFinished
                ? 'text-slate-500 opacity-70'
                : 'text-white'
            }`}
            title={onSelectManualSlot && !isFinished ? 'Нажмите, чтобы сменить команду' : undefined}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {teamB ? (
                <TeamLogo team={teamB} size="xs" />
              ) : (
                <span className="w-5 h-5 rounded bg-slate-800 text-[10px] font-mono flex items-center justify-center text-slate-500">
                  ?
                </span>
              )}
              <span className="font-mono text-xs truncate" title={teamB?.name}>
                {teamB ? (teamB.name.length > 12 && teamB.shortName ? teamB.shortName : teamB.name) : 'TBD (Выбрать)'}
              </span>
            </div>

            {/* Score or Change Hint */}
            <div className="flex items-center gap-1.5 font-mono">
              {onSelectManualSlot && !isFinished && (
                <span className="text-[10px] text-slate-500 group-hover/slot:text-amber-400 transition-colors hidden sm:inline">
                  изм.
                </span>
              )}
              <span className="font-bold text-sm tabular-nums">
                {isFinished ? match.scoreB : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Delta Points & Form if finished */}
        {isFinished && match.deltaPointsA !== undefined && match.deltaPointsB !== undefined && (
          <div className="px-3 py-1 bg-slate-900/60 border-t border-slate-800/60 flex items-center justify-between text-[9px] font-mono">
            <span className={match.winnerId === teamA?.id ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
              {match.deltaPointsA > 0 ? `+${match.deltaPointsA}` : match.deltaPointsA} VRS
            </span>
            <span className={match.winnerId === teamB?.id ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
              {match.deltaPointsB > 0 ? `+${match.deltaPointsB}` : match.deltaPointsB} VRS
            </span>
          </div>
        )}

        {/* Played Maps Badges in Playoffs */}
        {isFinished && match.mapsPlayed && match.mapsPlayed.length > 0 && (
          <div className="px-3 py-1 bg-slate-950/80 border-t border-slate-800/60 flex flex-wrap gap-1">
            {match.mapsPlayed.map((mp, idx) => (
              <span
                key={idx}
                className="text-[8px] font-mono px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                title={`${mp.mapName}: ${mp.scoreA}:${mp.scoreB} ${mp.overtime ? '(OT)' : ''}`}
              >
                {mp.mapName.slice(0, 3)} {mp.scoreA}:{mp.scoreB}
              </span>
            ))}
          </div>
        )}

        {/* Action Bar Footer */}
        {isReady && !isFinished && (
          <div className="px-3 py-1.5 bg-amber-500/10 border-t border-amber-500/30 flex items-center justify-between text-[11px] font-mono font-bold text-amber-400">
            <div className="flex items-center gap-1">
              <Play className="w-3 h-3 fill-amber-400" />
              <span>Симуляция</span>
            </div>

            {onQuickSimulateMatch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickSimulateMatch(match);
                }}
                className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black text-[9px] font-bold transition-colors cursor-pointer"
                title="Быстро сыграть матч"
              >
                быстро
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Playoff Seeding / Link Bar */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Сетка плей-офф (Playoffs)
            </h3>
          </div>

          {/* Subtitle status based on link state */}
          <div className="mt-1 text-xs font-mono">
            {isFromSwiss && linkPlayoffsToSwiss ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Сетка привязана к швейцарке: пары сформированы по правилам CS2 Major (3:0 vs 3:2, 3:1 vs 3:1).
              </span>
            ) : isFromSwiss && !linkPlayoffsToSwiss ? (
              <span className="text-amber-400 flex items-center gap-1">
                <Link2Off className="w-3.5 h-3.5" />
                Привязка к швейцарке отключена: вы можете свободно выбирать любые команды в сетку.
              </span>
            ) : (
              <span className="text-slate-400">
                Одиночная сетка на выбывание (Single Elimination)
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          {/* Link to Swiss Toggle (Only if from Swiss tournament) */}
          {isFromSwiss && onToggleLinkSwiss && (
            <button
              onClick={() => {
                soundFx.playClick();
                onToggleLinkSwiss();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                linkPlayoffsToSwiss
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
              }`}
              title="Переключить привязанность сетки к результатам швейцарской системы"
            >
              {linkPlayoffsToSwiss ? (
                <>
                  <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Привязка: ВКЛ</span>
                </>
              ) : (
                <>
                  <Link2Off className="w-3.5 h-3.5 text-amber-400" />
                  <span>Привязка: ВЫКЛ</span>
                </>
              )}
            </button>
          )}

          {/* Reset to Swiss official pairings */}
          {isFromSwiss && linkPlayoffsToSwiss && onResetToSwissSeeding && (
            <button
              onClick={() => {
                soundFx.playClick();
                onResetToSwissSeeding();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono border border-slate-700 transition-colors cursor-pointer"
              title="Сбросить четвертьфиналы к стандартному посеву со швейцарки"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Посев со швейцарки</span>
            </button>
          )}

          {/* Free Mode Actions (When unlinked or standalone) */}
          {(!linkPlayoffsToSwiss || !isFromSwiss) && (
            <>
              {onRandomizePlayoffTeams && (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onRandomizePlayoffTeams();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono border border-slate-700 transition-colors cursor-pointer"
                  title="Случайно заполнить сетку плей-офф"
                >
                  <Shuffle className="w-3 h-3 text-amber-400" />
                  <span>Рандом команд</span>
                </button>
              )}

              {onSeedTop8VRS && (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onSeedTop8VRS();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono border border-slate-700 transition-colors cursor-pointer"
                  title="Заполнить сетку топ-8 командами по рейтингу VRS"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Топ-8 по рейтингу</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* SECTION 1: Main Playoffs Bracket (Photo 2 Top Part) */}
      <div className="bg-[#090d15] border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-x-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white tracking-wide">
              Playoffs (Плей-офф)
            </h3>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span>BO3 / Финал BO5</span>
            <span>·</span>
            <span>Single Elimination</span>
          </div>
        </div>

        {/* Bracket Grid: 3 columns if quarterfinals present, 2 columns if starting from semifinals */}
        <div className={`min-w-[700px] grid ${r12Matches.length > 0 ? 'grid-cols-4 min-w-[1400px]' : qfMatches.length > 0 ? 'grid-cols-3' : 'grid-cols-2 max-w-3xl mx-auto'} gap-8 relative items-center`}>
          {/* First round play-in, only in a 12-team group-playoff format. */}
          {r12Matches.length > 0 && (
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">Раунд за выход в 1/4 финала</div>
              <div className="space-y-4">
                {r12Matches.map((m, i) => renderBracketMatch(m, undefined, `Матч ${i + 1}`))}
              </div>
            </div>
          )}

          {/* Column: Quarter-finals (if any) */}
          {qfMatches.length > 0 && (
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Quarter-finals</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Клик на команду для выбора
                </span>
              </div>
              <div className="space-y-4">
                {qfMatches.map((m, i) => renderBracketMatch(m, undefined, `Матч ${i + 1}`))}
              </div>
            </div>
          )}

          {/* Column: Semi-finals (2 matches, vertically centered) */}
          <div className="space-y-4 flex flex-col justify-around h-full">
            <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
              Semi-finals
            </div>
            <div className="space-y-16 py-6">
              {sfMatches.map((m, i) => renderBracketMatch(m, undefined, `Полуфинал ${i + 1}`))}
            </div>
          </div>

          {/* Column: Grand Final (1 match, centered) */}
          <div className="space-y-4 flex flex-col justify-center h-full">
            <div className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Grand final
            </div>
            <div className="py-12">
              {finalMatch && renderBracketMatch(finalMatch, '18:00', 'Финал чемпионата')}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: 3rd Place Decider Match (not used for Major format) */}
      {!hideThirdPlaceToggle && (
      <div className="bg-[#090d15] border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <Medal className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-white tracking-wide">
              3rd Place Decider Match (Матч за 3-е место)
            </h3>
          </div>

          {/* Toggle 3rd place match */}
          <label className={`flex items-center gap-2 select-none text-xs font-mono ${thirdPlaceRequired ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <span className="text-slate-400">
              {thirdPlaceRequired ? 'Матч обязателен для GSL 8×8:' : 'Включить матч за 3-е место:'}
            </span>
            <div
              aria-disabled={thirdPlaceRequired}
              title={thirdPlaceRequired ? 'В этом формате матч за 3-е место обязателен' : 'Включить или отключить матч за 3-е место'}
              onClick={() => {
                if (thirdPlaceRequired) return;
                soundFx.playClick();
                onToggleThirdPlace();
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                includeThirdPlace ? 'bg-amber-500' : 'bg-slate-700'
              } ${thirdPlaceRequired ? 'opacity-80' : ''}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
                  includeThirdPlace ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </div>
            <span className={`font-bold ${includeThirdPlace ? 'text-amber-400' : 'text-slate-500'}`}>
              {includeThirdPlace ? 'ВКЛ' : 'ВЫКЛ'}
            </span>
          </label>
        </div>

        {includeThirdPlace ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div>
              <div className="text-xs font-mono text-slate-400 mb-2 font-semibold">
                Tiebreaker
              </div>
              {thirdMatch && renderBracketMatch(thirdMatch, '14:30', 'Матч за 3-е место')}
            </div>

            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              В матче за 3-е место встречаются проигравшие команды из двух полуфиналов.
              Победитель получает бронзовые медали турнира.
            </p>
          </div>
        ) : (
          <div className="text-xs font-mono text-slate-500 py-2">
            Матч за 3-е место выключен. Команды из полуфиналов разделят 3–4-е места.
          </div>
        )}
      </div>
      )}
    </div>
  );
};
