/**
 * Chunked mode counts content only when the exact chunk it is in is owned
 * (and reached). These pin the Journal, the Doable tab (which Fate's Mercy
 * reads), the diary and combat-achievement checks, the advisors and the
 * Strategy Guide to that rule, and Vanilla to its old answers.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import full from '../public/chunk-content.json';
import { chunkContentService } from '../services/ChunkContentService';
import { createFreshState } from '../context/GameContext';
import { QUEST_DATA } from '../data/questData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { ALL_CA_TASKS } from '../data/caTasks';
import { SKILLS_LIST } from '../data/items';
import type { UnlockState } from '../types';
import { evaluateDiaryTaskEligibility, evaluateQuestEligibility } from './journalStatus';
import { chunkedQuestRows } from '../components/QuestDoabilityPanel';
import { doableCATasks } from '../components/JournalSummaryCard';
import { analyzeRequirement } from '../components/StrategyGuide';
import { STRATEGY_DATABASE } from '../data/requirements';
import { computeAreaRoutes } from './areaRoutes';
import { buildDiaryIndex, chunkedChunkOpen } from './chunkedContentChecks';
import { getChunkFrontier, chunkKey } from './chunkAdjacency';
import { PANDEMONIUM_ROUTE } from './pandemoniumRoute';
import { planForTarget } from './goalPlanner';
import { rankFrontierChunks } from './frontierAdvisor';
import { chunkedTrainingTiers } from './chunkedSkillPool';
import { calculateSupplyChain, isItemAvailable } from './supplyChain';
import { analyzeQuestPreparation, questItemsObtainableNow } from './questRoutes/analyzeQuest';
import { materializeQuestRouteSnapshot, materializeRuneProofAccount } from './questRoutes/goalPlannerRuneProof';
import { CHUNK_CONTENT_DATA_VERSION } from '../services/ChunkContentService';
import { setStartArea } from './freeAreas';

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => structuredClone(full) })));
  await chunkContentService.init();
  setStartArea('none');
});

const fresh = (patch: Partial<UnlockState> = {}): UnlockState => ({ ...createFreshState().unlocks, chunks: [], ...patch } as UnlockState);
const maxed = (chunks: string[], patch: Partial<UnlockState> = {}): UnlockState => {
  const base = createFreshState().unlocks;
  return {
    ...base, chunks,
    skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
    levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
    equipment: Object.fromEntries(Object.keys(base.equipment ?? {}).map(slot => [slot, 10])),
    quests: [], ...patch,
  } as UnlockState;
};
// A seeded random walk out from the start chunk, as Chunked rolls grow a run.
const walk = (seed: number, n: number): string[] => {
  let s = seed;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const chunks: string[] = [];
  while (chunks.length < n) {
    const frontier = getChunkFrontier(chunks, { quests: [] } as never).map(chunkKey).filter(key => !chunks.includes(key));
    if (!frontier.length) break;
    chunks.push(frontier[Math.floor(next() * frontier.length)]);
  }
  return chunks;
};
const journalReady = (unlocks: UnlockState, mode = 'chunked') => {
  const routes = computeAreaRoutes(chunkContentService.connectGraph(), unlocks, mode);
  return Object.values(QUEST_DATA)
    .filter(quest => evaluateQuestEligibility(quest, unlocks, mode, routes).eligible)
    .map(quest => quest.id).sort();
};
const doableNow = (unlocks: UnlockState) => chunkedQuestRows(unlocks, 'chunked')
  .filter(row => row.bucket === 'DOABLE').map(row => row.id).sort();

describe('Chunked quests count only in their own chunks', () => {
  it('a fresh run has only Learning the Ropes ready, in the Journal and the Doable tab alike', () => {
    const unlocks = fresh();
    expect(journalReady(unlocks)).toEqual(['Learning the Ropes']);
    expect(doableNow(unlocks)).toEqual(['Learning the Ropes']);
  });

  it.each([
    ['The Ides of Milk', ['Lumbridge (49, 51)']],
    ['Vampyre Slayer', ['Draynor Village (48, 51)', 'Varrock (50, 53)']],
    ['X Marks the Spot', ['Port Sarim (47, 50)']],
    ['Sheep Shearer', ['Lumbridge (49, 51)']],
    ['Imp Catcher', ["Wizards' Tower (48, 49)"]],
  ])('%s is not "Can do now" on a fresh run and names the chunks it needs', (id, chunks) => {
    const unlocks = fresh();
    const journal = evaluateQuestEligibility(QUEST_DATA[id], unlocks, 'chunked');
    expect(journal.eligible).toBe(false);
    const labels = journal.blockers.filter(blocker => blocker.kind === 'region').map(blocker => blocker.label);
    for (const chunk of chunks) expect(labels).toContain(chunk);
    const row = chunkedQuestRows(unlocks, 'chunked').find(r => r.id === id)!;
    expect(row.bucket).not.toBe('DOABLE');
    for (const chunk of chunks) expect(row.lockedAreas).toContain(chunk);
  });

  it("names a quest item with no source in the run's chunks (Cook's Assistant's milk)", () => {
    const unlocks = fresh();
    const journal = evaluateQuestEligibility(QUEST_DATA["Cook's Assistant"], unlocks, 'chunked');
    expect(journal.eligible).toBe(false);
    expect(journal.blockers.map(blocker => blocker.label)).toContain('Bucket of milk (no source in your chunks yet)');
    const row = chunkedQuestRows(unlocks, 'chunked').find(r => r.id === "Cook's Assistant")!;
    expect(row.bucket).not.toBe('DOABLE');
  });

  it('the Journal and the Doable tab agree on grown runs', () => {
    for (let i = 1; i <= 6; i++) {
      const unlocks = maxed(walk(i * 7919, 30));
      expect(journalReady(unlocks)).toEqual(doableNow(unlocks));
    }
  });

  it("opens Pandemonium's sea route from Port Sarim without naming the open sea", () => {
    const unlocks = fresh({ chunks: ['49,50', '48,50', '47,50'] });
    for (const key of PANDEMONIUM_ROUTE) {
      const [cx, cy] = key.split(',').map(Number);
      expect(chunkedChunkOpen({ cx, cy }, unlocks)).toBe(true);
    }
    const row = chunkedQuestRows(unlocks, 'chunked').find(r => r.id === 'Pandemonium')!;
    const journal = evaluateQuestEligibility(QUEST_DATA.Pandemonium, unlocks, 'chunked');
    const named = [...row.lockedAreas, ...journal.blockers.map(blocker => blocker.label)];
    for (const key of PANDEMONIUM_ROUTE) expect(named.join('|')).not.toContain(`(${key.replace(',', ', ')})`);
    // Done, the route closes again.
    const done = fresh({ chunks: ['49,50', '48,50', '47,50'], quests: ['Pandemonium'] });
    const sea = [...PANDEMONIUM_ROUTE].find(key => !['47,50', '47,49'].includes(key))!;
    const [cx, cy] = sea.split(',').map(Number);
    expect(chunkedChunkOpen({ cx, cy }, done)).toBe(false);
  });

  it('leaves Vanilla on its named areas', () => {
    const unlocks = fresh({ regions: ['Misthalin'] });
    const before = evaluateQuestEligibility(QUEST_DATA['The Ides of Milk'], unlocks, 'vanilla');
    expect(before.blockers.some(blocker => blocker.kind === 'region' && /\(\d+, \d+\)/.test(blocker.label))).toBe(false);
  });
});

describe('Chunked diary tasks use the Chunk Picker task refs', () => {
  it('maps a tier\'s task refs by their place in the tier', () => {
    const doc = chunkContentService.rawDocument()!;
    const index = buildDiaryIndex(doc.chunks, doc.interiors as never);
    expect(index.get('lum_easy_2')?.chunkOptions).toContainEqual({ cx: 49, cy: 49 });
    expect(index.get('var_easy_1')?.chunkOptions).toContainEqual({ cx: 50, cy: 53 });
    expect(index.size).toBeGreaterThan(200);
  });

  it.each(['lum_easy_2', 'lum_easy_4', 'lum_easy_12', 'lum_elite_5'])('%s is not doable from the start chunk alone', id => {
    const task = ALL_DIARY_TASKS.find(t => t.id === id)!;
    const unlocks = maxed([]);
    const result = evaluateDiaryTaskEligibility(task, unlocks, 'chunked');
    expect(result.eligible).toBe(false);
    expect(result.blockers.some(blocker => blocker.kind === 'region' || blocker.kind === 'alternative')).toBe(true);
  });

  it('a task becomes doable once its own chunk is owned', () => {
    const task = ALL_DIARY_TASKS.find(t => t.id === 'lum_easy_2')!;
    const result = evaluateDiaryTaskEligibility(task, maxed(['49,49', '49,50']), 'chunked');
    expect(result.blockers.filter(blocker => blocker.kind === 'region')).toEqual([]);
  });
});

describe('Chunked combat achievements follow boss reachability', () => {
  it("counts no Obor task until Obor's chunk is reached", () => {
    const tasks = ALL_CA_TASKS.filter(task => task.monster === 'Obor');
    const unlocks = fresh({ bosses: ['Obor'] });
    expect(doableCATasks(tasks, unlocks, 'chunked')).toEqual([]);
    // Vanilla keeps counting an unlocked boss.
    expect(doableCATasks(tasks, unlocks, 'vanilla').length).toBe(tasks.length);
  });
});

describe('Chunked advisors and guides', () => {
  it('credits a chunk that makes a skill trainable', () => {
    // Needs the chunk content (utils/chunkedContentChecks.ts).
    // chunkedTrainingTiers is what Skills Keys roll on: a skill whose first
    // method only this chunk holds becomes trainable once it is owned.
    const ranked = rankFrontierChunks(fresh(), 'chunked');
    const before = chunkedTrainingTiers([]);
    const opener = ranked.find(r => r.newSkills.length > 0);
    expect(opener).toBeDefined();
    const after = chunkedTrainingTiers([opener!.key]);
    for (const skill of opener!.newSkills) {
      expect((before.get(skill) ?? 99) > 1).toBe(true);
      expect(after.get(skill)).toBeLessThanOrEqual(1);
    }
    expect(opener!.sortScore).toBeGreaterThanOrEqual(opener!.newSkills.length * 3);
    // A skill already trainable from the start chunk is never "new".
    for (const r of ranked) for (const skill of r.newSkills) expect((before.get(skill) ?? 99) > 1).toBe(true);
  });

  it('the Goal Planner says to roll chunks, not to pick one', () => {
    const plan = planForTarget('region', 'Falador', maxed([]), 'chunked')!;
    expect(plan.regionSteps[0].detail).toBe('Roll chunks toward this area');
    const quest = planForTarget('quest', "Cook's Assistant", maxed([]), 'chunked')!;
    const steps = [...quest.regionSteps, ...quest.manualSteps];
    expect(steps.map(step => step.detail).join('|')).not.toMatch(/Unlock any chunk/);
  });

  it("the Strategy Guide does not count one desert chunk as Nardah's", () => {
    const req = STRATEGY_DATABASE['Nardah Bank'];
    const alKharid = maxed(['51,49', '51,50'], { merchants: ['Nardah Bank'] });
    const chunked = analyzeRequirement(req, alKharid, 'chunked');
    expect(chunked.isFullyPlayable).toBe(false);
    expect(chunked.missingChecks).toContain('Check it is in your chunks: Kharidian Desert');
    // Vanilla: owning the area is enough, as before.
    const vanilla = analyzeRequirement(req, { ...alKharid, regions: ['Kharidian Desert'] }, 'vanilla');
    expect(vanilla.missingChecks).not.toContain('Check it is in your chunks: Kharidian Desert');
  });

  it('the supply chain places a source by its own chunk', () => {
    // The Leviathan drops its lure in one chunk (48,49); the start chunk is
    // in Misthalin too, but that no longer counts.
    const state = (unlocks: UnlockState, gameModeId = 'chunked') => ({ ...createFreshState(), gameModeId, unlocks }) as never;
    const bosses = ['The Leviathan'];
    const quests = ['Desert Treasure II'];
    expect(isItemAvailable('Leviathan Lure', state(maxed([], { bosses, quests })))).toBe(false);
    expect(calculateSupplyChain('Leviathan Lure', state(maxed([], { bosses, quests })))!.sources[0].status.missing)
      .toContain('Not in your chunks: The Leviathan');
    expect(isItemAvailable('Leviathan Lure', state(maxed(['49,50', '48,49'], { bosses, quests })))).toBe(true);
    expect(isItemAvailable('Leviathan Lure', state(maxed([], { bosses, quests, regions: ['Misthalin'] }), 'vanilla'))).toBe(true);
  });
});

describe("RuneProof's current-only item check", () => {
  it('agrees with the full preparation analysis on what is missing now', () => {
    for (const id of ["Cook's Assistant", 'Sheep Shearer', 'Imp Catcher']) {
      for (const chunks of [[], ['49,51', '50,51', '48,51'], walk(31, 40)]) {
        const unlocks = maxed(chunks);
        const snapshot = {
          ...materializeQuestRouteSnapshot(id, materializeRuneProofAccount(unlocks, 'chunked'), chunkContentService, CHUNK_CONTENT_DATA_VERSION),
          ...materializeRuneProofAccount(unlocks, 'chunked'),
        };
        const now = questItemsObtainableNow(id, snapshot);
        const full = analyzeQuestPreparation(id, snapshot);
        expect(now.status === 'CANNOT_COMPLETE_YET').toBe(full.status === 'CANNOT_COMPLETE_YET');
      }
    }
  });
});
