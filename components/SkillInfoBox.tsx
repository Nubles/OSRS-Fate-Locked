import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatKeyPercent, skillLevelKeyChance } from '../utils/keyRoll';
import { isSkillChaosMilestone, LEVEL_CHAOS_CHANCE, SKILL_CHAOS_MILESTONES } from '../config/economy';
import { tierCap } from '../utils/chunkedFate';
import type { SkillOddsInfo } from './SkillInfoButton';
import './skill-info.css';

/**
 * The box a skill's info button opens (components/SkillInfoButton.tsx),
 * loaded on first use. It sits beside the card, not over it: to the right,
 * or to the left when there's no room. While pinned, a click anywhere else,
 * Escape or a scroll closes it.
 */

const GAP = 6;

interface BoxProps extends SkillOddsInfo {
  id: string;
  variant: 'classic' | 'osrs';
  anchorRef: React.RefObject<HTMLElement | null>;
  pinned: boolean;
  onClose: () => void;
}

export const SkillInfoBox: React.FC<BoxProps> = ({ id, variant, anchorRef, pinned, onClose, ...odds }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const place = useCallback(() => {
    const el = anchorRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!el || !box) return;
    const card = (el.closest('[data-skill-card]') ?? el).getBoundingClientRect();
    let left = card.right + GAP;
    if (left + box.width > window.innerWidth - 4) left = card.left - box.width - GAP;
    const top = Math.max(4, Math.min(window.innerHeight - box.height - 4, card.top));
    setPos({ left: Math.max(4, left), top });
  }, [anchorRef]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    if (!pinned) return;
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || boxRef.current?.contains(target)) return;
      onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [pinned, onClose, anchorRef]);

  return createPortal(
    <div
      ref={boxRef}
      id={id}
      role="tooltip"
      className={variant === 'osrs' ? 'osrs-skill-info-box' : 'skill-info-classic-box'}
      style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      <SkillOddsDetails {...odds} variant={variant} />
    </div>,
    document.body,
  );
};

interface DetailsProps extends SkillOddsInfo {
  variant: 'classic' | 'osrs';
}

/**
 * What a skill's info button shows: the next
 * level's Key and Chaos Key odds and how far the tier reaches. Only for skills
 * that can still level, so there is always a next level.
 */
export const SkillOddsDetails: React.FC<DetailsProps> = ({ skill, level, tier, boost = 0, pastCap, variant }) => {
  const nextLevel = level + 1;
  const base = skillLevelKeyChance(nextLevel);
  const milestone = isSkillChaosMilestone(nextLevel);
  const nextMilestone = SKILL_CHAOS_MILESTONES.find((m) => m > nextLevel);
  const rows: [string, string][] = pastCap !== undefined
    ? [['Key chance', 'no roll'], ['Why', `past this tier's cap of level ${pastCap}`]]
    : [
      ['Key chance', formatKeyPercent(Math.min(100, base + boost))],
      ...(boost > 0 ? [['From achievements', `+${boost}%`] as [string, string]] : []),
      ['Chaos Key', milestone ? `guaranteed, plus ${LEVEL_CHAOS_CHANCE}% for another` : `${LEVEL_CHAOS_CHANCE}% chance`],
      ...(!milestone && nextMilestone ? [['Next free Chaos', `level ${nextMilestone}`] as [string, string]] : []),
    ];
  rows.push(['Methods', `up to level ${tierCap(tier)}`]);

  if (variant === 'osrs') {
    return (
      <>
        <div>{skill}: next level {nextLevel}</div>
        {rows.map(([k, v]) => <div key={k}>{k}: {v}</div>)}
      </>
    );
  }
  return (
    <>
      <div className="skill-info-classic-head">{skill} <span>&middot; Next Lv {nextLevel}</span></div>
      <dl>
        {rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}
      </dl>
    </>
  );
};
