import type { ChunkContent } from '../../services/ChunkContentService';

export type ChunkInfoMode = 'chunk' | 'region';
export type ChunkInfoScope = 'available' | 'locked' | 'mixed';
export type ChunkInfoItemState = 'available' | 'locked' | 'completed' | 'mixed' | 'neutral';
export type ChunkInfoSectionId = 'quests' | 'combat' | 'gathering' | 'shops' | 'travel' | 'other';

export const CHUNK_INFO_SECTION_ORDER: readonly ChunkInfoSectionId[] = [
  'quests', 'combat', 'gathering', 'shops', 'travel', 'other',
];

export interface ChunkInfoSectionStats {
  available: number;
  locked: number;
  completed: number;
  mixed: number;
  neutral: number;
  actionable: number;
  total: number;
}

export type ChunkInfoDrawerSummary =
  | { kind: 'availability'; available: number; locked: number }
  | { kind: 'indexed'; indexedActivities: number; groups: number };

export const getChunkInfoScope = (
  mode: ChunkInfoMode,
  wholeAreaOwnershipMixed: boolean,
  unlocked: boolean,
): ChunkInfoScope => mode === 'region' && wholeAreaOwnershipMixed
  ? 'mixed'
  : unlocked ? 'available' : 'locked';

export const resolveChunkInfoItemState = (
  intrinsicAvailable: boolean,
  scope: ChunkInfoScope,
): ChunkInfoItemState => scope === 'mixed'
  ? 'mixed'
  : scope === 'available' && intrinsicAvailable ? 'available' : 'locked';

export const buildChunkInfoSectionStats = (
  states: readonly ChunkInfoItemState[],
): ChunkInfoSectionStats => {
  const stats: ChunkInfoSectionStats = {
    available: 0,
    locked: 0,
    completed: 0,
    mixed: 0,
    neutral: 0,
    actionable: 0,
    total: states.length,
  };
  for (const state of states) stats[state] += 1;
  stats.actionable = stats.available + stats.locked + stats.mixed;
  return stats;
};

export const buildChunkInfoDrawerSummary = (
  sections: Partial<Record<ChunkInfoSectionId, ChunkInfoSectionStats>>,
  scope: ChunkInfoScope,
): ChunkInfoDrawerSummary => {
  const nonEmpty = Object.values(sections).filter(
    (stats): stats is ChunkInfoSectionStats => Boolean(stats?.total),
  );
  if (scope === 'mixed') {
    return {
      kind: 'indexed',
      indexedActivities: nonEmpty.reduce((sum, stats) => sum + stats.actionable, 0),
      groups: nonEmpty.length,
    };
  }
  return {
    kind: 'availability',
    available: nonEmpty.reduce((sum, stats) => sum + stats.available, 0),
    locked: nonEmpty.reduce((sum, stats) => sum + stats.locked, 0),
  };
};

export const formatChunkInfoSectionSummary = (
  stats: ChunkInfoSectionStats,
  scope: ChunkInfoScope,
): string => {
  if (scope === 'mixed') return `${stats.total} indexed`;
  const parts = [
    stats.available ? `${stats.available} ready` : '',
    stats.locked ? `${stats.locked} locked` : '',
    stats.completed ? `${stats.completed} done` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : `${stats.total} items`;
};

export const getDefaultChunkInfoSection = (
  ids: readonly ChunkInfoSectionId[],
): ChunkInfoSectionId | null => CHUNK_INFO_SECTION_ORDER.find(id => ids.includes(id)) ?? null;

export const chunkContentIsEmpty = (content: ChunkContent): boolean =>
  content.monsters.length === 0 &&
  content.npcs.length === 0 &&
  content.objects.length === 0 &&
  content.shops.length === 0 &&
  Object.keys(content.quests).length === 0 &&
  Object.keys(content.diaries).length === 0 &&
  Object.keys(content.clues).length === 0 &&
  content.spawns.length === 0;
