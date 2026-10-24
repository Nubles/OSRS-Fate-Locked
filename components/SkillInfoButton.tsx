import React, { Suspense, useRef, useState } from 'react';
import { lazyWithRetry } from '../utils/lazyRetry';

/**
 * The small "i" in a skill card's corner. Pointing at it (or tapping it)
 * shows the card's roll odds in a box beside the card, so the card itself
 * stays in view while you click it to level up. A click pins the box open
 * until you click anywhere else or press Escape. The box loads on first use
 * (components/SkillInfoBox.tsx), keeping the entry chunk small.
 */

const SkillInfoBox = lazyWithRetry(() => import('./SkillInfoBox').then(m => ({ default: m.SkillInfoBox })));

export interface SkillOddsInfo {
  skill: string;
  level: number;
  tier: number;
  /** The next level's Key chance as the roll makes it (utils/keyChance.ts levelUpKeyChance). */
  chance: number | null;
  /** Chunked: the tier cap when the next level is past it, so it rolls nothing. */
  pastCap?: number;
}

interface Props extends SkillOddsInfo {
  variant: 'classic' | 'osrs';
}

const CLASSIC_BUTTON = 'w-3.5 h-3.5 shrink-0 inline-flex items-center justify-center rounded-[3px] border border-white/10 bg-black/35 '
  + 'text-gray-400 font-serif italic font-bold text-[9px] leading-none cursor-pointer '
  + 'hover:text-blue-300 hover:border-blue-400/50 hover:bg-blue-900/35 '
  + 'aria-expanded:text-blue-300 aria-expanded:border-blue-400/50 aria-expanded:bg-blue-900/35 '
  + 'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-blue-400';

export const SkillInfoButton: React.FC<Props> = ({ variant, ...odds }) => {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const open = hover || pinned;
  const boxId = `skill-info-${odds.skill.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={variant === 'osrs' ? 'osrs-skill-info' : CLASSIC_BUTTON}
        aria-label={`${odds.skill} roll odds`}
        aria-expanded={open}
        aria-controls={open ? boxId : undefined}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
        onPointerLeave={() => setHover(false)}
        onClick={(e) => { e.stopPropagation(); setPinned((v) => !v); }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        i
      </button>
      {open && (
        <Suspense fallback={null}>
          <SkillInfoBox {...odds} id={boxId} variant={variant} anchorRef={btnRef} pinned={pinned} onClose={() => setPinned(false)} />
        </Suspense>
      )}
    </>
  );
};

export default SkillInfoButton;
