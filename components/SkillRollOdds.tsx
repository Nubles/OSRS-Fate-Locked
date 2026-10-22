import React from 'react';
import { formatKeyPercent, skillLevelKeyChance } from '../utils/keyRoll';
import { isSkillChaosMilestone, LEVEL_CHAOS_CHANCE } from '../config/economy';

/**
 * " 12.4% base, +3.3% from your boosts." when the run's achievements, region
 * passives or rituals move a level's Key chance; the skill cards and the OSRS
 * skill guide share it.
 */
export const levelBoostNote = (chance: number, nextLevel: number): string => {
  const base = skillLevelKeyChance(nextLevel);
  const diff = Math.round((chance - base) * 100) / 100;
  return diff === 0 ? '' : ` ${formatKeyPercent(base)} base, ${diff > 0 ? '+' : ''}${diff}% from your boosts.`;
};

/** Why a Chunked level past the tier cap rolls nothing; the skill cards share it. */
export const chunkedPastCapText = (cap: number): string =>
  `Past this tier's cap of level ${cap}. In Chunked you can still log it, but levels past the cap roll no Keys until a Key or a Breakthrough opens the next tier.`;

interface Props {
  currentLevel: number;
  isUnlocked: boolean;
  descriptionId: string;
  /** The next level's Key chance as the roll makes it (utils/keyChance.ts levelUpKeyChance). */
  chance: number | null;
  /** Chunked: the skill's tier cap when the next level is past it, so it rolls nothing. */
  pastCap?: number;
}

export const SkillRollOdds: React.FC<Props> = ({ currentLevel, isUnlocked, descriptionId, chance, pastCap }) => {
  if (!isUnlocked || currentLevel >= 99) return null;

  const nextLevel = currentLevel + 1;
  if (pastCap !== undefined || chance === null) {
    return (
      <div className="pointer-events-auto text-[8px] text-gray-400 mt-0.5 leading-none whitespace-nowrap">
        Next Lv {nextLevel} &middot; no roll
        <span
          id={descriptionId}
          role="tooltip"
          className="pointer-events-none absolute inset-x-2 bottom-2 z-40 whitespace-normal rounded border border-blue-400/30 bg-slate-950/95 px-2 py-1 text-[9px] leading-tight text-blue-100 shadow-lg invisible opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          {pastCap !== undefined ? chunkedPastCapText(pastCap) : 'This level rolls no Key.'}
        </span>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto text-[8px] text-blue-300/80 mt-0.5 leading-none whitespace-nowrap"
    >
      Next Lv {nextLevel} &middot; {formatKeyPercent(chance)} Key
      <span
        id={descriptionId}
        role="tooltip"
        className="pointer-events-none absolute inset-x-2 bottom-2 z-40 whitespace-normal rounded border border-blue-400/30 bg-slate-950/95 px-2 py-1 text-[9px] leading-tight text-blue-100 shadow-lg invisible opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {isSkillChaosMilestone(nextLevel)
          ? `Level ${nextLevel} also gives a guaranteed Chaos Key, and a separate ${LEVEL_CHAOS_CHANCE}% chance of another.`
          : `Each level-up also has a separate ${LEVEL_CHAOS_CHANCE}% chance of a Chaos Key.`}
        {levelBoostNote(chance, nextLevel)}
      </span>
    </div>
  );
};
