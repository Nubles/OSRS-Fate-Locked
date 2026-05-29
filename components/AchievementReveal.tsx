import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, X } from 'lucide-react';
import { Achievement } from '../utils/achievements';
import { ACHIEVEMENT_ICON } from './AchievementsModal';
import { usePortalHost } from '../hooks/usePortalHost';

/**
 * Celebratory slide-in (top-right) fired when one or more achievements are
 * newly earned. Sits at the top so it never collides with the bottom-right
 * UnlockReveal / ToastNotification. Auto-dismisses with a countdown bar; the
 * "View all" CTA opens the achievements modal.
 */

const AUTO_DISMISS_MS = 8_000;
const MAX_LIST = 4;

interface Props {
  data: Achievement[];
  onDismiss: () => void;
  onView: () => void;
}

export const AchievementReveal: React.FC<Props> = ({ data, onDismiss, onView }) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 16);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    timerRef.current = window.setTimeout(handleDismiss, AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const host = usePortalHost('reveal-top');

  function handleDismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    window.setTimeout(onDismiss, 280);
  }

  const headline =
    data.length === 1 ? 'Achievement unlocked!' : `${data.length} achievements unlocked!`;

  if (!host) return null;

  return createPortal(
    <div
      className={`
        pointer-events-auto w-[20rem]
        transition-transform duration-[280ms] ease-out
        ${visible ? 'translate-x-0' : 'translate-x-[120%]'}
      `}
    >
      <div className="bg-[#191919] border border-amber-500/30 rounded-xl shadow-[0_12px_48px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-gradient-to-r from-amber-900/40 to-transparent border-b border-white/8">
          <Trophy size={16} className="text-amber-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-amber-300 leading-snug">{headline}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Milestone reached</p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-600 hover:text-gray-300 transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>

        {/* Earned list */}
        <div className="px-3 py-2 space-y-1.5">
          {data.slice(0, MAX_LIST).map((a) => {
            const Icon = ACHIEVEMENT_ICON[a.icon] ?? Trophy;
            return (
              <div key={a.id} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
                  <Icon size={13} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-amber-200 truncate">{a.title}</p>
                  <p className="text-[9px] text-gray-500 truncate">{a.description}</p>
                </div>
              </div>
            );
          })}
          {data.length > MAX_LIST && (
            <p className="text-[10px] text-gray-600 pl-9">+{data.length - MAX_LIST} more</p>
          )}
        </div>

        {/* CTA */}
        <div className="px-3 pb-2.5">
          <button
            onClick={() => { onView(); handleDismiss(); }}
            className="w-full text-[10px] font-bold py-1.5 rounded-lg bg-amber-900/30 border border-amber-500/30 text-amber-300 hover:bg-amber-900/50 transition-colors"
          >
            View all achievements →
          </button>
        </div>

        {/* Countdown */}
        <div className="h-[2px] bg-black/30">
          <div
            className="h-full bg-amber-500/50 origin-left"
            style={{ animation: `shrink-width ${AUTO_DISMISS_MS}ms linear forwards` }}
          />
        </div>
      </div>

      <style>{`@keyframes shrink-width { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>,
    host,
  );
};
