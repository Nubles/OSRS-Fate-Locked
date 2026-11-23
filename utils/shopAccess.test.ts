import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { initialState } from '../context/GameContext';
import { GUILDS_LIST, MERCHANTS_LIST, MOBILITY_LIST, REGIONS_LIST, SKILLS_LIST } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import { ChunkContentService } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { computeAreaRoutes } from './areaRoutes';
import { runReach } from './chunkEntry';
import { evaluateEntityAccess } from './entityAccess';
import { shopLocationAccess } from './shopAccess';

const service = new ChunkContentService();
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
  await import('./travelReach');
});

// Every area, category and skill, so only the way there decides.
const owned = (quests: string[]): UnlockState => ({
  ...initialState.unlocks,
  regions: [...REGIONS_LIST], merchants: [...MERCHANTS_LIST], guilds: [...GUILDS_LIST], mobility: [...MOBILITY_LIST],
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  quests,
});

const directory = (name: string, cx: number, cy: number, unlocks: UnlockState) => {
  const reach = runReach(service, unlocks, 'vanilla');
  const routes = computeAreaRoutes(service.connectGraph(), unlocks, 'vanilla');
  return shopLocationAccess({ name, kind: 'shop' }, { cx, cy }, unlocks, 'vanilla', reach, routes, service);
};

// Audit minigames-misc d2 0: the directory asked only for the land and the category.
describe('the shop directory asks for a way to the shop', () => {
  const shops: [string, number, number][] = [['Moon Clan General Store', 32, 61], ['Island Greengrocer', 39, 60]];

  it.each(shops)('%s is not usable before the quest that leads there', (name, cx, cy) => {
    const none = owned([]);
    // What the directory said before: the land and the category were enough.
    expect(evaluateEntityAccess(name, 'shop', { cx, cy }, none, 'vanilla', service).status).toBe('ALLOWED');
    expect(directory(name, cx, cy, none)).toEqual({ status: 'NOT_READY', reasons: ['No reachable route to this location'] });
  });

  it.each(shops)('%s is usable once every quest is done', (name, cx, cy) => {
    expect(directory(name, cx, cy, owned(Object.keys(QUEST_DATA))).status).toBe('ALLOWED');
  });

  it('agrees with the RuneLite export wherever the export has a route', () => {
    const none = owned([]);
    const reach = runReach(service, none, 'vanilla');
    let differ = 0;
    for (const hit of service.entitiesOfKind('shop')) for (const location of hit.locations) {
      const exported = evaluateEntityAccess(hit.name, 'shop', location, none, 'vanilla', service, reach);
      const shown = shopLocationAccess({ name: hit.name, kind: 'shop' }, location, none, 'vanilla', reach, undefined, service);
      if (exported.status !== shown.status) differ++;
    }
    expect(differ).toBe(0);
  });
});
