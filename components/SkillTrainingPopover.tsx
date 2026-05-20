import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ExternalLink, X, TrendingUp, BookOpen, ChevronRight } from 'lucide-react';
import { TRAINING_TIPS, getWikiTrainingUrl, xpAtLevel, formatXP } from '../data/trainingTips';

/**
 * Floating popover that appears when the player clicks a red (unmet)
 * skill chip in the Journal. Shows:
 *  - current vs required level
 *  - approx XP needed
 *  - curated training methods for the player's specific level range
 *  - a link to the full OSRS wiki Training guide
 *
 * Rendered via a portal at document.body so it can't be clipped by
 * overflow:hidden scroll containers in the Journal panels.
 */

const POPOVER_WIDTH = 292;

export interface SkillPopoverState {
  skill: string;
  currentLevel: number;
  requiredLevel: number;
  anchorRect: DOMRect;
}

interface Props extends SkillPopoverState {
  onClose: () => void;
}

export const SkillTrainingPopover: React.FC<Props> = ({
  skill,
  currentLevel,
  requiredLevel,
  anchorRect,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', handler, true);
    return () => window.removeEventListener('mousedown', handler, true);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Position the popover. Prefer below the chip; flip above if there's
  // not enough room. Clamp horizontally to stay within the viewport.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const estimatedHeight = 260;

  let left = Math.round(anchorRect.left);
  if (left + POPOVER_WIDTH > vw - 12) left = vw - POPOVER_WIDTH - 12;
  if (left < 8) left = 8;

  const spaceBelow = vh - anchorRect.bottom;
  const showAbove = spaceBelow < estimatedHeight + 8 && anchorRect.top > estimatedHeight;

  const posStyle: React.CSSProperties = {
    position: 'fixed',
    left,
    width: POPOVER_WIDTH,
    zIndex: 9999,
    ...(showAbove
      ? { bottom: Math.round(vh - anchorRect.top + 6) }
      : { top: Math.round(anchorRect.bottom + 6) }),
  };

  // Filter training tips to the player's current → required range only,
  // so we don't show methods they've already outgrown or can't use yet.
  const allTips = TRAINING_TIPS[skill] ?? [];
  const relevantTips = allTips
    .filter(t => t.to > currentLevel && t.from < requiredLevel)
    .slice(0, 5);

  const isQP = skill === 'Quest Points';
  const xpNeeded = isQP ? 0 : Math.max(0, xpAtLevel(requiredLevel) - xpAtLevel(currentLevel));
  const levelsNeeded = Math.max(0, requiredLevel - currentLevel);
  const wikiUrl = isQP
    ? 'https://oldschool.runescape.wiki/w/Quest_points'
    : getWikiTrainingUrl(skill);

  return ReactDOM.createPortal(
    <div
      ref={ref}
      style={posStyle}
      className="rounded-xl border border-white/15 bg-[#181818] shadow-[0_8px_40px_rgba(0,0,0,0.7)] overflow-hidden"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white">{skill}</span>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Level badge */}
          <div className="flex items-center gap-1 font-mono text-xs">
            <span className="text-red-400">{currentLevel}</span>
            <ChevronRight size={10} className="text-gray-600" />
            <span className="text-gray-200">{requiredLevel}</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── XP / levels needed ─────────────────────────────── */}
      {!isQP && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-black/20">
          <span className="text-[10px] text-gray-500">
            {levelsNeeded} level{levelsNeeded !== 1 ? 's' : ''} to go
          </span>
          {xpNeeded > 0 && (
            <span className="text-[10px] font-mono text-amber-400/80">
              ~{formatXP(xpNeeded)} XP
            </span>
          )}
        </div>
      )}

      {/* ── Training methods ───────────────────────────────── */}
      <div className="p-2">
        {isQP ? (
          <div className="px-2 py-3 text-center text-[11px] text-gray-400 italic">
            Complete quests to earn Quest Points.
          </div>
        ) : relevantTips.length > 0 ? (
          <div className="space-y-1">
            {relevantTips.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/5"
              >
                {/* Level range badge */}
                <span className="text-[9px] font-mono text-gray-600 shrink-0 mt-0.5 w-10 text-right">
                  {tip.from}–{tip.to >= 99 ? '99' : tip.to}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-gray-200 leading-snug">{tip.method}</div>
                  {tip.note && (
                    <div className="text-[9px] text-gray-500 mt-0.5 italic">{tip.note}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-2 py-3 text-center text-[11px] text-gray-500 italic">
            No curated tips for this range — see the full guide below.
          </div>
        )}
      </div>

      {/* ── Wiki link ──────────────────────────────────────── */}
      <div className="px-2 pb-2">
        <a
          href={wikiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg
                     bg-blue-900/25 border border-blue-500/25 text-blue-300
                     text-[11px] font-bold hover:bg-blue-900/40 transition-colors"
        >
          <BookOpen size={11} />
          Full Training Guide
          <ExternalLink size={10} />
        </a>
      </div>
    </div>,
    document.body,
  );
};
