import { MERCHANT_SERVICES } from '../data/merchantServices';
import type { GameModeRules } from '../config/gameModes';
import { BANK_BY_ID } from '../data/banks';
import { MINIGAMES_LIST } from '../data/items';
import type {
  ChunkContent,
  Shortcut,
} from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import type { QuestData } from '../data/questData';
import { resourceReqFor, resourceUsable } from './chunkResources';
import { placeOf } from './chunkLocations';
import { chunkEntry, chunkEntryReason } from './chunkEntry';
import { OCEAN_CHUNK_KEYS } from './oceanAccess';
import {
  evaluateQuestEligibility, meetsSkillRequirement, questRequirementOptionLabel, type EligibilityBlocker,
} from './journalStatus';
import { farmingPatchFor } from './farmingPatches';
import { shortcutReachability, shortcutsByChunk, type ShortcutContent } from './shortcutReach';
import { isBankReachable } from './reachability';
import { canonicalBossId, resolveQuest } from './contentIdentity';
import { evaluateEntityAccess, evaluateBankRequirements, type EntityAccessSource, type EntityAccessResult } from './entityAccess';

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
  /** Why the entry isn't ALLOWED; absent when it is. */
  entryReason?: string;
  kind: 'land' | 'ocean';
  /** The rolled area the chunk belongs to, when it belongs to one. */
  area?: string;
  categories: Partial<Record<ChunkCategoryId, ChunkPermissionRow[]>>;
  counts: { allowed: number; notReady: number; locked: number; unknown: number };
}

export interface ChunkPermissionContext {
  contentService?: EntityAccessSource;
  unlocks: UnlockState;
  gameModeId?: string;
  customMode?: GameModeRules;
  reachableChunks?: Set<string>;
  shortcuts?: Shortcut[];
  /** Where shortcuts' objects and interiors are (the chunk content); without it they are placed by chunk id and place name. */
  shortcutContent?: ShortcutContent;
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

function withEntry(
  status: PermissionStatus,
  entry: PermissionStatus,
): PermissionStatus {
  if (entry === 'LOCKED') return 'LOCKED';
  if (entry === 'NOT_READY' && status === 'ALLOWED') return 'NOT_READY';
  if (entry === 'UNKNOWN' && status === 'ALLOWED') return 'UNKNOWN';
  return status;
}

const QUEST_REASON_MAX_CHARS = 120;

/**
 * A quest blocker as the plugin shows it. The plugin repeats a quest's reasons
 * on every chunk the quest touches and the relay caps a bundle's size, so a
 * worn item names only its slot and tier, and a long list of item routes
 * gives only its count. The tracker's Quests tab shows both in full.
 */
const questReason = (quest: QuestData, blocker: EligibilityBlocker): string => {
  if (blocker.kind === 'equipment') return `${blocker.slot} T${blocker.tier}`;
  const options = quest.oneOf ?? [];
  if (options.length > 1 && blocker.label.length > QUEST_REASON_MAX_CHARS
    && blocker.label === options.map(questRequirementOptionLabel).join(' or ')) {
    return `One of ${options.length} routes (see the tracker)`;
  }
  return blocker.label;
};

function questStatus(
  name: string,
  context: ChunkPermissionContext,
): EntityAccessResult {
  const quest = resolveQuest(name);
  if (!quest) return { status: 'UNKNOWN', reasons: ['Quest requirements need review'] };
  const result = evaluateQuestEligibility(quest, context.unlocks, context.gameModeId);
  if (result.eligible) return { status: 'ALLOWED', reasons: [] };
  return { status: result.status === 'LOCKED_REGION' ? 'LOCKED' : result.machineEligible ? 'UNKNOWN' : 'NOT_READY',
    reasons: [...result.blockers.map(blocker => questReason(quest, blocker)), ...result.manualChecks] };
}

/**
 * Whether the run may use the bank whose chunk this is, and why not: the
 * bank's own unlock, its facilities' requirements and the chunk's entry.
 * The chunk's BANKS row and the export's bank table both come from here.
 */
export function bankAccess(
  content: ChunkContent,
  coord: { cx: number; cy: number },
  context: ChunkPermissionContext,
  entry: PermissionStatus,
): { status: PermissionStatus; reasons: string[] } {
  const access = evaluateBankRequirements(content, coord, context.unlocks, context.contentService, context.gameModeId ?? 'vanilla');
  const unlocked = isBankReachable(coord.cx, coord.cy, context.unlocks, context.gameModeId, context.customMode);
  return { status: withEntry(unlocked ? 'ALLOWED' : 'LOCKED', withEntry(access.status, entry)), reasons: access.reasons };
}

/** A level line as the plugin's SkillLine reads it: "Slayer 5/93 · cap 10". */
const skillLine = (unlocks: UnlockState, skill: string, needed: number): string =>
  `${skill} ${unlocks.levels[skill] ?? 1}/${needed} · cap ${Math.min(99, (unlocks.skills[skill] ?? 0) * 10)}`;

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
  const entry = chunkEntry(coord, context.unlocks, context.gameModeId, context.reachableChunks);
  const place = placeOf(coord.cx, coord.cy);
  const categories: Partial<Record<ChunkCategoryId, ChunkPermissionRow[]>> = {};
  const add = (category: ChunkCategoryId, row: ChunkPermissionRow) => {
    const kind = category === 'COMBAT' || row.key.startsWith('boss:') ? 'monster'
      : category === 'SKILLING' || category === 'FARMING' ? 'object' : null;
    if (kind) {
      const access = evaluateEntityAccess(row.name, kind, coord, context.unlocks, context.gameModeId, context.contentService, context.reachableChunks);
      row.status = withEntry(row.status, access.status);
      if (access.reasons.length) row.detail = [row.detail, ...access.reasons].filter(Boolean).join('; ');
    }
    (categories[category] ??= []).push(row);
  };

  if (BANK_BY_ID[numericId]) {
    const access = bankAccess(content, coord, context, entry);
    add('BANKS', {
      key: `bank:${numericId}`,
      name: BANK_BY_ID[numericId].name,
      status: access.status,
      ...(access.reasons.length ? { detail: access.reasons.join('; ') } : {}),
      targetKind: 'BANK',
    });
  }

  for (const name of content.shops) {
    const access = evaluateEntityAccess(name, 'shop', coord, context.unlocks, context.gameModeId, context.contentService, context.reachableChunks);
    add('SHOPS', {
      key: `shop:${name.toLowerCase()}`,
      name,
      status: withEntry(access.status, entry),
      ...(access.reasons.length ? { detail: access.reasons.join('; ') } : {}),
      targetKind: 'SHOP',
    });
  }

  for (const name of content.npcs) {
    if (!MERCHANT_SERVICES[name]) continue;
    const access = evaluateEntityAccess(name, 'npc', coord, context.unlocks, context.gameModeId, context.contentService, context.reachableChunks);
    add('SHOPS', { key: `service:${name.toLowerCase()}`, name, status: withEntry(access.status, entry), detail: access.reasons.join('; ') || 'NPC service', targetKind: 'NPC' });
  }

  for (const name of Object.keys(content.quests)) {
    const access = questStatus(name, context);
    add('QUESTS', {
      key: `quest:${name.toLowerCase()}`,
      name,
      status: withEntry(access.status, entry),
      ...(access.reasons.length ? { detail: access.reasons.join('; ') } : {}),
    });
  }

  for (const monster of content.monsters) {
    const bossId = canonicalBossId(monster.name);
    if (bossId) {
      add('ACTIVITIES', {
        key: `boss:${monster.name.toLowerCase()}`,
        name: monster.name,
        status: withEntry(
          context.unlocks.bosses.includes(bossId) ? 'ALLOWED' : 'LOCKED',
          entry,
        ),
        targetKind: 'ACTIVITY',
      });
      continue;
    }
    const slayerMet = monster.slayer == null || meetsSkillRequirement(context.unlocks, 'Slayer', monster.slayer);
    const row: ChunkPermissionRow = {
      key: `combat:${monster.name.toLowerCase()}`,
      name: monster.name,
      status: withEntry(slayerMet ? 'ALLOWED' : 'NOT_READY', entry),
      targetKind: 'NPC',
    };
    add('COMBAT', row);
    // A row waiting on its Slayer level names it first, as skilling rows do; a locked row says only why it is locked.
    if (!slayerMet && row.status === 'NOT_READY') {
      row.detail = [skillLine(context.unlocks, 'Slayer', monster.slayer!), row.detail].filter(Boolean).join('; ');
    }
  }

  for (const [name] of content.objects) {
    const patch = farmingPatchFor(name);
    if (patch) {
      const unlocked = context.unlocks.farming.includes(patch);
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
    add('SKILLING', {
      key: `skill:${name.toLowerCase()}`,
      name,
      status: withEntry(
        resourceUsable(requirement, context.unlocks) ? 'ALLOWED' : 'NOT_READY',
        entry,
      ),
      detail: skillLine(context.unlocks, requirement.skill, requirement.level),
      targetKind: 'OBJECT',
    });
  }

  // One row per shortcut, placed and judged as the Shortcuts panels do: every
  // level, its quests and diary tiers. The chunk's entry covers ownership and routes.
  const here = shortcutsByChunk(context.shortcuts ?? [], context.shortcutContent).get(chunkKey) ?? [];
  for (const row of shortcutReachability(here, context.unlocks, () => ({ ...coord, unlocked: true })).rows) {
    const levels = row.requirements.map(({ skill, level }) => `${skill} ${context.unlocks.levels[skill] ?? 1}/${level}`).join(', ');
    const needs = [row.quest, row.diary].filter(Boolean).map(need => `Needs ${need}`);
    add('TRAVEL', {
      key: `travel:${row.name.toLowerCase()}`,
      name: row.name,
      status: withEntry(row.status === 'ready' ? 'ALLOWED' : 'NOT_READY', entry),
      detail: [levels, ...needs].join('; '),
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
  const entryReason = chunkEntryReason(coord, entry, context.unlocks, context.gameModeId,
    context.contentService?.chunkEntryRequirements(coord.cx, coord.cy) ?? []);
  const area = place.subArea ?? place.region;
  return {
    chunkKey,
    name: content.name ?? place.subArea,
    region: place.region,
    entry,
    ...(entryReason ? { entryReason } : {}),
    kind: OCEAN_CHUNK_KEYS.has(chunkKey) ? 'ocean' : 'land',
    ...(area ? { area } : {}),
    categories,
    counts: {
      allowed: rows.filter((row) => row.status === 'ALLOWED').length,
      notReady: rows.filter((row) => row.status === 'NOT_READY').length,
      locked: rows.filter((row) => row.status === 'LOCKED').length,
      unknown: rows.filter((row) => row.status === 'UNKNOWN').length,
    },
  };
}
