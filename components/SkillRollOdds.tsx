import React from 'react';
import { formatKeyPercent, skillLevelKeyChance } from '../utils/keyRoll';
import { isSkillChaosMilestone, LEVEL_CHAOS_CHANCE } from '../config/economy';

/** Why a Chunked level past the tier cap rolls nothing; the skill cards share it. */
export const chunkedPastCapText = (cap: number): string =>
  `Past this tier's cap of level ${cap}. In Chunked you can still log it, but levels past the cap roll no Keys until a Key or a Breakthrough opens the next tier.`;

interface Props {
  currentLevel: number;
  isUnlocked: boolean;
  descriptionId: string;
  /** Extra Key chance from the run's level-up milestone achievements. */
  boost?: number;
  /** Chunked: the skill's tier cap when the next level is past it, so it rolls nothing. */
  pastCap?: number;
  /**
   * The Settings option for the older look: the explanation shows over the
   * whole card on hover or keyboard focus. Off, it stays for screen readers
   * and the card's info button (SkillInfoButton) shows the odds instead.
   */
  hoverBox?: boolean;
}

// Fills the card (so nothing is cut off) and shows on hover or keyboard focus
// only, so it doesn't stay up after a mouse click.
const HOVER_BOX = 'pointer-events-none absolute inset-1 z-40 flex items-center whitespace-normal rounded border border-blue-400/30 bg-slate-950/95 px-2 py-1 text-[9px] leading-tight text-blue-100 shadow-lg invisible opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100';

export const SkillRollOdds: React.FC<Props> = ({ currentLevel, isUnlocked, descriptionId, boost = 0, pastCap, hoverBox = false }) => {
  if (!isUnlocked || currentLevel >= 99) return null;

  const nextLevel = currentLevel + 1;
  if (pastCap !== undefined) {
    return (
      <div className="pointer-events-auto text-[8px] text-gray-400 mt-0.5 leading-none whitespace-nowrap">
        Next Lv {nextLevel} &middot; no roll
        <span id={descriptionId} role={hoverBox ? 'tooltip' : undefined} className={hoverBox ? HOVER_BOX : 'sr-only'}>
          {chunkedPastCapText(pastCap)}
        </span>
      </div>
    );
  }
  const chance = formatKeyPercent(Math.min(100, skillLevelKeyChance(nextLevel) + boost));

  return (
    <div
      className="pointer-events-auto text-[8px] text-blue-300/80 mt-0.5 leading-none whitespace-nowrap"
    >
      Next Lv {nextLevel} &middot; {chance} Key
      <span id={descriptionId} role={hoverBox ? 'tooltip' : undefined} className={hoverBox ? HOVER_BOX : 'sr-only'}>
        {isSkillChaosMilestone(nextLevel)
          ? `Level ${nextLevel} also gives a guaranteed Chaos Key, and a separate ${LEVEL_CHAOS_CHANCE}% chance of another.`
          : `Each level-up also has a separate ${LEVEL_CHAOS_CHANCE}% chance of a Chaos Key.`}
        {boost > 0 && ` Your achievements add ${boost}% to the Key chance.`}
      </span>
    </div>
  );
};
