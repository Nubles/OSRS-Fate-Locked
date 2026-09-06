import type { GameModeRules } from '../config/gameModes';
import { BANK_BY_ID } from '../data/banks';
import { BOSSES_LIST, MINIGAMES_LIST } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import type {
  ChunkContent,
  Shortcut,
} from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { resourceReqFor, resourceUsable } from './chunkResources';
import { chunkUnlocked, placeOf } from './chunkLocations';
import { getQuestStatus } from './journalStatus';
import { classifyShop } from './merchantShops';
import { isBankReachable } from './reachability';

export type PermissionStatus = 'ALLOWED' | 'NOT_READY' | 'LOCKED' | 'UNKNOWN';
export type ChunkCategoryId =
  | 'SKILLING'
  | 'BANKS'
  | 'SHOPS'
  | 'QUESTS'
  | 'COMBAT'
  | 'TRAVEL'
  | 'FARMING'
  | 'ACTIVITIES';

export interface ChunkPermissionRow {
  key: string;
  name: string;
  status: PermissionStatus;
  detail?: string;
  targetKind?: 'NPC' | 'OBJECT' | 'SHOP' | 'BANK' | 'TELEPORT' | 'ACTIVITY';
}

export interface ChunkPermissionSnapshot {
  chunkKey: string;
  name: string | null;
  region: string | null;
  entry: PermissionStatus;
  categories: Partial<Record<ChunkCategoryId, ChunkPermissionRow[]>>;
  counts: { allowed: number; notReady: number; locked: number; unknown: number };
}

export interface ChunkPermissionContext {
  unlocks: UnlockState;
  gameModeId?: string;
  customMode?: GameModeRules;
  reachableChunks?: Set<string>;
  shortcuts?: Shortcut[];
  /** @deprecated Ignored. Quest status is always computed canonically. */
  questStatuses?: Record<string, PermissionStatus>;
}

const CATEGORY_ORDER: ChunkCategoryId[] = [
  'SKILLING',
  'BANKS',
  'SHOPS',
  'QUESTS',
  'COMBAT',
  'TRAVEL',
  'FARMING',
  'ACTIVITIES',
];

const PATCH = /\bpatch\b|grapevine|giant seaweed/i;

function withEntry(
  status: PermissionStatus,
  entry: PermissionStatus,
): PermissionStatus {
  if (entry === 'LOCKED') return 'LOCKED';
  if (entry === 'NOT_READY' && status === 'ALLOWED') return 'NOT_READY';
  if (entry === 'UNKNOWN' && status === 'ALLOWED') return 'UNKNOWN';
  return status;
}

function questStatus(
  name: string,
  context: ChunkPermissionContext,
): PermissionStatus {
  const quest = QUEST_DATA[name]
    ?? Object.values(QUEST_DATA).find((candidate) => candidate.name === name);
  if (!quest) return 'UNKNOWN';
  const status = getQuestStatus(quest, context.unlocks, context.gameModeId);
  if (status === 'COMPLETED' || status === 'AVAILABLE') return 'ALLOWED';
  if (status === 'LOCKED_REGION') return 'LOCKED';
  return 'NOT_READY';
}

function sortRows(rows: ChunkPermissionRow[]): ChunkPermissionRow[] {
  return rows.sort((left, right) =>
    left.name.localeCompare(right.name) || left.key.localeCompare(right.key));
}

export function buildChunkPermissionSnapshot(
  content: ChunkContent,
  coord: { cx: number; cy: number },
  context: ChunkPermissionContext,
): ChunkPermissionSnapshot {
  const chunkKey = `${coord.cx},${coord.cy}`;
  const numericId = String(coord.cx * 256 + coord.cy);
  const owned = chunkUnlocked(
    coord.cx,
    coord.cy,
    context.unlocks,
    context.gameModeId,
  );
  const entry: PermissionStatus = !owned
    ? 'LOCKED'
    : context.reachableChunks && !context.reachableChunks.has(numericId)
      ? 'NOT_READY'
      : 'ALLOWED';
  const place = placeOf(coord.cx, coord.cy);
  const categories: Partial<Record<ChunkCategoryId, ChunkPermissionRow[]>> = {};
  const add = (category: ChunkCategoryId, row: ChunkPermissionRow) => {
    (categories[category] ??= []).push(row);
  };

  if (BANK_BY_ID[numericId]) {
    add('BANKS', {
      key: `bank:${numericId}`,
      name: BANK_BY_ID[numericId].name,
      status: withEntry(
        isBankReachable(
          coord.cx,
          coord.cy,
          context.unlocks,
          context.gameModeId,
          context.customMode,
        ) ? 'ALLOWED' : 'LOCKED',
        entry,
      ),
      targetKind: 'BANK',
    });
  }

  for (const name of content.shops) {
    const category = classifyShop(name);
    const status: PermissionStatus = category == null
      ? 'UNKNOWN'
      : context.unlocks.merchants.includes(category) ? 'ALLOWED' : 'LOCKED';
    add('SHOPS', {
      key: `shop:${name.toLowerCase()}`,
      name,
      status: withEntry(status, entry),
      targetKind: 'SHOP',
    });
  }

  for (const name of Object.keys(content.quests)) {
    add('QUESTS', {
      key: `quest:${name.toLowerCase()}`,
      name,
      status: withEntry(questStatus(name, context), entry),
    });
  }

  for (const monster of content.monsters) {
    if (BOSSES_LIST.includes(monster.name)) {
      add('ACTIVITIES', {
        key: `boss:${monster.name.toLowerCase()}`,
        name: monster.name,
        status: withEntry(
          context.unlocks.bosses.includes(monster.name) ? 'ALLOWED' : 'LOCKED',
          entry,
        ),
        targetKind: 'ACTIVITY',
      });
      continue;
    }
    const slayerLevel = context.unlocks.levels.Slayer ?? 1;
    const status: PermissionStatus =
      monster.slayer == null || slayerLevel >= monster.slayer
        ? 'ALLOWED'
        : 'NOT_READY';
    add('COMBAT', {
      key: `combat:${monster.name.toLowerCase()}`,
      name: monster.name,
      status: withEntry(status, entry),
      targetKind: 'NPC',
    });
  }

  for (const [name] of content.objects) {
    if (PATCH.test(name)) {
      const unlocked = context.unlocks.farming.some((patch) =>
        name.toLowerCase().includes(patch.toLowerCase())
        || patch.toLowerCase().includes(name.toLowerCase()));
      add('FARMING', {
        key: `farm:${name.toLowerCase()}`,
        name,
        status: withEntry(unlocked ? 'ALLOWED' : 'LOCKED', entry),
        targetKind: 'OBJECT',
      });
      continue;
    }
    const requirement = resourceReqFor(name);
    if (!requirement) continue;
    const level = context.unlocks.levels[requirement.skill] ?? 1;
    const tier = context.unlocks.skills[requirement.skill] ?? 0;
    const cap = Math.min(99, tier * 10);
    add('SKILLING', {
      key: `skill:${name.toLowerCase()}`,
      name,
      status: withEntry(
        resourceUsable(requirement, context.unlocks) ? 'ALLOWED' : 'NOT_READY',
        entry,
      ),
      detail: `${requirement.skill} ${level}/${requirement.level} · cap ${cap}`,
      targetKind: 'OBJECT',
    });
  }

  for (const shortcut of context.shortcuts ?? []) {
    if (!shortcut.chunks.includes(numericId)) continue;
    const level = context.unlocks.levels[shortcut.skill] ?? 1;
    const status: PermissionStatus = level >= shortcut.level
      ? 'ALLOWED'
      : 'NOT_READY';
    add('TRAVEL', {
      key: `travel:${shortcut.name.toLowerCase()}`,
      name: shortcut.name,
      status: withEntry(status, entry),
      detail: `${shortcut.skill} ${level}/${shortcut.level}`,
      targetKind: 'TELEPORT',
    });
  }

  if (content.name && MINIGAMES_LIST.includes(content.name)) {
    add('ACTIVITIES', {
      key: `minigame:${content.name.toLowerCase()}`,
      name: content.name,
      status: withEntry(
        context.unlocks.minigames.includes(content.name) ? 'ALLOWED' : 'LOCKED',
        entry,
      ),
      targetKind: 'ACTIVITY',
    });
  }

  for (const category of CATEGORY_ORDER) {
    if (categories[category]?.length) sortRows(categories[category]!);
    else delete categories[category];
  }
  const rows = Object.values(categories).flatMap((value) => value ?? []);
  return {
    chunkKey,
    name: content.name ?? place.subArea,
    region: place.region,
    entry,
    categories,
    counts: {
      allowed: rows.filter((row) => row.status === 'ALLOWED').length,
      notReady: rows.filter((row) => row.status === 'NOT_READY').length,
      locked: rows.filter((row) => row.status === 'LOCKED').length,
      unknown: rows.filter((row) => row.status === 'UNKNOWN').length,
    },
  };
}
