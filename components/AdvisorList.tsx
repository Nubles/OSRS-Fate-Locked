import React from 'react';
import { BookOpen, Map, ArrowDown, Sparkles, GitBranch } from 'lucide-react';

/**
 * Shared presentational component for the Quest & Region advisors.
 *
 * Renders a ranked list where each row shows:
 *   • a relative impact bar (widest = highest cascade score)
 *   • DIRECT unlock pills  — "+N quests · +N diary tiers" (one step)
 *   • a CASCADE chain line — "↳ +M quests · +K tiers in full chain" when the
 *     downstream total exceeds the direct payoff
 *
 * Two chrome variants: 'strip' (embedded inside the Journal) and 'card'
 * (standalone dashboard widget). Both share identical row rendering so the
 * advisors stay visually consistent and future tweaks land in one place.
 */

export interface AdvisorItem {
  id: string;
  title: string;
  /** Optional secondary label, e.g. "5 QP". */
  meta?: string;
  directQuests: string[];
  directDiaries: string[];
  cascadeQuests: string[];
  cascadeDiaries: string[];
  /** Immediate payoff (drives the pills). */
  score: number;
  /** Full downstream potential (drives the bar + ranking). */
  cascadeScore: number;
}

type Accent = 'violet' | 'amber' | 'cyan';

const ACCENTS: Record<Accent, {
  icon: string; title: string; bar: string; grad: string;
  arrowHover: string; rowTitle: string; ring: string;
}> = {
  violet: {
    icon: 'text-violet-400', title: 'text-violet-300', bar: 'bg-violet-500/60',
    grad: 'from-violet-900/8', arrowHover: 'group-hover:text-violet-400',
    rowTitle: 'text-gray-100', ring: 'focus-visible:ring-violet-400/60',
  },
  amber: {
    icon: 'text-amber-400', title: 'text-amber-300', bar: 'bg-amber-500/55',
    grad: 'from-amber-900/8', arrowHover: 'group-hover:text-amber-400',
    rowTitle: 'text-amber-200', ring: 'focus-visible:ring-amber-400/60',
  },
  cyan: {
    icon: 'text-cyan-400', title: 'text-cyan-300', bar: 'bg-cyan-500/55',
    grad: 'from-cyan-900/8', arrowHover: 'group-hover:text-cyan-400',
    rowTitle: 'text-cyan-100', ring: 'focus-visible:ring-cyan-400/60',
  },
};

interface Props {
  items: AdvisorItem[];
  accent: Accent;
  heading: string;
  subheading?: string;
  icon: React.ReactNode;
  /** Right-aligned caption in the header (e.g. "by unlock count"). */
  caption?: string;
  maxShown?: number;
  maxNames?: number;
  emptyLabel: string;
  onItemClick: (id: string) => void;
  variant?: 'card' | 'strip';
}

export const AdvisorList: React.FC<Props> = ({
  items, accent, heading, subheading, icon, caption,
  maxShown = 5, maxNames = 4, emptyLabel, onItemClick, variant = 'strip',
}) => {
  const c = ACCENTS[accent];
  const top = items.slice(0, maxShown);
  const topScore = top[0]?.cascadeScore || top[0]?.score || 1;

  const Header = (
    <div className="flex items-center gap-2 mb-2 px-1">
      <span className={c.icon} aria-hidden>{icon}</span>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${c.title}`}>
        {heading}
      </span>
      {caption && <span className="text-[10px] text-gray-600 font-mono">{caption}</span>}
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );

  const Body = top.length === 0 ? (
    <p className="text-[11px] text-gray-600 italic text-center py-3">{emptyLabel}</p>
  ) : (
    <>
      {subheading && (
        <p className="text-[10px] text-gray-600 mb-2 px-1">{subheading}</p>
      )}
      <div className="space-y-1.5" role="list">
        {top.map((item, idx) => {
          const barPct = topScore > 0 ? Math.round(((item.cascadeScore || item.score) / topScore) * 100) : 0;
          const hasDirect = item.score > 0;
          // Only surface the chain line when it adds info beyond the direct pills.
          const extraQuests = Math.max(0, item.cascadeQuests.length - item.directQuests.length);
          const extraDiaries = Math.max(0, item.cascadeDiaries.length - item.directDiaries.length);
          const hasChain = extraQuests > 0 || extraDiaries > 0;
          const previewNames = item.cascadeQuests.slice(0, maxNames);

          const aria = hasDirect
            ? `${item.title}: unlocks ${item.directQuests.length} quests and ${item.directDiaries.length} diary tiers directly` +
              (hasChain ? `, ${item.cascadeQuests.length} quests and ${item.cascadeDiaries.length} tiers across the full chain` : '')
            : `${item.title}: available to complete, no new unlocks`;

          return (
            <button
              key={item.id}
              role="listitem"
              onClick={() => onItemClick(item.id)}
              aria-label={aria}
              style={{ animationDelay: `${idx * 40}ms` }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 bg-[#1a1a1a] border border-white/5 rounded-md hover:bg-white/5 hover:border-white/15 transition-all text-left group outline-none focus-visible:ring-2 ${c.ring} animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both`}
            >
              {/* Rank */}
              <span className="text-[9px] font-mono font-bold text-gray-600 w-4 shrink-0 text-right" aria-hidden>
                {idx + 1}.
              </span>

              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-semibold truncate ${c.rowTitle}`}>
                    {item.title}
                  </span>
                  {item.meta && (
                    <span className="text-[9px] text-gray-600 font-mono shrink-0">{item.meta}</span>
                  )}
                </div>

                {hasDirect ? (
                  <>
                    {/* Impact bar (relative to top scorer) */}
                    <div
                      className="h-[3px] bg-black/40 rounded-full overflow-hidden mb-1"
                      title={`Cascade impact score: ${item.cascadeScore} (quests count double)`}
                    >
                      <div className={`h-full ${c.bar} rounded-full transition-all duration-500`} style={{ width: `${barPct}%` }} />
                    </div>

                    {/* Direct unlock pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.directQuests.length > 0 && (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-900/25 text-blue-300 border border-blue-500/25">
                          <BookOpen size={8} aria-hidden />
                          +{item.directQuests.length} quest{item.directQuests.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {item.directDiaries.length > 0 && (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-900/25 text-green-300 border border-green-500/25">
                          <Map size={8} aria-hidden />
                          +{item.directDiaries.length} diary tier{item.directDiaries.length !== 1 ? 's' : ''}
                        </span>
                      )}

                      {/* Preview a few names from the cascade */}
                      {previewNames.map((n) => (
                        <span key={n} className="text-[9px] text-gray-600 truncate max-w-[80px]" title={n}>
                          {n}
                        </span>
                      ))}
                      {item.cascadeQuests.length > maxNames && (
                        <span className="text-[9px] text-gray-700 shrink-0">
                          +{item.cascadeQuests.length - maxNames} more
                        </span>
                      )}
                    </div>

                    {/* Cascade chain line — only when it beats the direct payoff */}
                    {hasChain && (
                      <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-500">
                        <GitBranch size={8} className={c.icon} aria-hidden />
                        <span>
                          full chain: {item.cascadeQuests.length} quest{item.cascadeQuests.length !== 1 ? 's' : ''}
                          {item.cascadeDiaries.length > 0 && ` · ${item.cascadeDiaries.length} tier${item.cascadeDiaries.length !== 1 ? 's' : ''}`}
                          <span className="text-gray-600"> ({extraQuests > 0 && `+${extraQuests} downstream`}{extraQuests > 0 && extraDiaries > 0 && ', '}{extraDiaries > 0 && `+${extraDiaries} tiers`})</span>
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[9px] text-gray-700 italic">
                    No new unlocks — but available to complete
                  </p>
                )}
              </div>

              <ArrowDown
                size={11}
                aria-hidden
                className={`text-gray-600 ${c.arrowHover} rotate-[-45deg] transition-all shrink-0`}
              />
            </button>
          );
        })}
      </div>

      {items.length > maxShown && (
        <p className="text-[9px] text-gray-700 text-right mt-1.5 pr-1">
          <Sparkles size={8} className="inline mr-0.5" aria-hidden />
          {items.length - maxShown} more — scroll to find them
        </p>
      )}
    </>
  );

  if (variant === 'card') {
    return (
      <section className="bg-[#151515] border border-white/10 rounded-xl p-4" aria-label={heading}>
        {Header}
        {Body}
      </section>
    );
  }

  return (
    <div className="px-3 pt-3">
      <section className={`rounded-lg border border-white/5 bg-gradient-to-r ${c.grad} to-transparent p-2.5`} aria-label={heading}>
        {Header}
        {Body}
      </section>
    </div>
  );
};
