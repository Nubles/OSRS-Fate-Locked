import { describe, it, expect } from 'vitest';
import { mobilityFor } from './chunkMobility';
import { MOBILITY_LIST } from '../constants';

describe('mobilityFor', () => {
  it('maps real chunk transport objects to a MOBILITY_LIST network', () => {
    const cases: [string, string][] = [
      ['Spirit tree', 'Spirit Trees'],
      ['Fairy ring', 'Fairy Rings'],
      ['Crashed glider', 'Gnome Gliders'],
      ['Canoe Station', 'Canoes'],
      ['Balloon toad pile', 'Balloon Transport'],
      ['Magic Mushtree', 'Mycelium Transport'],
      ['Carpet hotspot', 'Magic Carpets'],
      ['Obelisk of Water', 'Wilderness Obelisks'],
      ['Mine cart', 'Mine Carts'],
    ];
    for (const [name, network] of cases) {
      expect(mobilityFor(name), name).toBe(network);
    }
  });

  it('only ever returns networks the Mobility table actually has', () => {
    const valid = new Set(MOBILITY_LIST);
    for (const name of ['Spirit tree', 'Fairy ring', 'Canoe Station', 'Obelisk of Air', 'Quetzal']) {
      const got = mobilityFor(name);
      if (got) expect(valid.has(got), `${name} -> ${got}`).toBe(true);
    }
  });

  it('ignores cart-shaped scenery that is not the mine-cart network', () => {
    for (const name of ['Broken cart', 'Corpse cart', 'Travel cart', 'Coal Truck', 'Broken cart wheel']) {
      expect(mobilityFor(name), name).toBeNull();
    }
  });

  it('returns null for plainly inert objects', () => {
    for (const name of ['Bank booth', 'Anvil', 'Oak tree', 'Iron rocks']) {
      expect(mobilityFor(name), name).toBeNull();
    }
  });
});
