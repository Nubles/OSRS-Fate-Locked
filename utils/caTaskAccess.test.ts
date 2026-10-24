import { describe, expect, it } from 'vitest';
import { ALL_CA_TASKS } from '../data/caTasks';
import { ACTIVITY_ACCESS_AREAS, NO_HARD_LOCATION_GATE } from '../data/activityAccess';
import type { UnlockState } from '../types';
import type { AreaRoutes } from './areaRoutes';
import { bossAreaBlocker, caTaskBlocker, caTaskBlockerText } from './caTaskAccess';
import { canonicalBossId } from './contentIdentity';

const run = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: ['Lumbridge'],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  ...over,
});

const taskAt = (boss: string) => ALL_CA_TASKS.find(task => canonicalBossId(task.monster) === boss)!;

describe('caTaskBlocker', () => {
  it('asks for the boss first, then its area', () => {
    const task = taskAt('Vorkath');
    expect(caTaskBlocker(task, run(), 'vanilla')).toEqual({ kind: 'boss', boss: 'Vorkath', label: 'Unlock Vorkath' });
    const blocker = caTaskBlocker(task, run({ bosses: ['Vorkath'] }), 'vanilla');
    expect(blocker).toEqual({ kind: 'area', boss: 'Vorkath', label: 'Needs Rellekka' });
    expect(caTaskBlockerText(blocker!)).toBe("Vorkath is unlocked, but you can't get there yet: needs Rellekka.");
    expect(caTaskBlocker(task, run({ bosses: ['Vorkath'], regions: ['Lumbridge', 'Rellekka'] }), 'vanilla')).toBeUndefined();
  });

  it('holds back an owned area no route reaches', () => {
    const unlocks = run({ bosses: ['Vorkath'], regions: ['Lumbridge', 'Rellekka'] });
    const routes: AreaRoutes = { strandedAreas: new Set(['Rellekka']), strandedChunks: new Set() };
    expect(caTaskBlocker(taskAt('Vorkath'), unlocks, 'vanilla', routes)?.label).toBe('No route to Rellekka yet');
  });

  it('needs a way onto an island, not only the island', () => {
    const island = run({ bosses: ['Dagannoth Kings'], regions: ['Lumbridge', 'Waterbirth Island'] });
    expect(caTaskBlocker(taskAt('Dagannoth Kings'), island, 'vanilla')?.label).toBe('No route to Waterbirth Island yet');
    // Jarvald takes anyone who pays from Rellekka: a route the player confirms still counts.
    const boat = run({ ...island, regions: [...island.regions, 'Rellekka'] });
    expect(caTaskBlocker(taskAt('Dagannoth Kings'), boat, 'vanilla')).toBeUndefined();
  });

  it('applies in the legacy modes too', () => {
    expect(caTaskBlocker(taskAt('Vorkath'), run({ bosses: ['Vorkath'] }), 'casual')?.kind).toBe('area');
  });

  it('says nothing about a done task or a monster that is not a boss', () => {
    const task = taskAt('Vorkath');
    expect(caTaskBlocker(task, run({ completedTasks: [task.id] }), 'vanilla')).toBeUndefined();
    expect(caTaskBlocker({ id: 'x', monster: 'Kurask' }, run(), 'vanilla')).toBeUndefined();
  });
});

describe('bossAreaBlocker', () => {
  it('needs no area for a boss with no tracked one', () => {
    for (const boss of NO_HARD_LOCATION_GATE) expect(bossAreaBlocker(boss, run(), 'vanilla'), boss).toBeUndefined();
  });

  it('knows where every Combat Achievement boss is', () => {
    const bosses = new Set(ALL_CA_TASKS.map(task => canonicalBossId(task.monster)).filter((boss): boss is string => !!boss));
    const unplaced = [...bosses].filter(boss => !ACTIVITY_ACCESS_AREAS[boss] && !NO_HARD_LOCATION_GATE.has(boss));
    expect(unplaced).toEqual([]);
  });
});
