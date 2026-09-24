import { describe, it, expect } from 'vitest';
import { chunkTransportNodes, mobilityFor } from './chunkMobility';
import { MOBILITY_LIST } from '../constants';

describe('mobilityFor', () => {
  it('maps real chunk transport objects to a MOBILITY_LIST network', () => {
    const cases: [string, string][] = [
      ['Spirit tree', 'Spirit Trees'],
      ['Fairy ring', 'Fairy Rings'],
      ['Canoe Station', 'Canoes'],
      ['Magic Mushtree', 'Mycelium Transport'],
      ['Obelisk', 'Wilderness Obelisks'],
      ['Mine cart', 'Mine Carts'],
    ];
    for (const [name, network] of cases) {
      expect(mobilityFor(name), name).toBe(network);
    }
  });

  it.each([
    ['Trader Crewmember', 'Charter Ships'],
    ['Renu', 'Quetzal Network'],
    ['Captain Errdo', 'Gnome Gliders'],
    ['Gnormadium Avlafrim', 'Gnome Gliders'],
    ['Captain Shoracks', 'Gnome Gliders'],
    ['Captain Bleemadge', 'Gnome Gliders'],
    ['Captain Klemfoodle', 'Gnome Gliders'],
    ['Captain Dalbur', 'Gnome Gliders'],
    ['Auguste', 'Balloon Transport'],
    ['Rug Merchant', 'Magic Carpets'],
  ])('recognizes reviewed NPC service %s without conflating entity kinds', (name, network) => {
    expect(mobilityFor(name, 'npc')).toBe(network);
    expect(mobilityFor(name.toUpperCase(), 'npc')).toBe(network);
    expect(mobilityFor(name, 'object')).toBeNull();
    expect(MOBILITY_LIST).toContain(network);
  });

  it.each([
    'Crashed glider', 'Crashed glider (Sea charting)', 'Balloon toad pile',
    'Carpet hotspot', 'Eagle lever', 'Spirit Tree Patch', 'Quetzal shrine',
    'Balloon assistant statue', 'constructor', 'toString',
  ])('does not invent transport from scenery or unknown identity %s', name => {
    expect(mobilityFor(name, 'object')).toBeNull();
    expect(mobilityFor(name, 'npc')).toBeNull();
  });

  it('combines reviewed objects and NPC presence without inventing NPC counts', () => {
    const content = {
      objects: [['Fairy ring', 2], ['Balloon toad pile', 1], ['Carpet hotspot', 12]] as [string, number][],
      npcs: ['Auguste', 'Rug Merchant', 'Shopkeeper'],
    };
    expect(chunkTransportNodes(content)).toEqual([
      { name: 'Fairy ring', kind: 'object', count: 2, network: 'Fairy Rings' },
      { name: 'Auguste', kind: 'npc', network: 'Balloon Transport' },
      { name: 'Rug Merchant', kind: 'npc', network: 'Magic Carpets' },
    ]);
    expect(content.npcs).toHaveLength(3);
    expect(content.objects).toHaveLength(3);
  });

  it('only ever returns networks the Mobility table actually has', () => {
    const valid = new Set(MOBILITY_LIST);
    for (const name of ['Spirit tree', 'Fairy ring', 'Canoe Station', 'Obelisk', 'Quetzal']) {
      const got = mobilityFor(name);
      if (got) expect(valid.has(got), `${name} -> ${got}`).toBe(true);
    }
  });

  it('ignores cart-shaped scenery that is not the mine-cart network', () => {
    for (const name of ['Broken cart', 'Corpse cart', 'Travel cart', 'Coal Truck', 'Broken cart wheel']) {
      expect(mobilityFor(name), name).toBeNull();
    }
  });

  it('does not treat elemental orb-charging obelisks as transport', () => {
    for (const name of ['Obelisk of Water', 'Obelisk of Air', 'Obelisk of Earth', 'Obelisk of Fire']) {
      expect(mobilityFor(name), name).toBeNull();
    }
  });

  it('returns null for plainly inert objects', () => {
    for (const name of ['Bank booth', 'Anvil', 'Oak tree', 'Iron rocks']) {
      expect(mobilityFor(name), name).toBeNull();
    }
  });
});
