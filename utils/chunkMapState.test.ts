import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chunkMapState, chunkMapStateLine, chunkedUnlockedCount, reachLensDetail, vanillaUnlockedCount } from './chunkMapState';
import { setStartArea } from './freeAreas';
import { visibleAreaUnlocks } from '../data/areaMapPolicy';
import regionMapSource from '../components/RegionMap.tsx?raw';
import { loadWalkSections } from './walkSections';

beforeAll(() => loadWalkSections());

// map.md finding 11: how the World map shows a Chunked run's chunks.
describe('chunkMapState', () => {
  it('tints only the frontier the run can walk into', () => {
    expect(chunkMapState('50,49', [], undefined)).toBe('frontier');
    expect(chunkMapState('48,49', ['50,49', '49,49'], undefined)).toBe('locked');
    expect(chunkMapStateLine('frontier')).toBe('On your frontier: a Key can roll it');
  });

  it('shows an owned chunk no route reaches as cut off, without the lens', () => {
    expect(chunkMapState('48,49', ['48,49'], undefined, new Set(['48,49']))).toBe('cut-off');
    expect(chunkMapState('48,49', ['48,49'], undefined, new Set())).toBe('owned');
    expect(chunkMapStateLine('cut-off')).toBe('Cut off: no route from your start chunk');
    expect(chunkMapStateLine('owned')).toBeUndefined();
  });
});

describe('the World map legend and lens', () => {
  it('counts the free start chunk as unlocked', () => {
    expect(chunkedUnlockedCount([])).toBe(1);
    expect(chunkedUnlockedCount(['50,49'])).toBe(2);
    expect(chunkedUnlockedCount(['50,50', '50,49'])).toBe(2);
  });

  it('says where routes start from in each mode', () => {
    expect(reachLensDetail(2, true)).toBe('2 stranded (owned but no route from your start chunk)');
    expect(reachLensDetail(2, false)).toBe('2 stranded (owned but no route from Lumbridge)');
    expect(reachLensDetail(0, true)).toBe('Every owned chunk is reachable.');
  });
});

// ui-osrs-b.d3[1]: the World map's Vanilla 'Unlocked' legend counts what the map paints as unlocked.
describe('vanillaUnlockedCount', () => {
  afterEach(() => setStartArea('misthalin'));

  it('counts the free Misthalin start areas of a new run', () => {
    setStartArea('misthalin');
    expect(vanillaUnlockedCount(visibleAreaUnlocks([]))).toBe(9);
    expect(vanillaUnlockedCount(visibleAreaUnlocks(['Falador']))).toBe(10);
    // Tutorial Island is never counted, as the map does not show it.
    expect(vanillaUnlockedCount(visibleAreaUnlocks(['Tutorial Island']))).toBe(9);
  });

  it('counts only Lumbridge for a Lumbridge-only start', () => {
    setStartArea('lumbridge');
    expect(vanillaUnlockedCount(visibleAreaUnlocks([]))).toBe(1);
    expect(vanillaUnlockedCount(visibleAreaUnlocks(['Varrock']))).toBe(2);
  });

  it('keeps the Chunked count, start chunk included', () => {
    expect(chunkedUnlockedCount([])).toBe(1);
  });

  it('is what the World map legend shows', () => {
    // It used to show regionUnlocks.length: 0 for a new run while nine areas were painted.
    expect(regionMapSource).toContain('isChunked ? chunkedUnlockedCount(chunkUnlocks) : vanillaUnlockedCount(regionUnlocks)');
  });
});
