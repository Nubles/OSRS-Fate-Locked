import React from 'react';
import { Sparkles, ArrowDown } from 'lucide-react';

/**
 * Pinned strip surfaced at the top of every Journal sub-tab (Quests /
 * Diaries / CAs) when the player has an "All" filter active. Lists up to N
 * items the player can act on right now so they don't have to scroll a long
 * list to find the doable ones.
 *
 * Each card is a compact button that delegates back to the parent for
 * navigation/completion (the parent supplies `onItemClick`). Kept dumb on
 * purpose: the tab decides what "actionable" means for its content type.
 */

export interface NextUpItem {
  id: string;
  title: string;
  subtitle?: string;
  tierLabel?: string;
  tierColorClass?: string;
}

interface JournalNextUpStripProps {
  items: NextUpItem[];
  /** Plural label shown when zero items are surfaced, e.g. "quests", "diaries". */
  noun: string;
  /** Tailwind classes for the accent — matches the parent tab's theme. */
  accent: string;
  onItemClick: (id: string) => void;
}

export const JournalNextUpStrip: React.FC<JournalNextUpStripProps> = ({
  items, noun, accent, onItemClick,
}) => {
  if (items.length === 0) {
    // Don't render an empty strip — players who've maxed a tab shouldn't see a
    // dangling "no doable X" notice, the list itself communicates that.
    return null;
  }

  const textAccent = accent.split(' ').find((c) => c.startsWith('text-')) || 'text-gray-300';

  return (
    <div className="px-3 pt-3">
      <div className="rounded-lg border border-white/5 bg-gradient-to-r from-amber-900/5 to-transparent p-2.5">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Sparkles size={11} className={textAccent} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${textAccent}`}>
            Ready now
          </span>
          <span className="text-[10px] text-gray-600 font-mono">
            top {items.length} actionable {noun}
          </span>
          <div className="flex-1 h-px bg-white/5"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => onItemClick(it.id)}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-[#1a1a1a] border border-white/5 rounded-md hover:bg-white/5 hover:border-white/15 transition-all text-left group"
            >
              {it.tierLabel && (
                <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-current ${it.tierColorClass || textAccent} shrink-0`}>
                  {it.tierLabel}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-200 truncate">{it.title}</div>
                {it.subtitle && (
                  <div className="text-[10px] text-gray-500 truncate">{it.subtitle}</div>
                )}
              </div>
              <ArrowDown size={11} className="text-gray-600 group-hover:text-gray-300 rotate-[-45deg] transition-all shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
