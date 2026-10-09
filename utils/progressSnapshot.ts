/**
 * The summary of a run a player shares with the Fate Locked Discord bot
 * (docs/shared-progress.md). Counts only: never the save, the history, a sync
 * code or any token. The relay keeps exactly these fields
 * (workers/fate-relay/progress.js::validProgressSnapshot), so a field added
 * here needs adding there too.
 *
 * This module pulls in the quest, diary and Combat Achievement tables, so the
 * always-mounted driver imports it lazily to keep it out of the entry chunk.
 */
import type { GameModeRules } from '../config/gameModes';
import { getGameMode, resolveModeRules } from '../config/gameModes';
import { QUEST_DATA } from '../data/questData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import type { LogEntry, UnlockState } from '../types';
import { completedCAPoints, earnedCATiers } from './caProgress';
import { ALL_CHUNKS } from './chunkAdjacency';
import { chunkUnlocked } from './chunkLocations';
import { simpleHash } from './integrity';
import { runProgress } from './runProgress';
import { tableDisplayName } from './tableDisplay';

export const MAX_RECENT_UNLOCKS = 5;

/**
 * The world map grid the snapshot's `map` covers: the tracker's map image,
 * chunks 15..62 west to east and 65..32 north to south (utils/mapCoords.ts).
 */
export const MAP_GRID = { minCx: 15, maxCy: 65, cols: 48, rows: 34 } as const;

export interface ProgressSnapshot {
  v: 1;
  /** The mode's name as the tracker shows it. */
  mode: string;
  modeId: string;
  /** A short fingerprint of a Custom run's rules: equal tags mean equal rules. */
  rulesTag?: string;
  /** The OSRS account the run is bound to, when it is. */
  account?: string;
  /** When the run's first history entry was made. */
  startedAt?: number;
  areas: { unit: 'areas' | 'chunks'; unlocked: number; total: number };
  chunks: { unlocked: number; total: number };
  quests: { done: number; total: number };
  diaryTasks: { done: number; total: number };
  /** Combat Achievement points and the highest tier earned, or null. */
  ca: { points: number; tier: string | null };
  /** The newest unlocks, newest first. */
  recent: { text: string; at: number }[];
  /**
   * The land chunks the run owns, for the bot's map picture: one bit per
   * MAP_GRID cell, row by row from the north-west corner, low bit first, in
   * base64. Present on every snapshot this tracker builds.
   */
  map?: string;
}

/** The `map` field for the chunks `owned` says the run has. */
export function encodeChunkMap(owned: (cx: number, cy: number) => boolean): string {
  const bytes = new Uint8Array(Math.ceil((MAP_GRID.cols * MAP_GRID.rows) / 8));
  for (const { cx, cy } of ALL_CHUNKS) {
    const col = cx - MAP_GRID.minCx;
    const row = MAP_GRID.maxCy - cy;
    if (col < 0 || col >= MAP_GRID.cols || row < 0 || row >= MAP_GRID.rows || !owned(cx, cy)) continue;
    const bit = row * MAP_GRID.cols + col;
    bytes[bit >> 3] |= 1 << (bit & 7);
  }
  return btoa(String.fromCharCode(...bytes));
}

export interface ProgressSource {
  unlocks: UnlockState;
  history: readonly LogEntry[];
  gameModeId?: string;
  customMode?: GameModeRules;
  linkedAccount?: string;
}

/**
 * A fingerprint of the rules a run plays under: `R-` and six hex digits of a
 * hash of the resolved rules with sorted keys, so two Custom runs share a tag
 * exactly when their rules match.
 */
export function rulesTag(gameModeId: string | undefined, customMode?: GameModeRules): string {
  const rules = resolveModeRules(gameModeId, customMode) as unknown as Record<string, unknown>;
  const canonical = JSON.stringify(Object.keys(rules).sort().map(key => [key, rules[key]]));
  return `R-${simpleHash(canonical).slice(0, 6).toUpperCase()}`;
}

const unlockText = (entry: LogEntry): string => {
  const category = typeof entry.meta?.category === 'string' ? tableDisplayName(entry.meta.category) : '';
  const text = category ? `${entry.message} (${category})` : entry.message;
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
};

export function buildProgressSnapshot(source: ProgressSource): ProgressSnapshot {
  const { unlocks, history, gameModeId, customMode, linkedAccount } = source;
  const progress = runProgress(unlocks, gameModeId);
  const diaryIds = new Set(ALL_DIARY_TASKS.map(task => task.id));
  const caPoints = completedCAPoints(unlocks.completedTasks);
  const caTiers = earnedCATiers(caPoints, unlocks.cas);
  const recent = history
    .filter(entry => entry.type === 'UNLOCK' && entry.message.trim() !== '')
    .slice(-MAX_RECENT_UNLOCKS)
    .reverse()
    .map(entry => ({ text: unlockText(entry), at: entry.timestamp }));
  const account = linkedAccount?.trim();
  const questTotal = Object.keys(QUEST_DATA).length;
  const mode = getGameMode(gameModeId);

  return {
    v: 1,
    mode: mode.name,
    modeId: mode.id,
    ...(mode.id === 'custom' ? { rulesTag: rulesTag(gameModeId, customMode) } : {}),
    ...(account ? { account: account.slice(0, 32) } : {}),
    ...(history[0]?.timestamp ? { startedAt: history[0].timestamp } : {}),
    areas: { unit: progress.unit, unlocked: Math.min(progress.unlocked, progress.total), total: progress.total },
    chunks: { unlocked: Math.min(progress.chunks.unlocked, progress.chunks.total), total: progress.chunks.total },
    quests: { done: Math.min(unlocks.quests.length, questTotal), total: questTotal },
    diaryTasks: {
      done: unlocks.completedTasks.filter(id => diaryIds.has(id)).length,
      total: ALL_DIARY_TASKS.length,
    },
    ca: { points: caPoints, tier: caTiers.length > 0 ? caTiers[caTiers.length - 1] : null },
    recent,
    map: encodeChunkMap((cx, cy) => chunkUnlocked(cx, cy, unlocks, gameModeId)),
  };
}
