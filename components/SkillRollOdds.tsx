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

// One line where the card is wide enough. On a narrow card (a phone, or a
// laptop at 1280 wide) the line wraps instead of running past the card's
// edge, which cut the end off: "Next Lv 52 · 11.7% Ke". The negative margin
// lets it use the card's own padding (p-2 in Dashboard.tsx) before it wraps,
// as it did when it could not wrap, so a wider card keeps it on one line.
// The chance and its word stay together (a no-break space), so a wrapped
// line reads "Next Lv 52 ·" then "11.7% Key", never a lone "Key".
const LINE = 'pointer-events-auto text-[8px] mt-0.5 -mr-2 leading-none';

export const SkillRollOdds: React.FC<Props> = ({ currentLevel, isUnlocked, descriptionId, chance, pastCap, hoverBox = false }) => {
  if (!isUnlocked || currentLevel >= 99) return null;

  const nextLevel = currentLevel + 1;
  if (pastCap !== undefined || chance === null) {
    return (
      <div className={`${LINE} text-gray-400`}>
        Next Lv {nextLevel} &middot; no&nbsp;roll
        <span id={descriptionId} role={hoverBox ? 'tooltip' : undefined} className={hoverBox ? HOVER_BOX : 'sr-only'}>
          {pastCap !== undefined ? chunkedPastCapText(pastCap) : 'This level rolls no Key.'}
        </span>
      </div>
    );
  }

  return (
    <div className={`${LINE} text-blue-300/80`}>
      Next Lv {nextLevel} &middot; {formatKeyPercent(chance)}&nbsp;Key
      <span id={descriptionId} role={hoverBox ? 'tooltip' : undefined} className={hoverBox ? HOVER_BOX : 'sr-only'}>
        {isSkillChaosMilestone(nextLevel)
          ? `Level ${nextLevel} also gives a guaranteed Chaos Key, and a separate ${LEVEL_CHAOS_CHANCE}% chance of another.`
          : `Each level-up also has a separate ${LEVEL_CHAOS_CHANCE}% chance of a Chaos Key.`}
        {levelBoostNote(chance, nextLevel)}
      </span>
    </div>
  );
};
