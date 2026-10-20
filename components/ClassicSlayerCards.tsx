import React from 'react';
import { Crosshair } from 'lucide-react';
import { DropSource } from '../types';
import { DROP_RATES } from '../constants';
import { useGame } from '../context/GameContext';
import { slayerCardBlock } from '../utils/farmGates';
import { useBossTask, type BossTaskModel } from '../hooks/useBossTask';
import { RollingOverlay, SlayerMasterCard, useRollSuspense, type FarmModel, type TierStyle } from './ActionSection';

/**
 * The classic Farm Keys panel's Slayer cards. They load with the panel's
 * Slayer tab, so the gates (utils/farmGates.ts) stay out of the entry chunk.
 * A master the run can't use yet is greyed out with why (critique GP-10).
 */

// --- Boss Task Card (Vanilla and Chunked) ---
// The player says which boss the task was; the roll draws from that boss's
// Key stash at its next-Key odds, as a kill does (utils/farmGates.ts).
const BossTaskCard: React.FC<{ task: BossTaskModel; image: string; style: TierStyle; subText: string }> = ({ task, image, style, subText }) => {
  const { isRolling, triggerRoll } = useRollSuspense(task.roll);
  const blocked = task.block;
  return (
    <div
      title={blocked ?? undefined}
      className={`relative w-full min-h-20 overflow-hidden rounded-lg border-2 ${style.bg} ${style.border} ${blocked ? 'opacity-50 grayscale' : ''} shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] py-2 pl-4 pr-3`}
    >
      <img src={image} alt="" className="absolute -right-2 -bottom-2 w-auto h-[120%] object-contain opacity-30 grayscale pointer-events-none" />
      <div className={`relative z-10 flex flex-col items-start gap-1 transition-opacity duration-200 ${isRolling ? 'opacity-0' : 'opacity-100'}`}>
        <h3 className={`font-black text-base uppercase tracking-wider ${style.text} drop-shadow-md`}>Boss Task</h3>
        <p className="text-[10px] text-gray-400 font-mono">{subText}</p>
        {blocked ? (
          <div className="px-2 py-0.5 rounded text-[10px] font-bold border border-white/10 bg-black/40 text-amber-300">{blocked}</div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 w-full">
            <select
              aria-label="Which boss was the task?"
              value={task.pick}
              onChange={(e) => task.setPick(e.target.value)}
              className="w-full min-w-0 bg-black/50 border border-white/15 rounded px-1.5 py-1 text-[11px] text-gray-200 focus:outline-none focus:border-white/40"
            >
              <option value="">Which boss was it?</option>
              {task.bosses.map(boss => <option key={boss.name} value={boss.name}>{boss.name} · {boss.rate}%</option>)}
            </select>
            <button
              type="button"
              onClick={triggerRoll}
              disabled={!task.pick || isRolling}
              className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold border ${style.pill} flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Crosshair size={10} />
              {task.rate === null ? 'Roll' : `${task.rate}% Chance`}
            </button>
          </div>
        )}
      </div>
      {isRolling && <RollingOverlay />}
    </div>
  );
};

type Props = Pick<FarmModel, 'slayers' | 'effectiveRate' | 'bonusFor' | 'handleRoll'> & { animationsEnabled: boolean };

export const ClassicSlayerCards: React.FC<Props> = ({ slayers, effectiveRate, bonusFor, handleRoll, animationsEnabled }) => {
  const { unlocks, gameModeId } = useGame();
  const bossTask = useBossTask(handleRoll);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {slayers.map((master, i) => (
        <div
          key={master.name}
          className={animationsEnabled ? 'animate-fade-in-up' : ''}
          style={animationsEnabled ? { animationDelay: `${i * 35}ms` } : undefined}
        >
          {master.source === DropSource.SLAYER_BOSS && bossTask ? (
            <BossTaskCard task={bossTask} image={master.image} style={master.style} subText={master.subText} />
          ) : (
            <SlayerMasterCard
              name={master.name}
              subText={master.subText}
              displayRate={effectiveRate(master.source)}
              bonus={bonusFor(master.source)}
              image={master.image}
              style={master.style}
              blocked={slayerCardBlock(master.name, unlocks, gameModeId)}
              onClick={(e) => handleRoll(master.source, DROP_RATES[master.source], e)}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default ClassicSlayerCards;
