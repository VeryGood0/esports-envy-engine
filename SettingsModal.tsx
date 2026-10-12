import React, { useState } from 'react';
import { X, Settings } from 'lucide-react';
import { getRatingWeight, setRatingWeight, DEFAULT_RATING_WEIGHT } from '../utils/settings';

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [weight, setWeight] = useState(getRatingWeight());
  if (!isOpen) return null;
  const update = (v: number) => {
    setWeight(v);
    setRatingWeight(v);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0d121c] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Settings className="w-5 h-5 text-amber-400" /> Настройки симуляции
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-200">Значимость рейтинга команд</span>
            <span className="font-mono font-bold text-amber-400">{weight}%</span>
          </div>
          <input type="range" min={0} max={100} step={5} value={weight} onChange={(e) => update(Number(e.target.value))} className="w-full accent-amber-500" />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Решает статистика карт</span>
            <span>Решает рейтинг</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Чем меньше сыграно карт у команд, тем сильнее на исход влияет общий рейтинг и VRS-очки. Этот ползунок задаёт, насколько сильно.
          </p>
          <button onClick={() => update(DEFAULT_RATING_WEIGHT)} className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer">
            Сбросить ({DEFAULT_RATING_WEIGHT}%)
          </button>
        </div>
      </div>
    </div>
  );
}
