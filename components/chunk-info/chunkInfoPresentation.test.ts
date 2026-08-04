import { describe, expect, it } from 'vitest';
import type { ChunkContent } from '../../services/ChunkContentService';
import {
  buildChunkInfoDrawerSummary,
  buildChunkInfoSectionStats,
  chunkContentIsEmpty,
  formatChunkInfoSectionSummary,
  getChunkInfoScope,
  getDefaultChunkInfoSection,
  resolveChunkInfoItemState,
  resolveChunkInfoRequirementState,
} from './chunkInfoPresentation';

describe('chunk info presentation', () => {
  it('uses a mixed scope only for Whole-area aggregates with mixed ownership', () => {
    expect(getChunkInfoScope('chunk', true, true)).toBe('available');
    expect(getChunkInfoScope('chunk', true, false)).toBe('locked');
    expect(getChunkInfoScope('region', false, true)).toBe('available');
    expect(getChunkInfoScope('region', true, true)).toBe('mixed');
  });

  it('combines intrinsic and scope availability without guessing mixed state', () => {
    expect(resolveChunkInfoItemState(true, 'available')).toBe('available');
    expect(resolveChunkInfoItemState(false, 'available')).toBe('locked');
    expect(resolveChunkInfoItemState(true, 'locked')).toBe('locked');
    expect(resolveChunkInfoItemState(false, 'mixed')).toBe('mixed');
  });

  it('keeps known blockers locked while leaving only unevaluated extra requirements neutral', () => {
    expect(resolveChunkInfoRequirementState(true, true, 'available')).toBe('neutral');
    expect(resolveChunkInfoRequirementState(false, true, 'available')).toBe('locked');
    expect(resolveChunkInfoRequirementState(true, true, 'locked')).toBe('locked');
    expect(resolveChunkInfoRequirementState(false, false, 'locked')).toBe('locked');
    expect(resolveChunkInfoRequirementState(true, true, 'mixed')).toBe('mixed');
    expect(resolveChunkInfoRequirementState(false, false, 'mixed')).toBe('mixed');
    expect(resolveChunkInfoRequirementState(true, false, 'available')).toBe('available');
  });

  it('formats neutral singleton groups without false indexed claims', () => {
    const neutral = buildChunkInfoSectionStats(['neutral']);
    const mixedAndNeutral = buildChunkInfoSectionStats(['mixed', 'neutral']);

    expect(formatChunkInfoSectionSummary(neutral, 'available')).toBe('1 item');
    expect(formatChunkInfoSectionSummary(neutral, 'mixed')).toBe('1 item');
    expect(formatChunkInfoSectionSummary(mixedAndNeutral, 'mixed')).toBe('1 indexed');
  });
  it('counts actionable, completed, mixed, and neutral rows separately', () => {
    expect(buildChunkInfoSectionStats([
      'available', 'available', 'locked', 'completed', 'mixed', 'neutral',
    ])).toEqual({
      available: 2,
      locked: 1,
      completed: 1,
      mixed: 1,
      neutral: 1,
      actionable: 4,
      total: 6,
    });
  });

  it('builds availability totals for a uniform scope and indexed totals for mixed scope', () => {
    const sections = {
      quests: buildChunkInfoSectionStats(['available', 'completed']),
      combat: buildChunkInfoSectionStats(['available', 'locked']),
      other: buildChunkInfoSectionStats(['neutral']),
    };

    expect(buildChunkInfoDrawerSummary(sections, 'available')).toEqual({
      kind: 'availability',
      available: 2,
      locked: 1,
    });
    expect(buildChunkInfoDrawerSummary(sections, 'mixed')).toEqual({
      kind: 'indexed',
      indexedActivities: 3,
      groups: 3,
    });
  });

  it('formats compact group labels and chooses the stable default group', () => {
    const stats = buildChunkInfoSectionStats(['available', 'available', 'locked', 'completed']);
    expect(formatChunkInfoSectionSummary(stats, 'available')).toBe('2 ready · 1 locked · 1 done');
    expect(formatChunkInfoSectionSummary(stats, 'mixed')).toBe('3 indexed');
    expect(getDefaultChunkInfoSection(['combat', 'other'])).toBe('combat');
    expect(getDefaultChunkInfoSection(['other', 'quests'])).toBe('quests');
    expect(getDefaultChunkInfoSection([])).toBeNull();
  });

  it('recognizes an indexed-content document with no rows', () => {
    const empty: ChunkContent = {
      monsters: [], npcs: [], objects: [], shops: [], quests: {}, diaries: {}, clues: {}, spawns: [],
    };
    expect(chunkContentIsEmpty(empty)).toBe(true);
    expect(chunkContentIsEmpty({ ...empty, npcs: ['Banker'] })).toBe(false);
  });
});
