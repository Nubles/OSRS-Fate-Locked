/**
 * The guided first hour: a short "quest" that teaches a new run Keys, rolls,
 * Fate and unlocks while the player does the real thing, instead of a slide
 * show before they have seen the app.
 *
 * Every step but the "look at" ones is done by something the run's history
 * already records (an unlock, a roll, a failed roll, a ritual), so the guide
 * can never get out of step with the game, and an older or imported run
 * finds most of it done. The look-at steps (open the Journal, open the Void
 * Altar, open Sync & Roll) are remembered in a small per-viewer record kept
 * in localStorage outside GameState: it never travels with saves, sync codes
 * or exports.
 *
 * The guide gives nothing: no Keys, no Fate, no unlocks. Fate picks every
 * reward in this game; the guide only points at where to click.
 *
 * Pure apart from the storage helpers at the bottom, so vitest pins it
 * (utils/firstHour.test.ts). The guide's look lives in
 * components/FirstHourGuide.tsx (both layouts).
 */
import type { LogEntry } from '../types';
import { isRollEntry } from './logEntry';

export type FirstHourStepId = 'spend' | 'journal' | 'roll' | 'fate' | 'altar' | 'sync';

/** Where a step points: the layout-neutral name of the thing to click. */
export type FirstHourTarget = 'spend-keys' | 'spend-table' | 'journal' | 'farm-keys' | 'fate' | 'altar' | 'sync';

export interface FirstHourStep {
  id: FirstHourStepId;
  /** The instruction's title, as Tutorial Island words them. */
  title: string;
  /** What to do, one or two short sentences. */
  body: string;
  /** Said instead of body once the player is looking at the right place (the open Spend Keys panel). */
  hereBody?: string;
  /** What the player learned, said once the step is done. */
  done: string;
  target: FirstHourTarget;
  /** The step can be passed over without doing it. */
  optional?: boolean;
}

export interface FirstHourInput {
  history: readonly LogEntry[];
  keys: number;
  startingKeys: number;
  pityThreshold: number;
  chunked: boolean;
}

/** What the viewer has done that history does not record. */
export interface FirstHourRecord {
  /** Look-at steps the viewer has done, and optional steps passed over. */
  seen: FirstHourStepId[];
  /** The player chose Skip guide for this run. */
  skipped?: boolean;
  /** The run was already well under way when the guide first saw it. */
  graduated?: boolean;
  /** The quest-complete scroll has been shown and closed. */
  finished?: boolean;
}

export const EMPTY_RECORD: FirstHourRecord = { seen: [] };

/** A run with this much history when the guide first meets it skips the guide. */
export const GRADUATE_AT_HISTORY = 12;

const unlockCount = (history: readonly LogEntry[]) =>
  history.reduce((n, h) => n + (h.type === 'UNLOCK' ? 1 : 0), 0);

/** The steps, worded for the run's mode. */
export const firstHourSteps = (input: Pick<FirstHourInput, 'startingKeys' | 'pityThreshold' | 'chunked'>): FirstHourStep[] => {
  const { startingKeys, pityThreshold, chunked } = input;
  return [
    {
      id: 'spend',
      title: 'Spend your starting Keys',
      body: chunked
        ? `You start with ${startingKeys} Keys. Open Spend Keys and pick a table. You choose the table, fate picks what comes out of it. The Chunks table grows your land.`
        : `You start with ${startingKeys} Keys. Open Spend Keys and pick a table. You choose the table, fate picks what comes out of it.`,
      hereBody: 'Pick any table and press its Key. You choose the table; fate picks what comes out of it, and it is yours for good.',
      done: 'Every unlock is yours for good. Your gear slots and skills show their tier on the Character tab.',
      target: 'spend-keys',
    },
    {
      id: 'journal',
      title: 'Find something to do',
      body: 'Your unlocks open quests, diary tasks and Slayer. The Journal shows what you can do right now.',
      done: 'Quests marked ready can be done with what you have unlocked. Finish one in game, then come back and roll it.',
      target: 'journal',
    },
    {
      id: 'roll',
      title: 'Roll for a Key',
      body: 'Go and finish something in game: a quest, a Slayer task, a clue or a level. Then roll it here, quests from the Journal. The % is your chance at a Key. Only roll what you really finished.',
      done: 'Harder content rolls better. Each thing you finish rolls once, and a Key from a roll resets your Fate to 0.',
      target: 'farm-keys',
    },
    {
      id: 'fate',
      title: 'Fate remembers',
      body: `Not every roll pays. A failed roll gives you Fate Points instead, and at ${pityThreshold} Fate a Pity Key is guaranteed. Keep rolling until one misses.`,
      done: `Your Fate shows at the top. Harder content gives more Fate when it misses.`,
      target: 'fate',
    },
    {
      id: 'altar',
      title: 'The Void Altar',
      body: 'Fate can also be spent at the Void Altar, on rituals that bend your next rolls. Open it and have a look.',
      done: 'Fate resets to 0 when a roll pays a Key, so spend it at the Altar first if you want a ritual.',
      target: 'altar',
    },
    {
      id: 'sync',
      title: 'Let RuneLite roll for you',
      body: 'Sync & Roll reads your levels from the hiscores, and the RuneLite plugin can send what you finish straight here.',
      done: 'That is everything. Fate picks the rest.',
      target: 'sync',
      optional: true,
    },
  ];
};

/** Which steps the run has done. Look-at steps come from the record, the rest from history. */
export const firstHourDone = (input: FirstHourInput, record: FirstHourRecord): Set<FirstHourStepId> => {
  const { history, keys, startingKeys } = input;
  const done = new Set<FirstHourStepId>(record.seen);
  const unlocks = unlockCount(history);
  if (unlocks >= startingKeys || (unlocks > 0 && keys === 0)) done.add('spend');
  const rolled = history.some(isRollEntry);
  // Rolling means the player found something to do, wherever they found it.
  if (rolled) { done.add('roll'); done.add('journal'); }
  // Only a miss teaches Fate: achievements also pay Fate, often before any roll.
  if (history.some((h) => h.type === 'ROLL_FAIL' || h.type === 'PITY')) done.add('fate');
  if (history.some((h) => h.type === 'ALTAR')) done.add('altar');
  return done;
};

export interface FirstHourProgress {
  steps: FirstHourStep[];
  done: Set<FirstHourStepId>;
  /** The step to show now; null once every step is done. */
  current: FirstHourStep | null;
  /** 0..100, as Tutorial Island's progress bar. */
  percent: number;
  /** Spend step only: starting Keys spent so far, capped at the starting count. */
  spent: number;
}

export const firstHourProgress = (input: FirstHourInput, record: FirstHourRecord): FirstHourProgress => {
  const steps = firstHourSteps(input);
  const done = firstHourDone(input, record);
  const current = steps.find((s) => !done.has(s.id)) ?? null;
  const percent = Math.round((steps.filter((s) => done.has(s.id)).length / steps.length) * 100);
  const spent = Math.min(input.startingKeys, unlockCount(input.history));
  return { steps, done, current, percent, spent };
};

/** The first finished step not yet announced, in step order: its "done" beat shows before anything else. */
export const nextAnnouncement = (
  steps: readonly FirstHourStep[], done: ReadonlySet<FirstHourStepId>, announced: ReadonlySet<FirstHourStepId>,
): FirstHourStep | null => steps.find((s) => done.has(s.id) && !announced.has(s.id)) ?? null;

/** Whether the guide shows at all for this run. */
export const firstHourActive = (record: FirstHourRecord, enabled: boolean): boolean =>
  enabled && !record.skipped && !record.graduated && !record.finished;

/**
 * The record to start from the first time the guide meets a run: a run that
 * is already well under way graduates silently, as imports and older runs do.
 */
export const firstSightRecord = (history: readonly LogEntry[]): FirstHourRecord =>
  history.length >= GRADUATE_AT_HISTORY ? { seen: [], graduated: true } : { seen: [] };

/** Marks a look-at step (or an optional step passed over) as done. Returns the same record when nothing changes. */
export const markSeen = (record: FirstHourRecord, step: FirstHourStepId): FirstHourRecord =>
  record.seen.includes(step) ? record : { ...record, seen: [...record.seen, step] };

// ── Per-viewer storage (outside GameState) ─────────────────────────────────

export const firstHourRecordKey = (runId: string) => `fate_first_hour_v1:${runId}`;

export { FIRST_HOUR_ENABLED_KEY, readFirstHourEnabled, writeFirstHourEnabled } from './firstHourStore';

const STEP_IDS: readonly FirstHourStepId[] = ['spend', 'journal', 'roll', 'fate', 'altar', 'sync'];

/** The stored record for a run, or null when the guide has never met it. Anything unreadable reads as null. */
export const readFirstHourRecord = (runId: string): FirstHourRecord | null => {
  try {
    const raw = localStorage.getItem(firstHourRecordKey(runId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FirstHourRecord>;
    const seen = Array.isArray(parsed.seen) ? parsed.seen.filter((s): s is FirstHourStepId => STEP_IDS.includes(s as FirstHourStepId)) : [];
    return {
      seen,
      ...(parsed.skipped ? { skipped: true } : {}),
      ...(parsed.graduated ? { graduated: true } : {}),
      ...(parsed.finished ? { finished: true } : {}),
    };
  } catch { return null; }
};

export const writeFirstHourRecord = (runId: string, record: FirstHourRecord): void => {
  try { localStorage.setItem(firstHourRecordKey(runId), JSON.stringify(record)); } catch { /* lasts this page only */ }
};
