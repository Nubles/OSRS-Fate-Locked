import { describe, it, expect } from 'vitest';
import { STRATEGY_DATABASE } from './requirements';
import { QUEST_DATA } from './questData';
import { DIARY_DATA } from './diaryData';
import {
  SKILLS_LIST, REGION_GROUPS, MISTHALIN_AREAS,
} from './items';

/**
 * Integrity guards for STRATEGY_DATABASE (the goal-tracker source).
 *
 * Mirrors the resourceConsistency guards: every region / skill / quest /
 * diary referenced in a strategy entry must resolve to a real entry in the
 * canonical list. Otherwise the goal's lock analysis silently lists an
 * impossible "Missing X" forever — the original failure mode that motivated
 * adding these tests.
 */

const VALID_REGION = new Set<string>([
  'Misthalin',
  ...MISTHALIN_AREAS,
  ...Object.keys(REGION_GROUPS),
  ...Object.values(REGION_GROUPS).flat(),
]);
const VALID_SKILL = new Set(SKILLS_LIST);
const VALID_QUEST = new Set(Object.values(QUEST_DATA).map((q) => q.name));
const VALID_DIARY = new Set(Object.keys(DIARY_DATA));

describe('STRATEGY_DATABASE references resolve', () => {
  it('every region tag is valid', () => {
    const bad: string[] = [];
    for (const [key, e] of Object.entries(STRATEGY_DATABASE)) {
      for (const r of e.regions || []) {
        if (!VALID_REGION.has(r)) bad.push(`${key} -> "${r}"`);
      }
    }
    expect(bad, 'strategy entries with unknown region tags').toEqual([]);
  });

  it('every skill key is in SKILLS_LIST', () => {
    const bad: string[] = [];
    for (const [key, e] of Object.entries(STRATEGY_DATABASE)) {
      for (const s of Object.keys(e.skills || {})) {
        if (!VALID_SKILL.has(s)) bad.push(`${key} -> "${s}"`);
      }
    }
    expect(bad, 'strategy entries referencing unknown skills').toEqual([]);
  });

  it('every quest name matches QUEST_DATA', () => {
    const bad: string[] = [];
    for (const [key, e] of Object.entries(STRATEGY_DATABASE)) {
      for (const q of e.quests || []) {
        if (!VALID_QUEST.has(q)) bad.push(`${key} -> "${q}"`);
      }
    }
    expect(bad, 'strategy entries referencing unknown quests').toEqual([]);
  });

  it('every diary tier matches DIARY_DATA', () => {
    const bad: string[] = [];
    for (const [key, e] of Object.entries(STRATEGY_DATABASE)) {
      for (const d of e.diaries || []) {
        if (!VALID_DIARY.has(d)) bad.push(`${key} -> "${d}"`);
      }
    }
    expect(bad, 'strategy entries referencing unknown diary tiers').toEqual([]);
  });
});
