// The advisors' "unlocks N quests" promises use the same routes as the Quest
// Log: a quest in an owned area that no route reaches is "No route to ...",
// so no advisor may promise it.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import fullChunkContent from '../public/chunk-content.json';
import { createFreshState } from '../context/GameContext';
import { chunkContentService } from '../services/ChunkContentService';
import { QUEST_DATA } from '../data/questData';
import { EQUIPMENT_SLOTS, MERCHANTS_LIST, SKILLS_LIST } from '../data/items';
import { computeAreaRoutes } from './areaRoutes';
import { loadWalkSections } from './walkSections';
import { evaluateQuestEligibility } from './journalStatus';
import { rankSkillBottlenecks } from './skillAdvisor';
import { rankLockedRegions } from './regionAdvisor';
import { computeUnlockImpact } from './unlockImpact';
import type { UnlockState } from '../types';

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => structuredClone(fullChunkContent) })));
  expect(await chunkContentService.init()).toBe(true);
  await loadWalkSections();
});

const routesFor = (unlocks: UnlockState) => computeAreaRoutes(chunkContentService.connectGraph(), unlocks, 'vanilla');
const questByName = (name: string) => Object.values(QUEST_DATA).find(q => q.name === name)!;
const readyWithRoutes = (name: string, unlocks: UnlockState) => {
  const result = evaluateQuestEligibility(questByName(name), unlocks, 'vanilla', routesFor(unlocks));
  return result.status === 'AVAILABLE' && result.eligible;
};

// Witchaven owned with no route to it, Firemaking one level short of Sea Slug.
const strandedWitchaven = (): UnlockState => ({
  ...createFreshState().unlocks,
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 9])),
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: { ...Object.fromEntries(SKILLS_LIST.map(skill => [skill, 1])), Hitpoints: 10, Firemaking: 29 },
  regions: ['Witchaven'], merchants: [...MERCHANTS_LIST], quests: [],
} as UnlockState);

describe('advisors ask the Quest Log routes', () => {
  it('the Skill Advisor does not promise Sea Slug while no route reaches Witchaven', () => {
    const unlocks = strandedWitchaven();
    const routes = routesFor(unlocks);
    expect(routes?.strandedAreas.size).toBeGreaterThan(0);
    // Without routes (still loading) owning the area is enough, as before.
    expect(rankSkillBottlenecks(unlocks, 'vanilla').find(r => r.id === 'Firemaking')?.newQuestNames).toContain('Sea Slug');
    const firemaking = rankSkillBottlenecks(unlocks, 'vanilla', routes).find(r => r.id === 'Firemaking');
    expect(firemaking?.newQuestNames ?? []).not.toContain('Sea Slug');
    expect(readyWithRoutes('Sea Slug', { ...unlocks, levels: { ...unlocks.levels, Firemaking: 30 } })).toBe(false);
  }, 120_000);

  it('"What it unlocks" for a quest counts only route-ready quests', () => {
    const unlocks = strandedWitchaven();
    const routes = routesFor(unlocks);
    const simulated = { ...unlocks, levels: { ...unlocks.levels, Firemaking: 30 } };
    expect(computeUnlockImpact(unlocks, simulated, 'vanilla').directQuestNames).toContain('Sea Slug');
    expect(computeUnlockImpact(unlocks, simulated, 'vanilla', { areaRoutes: routes }).directQuestNames).not.toContain('Sea Slug');
  }, 120_000);

  it('on a brand-new run every quest the Region Advisor names is ready once its area is owned', () => {
    const unlocks = createFreshState().unlocks as UnlockState;
    const ranked = rankLockedRegions(unlocks, 'vanilla', routesFor);
    const promised = ranked.flatMap(r => r.newQuestNames.map(name => ({ area: r.id, name })));
    const broken = promised.filter(({ area, name }) => !readyWithRoutes(name, { ...unlocks, regions: [...unlocks.regions, area] }));
    expect(broken).toEqual([]);
    const eastArdougne = ranked.find(r => r.id === 'East Ardougne');
    for (const name of ["Monk's Friend", 'Clock Tower', 'Hazeel Cult']) {
      expect(eastArdougne?.newQuestNames ?? []).not.toContain(name);
    }
  }, 180_000);
});
