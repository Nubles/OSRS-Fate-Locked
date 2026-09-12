import type { GameState } from '../types';
import { TableType } from '../types';

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
  if (state.unlocks.regions.includes('Tutorial Island')) {
    const pending = state.pendingUnlock?.table === TableType.REGIONS
      && state.pendingUnlock.item === 'Tutorial Island' ? state.pendingUnlock : undefined;
    const recorded = [...state.history].reverse().find(entry => entry.type === 'UNLOCK'
      && entry.meta?.item === 'Tutorial Island' && entry.meta?.category === TableType.REGIONS)?.meta;
    const costType = pending?.costType ?? recorded?.costType;
    const counter = costType === 'chaosKey' ? 'chaosKeys' : costType === 'specialKey' ? 'specialKeys' : 'keys';
    const rawCost = pending?.cost ?? recorded?.cost;
    const cost = counter !== 'keys' ? 1
      : Number.isSafeInteger(rawCost) && rawCost > 0 && rawCost <= maxCounter ? rawCost : 1;
    // Retain ownership as refund credit if the counter is full; retry next load.
    if (state[counter] <= maxCounter - cost) {
      state[counter] += cost;
      state.unlocks.regions = state.unlocks.regions.filter(area => area !== 'Tutorial Island');
      changed = true;
    }
  }
  if (state.pendingUnlock?.table === TableType.REGIONS && state.pendingUnlock.item === 'Tutorial Island') {
    delete state.pendingUnlock;
    changed = true;
  }
  return changed;
}
