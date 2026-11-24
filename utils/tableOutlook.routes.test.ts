// Spend Keys' Table outlook asks the same area routes as the Quest Log and the
// Farm Keys cards: an owned area no route reaches opens nothing, so the
// outlook may not promise what those screens deny after the draw.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import fullChunkContent from '../public/chunk-content.json';
import { createFreshState } from '../context/GameContext';
import { chunkContentService } from '../services/ChunkContentService';
import { QUEST_DATA } from '../data/questData';
import { computeAreaRoutes, type AreaRoutes } from './areaRoutes';
import { loadWalkSections } from './walkSections';
import { evaluateDiaryTaskEligibility, evaluateQuestEligibility } from './journalStatus';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { randomUnlockPool } from './gameEngine';
import { evaluateActivityReadiness } from './activityReadiness';
import { getUtilityActivityReq } from './utilityReadiness';
import { areaOpens, tableOutlook } from './tableOutlook';
import { spendNotes } from './spendNotes';
import { TableType, type UnlockState } from '../types';

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => structuredClone(fullChunkContent) })));
  expect(await chunkContentService.init()).toBe(true);
  await loadWalkSections();
});

const routesFor = (unlocks: UnlockState) => computeAreaRoutes(chunkContentService.connectGraph(), unlocks, 'vanilla');
const routing = (unlocks: UnlockState) => ({ routes: routesFor(unlocks), routesFor });
const questByName = (name: string) => Object.values(QUEST_DATA).find(q => q.name === name)!;
const withArea = (unlocks: UnlockState, area: string): UnlockState => ({ ...unlocks, regions: [...unlocks.regions, area] });

describe('table outlook with area routes', () => {
  // The synthetic stranded set of 'evaluateActivityReadiness with routes'.
  const zulAndra = (): UnlockState => ({
    ...createFreshState().unlocks, regions: ['Lumbridge', 'Zul-Andra'], quests: ['Regicide'], bosses: [],
  } as UnlockState);
  const stranded: AreaRoutes = { strandedAreas: new Set(['Zul-Andra']), strandedChunks: new Set() };

  it('does not count Zulrah as ready if drawn while Zul-Andra has no route', () => {
    const unlocks = zulAndra();
    expect(evaluateActivityReadiness(true, getUtilityActivityReq('Zulrah', TableType.BOSSES, 'vanilla'), unlocks, 'vanilla', stranded).status)
      .toBe('NOT_READY');
    const without = tableOutlook(TableType.BOSSES, unlocks, 'vanilla')!;
    const withRoutes = tableOutlook(TableType.BOSSES, unlocks, 'vanilla', undefined, { routes: stranded })!;
    expect(without.examples).toContain('Zulrah');
    expect(withRoutes.examples).not.toContain('Zulrah');
    expect(withRoutes.useful).toBe(without.useful - 1);
    expect(withRoutes.left).toBe(without.left);
  });

  it('does not count East Ardougne as opening Clock Tower on a fresh Vanilla run', () => {
    const fresh = createFreshState().unlocks;
    const after = withArea(fresh, 'East Ardougne');
    expect(evaluateQuestEligibility(questByName('Clock Tower'), after, 'vanilla', routesFor(after)).status).not.toBe('AVAILABLE');
    const opens = areaOpens(fresh, 'vanilla', undefined, routing(fresh)).opens;
    expect(opens.find(o => o.area === 'East Ardougne')?.quests ?? []).not.toContain('Clock Tower');
  });

  it('still counts an area that really opens a quest, and every promise holds in the Quest Log', () => {
    const fresh = createFreshState().unlocks;
    const opens = areaOpens(fresh, 'vanilla', undefined, routing(fresh)).opens;
    expect(opens.find(o => o.area === 'Falador')?.quests).toContain("Doric's Quest");
    for (const { area, quests } of opens) {
      const after = withArea(fresh, area);
      for (const name of quests) {
        expect(evaluateQuestEligibility(questByName(name), after, 'vanilla', routesFor(after)).status, `${area}: ${name}`).toBe('AVAILABLE');
      }
    }
  }, 30_000);

  it('finds the same areas as trying every one with its routes, on a fresh run', () => {
    const fresh = createFreshState().unlocks;
    const base = routesFor(fresh);
    const quests = Object.values(QUEST_DATA).filter(q => evaluateQuestEligibility(q, fresh, 'vanilla', base).status !== 'AVAILABLE');
    const tasks = ALL_DIARY_TASKS.filter(t => !evaluateDiaryTaskEligibility(t, fresh, 'vanilla', base).machineEligible);
    const brute = randomUnlockPool(fresh, 'vanilla', 'key', TableType.REGIONS).map(c => c.item).filter(area => {
      const after = withArea(fresh, area);
      const routes = routesFor(after);
      return quests.some(q => evaluateQuestEligibility(q, after, 'vanilla', routes).status === 'AVAILABLE')
        || tasks.some(t => evaluateDiaryTaskEligibility(t, after, 'vanilla', routes).machineEligible);
    }).sort();
    const fast = areaOpens(fresh, 'vanilla', undefined, routing(fresh)).opens.map(o => o.area).sort();
    expect(fast.length).toBeGreaterThan(0);
    expect(fast).toEqual(brute);
  }, 60_000);

  it('holds the route-bound outlooks while routes load, and keeps the Banks one and the hopes', () => {
    const fresh = createFreshState().unlocks;
    const notes = spendNotes(fresh, 'vanilla', undefined, [`${TableType.BOSSES}|Zulrah`], true, { routes: null, routesFor: null, pending: true });
    expect([...notes].filter(([, note]) => note.outlook).map(([table]) => table)).toEqual([TableType.BANKS]);
    expect(notes.get(TableType.BOSSES)?.hope).toBeDefined();
    const loaded = spendNotes(fresh, 'vanilla', undefined, [], true, { ...routing(fresh), pending: false });
    expect(loaded.get(TableType.REGIONS)?.outlook?.line).not.toContain('East Ardougne');
  }, 30_000);
});
