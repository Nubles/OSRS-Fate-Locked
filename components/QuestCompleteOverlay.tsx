import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Scroll } from './OsrsIcon';
import { useGame } from '../context/GameContext';
import { describeRollOutcome, type RollOutcomeText } from '../utils/rollOutcomeText';

/**
 * Quest-complete celebration. Listens for `fate:quest-complete` {name} and
 * shows the OSRS wiki reward scroll for that quest with a gold particle burst —
 * the iconic "Congratulations! Quest complete!" moment. Auto-dismisses, or
 * click / Esc to close. Quests with no reward scroll on the wiki fall back to a
 * clean generic celebration (the image hides on error). Under the quest's
 * name it says what the quest's Key roll gave, in the toast's words.
 */
const rewardScrollUrl = (name: string) =>
  `https://oldschool.runescape.wiki/images/${encodeURIComponent(name.replace(/ /g, '_'))}_reward_scroll.png`;

const PARTICLES = Array.from({ length: 14 }, (_, i) => i);

export const QuestCompleteOverlay: React.FC = () => {
  const [quest, setQuest] = useState<string | null>(null);
  const [imgOk, setImgOk] = useState(true);
  const [roll, setRoll] = useState<RollOutcomeText | null>(null);
  const { lastEvent } = useGame();
  // The game event shown before this quest completed: the quest's own roll is the next one.
  const latestEventId = useRef<string | null>(lastEvent?.id ?? null);
  const eventBeforeQuest = useRef<string | null>(null);
  useEffect(() => { latestEventId.current = lastEvent?.id ?? null; }, [lastEvent]);

  useEffect(() => {
    const onComplete = (e: Event) => {
      const name = (e as CustomEvent<{ name?: string }>).detail?.name;
      if (!name) return;
      setImgOk(true);
      setRoll(null);
      eventBeforeQuest.current = latestEventId.current;
      setQuest(name);
    };
    window.addEventListener('fate:quest-complete', onComplete);
    return () => window.removeEventListener('fate:quest-complete', onComplete);
  }, []);

  useEffect(() => {
    if (!quest || roll || !lastEvent || lastEvent.id === eventBeforeQuest.current) return;
    setRoll(describeRollOutcome(lastEvent));
  }, [quest, roll, lastEvent]);

  useEffect(() => {
    if (!quest) return;
    const close = () => setQuest(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(close, 6000);
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(t); };
  }, [quest]);

  if (!quest || typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={() => setQuest(null)}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
      role="dialog" aria-modal="true" aria-label={`${quest} complete${roll ? `. ${roll.text}` : ''}`}
    >
      {/* The qc-* keyframes live in styles.css: adding and removing a <style>
          here restyled the whole page twice per completed quest. */}
      <div className="relative" style={{ animation: 'qc-pop .5s cubic-bezier(.2,.8,.2,1) both' }}>
        {/* gold glow halo */}
        <div className="absolute inset-0 -m-10 rounded-full bg-amber-400/20 blur-2xl" style={{ animation: 'qc-glow 2s ease-in-out infinite' }} />

        {/* particle burst */}
        {PARTICLES.map(i => {
          const a = (i / PARTICLES.length) * Math.PI * 2;
          const dist = 120 + (i % 3) * 40;
          return (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-amber-300"
              style={{
                ['--dx' as any]: `${Math.cos(a) * dist}px`,
                ['--dy' as any]: `${Math.sin(a) * dist}px`,
                animation: `qc-spark ${0.9 + (i % 4) * 0.25}s ease-out forwards`,
                boxShadow: '0 0 8px rgba(252,211,77,0.9)',
              }}
            />
          );
        })}

        {/* card */}
        <div className="relative bg-[#1a160c]/95 border-2 border-amber-500/50 rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.25)] px-8 py-6 max-w-[440px] flex flex-col items-center text-center">
          <button onClick={(e) => { e.stopPropagation(); setQuest(null); }} className="absolute top-2 right-2 text-amber-200/40 hover:text-amber-100" aria-label="Close">
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 text-amber-300 font-bold tracking-wide uppercase text-sm mb-3">
            <Scroll size={16} /> Quest complete!
          </div>
          {imgOk ? (
            <img
              src={rewardScrollUrl(quest)}
              alt={`${quest} reward scroll`}
              className="max-w-[380px] max-h-[300px] object-contain rounded"
              onError={() => setImgOk(false)}
            />
          ) : (
            <div className="py-8 px-6 flex flex-col items-center gap-2 text-amber-100">
              <Scroll size={48} className="text-amber-400/80" />
            </div>
          )}
          <div className="mt-3 text-lg font-bold text-amber-100">{quest}</div>
          {roll && (
            <div className={`mt-1 text-sm font-bold ${roll.won ? 'text-amber-300' : 'text-amber-200/70'}`}>{roll.text}</div>
          )}
          <div className="mt-1 text-[11px] text-amber-200/40">click anywhere to dismiss</div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
