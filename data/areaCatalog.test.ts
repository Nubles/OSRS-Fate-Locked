import { afterEach, describe, expect, it } from 'vitest';
import { AREA_CATALOG, areaId, areaUnlockIds, createAreaIndex } from './areaCatalog';
import { ACTIVITY_ACCESS_AREAS } from './activityAccess';
import { isAreaReachable, isRegionUnlocked } from '../utils/reachability';
import { setStartArea } from '../utils/freeAreas';
import type { UnlockState } from '../types';

afterEach(() => setStartArea());
describe('immutable area identities', () => {
  it('rejects duplicate IDs, names, dangling parents and aliases', () => {
    const row = { id: 'area:0001' as const, name: 'First' };
    expect(() => createAreaIndex([row, row])).toThrow();
    expect(() => createAreaIndex([row, { ...row, id: 'area:0002' }])).toThrow();
    expect(() => createAreaIndex([{ ...row, parentId: 'area:9999' }])).toThrow();
    expect(() => createAreaIndex([row], { Old: 'Missing' })).toThrow();
    expect(() => createAreaIndex([row], { First: 'First' })).toThrow();
  });
  it('keeps identity across a display rename with a legacy boundary alias', () => {
    const index = createAreaIndex([{ id: 'area:0001', name: 'New name' }], { 'Old name': 'New name' });
    expect(index.resolve('New name')).toBe(index.resolve('Old name'));
    expect(index.resolve('area:0001')).toBe(index.resolve('Old name'));
  });
  it('has no dangling activity geography references', () => {
    for (const areas of Object.values(ACTIVITY_ACCESS_AREAS)) {
      for (const name of areas) expect(areaId(name), name).toBeDefined();
    }
  });
  it('matches canonical IDs, legacy save labels and aliases without rewriting saves', () => {
    setStartArea('none');
    const saved = ['Elf Camp', 'unrecognized future area'];
    const id = areaId('Iorwerth Camp')!;
    const unlocks = { regions: saved } as UnlockState;
    expect(isAreaReachable(id, unlocks)).toBe(true);
    expect(isAreaReachable('Iorwerth Camp', unlocks)).toBe(true);
    expect(isRegionUnlocked('Elf Camp', [id])).toBe(true);
    expect(areaUnlockIds(saved)).toEqual(new Set([id]));
    expect(saved).toEqual(['Elf Camp', 'unrecognized future area']);
    expect(isAreaReachable('unrecognized future area', unlocks)).toBe(false);
    expect(areaId('constructor')).toBeUndefined();
  });
  it('keeps every area and parent resolvable by immutable ID', () => {
    for (const row of AREA_CATALOG) {
      expect(areaId(row.name)).toBe(row.id);
      if (row.parentId) expect(areaId(row.parentId)).toBe(row.parentId);
    }
  });
});
