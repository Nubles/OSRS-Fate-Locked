import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';
import {
  ARCANA_LIST, BOSSES_LIST, EQUIPMENT_SLOTS, MERCHANTS_LIST, MINIGAMES_LIST, MOBILITY_LIST, SKILLS_LIST,
} from '../data/items';
import type { UnlockState } from '../types';
import { computeAreaRoutes, type AreaRoutes } from './areaRoutes';
import { countDoableTasks, evaluateDiaryTaskEligibility, getDiaryStatus } from './journalStatus';

/**
 * A player reported on 26 September 2026 that diary tasks in owned areas the
 * map calls stranded (owned, but no route from the rest of the run) showed
 * as Can do: catching a Golden Warbler at the Ruins of Uzer and Tindel
 * Marchant in Port Khazard, among others.
 */
const account = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 9])),
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: [], mobility: [...MOBILITY_LIST], arcana: [...ARCANA_LIST], housing: [],
  merchants: [...MERCHANTS_LIST], minigames: [...MINIGAMES_LIST], bosses: [...BOSSES_LIST],
  storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: Object.keys(QUEST_DATA),
  diaries: [], cas: [], completedTasks: [], collectionLog: {}, ...overrides,
});
const id = (cx: number, cy: number) => String(cx * 256 + cy);
const NO_TRANSPORT: Record<string, string[]> = {};
const task = (taskId: string) => ALL_DIARY_TASKS.find(row => row.id === taskId)!;
const exceptTask = (taskId: string) => ALL_DIARY_TASKS
  .filter(row => row.tierId === task(taskId).tierId && row.id !== taskId).map(row => row.id);
const routesFor = (unlocks: UnlockState, connect = NO_TRANSPORT) => computeAreaRoutes(connect, unlocks, 'vanilla')!;
const noRoute = (place: string) => ({ kind: 'alternative', label: `No route to ${place}`, travel: place, blockerKinds: [], routes: [] });

describe('owned areas no route reaches', () => {
  it('finds the Ruins of Uzer stranded when nothing joins it to Misthalin', () => {
    const routes = routesFor(account({ regions: ['Ruins of Uzer'] }));

    expect(routes.strandedAreas.has('Ruins of Uzer')).toBe(true);
    expect(routes.strandedChunks.has('54,47')).toBe(true);
    expect(routes.strandedAreas.has('Lumbridge')).toBe(false);
  });

  it('counts a walk from Lumbridge through owned land', () => {
    expect(routesFor(account({ regions: ['Al Kharid'] })).strandedAreas.has('Al Kharid')).toBe(false);
  });

  it('counts a transport link from an owned chunk', () => {
    const routes = routesFor(account({ regions: ['Ruins of Uzer'] }), { [id(50, 50)]: [id(54, 47)] });

    expect(routes.strandedAreas.has('Ruins of Uzer')).toBe(false);
  });

  it('leaves islands with reviewed entry routes to those routes', () => {
    expect(routesFor(account({ regions: ['Waterbirth Island'] })).strandedAreas.has('Waterbirth Island')).toBe(false);
  });

  it('never calls an area it does not own stranded', () => {
    expect(routesFor(account({ regions: [] })).strandedAreas.has('Ruins of Uzer')).toBe(false);
  });
});

describe('diary tasks in an owned area with no route', () => {
  const uzer = account({ regions: ['Ruins of Uzer'], completedTasks: exceptTask('des_easy_1') });

  it('are not doable, and say there is no route', () => {
    const routes = routesFor(uzer);
    const result = evaluateDiaryTaskEligibility(task('des_easy_1'), uzer, 'vanilla', routes);

    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([noRoute('Ruins of Uzer')]);
    expect(getDiaryStatus(DIARY_DATA['Desert Easy'], uzer, 'vanilla', routes)).toBe('LOCKED_REGION');
    expect(countDoableTasks([task('des_easy_1')], uzer, 'vanilla', routes)).toBe(0);
  });

  it('become doable once a route reaches the area', () => {
    const joined = routesFor(uzer, { [id(50, 50)]: [id(54, 47)] });

    expect(evaluateDiaryTaskEligibility(task('des_easy_1'), uzer, 'vanilla', joined).eligible).toBe(true);
  });

  it('keep the old answer until the map data has loaded', () => {
    expect(evaluateDiaryTaskEligibility(task('des_easy_1'), uzer, 'vanilla').eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(task('des_easy_1'), uzer, 'vanilla', null).eligible).toBe(true);
  });

  it('cover Tindel Marchant in a stranded Port Khazard', () => {
    const khazard = account({ regions: ['Port Khazard'] });
    const routes = routesFor(khazard);

    expect(routes.strandedAreas.has('Port Khazard')).toBe(true);
    expect(evaluateDiaryTaskEligibility(task('ard_easy_7'), khazard, 'vanilla', routes).blockers)
      .toEqual([noRoute('Port Khazard')]);
  });

  it('take any listed area that a route reaches', () => {
    const row = task('ard_hard_9');
    const unlocks = account({ regions: ['Port Khazard', 'Yanille'] });
    const both: AreaRoutes = { strandedAreas: new Set(['Port Khazard', 'Yanille']), strandedChunks: new Set() };
    const one: AreaRoutes = { strandedAreas: new Set(['Port Khazard']), strandedChunks: new Set() };

    expect(evaluateDiaryTaskEligibility(row, unlocks, 'vanilla', both).eligible).toBe(false);
    expect(evaluateDiaryTaskEligibility(row, unlocks, 'vanilla', one).eligible).toBe(true);
  });

  it('need a route to a task\'s own map chunks too', () => {
    const row = task('wild_hard_7');
    const unlocks = account({ regions: ['Wilderness'] });
    const stranded: AreaRoutes = {
      strandedAreas: new Set(),
      strandedChunks: new Set(row.locations!.flatMap(location => location.chunkOptions.map(({ cx, cy }) => `${cx},${cy}`))),
    };

    expect(evaluateDiaryTaskEligibility(row, unlocks, 'vanilla').blockers).toEqual([]);
    expect(evaluateDiaryTaskEligibility(row, unlocks, 'vanilla', stranded).blockers)
      .toEqual(row.locations!.map(location => noRoute(location.label)));
  });
});
