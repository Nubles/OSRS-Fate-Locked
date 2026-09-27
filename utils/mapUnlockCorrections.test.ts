import { visibleAreaUnlocks } from '../data/areaMapPolicy';
import { planForTarget } from './goalPlanner';
import { isValidUnlock } from './gameEngine';
import { afterEach, describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { TableType } from '../types';
import { REGIONS_LIST, REGION_GROUPS } from '../data/items';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { chunkUnlocked, chunkUnlockRequirement, placeOf } from './chunkLocations';
import { ALL_CHUNKS, isChunkUnlocked, chunkKey } from './chunkAdjacency';
import { isAreaReachable, isRegionUnlocked } from './reachability';
import { isFreeArea, setStartArea } from './freeAreas';
import { evaluateDiaryTaskEligibility } from './journalStatus';
import { MAX_COUNTER, validateAndMigrateSave } from './saveSchema';
import { buildRuneliteBundle } from './runeliteBundle';

afterEach(() => setStartArea('misthalin'));
const migrate = (state: ReturnType<typeof createFreshState>) => {
  const result = validateAndMigrateSave(state, createFreshState());
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.state;
};

describe('map unlock corrections', () => {
  it.each(['misthalin', 'lumbridge', 'none'])('keeps Tutorial Island free outside paid progression (%s)', start => {
    setStartArea(start);
    expect(isFreeArea('Tutorial Island')).toBe(true);
    expect(isAreaReachable('Tutorial Island', createFreshState().unlocks, 'chunked')).toBe(true);
    expect(REGIONS_LIST).not.toContain('Tutorial Island');
    expect(isRegionUnlocked('Islands & Others', REGION_GROUPS['Islands & Others'])).toBe(true);
  });
  it.each(['key', 'chaosKey', 'specialKey'] as const)('refunds Tutorial Island once in its paid currency (%s), preserving history', costType => {
    const state = createFreshState();
    state.unlocks.regions = ['Tutorial Island', 'Port Khazard', 'Chaos Temple'];
    delete state.areaUnlockRevision;
    state.history = [{ id: 'paid', timestamp: 100, type: 'UNLOCK', message: 'Unlocked Tutorial Island', hash: 'untouched',
      meta: { item: 'Tutorial Island', category: TableType.REGIONS, cost: 1, costType } }];
    if (costType !== 'specialKey') state.pendingUnlock = { id: 'reveal', table: TableType.REGIONS, item: 'Tutorial Island', costType, cost: 1 };
    const counter = costType === 'key' ? 'keys' : costType === 'chaosKey' ? 'chaosKeys' : 'specialKeys';
    const next = migrate(state);
    expect(next[counter]).toBe(state[counter] + 1);
    expect(next.unlocks.regions).toEqual(['Port Khazard', 'Chaos Temple', 'Khazard Battlefield', 'Chaos Altar']);
    expect(next.pendingUnlock).toBeUndefined();
    expect(next.history).toEqual(state.history);
    expect(next.fateCompensation).toEqual(state.fateCompensation);
    expect(migrate(next)).toEqual(next);
  });
  it('keeps capped refund credit until the counter has room', () => {
    const state = createFreshState();
    state.keys = MAX_COUNTER;
    state.unlocks.regions = ['Tutorial Island'];
    const capped = migrate(state);
    expect(capped.keys).toBe(MAX_COUNTER);
    expect(capped.unlocks.regions).toContain('Tutorial Island');
    capped.keys -= 1;
    const refunded = migrate(capped);
    expect(refunded.keys).toBe(MAX_COUNTER);
    expect(refunded.unlocks.regions).not.toContain('Tutorial Island');
    expect(migrate(refunded)).toEqual(refunded);
  });
  it('does not grant bundled areas to new purchases after migration', () => {
    const state = createFreshState();
    state.unlocks.regions = ['Port Khazard', 'Chaos Temple'];
    expect(migrate(state).unlocks.regions).toEqual(state.unlocks.regions);
    expect(placeOf(39, 50).subArea).toBe('Khazard Battlefield');
    expect(placeOf(46, 59).subArea).toBe('Chaos Altar');
    expect(chunkUnlocked(39, 50, state.unlocks)).toBe(false);
    expect(chunkUnlocked(46, 59, state.unlocks)).toBe(false);
    expect(chunkUnlocked(41, 49, state.unlocks)).toBe(true);
    expect(chunkUnlocked(50, 56, state.unlocks)).toBe(true);
  });
  it('matches the map for every coordinate with only the start and after a single roll', () => {
    for (const chunks of [[], ['49,50'], ['46,59']]) {
      const unlocks = { ...createFreshState().unlocks, chunks };
      for (const coord of ALL_CHUNKS) expect(chunkUnlocked(coord.cx, coord.cy, unlocks, 'chunked'), chunkKey(coord))
        .toBe(isChunkUnlocked(chunkKey(coord), chunks));
    }
  });
  it('accepts legacy parent ownership consistently and explains generic completion', () => {
    const unlocks = { ...createFreshState().unlocks, regions: ['Kharidian Desert'] };
    expect(isAreaReachable('Shantay Pass', unlocks)).toBe(true);
    expect(chunkUnlocked(51, 48, unlocks)).toBe(true);
    expect(isValidUnlock(TableType.REGIONS, 'Shantay Pass', unlocks)).toBe(false);
    const partial = { ...unlocks, regions: ['Shantay Pass'] };
    expect(chunkUnlocked(53, 43, partial)).toBe(false);
    const explanation = chunkUnlockRequirement(53, 43, partial);
    expect(explanation.text).toContain('(1/15)');
    expect(explanation.remaining).toHaveLength(14);
    expect(explanation.remaining).not.toContain('Shantay Pass');
    expect(chunkUnlockRequirement(53, 43, unlocks).remaining).toEqual([]);
  });
  it('exports separate physical owners to RuneLite', async () => {
    const state = createFreshState();
    const bundle = await buildRuneliteBundle([], state);
    expect(JSON.stringify(bundle)).toContain('Khazard Battlefield');
    expect(SUB_AREA_CHUNKS['Port Khazard']).toEqual([{ cx: 41, cy: 49 }]);
    expect(SUB_AREA_CHUNKS['Chaos Temple']).not.toContainEqual({ cx: 46, cy: 59 });
  });
  it('does not count a Ferox foothold as dragons, ore, Ents or all bosses', () => {
    const unlocks = createFreshState().unlocks;
    unlocks.regions = ['Ferox Enclave'];
    unlocks.chunks = ['48,56'];
    for (const id of ['wild_med_2', 'wilderness_med_1', 'wilderness_med_2', 'wild_elite_1']) {
      const task = ALL_DIARY_TASKS.find(task => task.id === id)!;
      for (const mode of ['vanilla', 'chunked']) expect(evaluateDiaryTaskEligibility(task, unlocks, mode).machineEligible, id + mode).toBe(false);
    }
    const dragons = ALL_DIARY_TASKS.find(task => task.id === 'wild_med_2')!;
    unlocks.chunks = ['46,56'];
    expect(evaluateDiaryTaskEligibility(dragons, unlocks, 'chunked').eligible).toBe(true);
    unlocks.regions = ['Graveyard of Shadows'];
    expect(evaluateDiaryTaskEligibility(dragons, unlocks, 'vanilla').eligible).toBe(true);
  });
  it('requires all three boss locations, allowing mixed greater/lesser routes', () => {
    const task = ALL_DIARY_TASKS.find(task => task.id === 'wild_elite_1')!;
    const unlocks = createFreshState().unlocks;
    // Artio's, Venenatis's and Calvar'ion's entrances; each boss needs its unlock too.
    unlocks.bosses = ['Artio', 'Venenatis', "Calvar'ion"];
    unlocks.chunks = ['48,57', '51,59'];
    expect(evaluateDiaryTaskEligibility(task, unlocks, 'chunked').machineEligible).toBe(false);
    unlocks.chunks.push('49,57');
    expect(evaluateDiaryTaskEligibility(task, { ...unlocks, bosses: [] }, 'chunked').machineEligible).toBe(false);
    const ready = evaluateDiaryTaskEligibility(task, unlocks, 'chunked');
    expect(ready.machineEligible).toBe(true);
    expect(ready.manualChecks.length).toBeGreaterThan(0);
  });
});


it('plans actual chunk alternatives and never invents a dragon-area roll', () => {
  const unlocks = createFreshState().unlocks;
  unlocks.completedTasks = ALL_DIARY_TASKS.filter(t => t.tierId === 'Wilderness Medium' && t.id !== 'wild_med_2').map(t => t.id);
  const plan = planForTarget('diary', 'Wilderness Medium', unlocks, 'chunked')!;
  const dragonRoute = plan.alternativeSteps.find(step => step.label.includes('green dragons'))!;
  expect(dragonRoute.routes).toHaveLength(6);
  expect(dragonRoute.routes[0].blockers).toContainEqual(expect.objectContaining({ id: '46,56', unlockTable: TableType.CHUNKS }));
  const named = planForTarget('diary', 'Wilderness Medium', unlocks, 'vanilla')!;
  expect(named.alternativeSteps.flatMap(step => step.routes.flatMap(route => route.blockers))
    .every(step => REGIONS_LIST.includes(step.id))).toBe(true);
});

it('counts legacy parent entitlements once and excludes outstanding onboarding credit', () => {
  expect(visibleAreaUnlocks(['Kharidian Desert', 'Shantay Pass', 'Tutorial Island']))
    .toEqual(REGION_GROUPS['Kharidian Desert']);
});
