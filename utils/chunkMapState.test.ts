import { beforeAll, describe, expect, it } from 'vitest';
import { chunkMapState, chunkMapStateLine, chunkedUnlockedCount, reachLensDetail } from './chunkMapState';
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
