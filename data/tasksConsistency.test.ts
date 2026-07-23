import { describe, it, expect } from 'vitest';
import { ALL_CA_TASKS } from './caTasks';
import { ALL_DIARY_TASKS } from './diaryTasks';
import { CA_DATA } from './caData';
import { DIARY_DATA } from './diaryData';
import { QUEST_DATA, QuestLocationRequirement } from './questData';
import {
  GUILDS_LIST, SKILLS_LIST, REGION_GROUPS, MISTHALIN_AREAS,
} from './items';
import { ALL_CHUNK_KEYS, chunkKey } from '../utils/chunkAdjacency';

/**
 * Integrity guards for the per-task lists that drive CALog / DiaryLog.
 *
 * The diary log renders each task's `skills` / `quests` / `regions` as red /
 * green chips, so any unknown reference (a skill that isn't a skill, a
 * mistyped quest, a place name that isn't in REGION_GROUPS) shows up as a
 * permanently-red chip nobody can satisfy. These guards catch that drift on
 * every CI run.
 */

// Quests are referenced by their key/id in most places (prereqs, requirements)
// but a few have a long display `name` (e.g. "Desert Treasure II - The Fallen
// Empire"), so accept either form.
const VALID_QUEST = new Set<string>([
  ...Object.keys(QUEST_DATA),
  ...Object.values(QUEST_DATA).map((q) => q.name),
]);
const VALID_SKILL = new Set(SKILLS_LIST);
// Non-skill gate that remains in a quest's `skills` map and is resolved
// specially by journalStatus / goalPlanner (computed, not a trainable skill).
const META_SKILL = new Set(['Quest Points']);
const VALID_REGION = new Set<string>([
  'Misthalin', ...MISTHALIN_AREAS, ...Object.keys(REGION_GROUPS),
  ...Object.values(REGION_GROUPS).flat(),
]);
const VALID_GUILD = new Set(GUILDS_LIST);
const VALID_CHUNK = new Set(ALL_CHUNK_KEYS);
const VALID_CA_TIER = new Set(Object.keys(CA_DATA));
const VALID_DIARY_TIER = new Set(Object.keys(DIARY_DATA));

describe('CA task list references resolve', () => {
  it('every CA task tierId matches CA_DATA', () => {
    const bad = ALL_CA_TASKS.filter((t) => !VALID_CA_TIER.has(t.tierId))
      .map((t) => `${t.id} -> "${t.tierId}"`);
    expect(bad, 'CA tasks with unknown tier IDs').toEqual([]);
  });

  it('every CA task id is unique', () => {
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const t of ALL_CA_TASKS) { if (seen.has(t.id)) dups.push(t.id); else seen.add(t.id); }
    expect(dups, 'duplicate CA task ids').toEqual([]);
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

describe('Quest data integrity', () => {
  const keys = new Set(Object.keys(QUEST_DATA));
  const allLocations = (q: (typeof QUEST_DATA)[string]): QuestLocationRequirement[] => [
    ...(q.locations ?? []),
    ...(q.oneOf ?? []).flatMap(option => option.locations ?? []),
  ];

  it('every prereq references a real quest', () => {
    const bad: string[] = [];
    for (const [k, q] of Object.entries(QUEST_DATA))
      for (const p of q.prereqs || []) if (!keys.has(p)) bad.push(`${k} -> "${p}"`);
    expect(bad, 'quests with broken prereq references').toEqual([]);
  });

  it('every quest skill is a real skill or a known meta-gate', () => {
    const bad: string[] = [];
    for (const [k, q] of Object.entries(QUEST_DATA))
      for (const s of Object.keys(q.skills || {}))
        if (!VALID_SKILL.has(s) && !META_SKILL.has(s)) bad.push(`${k} -> "${s}"`);
    expect(bad, 'quests with unknown skill keys').toEqual([]);
  });

  it('every quest region is a known area', () => {
    const bad: string[] = [];
    for (const [k, q] of Object.entries(QUEST_DATA))
      for (const r of q.regions || []) if (!VALID_REGION.has(r)) bad.push(`${k} -> "${r}"`);
    expect(bad, 'quests with unknown region tags').toEqual([]);
  });

  it('every quest location uses known standard areas and canonical chunks', () => {
    const badAreas: string[] = [];
    const badChunks: string[] = [];
    for (const [questId, quest] of Object.entries(QUEST_DATA)) {
      for (const location of allLocations(quest)) {
        if (location.standardAreas.length === 0) badAreas.push(questId + ' -> ' + location.id + ' -> no standard areas');
        if (location.chunkOptions.length === 0) badChunks.push(questId + ' -> ' + location.id + ' -> no chunk coordinates');
        for (const area of location.standardAreas) {
          if (!VALID_REGION.has(area)) badAreas.push(questId + ' -> ' + location.id + ' -> "' + area + '"');
        }
        for (const coord of location.chunkOptions) {
          const key = chunkKey(coord);
          if (!VALID_CHUNK.has(key)) badChunks.push(questId + ' -> ' + location.id + ' -> ' + key);
        }
      }
    }
    expect(badAreas, 'quest locations with unknown standard areas').toEqual([]);
    expect(badChunks, 'quest locations with unknown chunk coordinates').toEqual([]);
  });

  it('every alternative access option references known areas, guilds, and locations', () => {
    const bad: string[] = [];
    for (const [questId, quest] of Object.entries(QUEST_DATA)) {
      for (const option of quest.oneOf ?? []) {
        for (const region of option.regions ?? []) {
          if (!VALID_REGION.has(region)) bad.push(questId + ' -> region "' + region + '"');
        }
        for (const guild of option.guilds ?? []) {
          if (!VALID_GUILD.has(guild)) bad.push(questId + ' -> guild "' + guild + '"');
        }
        for (const location of option.locations ?? []) {
          if (location.standardAreas.length === 0 || location.chunkOptions.length === 0) {
            bad.push(questId + ' -> incomplete location "' + location.id + '"');
          }
        }
      }
    }
    expect(bad, 'quests with invalid alternative access references').toEqual([]);
  });

  it('every quest id matches its key', () => {
    const bad = Object.entries(QUEST_DATA).filter(([k, q]) => q.id !== k).map(([k, q]) => `${k} (id=${q.id})`);
    expect(bad, 'quests whose id !== key').toEqual([]);
  });
});
