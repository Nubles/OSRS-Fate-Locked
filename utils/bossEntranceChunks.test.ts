// Chunked and Vanilla gate each lair boss on the chunk where its lair is ENTERED, not where it exits.
// Wiki: Mole hill pins x 2984-3005, y 3375-3387 (chunk 46,52, Falador Park); the Mole Hole's rope exit comes up
// at a well in 46,51. Signpost (Callisto's Den) x=3291,y=3848 sits by the one-way cave entrance (chunk 51,60).
// Cave entrance (Silk Chasm) x=3321,y=3794 (51,59). Crevice (Vet'ion's Rest) 3222,3788 (50,59). Leaving any of
// these lairs puts the player in the Escape Caves, whose surface exits are 50,59, 51,58 and 51,59.
import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import { TableType, type UnlockState } from '../types';
import { ACTIVITY_CHUNKS } from '../data/activityChunks';
import { ACTIVITY_ACCESS_AREAS } from '../data/activityAccess';
import { getActivityAccess } from './activityAccess';
import { isRandomUnlockEligible } from './gameEngine';

const run = (unlocks: Partial<UnlockState>): UnlockState => ({ ...initialState.unlocks, ...unlocks });
const chunkOf = (x: number, y: number) => `${Math.floor(x / 64)},${Math.floor(y / 64)}`;

describe('lair bosses open from their entrance chunk', () => {
  it('places each lair at the chunk of its way in', () => {
    expect(ACTIVITY_CHUNKS['Giant Mole']).toEqual([chunkOf(2984, 3387)]);
    expect(ACTIVITY_CHUNKS.Callisto).toEqual([chunkOf(3291, 3848)]);
    expect(ACTIVITY_CHUNKS.Venenatis).toEqual([chunkOf(3321, 3794)]);
    expect(ACTIVITY_CHUNKS["Vet'ion"]).toEqual([chunkOf(3222, 3788)]);
  });

  it('Chunked: the entrance chunk opens the boss and the exit chunk does not', () => {
    const cases: [string, string, string][] = [
      ['Giant Mole', '46,52', '46,51'],
      ['Callisto', '51,60', '51,58'],
      ['Venenatis', '51,59', '51,58'],
      ["Vet'ion", '50,59', '51,58'],
    ];
    for (const [boss, entrance, exit] of cases) {
      expect(getActivityAccess(boss, run({ chunks: [entrance], bosses: [boss] }), 'chunked').eligible).toBe(true);
      expect(isRandomUnlockEligible(TableType.BOSSES, boss, run({ chunks: [entrance] }), 'chunked')).toBe(true);
      expect(getActivityAccess(boss, run({ chunks: [exit], bosses: [boss] }), 'chunked').eligible).toBe(false);
    }
  });

  it("Vanilla: Callisto opens with Rogues' Castle, which owns 51,60, and not with Chaos Temple", () => {
    expect(ACTIVITY_ACCESS_AREAS.Callisto).toEqual(["Rogues' Castle"]);
    const regions = initialState.unlocks.regions ?? [];
    expect(getActivityAccess('Callisto', run({ regions: [...regions, "Rogues' Castle"], bosses: ['Callisto'] }), 'vanilla').eligible).toBe(true);
    expect(getActivityAccess('Callisto', run({ regions: [...regions, 'Chaos Temple'], bosses: ['Callisto'] }), 'vanilla').eligible).toBe(false);
  });
});
