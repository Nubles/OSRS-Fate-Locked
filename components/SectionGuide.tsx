import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

/**
 * A small "?" button that opens a short popover explaining a section: what it
 * offers and what you can do. Content lives in GUIDES, keyed by section id, so
 * adding a guide anywhere is a one-liner: <SectionGuide id="WORLD" />.
 */

interface Guide { title: string; blurb: string; bullets: string[] }

export const GUIDES: Record<string, Guide> = {
  // ── Dashboard tabs ──────────────────────────────────────────────────────
  CHARACTER: {
    title: 'Character',
    blurb: 'Your gear and skills — and the tools to plan and theorycraft them.',
    bullets: [
      'Spend Omni-keys to upgrade equipment slots and skill tiers (the paper-doll & skill grid).',
      'Equipment Lab → Tiers: see gear progress and plan a target loadout + its Omni-key cost.',
      'Equipment Lab → Gear: equip real OSRS items (gated by your unlocked tier) and see their stats.',
      'Equipment Lab → DPS: pick a monster and get max hit, accuracy, DPS and time-to-kill.',
    ],
  },
  WORLD: {
    title: 'World',
    blurb: 'Everywhere fate has let you travel — on the real OSRS map.',
    bullets: [
      'See which regions and sub-areas you’ve unlocked, lit up on the world map.',
      'Pan and zoom the map; hover for tile/chunk coordinates.',
      'Track region mastery per continent and what’s left to unlock.',
    ],
  },
  ACTIVITIES: {
    title: 'Activities & Utility',
    blurb: 'The content fate can grant beyond skills and regions.',
    bullets: [
      'Browse your unlocked bosses, minigames, guilds, storage, mobility and more.',
      'Each is unlocked by spending keys on its table in Spend Keys.',
      'Use the Kill Planner (header) to score your DPS against unlocked bosses.',
    ],
  },
  JOURNAL: {
    title: 'Journal',
    blurb: 'Quests, Achievement Diaries and Combat Achievements — your key-earning to-do list.',
    bullets: [
      'Tick off quests, diary tiers and CA tasks as you complete them in-game.',
      'Completing content rolls for keys (the core way to earn them).',
      'The “Do this next” banner suggests the highest-impact thing to tackle.',
    ],
  },
  COLLECTION: {
    title: 'Collection Log',
    blurb: 'Your unique drops — each new one is a chance at a key.',
    bullets: [
      'Log new unique items as you obtain them.',
      'Every newly-logged item rolls for a key (20% chance).',
      'Track collection progress across bosses and activities.',
    ],
  },

  // ── Equipment Lab ───────────────────────────────────────────────────────
  EQUIPMENT_LAB: {
    title: 'Equipment Lab',
    blurb: 'Three tools in one for your gear.',
    bullets: [
      'Tiers — your fate-locked gear tiers; click a slot for its ladder, or Plan a target loadout.',
      'Gear — equip real OSRS items (limited to your unlocked tier) and read their combined stats.',
      'DPS — choose a style, prayers and potion, pick a monster, and get max hit / DPS / TTK.',
    ],
  },

  // ── Left control panel ──────────────────────────────────────────────────
  FARM: {
    title: 'Farm Keys',
    blurb: 'Where you earn keys — the currency fate runs on.',
    bullets: [
      'Roll slayer tasks, clue scrolls and other sources for a chance at a key.',
      'Higher-effort content has better key odds.',
      'Fate Points build on failed rolls; max them for a guaranteed pity key.',
    ],
  },
  SPEND: {
    title: 'Spend Keys',
    blurb: 'The gacha — spend keys to let fate unlock content at random.',
    bullets: [
      'Pick a category and spend a key; fate reveals a random locked item from it.',
      'Omni-keys upgrade gear/skill tiers; Chaos keys unlock from any category.',
      'Visit the Void Altar to perform rituals with your Fate Points.',
    ],
  },
  LOG: {
    title: 'History',
    blurb: 'A verifiable log of every roll, unlock and ritual.',
    bullets: [
      'Review your full run history, newest first.',
      'Each entry is hash-chained so the run can be verified (see Share Run).',
    ],
  },

  JOURNAL_SUMMARY: {
    title: 'Journal Summary',
    blurb: 'A glance at your key-earning progress and what to do next.',
    bullets: [
      'See quests/diaries/CAs ready to complete at a glance.',
      'The “Do this next” banner picks the highest-impact available action.',
      'Click a row to jump to that journal tab.',
    ],
  },
};

interface Props { id: string; className?: string }

export const SectionGuide: React.FC<Props> = ({ id, className }) => {
  const guide = GUIDES[id];
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEscapeKey(() => setOpen(false), open);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const W = 288;
    const left = Math.min(Math.max(8, r.right - W), window.innerWidth - W - 8);
    const top = Math.min(r.bottom + 6, window.innerHeight - 12);
    setPos({ top, left });
  }, [open]);

  if (!guide) return null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`text-gray-500 hover:text-amber-300 transition-colors ${className ?? ''}`}
        title={`About: ${guide.title}`}
        aria-label={`Guide: ${guide.title}`}
      >
        <HelpCircle size={14} />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[9990]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9991] w-72 bg-[#1b1b1b] border border-white/15 rounded-xl shadow-[0_12px_48px_rgba(0,0,0,0.7)] p-3.5 animate-in fade-in zoom-in-95 duration-150"
            style={{ top: pos.top, left: pos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2 mb-2">
              <HelpCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-[12px] font-bold text-white leading-tight">{guide.title}</h4>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{guide.blurb}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-300 shrink-0" aria-label="Close"><X size={13} /></button>
            </div>
            <ul className="space-y-1.5">
              {guide.bullets.map((b, i) => (
                <li key={i} className="text-[11px] text-gray-300 leading-relaxed flex gap-1.5">
                  <span className="text-amber-500/70 shrink-0">›</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </>,
        document.body,
      )}
    </>
  );
};
