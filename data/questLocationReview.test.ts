import { describe, expect, it } from 'vitest';
import review from './sources/quest-location-review.json';
import { QUEST_DATA } from './questData';
import { areaId } from './areaCatalog';

describe('complete quest location source review', () => {
  it('accounts for every quest in the remaining region-based review scope', () => {
    expect(review.scope).toHaveLength(148);
    expect(new Set(review.scope).size).toBe(review.scope.length);
    expect(review.entries.map(entry => entry.id).sort()).toEqual([...review.scope].sort());
    for (const id of review.scope) expect(QUEST_DATA[id]).toBeDefined();
  });

  it('only promotes reviewed destinations with source evidence and valid map areas', () => {
    expect(review.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
    for (const entry of review.entries) {
      if (entry.status !== 'reviewed') {
        expect(entry.status, entry.id).toBe('unresolved');
        expect(entry.reason?.trim().length, entry.id).toBeGreaterThan(30);
        expect(QUEST_DATA[entry.id].accessPolicy, entry.id).toBe('regions');
        continue;
      }
      expect(QUEST_DATA[entry.id].accessPolicy, entry.id).toBe('locations');
      expect(QUEST_DATA[entry.id].locations, entry.id).toEqual(entry.locations.map(location => ({
        id: location.id, label: location.label,
        standardAreas: location.standardAreas, chunkOptions: location.chunkOptions,
      })));
      expect(entry.locations.length, entry.id).toBeGreaterThan(0);
      expect(new Set(entry.locations.map(location => location.id)).size, entry.id).toBe(entry.locations.length);
      for (const location of entry.locations) {
        expect(location.standardAreas.length, entry.id).toBeGreaterThan(0);
        for (const area of location.standardAreas) expect(areaId(area), `${entry.id}: ${area}`).toBeTruthy();
        expect(location.chunkOptions.length, entry.id).toBeGreaterThan(0);
        for (const point of location.chunkOptions) {
          expect(Number.isInteger(point.cx) && Number.isInteger(point.cy), entry.id).toBe(true);
        }
        const evidence = entry.evidence.filter(item => item.locationId === location.id);
        expect(evidence.length, `${entry.id}: ${location.id}`).toBeGreaterThan(0);
        for (const item of evidence) {
          expect(entry.sourceFiles, entry.id).toContain(item.sourceFile);
          expect(item.line, entry.id).toBeGreaterThan(0);
          expect(item.reason.trim().length, entry.id).toBeGreaterThan(10);
        }
      }
    }
  });
});
