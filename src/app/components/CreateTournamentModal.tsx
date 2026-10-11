// @ts-nocheck -- imported legacy code written for a looser tsconfig
import React, { useState, useMemo } from 'react';
import {
  Team,
  TournamentMode,
  MatchFormat,
  TournamentState,
  TournamentTier,
  StageFormatSettings
} from '../types';
import { TeamLogo } from './TeamLogo';
import { createCustomTournament } from '../utils/tournament';
import { soundFx } from '../utils/audio';
import {
  X,
  Trophy,
  Sparkles,
  Dices,
  Check,
  Search,
  Filter,
  Layers,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  DollarSign,
  Shield,
  Building,
  Sliders,
  Flame,
  Award,
  Users
} from 'lucide-react';

interface CreateTournamentModalProps {
  teams: Team[];
  onClose: () => void;
  onCreateTournament: (tournament: TournamentState) => void;
}

interface TournamentPreset {
  id: string;
  name: string;
  shortName: string;
  organizer: string;
  prizePool: string;
  tier: TournamentTier;
  description: string;
  mode: TournamentMode;
  teamCount: number;
  stageFormats: StageFormatSettings;
}

export const TOURNAMENT_TIERS: {
  id: TournamentTier;
  label: string;
  badge: string;
  vrsEstimate: string;
  description: string;
  bgGradient: string;
  borderColor: string;
}[] = [
  {
    id: 'Major',
    label: 'Valve Major',
    badge: 'MAJOR',
    vrsEstimate: '+380..520 VRS',
    description: 'Официальный Чемпионат Мира от Valve. Высшая точка киберспорта с максимальной наградой очков и престижем.',
    bgGradient: 'from-purple-900/40 via-purple-950/20 to-slate-900',
    borderColor: 'border-purple-500/50'
  },
  {
    id: 'S-Tier',
    label: 'S-Tier (Elite)',
    badge: 'S-TIER',
    vrsEstimate: '+260..350 VRS',
    description: 'Элитный LAN-турнир: IEM Katowice/Cologne, BLAST World Final, ESL Pro League.',
    bgGradient: 'from-amber-900/40 via-amber-950/20 to-slate-900',
    borderColor: 'border-amber-500/50'
  },
  {
    id: 'A-Tier',
    label: 'A-Tier (Championship)',
    badge: 'A-TIER',
    vrsEstimate: '+140..220 VRS',
    description: 'Крупный чемпионат: BetBoom Dacha, Roobet Cup, Skyesports Masters.',
    bgGradient: 'from-yellow-900/30 via-slate-900 to-slate-900',
    borderColor: 'border-yellow-500/40'
  },
  {
    id: 'B-Tier',
    label: 'B-Tier (Challenger)',
    badge: 'B-TIER',
    vrsEstimate: '+75..120 VRS',
    description: 'Тир-2 лига: ESL Challenger, CCT Global Finals, региональные RMR квалификации.',
    bgGradient: 'from-blue-900/30 via-slate-900 to-slate-900',
    borderColor: 'border-blue-500/40'
  },
  {
    id: 'Community',
    label: 'C-Tier / Community',
    badge: 'COMMUNITY',
    vrsEstimate: '+35..65 VRS',
    description: 'Локальный кубок, открытая квалификация или фанатский шоу-турнир.',
    bgGradient: 'from-slate-800/40 via-slate-900 to-slate-900',
    borderColor: 'border-slate-700'
  }
];

const TOURNAMENT_PRESETS: TournamentPreset[] = [
  {
    id: 'agerapvp',
    name: 'AgeraPVP Championship 2026',
    shortName: 'AGERA 2026',
    organizer: 'Agera Gaming',
    prizePool: '$1,250,000',
    tier: 'S-Tier',
    description: 'Главный флагманский турнир 2026 года: 16 команд, швейцарская система до 3 побед и плей-офф Top-8 Single Elimination с гранд-финалом BO5.',
    mode: 'swiss_playoffs',
    teamCount: 16,
    stageFormats: {
      swissNormalFormat: 'BO1',
      swissDeciderFormat: 'BO3',
      quarterfinalFormat: 'BO3',
      semifinalFormat: 'BO3',
      finalFormat: 'BO5'
    }
  },
  {
    id: 'major',
    name: 'Valve CS2 Major Championship 2026',
    shortName: 'MAJOR 2026',
    organizer: 'PGL / Valve',
    prizePool: '$1,250,000',
    tier: 'Major',
    description: 'Официальный Чемпионат Мира по Counter-Strike 2. Престижнейший турнир с полным циклом швейцарки и плей-офф на арене.',
    mode: 'swiss_playoffs',
    teamCount: 16,
    stageFormats: {
      swissNormalFormat: 'BO1',
      swissDeciderFormat: 'BO3',
      quarterfinalFormat: 'BO3',
      semifinalFormat: 'BO3',
      finalFormat: 'BO5'
    }
  },
  {
    id: 'iem',
    name: 'Intel Extreme Masters Katowice 2026',
    shortName: 'IEM KATO',
    organizer: 'ESL',
    prizePool: '$1,000,000',
    tier: 'S-Tier',
    description: 'Легендарный турнир в Сподеке. GSL-группы и плей-офф с гранд-финалом BO5.',
    mode: 'gsl_groups',
    teamCount: 16,
    stageFormats: {
      groupFormat: 'BO3',
      quarterfinalFormat: 'BO3',
      semifinalFormat: 'BO3',
      finalFormat: 'BO5'
    }
  },
  {
    id: 'blast',
    name: 'BLAST Premier World Final 2026',
    shortName: 'BLAST WF',
    organizer: 'BLAST',
    prizePool: '$1,000,000',
    tier: 'S-Tier',
    description: 'Элитный финал года для 8 сильнейших команд с системой Double Elimination (верхняя и нижняя сетка).',
    mode: 'double_elimination',
    teamCount: 8,
    stageFormats: {
      quarterfinalFormat: 'BO3',
      semifinalFormat: 'BO3',
      finalFormat: 'BO5'
    }
  },
  {
    id: 'epl',
    name: 'ESL Pro League Season 21',
    shortName: 'EPL S21',
    organizer: 'ESL',
    prizePool: '$750,000',
    tier: 'S-Tier',
    description: 'Групповой этап с 4 группами по 4 команды с выходом в плей-офф.',
    mode: 'groups_playoffs',
    teamCount: 16,
    stageFormats: {
      groupFormat: 'BO3',
      quarterfinalFormat: 'BO3',
      semifinalFormat: 'BO3',
      finalFormat: 'BO5'
    }
  },
  {
    id: 'single_cup',
    name: 'CS2 Masters Cup (Single Elimination)',
    shortName: 'CUP 8',
    organizer: 'StarLadder',
    prizePool: '$500,000',
    tier: 'A-Tier',
    description: 'Классическая олимпийская сетка на выбывание на 8 команд. Каждый матч имеет решающее значение.',
    mode: 'single_elimination',
    teamCount: 8,
    stageFormats: {
      quarterfinalFormat: 'BO3',
      semifinalFormat: 'BO3',
      finalFormat: 'BO5'
    }
  },
  {
    id: 'round_robin',
    name: 'All-Star Round Robin Championship',
    shortName: 'ROUND ROBIN',
    organizer: 'Agera Esports',
    prizePool: '$300,000',
    tier: 'B-Tier',
    description: 'Круговой турнир: каждая команда играет с каждой. Победитель определяется по сумме очков и разнице карт.',
    mode: 'round_robin',
    teamCount: 6,
    stageFormats: {
      groupFormat: 'BO1',
      finalFormat: 'BO3'
    }
  }
];

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  teams,
  onClose,
  onCreateTournament
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Tournament Basic Info
  const [name, setName] = useState('AgeraPVP Championship 2026');
  const [shortName, setShortName] = useState('AGERA 2026');
  const [organizer, setOrganizer] = useState('Agera Gaming');
  const [prizePool, setPrizePool] = useState('$1,250,000');
  const [tier, setTier] = useState<TournamentTier>('S-Tier');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(
    'Полноценный чемпионат CS2 с системой Map Veto, реалистичными раундами MR12 и динамическим обновлением VRS рейтинга.'
  );

  // Format Settings
  const [mode, setMode] = useState<TournamentMode>('swiss_playoffs');
  const [teamCount, setTeamCount] = useState<number>(16);
  const [groupCount, setGroupCount] = useState<number>(2); // 2 or 4 groups
  const [groupStyle, setGroupStyle] = useState<'gsl' | 'round_robin'>('gsl');
  const [includeThirdPlace, setIncludeThirdPlace] = useState(true);

  // Stage Formats
  const [stageFormats, setStageFormats] = useState<StageFormatSettings>({
    swissNormalFormat: 'BO1',
    swissDeciderFormat: 'BO3',
    quarterfinalFormat: 'BO3',
    semifinalFormat: 'BO3',
    finalFormat: 'BO5',
    groupFormat: 'BO3'
  });

  // Selected Teams & Seeding (Array of team IDs ordered by seed: index 0 = Seed 1)
  const defaultSortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => b.points - a.points);
  }, [teams]);

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(() => {
    return defaultSortedTeams.slice(0, 16).map((t) => t.id);
  });

  // Filters for Team Picker
  const [searchTeam, setSearchTeam] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  // Handle Preset Selection
  const handleApplyPreset = (preset: TournamentPreset) => {
    soundFx.playClick();
    setName(preset.name);
    setShortName(preset.shortName);
    setOrganizer(preset.organizer);
    setPrizePool(preset.prizePool);
    setTier(preset.tier);
    setDescription(preset.description);
    setMode(preset.mode);
    setTeamCount(preset.teamCount);
    setStageFormats(preset.stageFormats);

    // Pick top teams for this preset
    const needed = preset.teamCount;
    setSelectedTeamIds(defaultSortedTeams.slice(0, needed).map((t) => t.id));

    if (preset.mode === 'gsl_groups' || preset.mode === 'groups_playoffs') {
      setGroupCount(preset.teamCount <= 8 ? 2 : 4);
      setGroupStyle(preset.mode === 'gsl_groups' ? 'gsl' : 'round_robin');
    }
  };

  // Adjust team count
  const handleSetTeamCount = (count: number) => {
    soundFx.playClick();
    setTeamCount(count);
    if (count <= 8) {
      setGroupCount(2);
    }
    if (selectedTeamIds.length > count) {
      setSelectedTeamIds(selectedTeamIds.slice(0, count));
    } else if (selectedTeamIds.length < count) {
      const remaining = defaultSortedTeams
        .filter((t) => !selectedTeamIds.includes(t.id))
        .map((t) => t.id);
      setSelectedTeamIds([...selectedTeamIds, ...remaining.slice(0, count - selectedTeamIds.length)]);
    }
  };

  // Toggle Team Selection
  const handleToggleTeam = (teamId: string) => {
    soundFx.playClick();
    if (selectedTeamIds.includes(teamId)) {
      setSelectedTeamIds(selectedTeamIds.filter((id) => id !== teamId));
    } else {
      if (selectedTeamIds.length < teamCount) {
        setSelectedTeamIds([...selectedTeamIds, teamId]);
      }
    }
  };

  // Auto-seed by VRS rating & current form
  const handleAutoSeed = () => {
    soundFx.playClick();
    const currentTeams = selectedTeamIds.map((id) => teams.find((t) => t.id === id)!).filter(Boolean);
    const sorted = [...currentTeams].sort((a, b) => {
      const formA = a.mapProfile?.currentForm || 80;
      const formB = b.mapProfile?.currentForm || 80;
      const scoreA = a.points * 0.7 + formA * 10;
      const scoreB = b.points * 0.7 + formB * 10;
      return scoreB - scoreA;
    });
    setSelectedTeamIds(sorted.map((t) => t.id));
  };

  // Shuffle seed randomly
  const handleRandomSeed = () => {
    soundFx.playClick();
    const shuffled = [...selectedTeamIds].sort(() => Math.random() - 0.5);
    setSelectedTeamIds(shuffled);
  };

  // Move team seed up/down
  const handleMoveSeed = (index: number, direction: 'up' | 'down') => {
    soundFx.playClick();
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= selectedTeamIds.length) return;
    const copy = [...selectedTeamIds];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setSelectedTeamIds(copy);
  };

  // Finish and Create Tournament
  const handleCreate = () => {
    if (selectedTeamIds.length < 2) return;
    soundFx.playVictory();

    const selectedTeamsInSeedOrder = selectedTeamIds
      .map((id) => teams.find((t) => t.id === id)!)
      .filter(Boolean);

    const newTournament = createCustomTournament({
      name,
      shortName,
      organizer,
      prizePool,
      startDate,
      description,
      tier,
      mode,
      teams: selectedTeamsInSeedOrder,
      stageFormats: {
        ...stageFormats,
        groupCount,
        groupStyle
      },
      includeThirdPlace
    });

    onCreateTournament(newTournament);
    onClose();
  };

  // Filtered teams list for picker
  const filteredAvailableTeams = useMemo(() => {
    return teams.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(searchTeam.toLowerCase()) ||
        (t.rosterSnippet || []).some((p) => p.toLowerCase().includes(searchTeam.toLowerCase()));
      const matchRegion = selectedRegion === 'all' || t.region === selectedRegion;
      return matchSearch && matchRegion;
    });
  }, [teams, searchTeam, selectedRegion]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#0e1422] border border-slate-700/80 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>Создание турнира CS2</span>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Tournament Manager
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Настройте формат, участников, посев (seed) и правила стадий
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

        {/* Wizard Steps Tabs */}
        <div className="px-6 py-2.5 bg-slate-950/50 border-b border-slate-800/80 flex items-center gap-2 text-xs font-mono overflow-x-auto shrink-0">
          {[
            { num: 1, label: '1. Пресеты & Инфо' },
            { num: 2, label: '2. Формат турнира' },
            { num: 3, label: '3. Команды & Посев' },
            { num: 4, label: '4. Формат матчей' }
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => {
                soundFx.playClick();
                setStep(s.num as any);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                step === s.num
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900/40 hover:bg-slate-800/60'
              }`}
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* STEP 1: PRESETS & BASIC INFO */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Ready Presets Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Готовые шаблоны турниров
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Нажмите шаблон для мгновенного заполнения
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {TOURNAMENT_PRESETS.map((p) => {
                    const isSelected = name === p.name;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleApplyPreset(p)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                            : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span className="text-white truncate">{p.name}</span>
                          <span className="font-mono text-[10px] text-amber-400 shrink-0 ml-1">
                            {p.teamCount} команд
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {p.description}
                        </p>
                        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span>{p.organizer}</span>
                          <span className="text-emerald-400 font-bold">{p.prizePool}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tournament Tier / Status Selector */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    Статус турнира (Tier) & Начисление VRS
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    Определяет уровень престижа кубка и динамический бонус очков VRS
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {TOURNAMENT_TIERS.map((t) => {
                    const isSelected = tier === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          soundFx.playClick();
                          setTier(t.id);
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? `bg-gradient-to-br ${t.bgGradient} ${t.borderColor} ring-1 ring-amber-500/40 shadow-lg`
                            : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full border ${
                              t.id === 'Major'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : t.id === 'S-Tier'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : t.id === 'A-Tier'
                                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                                : t.id === 'B-Tier'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {t.badge}
                          </span>

                          <span className="text-[11px] font-mono font-bold text-emerald-400">
                            {t.vrsEstimate}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <div className="text-xs font-bold text-white flex items-center justify-between">
                            <span>{t.label}</span>
                            {isSelected && <span className="text-[10px] text-amber-400 font-mono font-bold">Выбран</span>}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 leading-snug line-clamp-2">
                            {t.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tournament Details Form */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Building className="w-4 h-4 text-amber-400" />
                  Параметры турнира
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <label className="text-slate-400 block mb-1">Название турнира:</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#090d14] border border-slate-700/80 rounded-xl px-3 py-2 text-white font-sans focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Короткий тег / Аббревиатура:</label>
                    <input
                      type="text"
                      value={shortName}
                      onChange={(e) => setShortName(e.target.value)}
                      className="w-full bg-[#090d14] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Организатор турнира:</label>
                    <input
                      type="text"
                      value={organizer}
                      onChange={(e) => setOrganizer(e.target.value)}
                      className="w-full bg-[#090d14] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Призовой фонд:</label>
                    <input
                      type="text"
                      value={prizePool}
                      onChange={(e) => setPrizePool(e.target.value)}
                      className="w-full bg-[#090d14] border border-slate-700/80 rounded-xl px-3 py-2 text-emerald-400 font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Дата старта:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-[#090d14] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Описание турнира:</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-[#090d14] border border-slate-700/80 rounded-xl px-3 py-2 text-white font-sans focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TOURNAMENT FORMATS */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Выберите формат соревнований
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Поддерживаются все основные киберспортивные форматы CS2
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    key: 'swiss_playoffs' as TournamentMode,
                    title: 'Swiss → Playoffs (Рекомендуемый)',
                    badge: '16 команд',
                    desc: 'Швейцарская система (3 победы для выхода, 3 поражения для вылета), затем плей-офф топ-8 на арене.'
                  },
                  {
                    key: 'single_elimination' as TournamentMode,
                    title: 'Single Elimination (Олимпийская)',
                    badge: '4, 8, 16 команд',
                    desc: 'Сетка на выбывание без права на ошибку. Проигравший вылетает, победитель проходит в следующий раунд.'
                  },
                  {
                    key: 'double_elimination' as TournamentMode,
                    title: 'Double Elimination',
                    badge: '8 команд (BLAST)',
                    desc: 'Верхняя и нижняя сетки. Первый проигрыш отправляет в сетку лузеров, второй проигрыш означает вылет. Гранд-финал BO5.'
                  },
                  {
                    key: 'swiss_system' as TournamentMode,
                    title: 'Swiss System (Чистая швейцарка)',
                    badge: '16 команд',
                    desc: '5 раундов швейцарской системы без финальной сетки. Команды распределяются по итоговому счету (3:0, 3:1, 3:2 и т.д.).'
                  },
                  {
                    key: 'gsl_groups' as TournamentMode,
                    title: 'GSL Groups → Playoffs (Формат IEM / Фото)',
                    badge: '2 или 4 группы (8 или 16 команд)',
                    desc: 'Группы GSL Double Elimination (Opening round -> Winners/Elimination -> Decider). По 2 команды из каждой группы выходят в плей-офф!'
                  },
                  {
                    key: 'groups_playoffs' as TournamentMode,
                    title: 'Круговые группы → Playoffs',
                    badge: 'Группы + плей-офф',
                    desc: 'Команды разделены на группы по 4 участника. Каждая играет с каждой. Топ-2 выходят в плей-офф.'
                  },
                  {
                    key: 'round_robin' as TournamentMode,
                    title: 'Round Robin (Круговая система)',
                    badge: 'Таблица очков',
                    desc: 'Каждая команда играет с каждой. Общая таблица очков, побед/поражений и разницы карт.'
                  }
                ].map((fmt) => {
                  const isCur = mode === fmt.key;
                  return (
                    <div
                      key={fmt.key}
                      onClick={() => {
                        soundFx.playClick();
                        setMode(fmt.key);
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isCur
                          ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                          : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                        <span className="text-white text-sm">{fmt.title}</span>
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                          {fmt.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {fmt.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* GROUPS CUSTOMIZATION PANEL */}
              {(mode === 'groups_playoffs' || mode === 'gsl_groups') && (
                <div className="p-4 rounded-2xl bg-[#090d14] border border-amber-500/40 space-y-4 animate-in fade-in duration-200 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Настройки группового формата (Сетки как на фото)
                    </h4>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      По 2 команды из группы → Плей-офф
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Number of groups */}
                    <div>
                      <label className="text-xs text-slate-300 font-mono block mb-1.5 font-bold">
                        Количество групп (по 4 команды в каждой):
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                        {[
                          { cnt: 2, label: '2 Группы', desc: '8 команд (A, B)' },
                          { cnt: 3, label: '3 Группы', desc: '12 команд (A..C)' },
                          { cnt: 4, label: '4 Группы', desc: '16 команд (A..D)' },
                          { cnt: 6, label: '6 Групп', desc: '24 команды' }
                        ].map((gOpt) => (
                          <button
                            key={gOpt.cnt}
                            type="button"
                            onClick={() => {
                              soundFx.playClick();
                              setGroupCount(gOpt.cnt);
                              handleSetTeamCount(gOpt.cnt * 4);
                            }}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left ${
                              groupCount === gOpt.cnt
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm ring-1 ring-amber-500/40'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <div className="text-white font-bold">{gOpt.label}</div>
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">{gOpt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Group stage bracket style */}
                    <div>
                      <label className="text-xs text-slate-300 font-mono block mb-1.5 font-bold">
                        Регламент матчей в группах:
                      </label>
                      <div className="grid grid-cols-2 gap-2 font-mono">
                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            setGroupStyle('gsl');
                            setMode('gsl_groups');
                          }}
                          className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left ${
                            groupStyle === 'gsl'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm ring-1 ring-amber-500/40'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="text-white font-bold">GSL Double Elim</div>
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">Сетка виннеров/лузеров (Фото)</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            setGroupStyle('round_robin');
                            setMode('groups_playoffs');
                          }}
                          className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left ${
                            groupStyle === 'round_robin'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm ring-1 ring-amber-500/40'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="text-white font-bold">Круговой турнир</div>
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">Таблица очков</div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
                    <div>
                      <span className="text-amber-400 font-bold">Схема выхода в плей-офф: </span>
                      <span>
                        {groupCount === 2
                          ? 'Из 2 групп (A и B) выходят по 2 команды (всего 4 в плей-офф). В плей-офф (Полуфиналы): 1-е место группы A vs 2-е место группы B, 1-е место группы B vs 2-е место группы A → Гранд-финал!'
                          : `Из ${groupCount} групп выходят по 2 сильнейшие команды (всего ${groupCount * 2} в плей-офф) и автоматически формируют олимпийскую сетку на выбывание с гранд-финалом.`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: TEAMS SELECTION & SEEDING */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Team count and seed controls */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-400" />
                      Количество участников турнира
                    </h4>
                    <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                      Выбрано: <span className="text-amber-400 font-bold">{selectedTeamIds.length}</span> из {teamCount} команд
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#090d14] p-1 rounded-xl border border-slate-800">
                    {[4, 6, 8, 12, 16, 24, 32].map((cnt) => (
                      <button
                        key={cnt}
                        onClick={() => handleSetTeamCount(cnt)}
                        className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                          teamCount === cnt
                            ? 'bg-amber-500 text-black shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seed Action Buttons */}
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleAutoSeed}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
                    title="Расставить команды в посеве по рейтингу и текущей форме"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Автоматический посев (По рейтингу)</span>
                  </button>

                  <button
                    onClick={handleRandomSeed}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
                    title="Случайно перемешать номера посева"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>Случайная жеребьевка (Перемешать)</span>
                  </button>

                  <button
                    onClick={() => {
                      soundFx.playClick();
                      setSelectedTeamIds(defaultSortedTeams.slice(0, teamCount).map((t) => t.id));
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
                  >
                    <span>Выбрать Топ-{teamCount}</span>
                  </button>
                </div>
              </div>

              {/* Seeded Teams Order List */}
              <div className="p-4 rounded-2xl bg-[#090d14] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-bold uppercase tracking-wider">
                    Текущий посев (Seed 1 → {selectedTeamIds.length})
                  </span>
                  <span className="text-slate-500">
                    Используйте стрелки для ручной корректировки посева
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {selectedTeamIds.map((id, idx) => {
                    const team = teams.find((t) => t.id === id);
                    if (!team) return null;
                    return (
                      <div
                        key={id}
                        className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0">
                            #{idx + 1}
                          </span>
                          <TeamLogo team={team} size="xs" />
                          <span className="text-white font-bold truncate">
                            {team.shortName && team.shortName !== team.name
                              ? `${team.name} (${team.shortName})`
                              : team.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMoveSeed(idx, 'up')}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Поднять посев"
                          >
                            ▲
                          </button>
                          <button
                            disabled={idx === selectedTeamIds.length - 1}
                            onClick={() => handleMoveSeed(idx, 'down')}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Опустить посев"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => handleToggleTeam(id)}
                            className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer ml-1"
                            title="Убрать команду из турнира"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Available Teams Database with Search & Filters */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    База команд CS2 (Кликните для добавления/удаления)
                  </span>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Поиск команды..."
                        value={searchTeam}
                        onChange={(e) => setSearchTeam(e.target.value)}
                        className="bg-[#090d14] border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="bg-[#090d14] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Все регионы</option>
                      <option value="Европа">Европа</option>
                      <option value="Южная Америка">Южная Америка</option>
                      <option value="Северная Америка">Северная Америка</option>
                      <option value="Азия">Азия</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {filteredAvailableTeams.map((t) => {
                    const isSelected = selectedTeamIds.includes(t.id);
                    const seedIdx = selectedTeamIds.indexOf(t.id);

                    return (
                      <button
                        key={t.id}
                        onClick={() => handleToggleTeam(t.id)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[90px] relative ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 shadow-sm'
                            : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-mono font-bold flex items-center justify-center">
                            #{seedIdx + 1}
                          </span>
                        )}

                        <TeamLogo team={t} size="sm" />
                        <div className="mt-1 font-bold text-white text-xs truncate max-w-full">
                          {t.name}
                        </div>
                        {t.shortName && (
                          <div className="text-[10px] font-mono font-bold text-amber-400">
                            [{t.shortName}]
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-slate-400">
                          {t.points} VRS
                        </div>
                        {t.trophiesCount !== undefined && t.trophiesCount > 0 && (
                          <div className="text-[9px] font-mono text-amber-400 flex items-center gap-0.5">
                            <Trophy className="w-2.5 h-2.5" />
                            <span>{t.trophiesCount}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: STAGE MATCH FORMATS (BO1 / BO3 / BO5) */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Настройка форматов матчей для стадий
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  MR12 CS2 (до 13 раундов, OT MR3)
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  {/* Swiss / Group stage normal */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <span className="text-slate-300 font-bold block">
                      Групповой / Швейцарский этап (Обычные матчи):
                    </span>
                    <div className="flex items-center gap-2">
                      {(['BO1', 'BO3'] as MatchFormat[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            soundFx.playClick();
                            setStageFormats({ ...stageFormats, swissNormalFormat: f, groupFormat: f });
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                            stageFormats.swissNormalFormat === f
                              ? 'bg-amber-500 text-black'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Swiss deciders */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <span className="text-slate-300 font-bold block">
                      Матчи за выход / вылет (2:0, 0:2, 2:2):
                    </span>
                    <div className="flex items-center gap-2">
                      {(['BO1', 'BO3'] as MatchFormat[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            soundFx.playClick();
                            setStageFormats({ ...stageFormats, swissDeciderFormat: f });
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                            stageFormats.swissDeciderFormat === f
                              ? 'bg-amber-500 text-black'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quarterfinals */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <span className="text-slate-300 font-bold block">
                      Четвертьфиналы плей-офф:
                    </span>
                    <div className="flex items-center gap-2">
                      {(['BO1', 'BO3'] as MatchFormat[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            soundFx.playClick();
                            setStageFormats({ ...stageFormats, quarterfinalFormat: f });
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                            stageFormats.quarterfinalFormat === f
                              ? 'bg-amber-500 text-black'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grand Final */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <span className="text-slate-300 font-bold block">
                      Гранд-финал чемпионата:
                    </span>
                    <div className="flex items-center gap-2">
                      {(['BO3', 'BO5'] as MatchFormat[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            soundFx.playClick();
                            setStageFormats({ ...stageFormats, finalFormat: f });
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                            stageFormats.finalFormat === f
                              ? 'bg-amber-500 text-black'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Third Place Toggle */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-bold text-white block">Матч за 3-е место (Бронзовый финал)</span>
                    <span className="text-slate-400 text-[11px]">
                      Проводить матч между проигравшими в полуфинале
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      soundFx.playClick();
                      setIncludeThirdPlace((p) => !p);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer ${
                      includeThirdPlace
                        ? 'bg-emerald-500 text-black'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {includeThirdPlace ? 'Включен' : 'Отключен'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Controls Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            {step > 1 && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  setStep((s) => (s - 1) as any);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Назад</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                onClick={() => {
                  soundFx.playClick();
                  setStep((s) => (s + 1) as any);
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <span>Далее</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={selectedTeamIds.length < 2}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Создать и запустить турнир</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
