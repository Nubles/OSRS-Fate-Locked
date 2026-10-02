import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { SKILLS_LIST } from '../data/items';
import { DROP_RATES } from '../config/rules';
import { DropSource } from '../types';

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
    blurb: 'Your gear and skills, and tools to plan them.',
    bullets: [
      'Spend an Omni-Key on a gear slot or skill here to unlock it or raise its tier by one.',
      'Equipment Lab → Tiers: your gear tiers, and Plan for a target loadout and its Omni-Key cost.',
      'Equipment Lab → Gear: equip real OSRS items (up to your unlocked tier) and see their stats.',
      'Equipment Lab → DPS: pick a monster and get max hit, accuracy, DPS and time to kill.',
    ],
  },
  WORLD: {
    title: 'World',
    blurb: 'Where you can go, on the OSRS world map.',
    bullets: [
      'See the areas you’ve unlocked, lit up on the world map.',
      'Pan and zoom the map; hover for tile and chunk coordinates.',
      'The list view counts the areas you hold in each region.',
    ],
  },
  ACTIVITIES: {
    title: 'Activities & Utility',
    blurb: 'Everything else Keys unlock: bosses, minigames, guilds, transport and more.',
    bullets: [
      'Browse your unlocked bosses, minigames, guilds, storage, transport and more.',
      'Unlock each with a Key on its table in Spend Keys, or pick one here with an Omni-Key.',
      'Use the Kill Planner to score your DPS against the bosses you’ve unlocked.',
    ],
  },
  JOURNAL: {
    title: 'Journal',
    blurb: 'Quests, Achievement Diaries and Combat Achievements: tick them off to roll for Keys.',
    bullets: [
      'Tick off quests, diary tasks and Combat Achievement tasks as you complete them in game.',
      'Each one you tick rolls once for a Key.',
      'The “Do this next” banner suggests the highest-impact thing to tackle.',
    ],
  },
  COLLECTION: {
    title: 'Collection Log',
    blurb: 'Your unique drops. Each new one rolls for a Key.',
    bullets: [
      'Log new unique items as you get them.',
      `Every newly logged item rolls for a Key (${DROP_RATES[DropSource.COLLECTION_LOG]}% chance).`,
      'Track your progress across bosses and activities.',
    ],
  },

  // ── Equipment Lab ───────────────────────────────────────────────────────
  EQUIPMENT_LAB: {
    title: 'Equipment Lab',
    blurb: 'Three tools in one for your gear.',
    bullets: [
      'Tiers: your gear tiers. Click a slot for its ladder, or Plan a target loadout.',
      'Gear: equip real OSRS items (up to your unlocked tier) and read their combined stats.',
      'DPS: choose a style, prayers and a potion, pick a monster, and get max hit, DPS and time to kill.',
    ],
  },

  // ── Left control panel ──────────────────────────────────────────────────
  FARM: {
    title: 'Farm Keys',
    blurb: 'Roll for Keys when you finish a Slayer task, a clue, a boss kill or a minigame.',
    bullets: [
      'Four tabs: Slayer, Clues, Bossing and Activities (minigames and pets).',
      'Harder content rolls better, and a harder failed roll gives more Fate.',
      'Failed rolls build Fate Points; at the pity threshold you get a guaranteed Pity Key.',
      'Quests, diaries and Combat Achievements roll from the Journal, and levels from the Character tab.',
    ],
  },
  SPEND: {
    title: 'Spend Keys',
    blurb: 'Spend a Key on a table to unlock a random entry from it.',
    bullets: [
      'Pick a table and spend a Key: it unlocks a random locked entry from that table.',
      'Omni-Keys (spent on the Dashboard) pick the exact unlock; Chaos Keys unlock at random from every table at once.',
      'Spend Fate Points on rituals at the Void Altar.',
    ],
  },
  LOG: {
    title: 'History',
    blurb: 'Every roll, unlock and ritual in your run.',
    bullets: [
      'Your full run history, newest first.',
      'Each entry is chained to the one before it, so the tracker can spot a hand-edited save. It is a check in your browser, not proof for anyone else.',
    ],
  },

  SKILLS: {
    title: 'Skills',
    blurb: `Your ${SKILLS_LIST.length} skills, each unlocked and raised a tier at a time.`,
    bullets: [
      'Unlock a skill or raise its tier with a Key on the Skills table (a random skill) or an Omni-Key (your choice). Each tier opens 10 more levels of training methods.',
      'Click an unlocked skill to log a level as you gain it in game; each level rolls for a Key.',
      'The Skill Advisor ranks which skill to train next by how much quest and diary content it unlocks.',
    ],
  },
  VOID_ALTAR: {
    title: 'The Void Altar',
    blurb: 'Spend Fate Points on rituals.',
    bullets: [
      'Failed rolls build Fate; your next successful roll resets it to 0, so spend it first.',
      'Clarity rolls your next Key roll twice and keeps the better. Greed tries to double your next Key. Chaos buys a Chaos Key. Transmutation trades 5 Keys for an Omni-Key.',
      'The Void Gambit stakes all your Fate on a coin flip. In Chunked, the Cartographer lets you choose your next chunk.',
    ],
  },
  ACHIEVEMENTS: {
    title: 'Achievements',
    blurb: 'Milestones that reward you for how your run unfolds.',
    bullets: [
      'Browse locked and unlocked achievements across categories.',
      'They unlock by themselves as you reach gear, skill, area and luck milestones.',
      'Track your overall completion at a glance.',
    ],
  },
  FORECAST: {
    title: 'Fate Forecast',
    blurb: 'How many Keys it takes to draw something specific from each table.',
    bullets: [
      'For each table: how many entries a Key could draw now, and the odds for any one of them.',
      'Compare tables to see which gives the best shot at what you want.',
      'Once you’ve earned a few Keys, it also estimates how long that takes at your pace.',
    ],
  },
  RIVAL: {
    title: 'Rival',
    blurb: 'A simulated rival that earns Keys at a steady pace, to race against.',
    bullets: [
      'See its completion next to yours, and who’s ahead.',
      'It earns about 4, 10 or 26 Keys a day, by the pace you pick, and turns each into an unlock. It doesn’t roll.',
      'Or race a friend’s run from their sync code.',
    ],
  },
  SYNC: {
    title: 'Sync Code',
    blurb: 'Move or back up your run with a single shareable code.',
    bullets: [
      'Export your full run to a compact, integrity-checked code.',
      'Import a code on another device to restore that run.',
      'Before an import replaces your save, a backup of it is kept on the Backups tab.',
    ],
  },
  GOAL_PLANNER: {
    title: 'Goal Planner',
    blurb: 'Pick a target unlock and see the path to it.',
    bullets: [
      'Pick a goal (a boss, an area, a gear tier and more) and see what it needs.',
      'Track the Keys and requirements still needed.',
      'Pin goals to your dashboard to keep them in view.',
    ],
  },
  STATS: {
    title: 'Fate Analytics',
    blurb: 'The numbers behind your run: luck, pace and how your rolls spread.',
    bullets: [
      'See how your luck compares with the expected Key rates.',
      'Dig into roll stats by category and by source.',
      'See whether your luck so far has been good or bad.',
    ],
  },
  STRATEGY: {
    title: 'Fate Strategy Guide',
    blurb: 'What you can do now, what each locked goal still needs, and the goals you’re closest to.',
    bullets: [
      'Available: quests, diaries and other content your unlocks allow now.',
      'Locked: what each goal still needs, such as areas, levels and quests.',
      'Closest: the ten goals nearest to reach. Pin one to keep it on your dashboard.',
    ],
  },
  SUPPLY: {
    title: 'The Resource Engine',
    blurb: 'Work out the supplies a given activity or goal needs.',
    bullets: [
      'Pick a target and see the resources required to get there.',
      'Break a goal down into its underlying material costs.',
      'Plan gathering/buying before you commit.',
    ],
  },
  ORACLE: {
    title: 'The Oracle',
    blurb: 'Search every unlockable to find anything fast.',
    bullets: [
      'Type to search all content: gear, areas, bosses, skills and more.',
      'See at a glance what’s unlocked and what’s still locked.',
      'Jump straight to the item you’re looking for.',
    ],
  },
  KILL_PLANNER: {
    title: 'Boss Kill Planner',
    blurb: 'Score your DPS and readiness against every boss you’ve unlocked.',
    bullets: [
      'Bosses are ranked by readiness, using your equipped gear and levels.',
      'See best DPS, time-to-kill, kills/hour, danger and a gear-gap %.',
      'Toggle prayers + potions to compare boosted vs unboosted.',
    ],
  },

  SHARE: {
    title: 'Share Run',
    blurb: 'Turn your run into a card to share.',
    bullets: [
      'Switch between a Stats card and a Map card.',
      'Download the image to share your progress.',
      'The card shows whether your history passes the tracker’s own check in this browser. It isn’t proof for anyone else.',
    ],
  },

  JOURNAL_SUMMARY: {
    title: 'Journal Summary',
    blurb: 'A glance at your Key-earning progress and what to do next.',
    bullets: [
      'See the quests, diary tasks and Combat Achievements ready to complete.',
      'The “Do this next” banner picks the highest-impact action you can take.',
      'Click a row to jump to that Journal tab.',
    ],
  },
};

interface Props { id: string; className?: string; suspendModals?: boolean }

export const SectionGuide: React.FC<Props> = ({ id, className, suspendModals = false }) => {
  const guide = GUIDES[id];
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEscapeKey(() => setOpen(false), open && !suspendModals);

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
      {!suspendModals && open && pos && createPortal(
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
