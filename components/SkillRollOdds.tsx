import React from 'react';
import { formatKeyPercent, skillLevelKeyChance } from '../utils/keyRoll';

interface Props {
  currentLevel: number;
  isUnlocked: boolean;
}

export const SkillRollOdds: React.FC<Props> = ({ currentLevel, isUnlocked }) => {
  if (!isUnlocked || currentLevel >= 99) return null;

  const nextLevel = currentLevel + 1;
  const chance = formatKeyPercent(skillLevelKeyChance(nextLevel));

  return (
    <div
      className="pointer-events-auto text-[8px] text-blue-300/80 mt-0.5 leading-none whitespace-nowrap"
      title={`Next level Key chance: ${chance}. Every level also has a separate 2% Chaos Key chance.`}
    >
      Next Lv {nextLevel} &middot; {chance} Key
    </div>
  );
};
