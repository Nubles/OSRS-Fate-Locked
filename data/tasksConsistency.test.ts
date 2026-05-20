import { describe, it, expect } from 'vitest';
import { ALL_CA_TASKS } from './caTasks';
import { ALL_DIARY_TASKS } from './diaryTasks';
import { CA_DATA } from './caData';
import { DIARY_DATA } from './diaryData';
import { QUEST_DATA } from './questData';
import {
  SKILLS_LIST, REGION_GROUPS, MISTHALIN_AREAS,
} from './items';

/**
 * Integrity guards for the per-task lists that drive CALog / DiaryLog.
 *
 * The diary log renders each task's `skills` / `quests` / `regions` as red /
 * green chips, so any unknown reference (a skill that isn't a skill, a
 * mistyped quest, a place name that isn't in REGION_GROUPS) shows up as a
 * permanently-red chip nobody can satisfy. These guards catch that drift on
 * every CI run.
 */

const VALID_QUEST = new Set(Object.values(QUEST_DATA).map((q) => q.name));
const VALID_SKILL = new Set(SKILLS_LIST);
const VALID_REGION = new Set<string>([
  'Misthalin', ...MISTHALIN_AREAS, ...Object.keys(REGION_GROUPS),
  ...Object.values(REGION_GROUPS).flat(),
]);
const VALID_CA_TIER = new Set(Object.keys(CA_DATA));
const VALID_DIARY_TIER = new Set(Object.keys(DIARY_DATA));

describe('CA task list references resolve', () => {
  it('every CA task tierId matches CA_DATA', () => {
    const bad = ALL_CA_TASKS.filter((t) => !VALID_CA_TIER.has(t.tierId))
      .map((t) => `${t.id} -> "${t.tierId}"`);
    expect(bad, 'CA tasks with unknown tier IDs').toEqual([]);
  });
});

describe('Diary task list references resolve', () => {
  it('every diary task tierId matches DIARY_DATA', () => {
    const bad = (ALL_DIARY_TASKS as any[]).filter((t) => !VALID_DIARY_TIER.has(t.tierId))
      .map((t) => `${t.id} -> "${t.tierId}"`);
    expect(bad, 'diary tasks with unknown tier IDs').toEqual([]);
  });

  it('every skill key is in SKILLS_LIST', () => {
    const bad: string[] = [];
    for (const t of ALL_DIARY_TASKS as any[]) {
      for (const s of Object.keys(t.skills || {})) {
        if (!VALID_SKILL.has(s)) bad.push(`${t.id} -> "${s}"`);
      }
    }
    expect(bad, 'diary tasks with unknown skills').toEqual([]);
  });

  it('every quest name matches QUEST_DATA', () => {
    const bad: string[] = [];
    for (const t of ALL_DIARY_TASKS as any[]) {
      for (const q of t.quests || []) {
        if (!VALID_QUEST.has(q)) bad.push(`${t.id} -> "${q}"`);
      }
    }
    expect(bad, 'diary tasks with unknown quests').toEqual([]);
  });

  it('every region tag is a known area', () => {
    const bad: string[] = [];
    for (const t of ALL_DIARY_TASKS as any[]) {
      for (const r of t.regions || []) {
        if (!VALID_REGION.has(r)) bad.push(`${t.id} -> "${r}"`);
      }
    }
    expect(bad, 'diary tasks with unknown region tags').toEqual([]);
  });
});
