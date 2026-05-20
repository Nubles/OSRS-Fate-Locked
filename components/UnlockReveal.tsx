import React, { useEffect, useState, useRef } from 'react';
import {
  CheckCircle2, X, ChevronRight,
  BookOpen, Map, Sparkles, Swords,
} from 'lucide-react';
import { UnlockRevealData } from '../hooks/useUnlockReveal';

/**
 * Slide-in panel (bottom-right, fixed) that appears after a quest
 * completion or region / boss unlock. Summarises what new content just
 * opened up so the player has immediate feedback without having to
 * manually scan the journal.
 *
 * Auto-dismisses after AUTO_DISMISS_MS with an animated countdown bar.
 * The "View Quests / Diaries" CTA switches the journal to the right tab
 * and closes the reveal.
 */

const AUTO_DISMISS_MS = 9_000;
const MAX_LIST = 5; // items per section before "N more"

interface Props {
  data: UnlockRevealData;
  onDismiss: () => void;
  onViewJournal: (tab: 'QUESTS' | 'DIARIES') => void;
}

export const UnlockReveal: React.FC<Props> = ({ data, onDismiss, onViewJournal }) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slide in on next frame so the transition actually plays.
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 16);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss.
  useEffect(() => {
    timerRef.current = window.setTimeout(handleDismiss, AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  function handleDismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    window.setTimeout(onDismiss, 280); // wait for slide-out
  }

  const hasQuests   = data.newQuestsAvailable.length > 0;
  const hasDiaries  = data.newDiaryTiersAvailable.length > 0;
  const hasRegions  = data.newRegions.length > 0;
  const hasBosses   = data.newBosses.length > 0;
  const hasNewContent = hasQuests || hasDiaries || hasRegions || hasBosses;

  // Build a compact trigger line shown in the header.
  const triggerLabel =
    data.completedQuests.length > 0
      ? data.completedQuests.length === 1
          ? data.completedQuests[0]
          : `${data.completedQuests[0]} +${data.completedQuests.length - 1} more`
      : data.newRegions.length > 0
          ? data.newRegions.join(', ')
          : data.newBosses[0] ?? 'Content unlocked';

  const triggerSuffix =
    data.completedQuests.length > 0 ? ' complete!'
    : data.newRegions.length > 0    ? ' unlocked!'
    : '';

  return (
    <div
      className={`
        fixed bottom-5 right-5 z-[9997] w-[22rem]
        transition-transform duration-[280ms] ease-out
        ${visible ? 'translate-x-0' : 'translate-x-[115%]'}
      `}
    >
      <div className="bg-[#191919] border border-white/15 rounded-xl shadow-[0_12px_48px_rgba(0,0,0,0.8)] overflow-hidden">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-gradient-to-r from-green-900/30 to-transparent border-b border-white/8">
          <CheckCircle2 size={16} className="text-green-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-green-300 leading-snug">
              <span className="truncate block">{triggerLabel}</span>
              {triggerSuffix && (
                <span className="text-green-400/80">{triggerSuffix}</span>
              )}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {hasNewContent ? 'New content now available' : 'Progress recorded'}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-600 hover:text-gray-300 transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>

        {/* ── New quests ──────────────────────────────────── */}
        {hasQuests && (
          <Section
            icon={<BookOpen size={11} className="text-blue-400" />}
            label={`${data.newQuestsAvailable.length} quest${data.newQuestsAvailable.length !== 1 ? 's' : ''} available`}
            labelColor="text-blue-300"
            items={data.newQuestsAvailable.map(q => q.name)}
            chevronColor="text-blue-600"
          />
        )}

        {/* ── New diary tiers ─────────────────────────────── */}
        {hasDiaries && (
          <Section
            icon={<Map size={11} className="text-green-400" />}
            label={`${data.newDiaryTiersAvailable.length} diary tier${data.newDiaryTiersAvailable.length !== 1 ? 's' : ''} available`}
            labelColor="text-green-300"
            items={data.newDiaryTiersAvailable}
            chevronColor="text-green-600"
          />
        )}

        {/* ── New regions ─────────────────────────────────── */}
        {hasRegions && (
          <div className="px-3 py-2 border-b border-white/5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={11} className="text-amber-400" />
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                {data.newRegions.length === 1 ? 'Region' : 'Regions'} unlocked
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {data.newRegions.map(r => (
                <span
                  key={r}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/25 text-amber-400 border border-amber-500/30 font-medium"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── New bosses ──────────────────────────────────── */}
        {hasBosses && (
          <div className="px-3 py-2 border-b border-white/5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Swords size={11} className="text-red-400" />
              <span className="text-[10px] font-bold text-red-300 uppercase tracking-wide">
                {data.newBosses.length === 1 ? 'Boss' : 'Bosses'} unlocked
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {data.newBosses.map(b => (
                <span
                  key={b}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-500/25 font-medium"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Nothing new opened (just a completion) ──────── */}
        {!hasNewContent && (
          <div className="px-3 py-3 text-[11px] text-gray-600 italic">
            No new quests or diaries unlocked yet.
          </div>
        )}

        {/* ── CTA buttons ─────────────────────────────────── */}
        {hasNewContent && (
          <div className="px-3 py-2 flex gap-2">
            {hasQuests && (
              <button
                onClick={() => { onViewJournal('QUESTS'); handleDismiss(); }}
                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-blue-900/25 border border-blue-500/25 text-blue-300 hover:bg-blue-900/45 transition-colors"
              >
                View Quests →
              </button>
            )}
            {hasDiaries && (
              <button
                onClick={() => { onViewJournal('DIARIES'); handleDismiss(); }}
                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-green-900/25 border border-green-500/25 text-green-300 hover:bg-green-900/45 transition-colors"
              >
                View Diaries →
              </button>
            )}
          </div>
        )}

        {/* ── Auto-dismiss countdown bar ───────────────────── */}
        <div className="h-[2px] bg-black/30">
          <div
            className="h-full bg-green-600/50 origin-left"
            style={{
              animation: `shrink-width ${AUTO_DISMISS_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>

      {/* Inline keyframe — avoids needing a tailwind.config change */}
      <style>{`
        @keyframes shrink-width { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </div>
  );
};

/* ── Shared section sub-component ───────────────────────────────────── */
interface SectionProps {
  icon: React.ReactNode;
  label: string;
  labelColor: string;
  items: string[];
  chevronColor: string;
}

const Section: React.FC<SectionProps> = ({ icon, label, labelColor, items, chevronColor }) => (
  <div className="px-3 py-2 border-b border-white/5">
    <div className="flex items-center gap-1.5 mb-1.5">
      {icon}
      <span className={`text-[10px] font-bold uppercase tracking-wide ${labelColor}`}>
        {label}
      </span>
    </div>
    <div className="space-y-0.5">
      {items.slice(0, MAX_LIST).map((name, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-300">
          <ChevronRight size={9} className={`${chevronColor} shrink-0`} />
          <span className="truncate">{name}</span>
        </div>
      ))}
      {items.length > MAX_LIST && (
        <p className="text-[10px] text-gray-600 pl-3.5">
          +{items.length - MAX_LIST} more
        </p>
      )}
    </div>
  </div>
);
