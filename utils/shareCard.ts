/**
 * What the Share Run card shows, worked out from the run (components/ShareCardCanvas.ts
 * draws it). Pure so the numbers stay pinned by utils/shareCard.test.ts. Pulls in
 * the quest and diary tables through progressSnapshot, so only the lazy Share
 * window imports it.
 */
import type { GameModeRules } from '../config/gameModes';
import { getGameMode, resolveModeRules } from '../config/gameModes';
import { EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX, SKILLS_LIST, SLOT_CONFIG } from '../constants';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import type { LogEntry, UnlockState } from '../types';
import { TableType } from '../types';
import { chunkLabel, parseChunkKey } from './chunkAdjacency';
import { chunkUnlocked } from './chunkLocations';
import { completionPercent } from './completion';
import { auditHistory, computeRunId } from './integrity';
import { CHUNK_TILES, MAP_BOUNDS, type ChunkCoord } from './mapCoords';
import { buildProgressSnapshot } from './progressSnapshot';

/** The world map image's chunk grid: chunk x 15..62, chunk y 32..65. */
export const GRID = {
  x0: MAP_BOUNDS.tileMinX / CHUNK_TILES,
  yTop: MAP_BOUNDS.tileMaxY / CHUNK_TILES,
  w: (MAP_BOUNDS.tileMaxX - MAP_BOUNDS.tileMinX) / CHUNK_TILES,
  h: (MAP_BOUNDS.tileMaxY - MAP_BOUNDS.tileMinY) / CHUNK_TILES,
} as const;

/** Grid cell (0,0 = top left of the map image) to chunk coordinates, and back. */
export const cellToChunk = (gx: number, gy: number): ChunkCoord => ({ cx: GRID.x0 + gx, cy: GRID.yTop - 1 - gy });
export const chunkToCell = ({ cx, cy }: ChunkCoord) => ({ gx: cx - GRID.x0, gy: GRID.yTop - 1 - cy });

export interface ShareCardSource {
  unlocks: UnlockState;
  history: readonly LogEntry[];
  gameModeId?: string;
  customMode?: GameModeRules;
  linkedAccount?: string;
  profileName: string;
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  fatePoints: number;
  now: number;
}

export interface ShareCardStats {
  name: string;
  mode: string;
  day: number;
  since: string;
  completion: number;
  areas: { unlocked: number; total: number; unit: 'areas' | 'chunks' };
  quests: { done: number; total: number };
  diary: { done: number; total: number };
  totalLevel: number;
  skills: { skill: string; tier: number; level: number }[];
  /** Highest skill tier (10) and gear tier (9). */
  skillTierMax: number;
  gear: { slot: string; file: string; tier: number }[];
  gearTierMax: number;
  keys: number;
  omni: number;
  chaos: number;
  fate: number;
  /** The mode's pity threshold, or null when the mode has pity off. */
  fateMax: number | null;
  /** The newest area (or chunk) unlock and its chunks, when it has any on the map. */
  latest: { name: string; chunks: ChunkCoord[] } | null;
  /** Owned chunks, as "cx,cy". */
  owned: ReadonlySet<string>;
  runId: string | null;
  history: { ok: boolean; detail: string };
}

const SUB_CHUNKS = SUB_AREA_CHUNKS as Record<string, ChunkCoord[] | undefined>;
const REGION_CHUNK_MAP = REGION_CHUNKS as Record<string, ChunkCoord[] | undefined>;

/** The newest area or chunk unlock, with the chunks to outline on the map. */
export function latestLandUnlock(history: readonly LogEntry[]): ShareCardStats['latest'] {
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry.type !== 'UNLOCK') continue;
    const category = entry.meta?.category;
    const item = typeof entry.meta?.item === 'string' ? entry.meta.item : null;
    if (!item) continue;
    if (category === TableType.CHUNKS && /^\d+,\d+$/.test(item)) {
      return { name: chunkLabel(item), chunks: [parseChunkKey(item)] };
    }
    if (category === TableType.REGIONS) {
      const chunks = SUB_CHUNKS[item] ?? REGION_CHUNK_MAP[item] ?? [];
      return chunks.length ? { name: item, chunks } : null;
    }
  }
  return null;
}

/** Every chunk on the map grid the run owns, coloured the way the world map colours it. */
export function ownedChunks(unlocks: UnlockState, gameModeId?: string): Set<string> {
  const owned = new Set<string>();
  for (let gx = 0; gx < GRID.w; gx++) {
    for (let gy = 0; gy < GRID.h; gy++) {
      const { cx, cy } = cellToChunk(gx, gy);
      if (chunkUnlocked(cx, cy, unlocks, gameModeId)) owned.add(`${cx},${cy}`);
    }
  }
  return owned;
}

const DAY_MS = 86_400_000;
const SKILL_TIER_MAX = 10;

export function buildShareCardStats(source: ShareCardSource): ShareCardStats {
  const { unlocks, history, gameModeId, customMode, linkedAccount } = source;
  const snapshot = buildProgressSnapshot({ unlocks, history, gameModeId, customMode, linkedAccount });
  const rules = resolveModeRules(gameModeId, customMode);
  const audit = auditHistory([...history], rules);
  const first = history[0]?.timestamp ?? source.now;
  const levels = unlocks.levels as Record<string, number>;
  const historyDetail = history.length === 0 ? 'No recorded history to check yet'
    : audit.verdict === 'tampered'
      ? `${audit.chain.brokenAt.length} broken history link${audit.chain.brokenAt.length === 1 ? '' : 's'}`
      : audit.verdict === 'warning'
        ? `${audit.violations.length} replay warning${audit.violations.length === 1 ? '' : 's'}`
        : 'History checks passed in this browser';
  return {
    name: linkedAccount?.trim() || source.profileName,
    mode: getGameMode(gameModeId).name,
    day: Math.max(1, Math.floor((source.now - first) / DAY_MS) + 1),
    since: new Date(first).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    completion: completionPercent(unlocks, gameModeId, customMode),
    areas: snapshot.areas,
    quests: snapshot.quests,
    diary: snapshot.diaryTasks,
    totalLevel: (Object.values(levels) as number[]).reduce((sum, level) => sum + level, 0),
    skills: SKILLS_LIST.map(skill => ({ skill, tier: unlocks.skills[skill] || 0, level: levels[skill] || 1 })),
    skillTierMax: SKILL_TIER_MAX,
    gearTierMax: EQUIPMENT_TIER_MAX,
    gear: EQUIPMENT_SLOTS.map(slot => ({ slot, file: SLOT_CONFIG[slot]?.file ?? '', tier: unlocks.equipment[slot] || 0 })),
    keys: source.keys,
    omni: source.specialKeys,
    chaos: source.chaosKeys,
    fate: source.fatePoints,
    fateMax: rules.pityEnabled ? rules.pityThreshold : null,
    latest: latestLandUnlock(history),
    owned: ownedChunks(unlocks, gameModeId),
    runId: computeRunId([...history]),
    history: { ok: history.length > 0 && audit.verdict === 'verified', detail: historyDetail },
  };
}

export interface MapWindow { x0: number; y0: number; x1: number; y1: number }

/**
 * The part of the map grid the card shows, in grid cells, shaped to the
 * panel's `aspect` (width / height). The whole world keeps its full height
 * and trims open sea at the sides; zoomed, it frames the owned land with two
 * chunks of margin, never closer than 14 chunks across.
 */
export function mapWindow(owned: ReadonlySet<string>, aspect: number, zoom: boolean): MapWindow {
  const fit = (w: number, h: number) => (w / h > aspect ? [w, w / aspect] : [h * aspect, h]);
  const [fullW, fullH] = GRID.h * aspect <= GRID.w ? [GRID.h * aspect, GRID.h] : [GRID.w, GRID.w / aspect];
  const whole = { x0: (GRID.w - fullW) / 2, y0: (GRID.h - fullH) / 2, x1: (GRID.w + fullW) / 2, y1: (GRID.h + fullH) / 2 };
  if (!zoom || owned.size === 0) return whole;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of owned) {
    const { gx, gy } = chunkToCell(parseChunkKey(key));
    if (gx < 0 || gy < 0 || gx >= GRID.w || gy >= GRID.h) continue;
    minX = Math.min(minX, gx); maxX = Math.max(maxX, gx + 1);
    minY = Math.min(minY, gy); maxY = Math.max(maxY, gy + 1);
  }
  if (minX === Infinity) return whole;
  const [w, h] = fit(Math.max(maxX - minX + 4, 14), maxY - minY + 4);
  if (w > fullW || h > fullH) return whole;
  const x0 = Math.max(0, Math.min(GRID.w - w, (minX + maxX) / 2 - w / 2));
  const y0 = Math.max(0, Math.min(GRID.h - h, (minY + maxY) / 2 - h / 2));
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}
