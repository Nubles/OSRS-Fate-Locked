import { confirmThen } from '../utils/spendConfirm';
import React, { useId, useState } from 'react';
import { useGame } from '../context/GameContext';
import { formatLevelBatchSummary, planSetLevel } from '../utils/setLevelText';
import { levelPastTierCap, tierCap } from '../utils/chunkedFate';

/**
 * Set level, in the skill detail (classic modal and OSRS skill guide): type
 * the level the skill reached and every level in between is logged, each
 * rolled as a click on the skill would roll it (GameContext.setSkillLevel).
 * One summary line replaces a popup per level.
 */
export const SetLevelControl: React.FC<{ skill: string; variant: 'classic' | 'osrs' }> = ({ skill, variant }) => {
  const { unlocks, gameModeId, setSkillLevel } = useGame();
  const level = unlocks.levels[skill] || 1;
  const tier = unlocks.skills[skill] || 0;
  const [value, setValue] = useState('');
  const [summary, setSummary] = useState('');
  const inputId = useId();
  const hintId = useId();

  const plan = planSetLevel(level, tier, value);
  const typed = value.trim() !== '';
  const pastCap = plan.ok && levelPastTierCap(gameModeId, unlocks, skill, plan.to)
    ? ` Levels past ${tierCap(tier)} roll nothing until the next tier opens.`
    : '';
  const hint = tier < 1 || level >= 99
    ? (plan.ok === false ? plan.reason : '')
    : !typed
      ? `Now level ${level}. Type the level you reached: each level rolls, as a click would.`
      : plan.ok
        ? `${plan.count === 1 ? `Level ${plan.to} rolls` : `Levels ${plan.from + 1} to ${plan.to} each roll`} for a Key.${pastCap}`
        : plan.ok === false ? plan.reason : '';
  const canEnter = tier >= 1 && level < 99;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!plan.ok) return;
    const to = plan.to;
    confirmThen(`Log ${skill} to level ${to} and roll for each level?`, () => {
      const result = setSkillLevel(skill, to);
      if (!result) return;
      setSummary(`${skill} ${result.from} to ${result.to}. ${formatLevelBatchSummary(result)}.`);
      setValue('');
    });
  };

  const buttonLabel = plan.ok ? `Roll ${plan.count} level${plan.count === 1 ? '' : 's'}` : 'Roll levels';
  const warn = typed && !plan.ok;

  if (variant === 'osrs') {
    return (
      <form className="osrs-inner osrs-dash-setlevel" onSubmit={submit} aria-label={`Set ${skill} level`}>
        <label htmlFor={canEnter ? inputId : undefined} className="osrs-dash-setlevel-label">Set level</label>
        {canEnter && (
          <>
            <span className="osrs-dash-search osrs-dash-setlevel-input">
              <input id={inputId} value={value} inputMode="numeric" maxLength={2} autoComplete="off"
                placeholder={String(level + 1)} aria-describedby={hintId} aria-invalid={warn || undefined}
                onChange={e => setValue(e.target.value.replace(/[^0-9]/g, ''))} />
            </span>
            <button type="submit" className="osrs-btn" disabled={!plan.ok} style={{ height: 26 }}>{buttonLabel}</button>
          </>
        )}
        <span id={hintId} className={warn ? 'osrs-dash-setlevel-hint is-warn' : 'osrs-dash-setlevel-hint'}>{hint}</span>
        <span role="status" className="osrs-dash-setlevel-done">{summary}</span>
      </form>
    );
  }

  return (
    <form onSubmit={submit} aria-label={`Set ${skill} level`}
      className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2.5 bg-[#151515] border-b border-white/10">
      <label htmlFor={canEnter ? inputId : undefined} className="text-xs font-bold text-gray-300">Set level</label>
      {canEnter && (
        <>
          <input id={inputId} value={value} inputMode="numeric" maxLength={2} autoComplete="off"
            placeholder={String(level + 1)} aria-describedby={hintId} aria-invalid={warn || undefined}
            onChange={e => setValue(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-14 bg-black/40 border border-white/10 rounded px-2 py-1 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-400/50" />
          <button type="submit" disabled={!plan.ok}
            className="text-xs font-bold px-3 py-1.5 rounded border border-green-500/40 bg-green-900/40 text-green-200 hover:bg-green-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {buttonLabel}
          </button>
        </>
      )}
      <span id={hintId} className={`text-[11px] min-w-0 ${warn ? 'text-amber-300' : 'text-gray-500'}`}>{hint}</span>
      <span role="status" className="basis-full text-xs font-bold text-green-300 empty:hidden">{summary}</span>
    </form>
  );
};

export default SetLevelControl;
