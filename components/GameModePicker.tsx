import React, { useRef, useState } from 'react';
import { X, Lock, Check, Settings2, Sparkles, ShieldOff, Gauge, Landmark } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import {
  GAME_MODES, getGameMode, resolveModeRules, CUSTOM_RULE_BOUNDS,
} from '../config/gameModes';
import type { GameModeRules } from '../config/gameModes';

interface Props {
  onClose: () => void;
}

const VANILLA = getGameMode('vanilla').rules;

export const GameModePicker: React.FC<Props> = ({ onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  useEscapeKey(onClose);

  const { gameModeId, customMode, history, gameModeLocked, setGameMode } = useGame();
  const locked = gameModeLocked || history.length > 0;

  const [selectedId, setSelectedId] = useState(gameModeId ?? 'vanilla');
  const [customDraft, setCustomDraft] = useState<GameModeRules>(
    customMode ?? { ...VANILLA },
  );

  const apply = () => {
    if (locked) return;
    setGameMode(selectedId, selectedId === 'custom' ? customDraft : undefined);
    onClose();
  };

  const activeRules = selectedId === 'custom'
    ? customDraft
    : resolveModeRules(selectedId);

  const setCustom = <K extends keyof GameModeRules>(key: K, value: GameModeRules[K]) =>
    setCustomDraft(prev => ({ ...prev, [key]: value }));

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose game mode"
      tabIndex={-1}
      className="fixed inset-0 z-[170] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="bg-[#0f1115] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-200">
            <Settings2 size={16} className="text-amber-400" />
            Game Mode
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {locked && (
          <div className="px-5 py-2 bg-amber-950/40 border-b border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-300 shrink-0">
            <Lock size={12} />
            The game mode is locked in — it can't be changed once chosen. Start a new profile to play a different mode.
          </div>
        )}

        {/* Mode list */}
        <div className="overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
          {GAME_MODES.map(mode => {
            const isSelected = selectedId === mode.id;
            const isActive = (gameModeId ?? 'vanilla') === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => !locked && setSelectedId(mode.id)}
                disabled={locked && !isActive}
                className={`text-left rounded-lg border p-3 transition-all ${
                  isSelected
                    ? 'border-amber-500/70 bg-amber-950/30'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                } ${locked && !isActive ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{mode.name}</span>
                    {isActive && (
                      <span className="text-[9px] uppercase tracking-wider bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={15} className="text-amber-400" />}
                </div>
                <div className="text-[11px] text-amber-300/70 mt-0.5">{mode.tagline}</div>
                <div className="text-[11px] text-gray-500 mt-1">{mode.description}</div>
              </button>
            );
          })}

          {/* Custom editor */}
          {selectedId === 'custom' && !locked && (
            <div className="rounded-lg border border-white/10 bg-black/30 p-4 mt-1 flex flex-col gap-4">
              <div className="text-[10px] uppercase tracking-widest text-gray-500">Custom ruleset</div>

              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex items-center gap-2 text-xs text-gray-300">
                  <ShieldOff size={13} className="text-sky-400" /> Pity system enabled
                </span>
                <input
                  type="checkbox"
                  checked={customDraft.pityEnabled}
                  onChange={e => setCustom('pityEnabled', e.target.checked)}
                  className="accent-amber-500 w-4 h-4"
                />
              </label>

              <Slider
                label="Pity threshold"
                disabled={!customDraft.pityEnabled}
                value={customDraft.pityThreshold}
                bounds={CUSTOM_RULE_BOUNDS.pityThreshold}
                format={v => `${v} Fate`}
                onChange={v => setCustom('pityThreshold', v)}
              />
              <Slider
                label="Base Omni-key chance"
                value={customDraft.omniChanceBase}
                bounds={CUSTOM_RULE_BOUNDS.omniChanceBase}
                format={v => `${v}%`}
                onChange={v => setCustom('omniChanceBase', v)}
              />
              <Slider
                label="Ritual cost multiplier"
                value={customDraft.ritualCostMultiplier}
                bounds={CUSTOM_RULE_BOUNDS.ritualCostMultiplier}
                format={v => `${v.toFixed(2)}×`}
                onChange={v => setCustom('ritualCostMultiplier', v)}
              />

              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex items-center gap-2 text-xs text-gray-300">
                  <Sparkles size={13} className="text-purple-400" /> Region passive modifiers
                </span>
                <input
                  type="checkbox"
                  checked={customDraft.regionModifiers}
                  onChange={e => setCustom('regionModifiers', e.target.checked)}
                  className="accent-amber-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex items-center gap-2 text-xs text-gray-300">
                  <Landmark size={13} className="text-amber-400" /> Lock every bank &amp; deposit box
                </span>
                <input
                  type="checkbox"
                  checked={!!customDraft.bankLocks}
                  onChange={e => setCustom('bankLocks', e.target.checked)}
                  className="accent-amber-500 w-4 h-4"
                />
              </label>
            </div>
          )}
        </div>

        {/* Summary + apply */}
        <div className="border-t border-white/10 px-5 py-3 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <Gauge size={13} className="text-gray-600" />
            <span>Pity: {activeRules.pityEnabled ? `${activeRules.pityThreshold} Fate` : 'off'}</span>
            <span>Omni: {activeRules.omniChanceBase}%</span>
            <span>Rituals: {activeRules.ritualCostMultiplier.toFixed(2)}×</span>
            <span>Regions: {activeRules.regionModifiers ? 'on' : 'off'}</span>
            {activeRules.bankLocks && <span className="text-amber-400">Banks locked</span>}
          </div>
          <button
            onClick={apply}
            disabled={locked}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {locked ? 'Locked' : 'Apply mode'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Slider: React.FC<{
  label: string;
  value: number;
  bounds: { min: number; max: number; step: number };
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}> = ({ label, value, bounds, format, onChange, disabled }) => (
  <div className={disabled ? 'opacity-40' : ''}>
    <div className="flex items-center justify-between text-xs mb-1">
      <span className="text-gray-300">{label}</span>
      <span className="font-mono text-amber-300">{format(value)}</span>
    </div>
    <input
      type="range"
      min={bounds.min}
      max={bounds.max}
      step={bounds.step}
      value={value}
      disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full accent-amber-500"
    />
  </div>
);
