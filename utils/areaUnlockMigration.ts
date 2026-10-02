import type { GameState } from '../types';
import { TableType } from '../types';
import { RETIRED_BOSSES } from '../data/items';

/**
 * Unlocks that left their table: a run that owned one gets back what it paid,
 * once, in the currency it paid with. Tutorial Island can't be returned to;
 * Galvek is fought once, inside Dragon Slayer II (owner decision B3, 2 October 2026).
 */
const RETIRED_UNLOCKS: ReadonlyArray<{ table: TableType; item: string; key: 'regions' | 'bosses' }> = [
  { table: TableType.REGIONS, item: 'Tutorial Island', key: 'regions' },
  ...RETIRED_BOSSES.map(item => ({ table: TableType.BOSSES, item, key: 'bosses' as const })),
];

/** Called only on validated save data. Never rewrite the integrity history. */
export function migrateAreaUnlocks(state: GameState, maxCounter: number): boolean {
  let changed = false;
  if (state.areaUnlockRevision !== 1) {
    const regions = new Set(state.unlocks.regions);
    if (regions.has('Port Khazard')) regions.add('Khazard Battlefield');
    if (regions.has('Chaos Temple')) regions.add('Chaos Altar');
    state.unlocks.regions = [...regions];
    state.areaUnlockRevision = 1;
    changed = true;
  }
  for (const { table, item, key } of RETIRED_UNLOCKS) {
    if (state.unlocks[key].includes(item)) {
      const pending = state.pendingUnlock?.table === table
        && state.pendingUnlock.item === item ? state.pendingUnlock : undefined;
      const recorded = [...state.history].reverse().find(entry => entry.type === 'UNLOCK'
        && entry.meta?.item === item && entry.meta?.category === table)?.meta;
      const costType = pending?.costType ?? recorded?.costType;
      const counter = costType === 'chaosKey' ? 'chaosKeys' : costType === 'specialKey' ? 'specialKeys' : 'keys';
      const rawCost = pending?.cost ?? recorded?.cost;
      const cost = counter !== 'keys' ? 1
        : Number.isSafeInteger(rawCost) && rawCost > 0 && rawCost <= maxCounter ? rawCost : 1;
      // Retain ownership as refund credit if the counter is full; retry next load.
      if (state[counter] <= maxCounter - cost) {
        state[counter] += cost;
        state.unlocks[key] = state.unlocks[key].filter(owned => owned !== item);
        changed = true;
      }
    }
    if (state.pendingUnlock?.table === table && state.pendingUnlock.item === item) {
      delete state.pendingUnlock;
      changed = true;
    }
  }
  return changed;
}
