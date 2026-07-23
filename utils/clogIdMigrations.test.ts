import { describe, it, expect } from 'vitest';
import { migrateClogIds, CLOG_ID_MIGRATIONS } from './clogIdMigrations';
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';

describe('migrateClogIds', () => {
  it('moves progress from a retired id to its survivor', () => {
    expect(migrateClogIds({ 104011: 2 })).toEqual({ 104002: 2 });
  });

  it('merges by max when both ids carry progress (same physical drop)', () => {
    expect(migrateClogIds({ 104011: 1, 104002: 3 })).toEqual({ 104002: 3 });
    expect(migrateClogIds({ 104011: 5, 104002: 3 })).toEqual({ 104002: 5 });
  });

  it('returns the input object untouched when nothing migrates', () => {
    const clog = { 101001: 1 };
    expect(migrateClogIds(clog)).toBe(clog);
  });

  it('every retired id is really gone from the data, and every survivor exists', () => {
    const liveIds = new Set<number>();
    for (const tab of Object.values(COLLECTION_LOG_DATA))
      for (const page of Object.values(tab.pages))
        for (const item of page.items) liveIds.add(item.id);
    for (const [from, to] of Object.entries(CLOG_ID_MIGRATIONS)) {
      expect(liveIds.has(Number(from)), `retired id ${from} still in data`).toBe(false);
      expect(liveIds.has(to), `surviving id ${to} missing from data`).toBe(true);
    }
  });
});
