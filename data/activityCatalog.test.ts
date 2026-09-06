import { describe, expect, it } from 'vitest';
import { activityId, createActivityIndex, indexActivityRecords } from './activityCatalog';
import { ACTIVITY_REQUIREMENTS, getActivityReq } from './activityRequirements';
import { ACTIVITY_ACCESS_AREAS, NO_HARD_LOCATION_GATE } from './activityAccess';
import { getActivityAccess } from '../utils/activityAccess';
import type { UnlockState } from '../types';

describe('canonical activity joins', () => {
  it('registers every authored requirement and location declaration', () => {
    expect(() => indexActivityRecords(ACTIVITY_REQUIREMENTS)).not.toThrow();
    expect(() => indexActivityRecords(ACTIVITY_ACCESS_AREAS)).not.toThrow();
    for (const name of NO_HARD_LOCATION_GATE) expect(activityId(name), name).toBeDefined();
  });
  it('fails on duplicate identities and dangling references', () => {
    const row = { id: 'activity:0001' as const, name: 'Example' };
    expect(() => createActivityIndex([row, row])).toThrow();
    expect(() => createActivityIndex([row, { ...row, id: 'activity:0002' }])).toThrow();
    expect(() => indexActivityRecords({ Missing: {} })).toThrow('Dangling');
  });
  it('uses the same canonical requirement and access join for IDs and labels', () => {
    const id = activityId('Pest Control')!;
    const unlocks = { regions: ["Void Knights' Outpost"] } as UnlockState;
    expect(getActivityReq(id)).toEqual(getActivityReq('Pest Control'));
    expect(getActivityAccess(id, unlocks, 'vanilla')).toEqual(getActivityAccess('Pest Control', unlocks, 'vanilla'));
    expect(getActivityAccess(id, unlocks, 'vanilla').eligible).toBe(true);
    expect(getActivityReq('constructor')).toBeUndefined();
  });
});
