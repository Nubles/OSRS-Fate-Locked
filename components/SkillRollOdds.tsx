import React from 'react';
import { formatKeyPercent, skillLevelKeyChance } from '../utils/keyRoll';

interface Props {
  currentLevel: number;
  isUnlocked: boolean;
  descriptionId: string;
}

export const SkillRollOdds: React.FC<Props> = ({ currentLevel, isUnlocked, descriptionId }) => {
  if (!isUnlocked || currentLevel >= 99) return null;

  const nextLevel = currentLevel + 1;
  const chance = formatKeyPercent(skillLevelKeyChance(nextLevel));

  return (
    <div
      className="pointer-events-auto text-[8px] text-blue-300/80 mt-0.5 leading-none whitespace-nowrap"
    >
      Next Lv {nextLevel} &middot; {chance} Key
      <span
        id={descriptionId}
        role="tooltip"
        className="pointer-events-none absolute inset-x-2 bottom-2 z-40 whitespace-normal rounded border border-blue-400/30 bg-slate-950/95 px-2 py-1 text-[9px] leading-tight text-blue-100 shadow-lg invisible opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        Every level also has a separate 2% Chaos Key chance.
      </span>
    </div>
  );
};
