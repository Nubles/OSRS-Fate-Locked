import { beforeAll, describe, expect, it } from 'vitest';
import { readPinnedChunkSource } from './chunk-source.mjs';
import { transformChunkContent } from './chunk-content-transform.mjs';
import { readNamedTaskUnlockRegistry } from './named-task-unlock-locations.mjs';
import { readBankLocationRegistry } from './bank-locations.mjs';

/**
 * Map content fixes from the deep audit (November 2026), checked on what the
 * transform makes from the pinned source, not on the committed output.
 */
type Interior = { name: string; content: { m?: [string, ...number[]][] }; entrances: { chunkId: string; requirements: string[] }[]; requirements: Record<string, Record<string, string[]>> };
let full: { interiors: Record<string, Interior>; taskUnlocks: Record<string, Record<string, Record<string, string[]>>> };
beforeAll(async () => {
  const { manifest, data } = await readPinnedChunkSource();
  full = transformChunkContent(data, manifest, readNamedTaskUnlockRegistry(), readBankLocationRegistry()).full;
}, 60_000);

const interiorsNamed = (name: string) => Object.entries(full.interiors).filter(([, interior]) => interior.name === name);

describe('Revenant Caves (slayer.d2[0])', () => {
  // Wiki "Revenant Caves" oldid 15397220: the 2020 overhaul moved the other monsters to the Wilderness Slayer Cave.
  const MOVED = ['Ankou', 'Black demon', 'Black dragon', 'Greater demon', 'Green dragon', 'Hellhound', 'Ice giant', 'Lesser demon'];

  it('holds only revenants, not the monsters the game moved out', () => {
    const caves = interiorsNamed('Revenant Caves');
    expect(caves.length).toBeGreaterThan(0);
    const monsters = caves.flatMap(([, interior]) => (interior.content.m ?? []).map(([name]) => name));
    for (const name of MOVED) expect(monsters, name).not.toContain(name);
    expect(monsters).toContain('Revenant knight');
    const slayerCave = interiorsNamed('Wilderness Slayer Cave').flatMap(([, interior]) => (interior.content.m ?? []).map(([name]) => name));
    for (const name of MOVED) expect(slayerCave, name).toContain(name);
  });
});

describe('quest-locked areas the source marks as area unlocks (slayer.d3[0])', () => {
  const GATES: [string, string][] = [
    ["Jormungand's Prison", 'The Fremennik Exiles Complete the quest'],
    ["Myth's Guild#Basement", 'Dragon Slayer II Complete the quest'],
    ["Heroes' Guild#Basement", "Heroes' Quest Complete the quest"],
    ["Legends' Guild#Dungeon", "Legends' Quest Complete the quest"],
    ['Smoke Dungeon', 'Started Desert Treasure I'],
    ['Shadow Dungeon', 'Started Desert Treasure I'],
    ['Waterfall Dungeon', 'Started Waterfall Quest'],
    ["Glarial's Tomb", 'Started Waterfall Quest'],
    ['Lighthouse#Dungeon', 'Started Horror from the Deep'],
  ];

  it.each(GATES)('asks for its quest at every entrance of %s', (name, gate) => {
    const records = interiorsNamed(name);
    expect(records.length, name).toBeGreaterThan(0);
    for (const [id, interior] of records) {
      expect(interior.entrances.length, `${name} ${id}`).toBeGreaterThan(0);
      for (const entrance of interior.entrances) expect(entrance.requirements, `${name} ${id} via ${entrance.chunkId}`).toContain(gate);
    }
  });
});

describe('shop requirement names (minigames-misc.d1[0])', () => {
  const shop = (name: string, chunkId: string) => full.taskUnlocks.Shops?.[name]?.[chunkId];

  it('keys no shop requirement by the source\'s trailing full stop', () => {
    expect(Object.keys(full.taskUnlocks.Shops).filter(name => name.endsWith('.'))).toEqual([]);
  });

  it('gives each shop the guild or quest gate the source records for it', () => {
    expect(shop('Fishing Guild Shop', '10293')).toEqual(['Access the fishing guild']);
    expect(shop("Aaron's Archery Appendages", '10549')).toEqual(['Access the Ranging Guild']);
    expect(shop("Happy Heroes' H'emporium", '11574')).toEqual(["Heroes' Quest Complete the quest"]);
    expect(shop('Legends Guild General Store', '10804')).toEqual(["Legends' Quest Complete the quest"]);
    expect(shop('Blades by Urbi', '13099')).toEqual(['Contact! Complete the quest']);
    // Wiki "Razmire Builders Merchants" oldid 15318751 and "Razmire General Store" oldid 15364312.
    expect(shop('Razmire Builders Merchants', '13875')).toEqual(["Shades of Mort'ton Complete the quest"]);
    expect(shop('Razmire General Store', '13875')).toEqual(["Shades of Mort'ton 2"]);
    // Wiki "Champions' Guild" oldid 15364426: 32 quest points.
    expect(shop("Scavvo's Rune Store", '12596')).toEqual(['32 Quest Points']);
    expect(shop("Valaine's Shop of Champions", '12596')).toEqual(['32 Quest Points']);
    // Wiki "Oobapohk's Javelin Store" oldid 14991780.
    expect(shop("Oobapohk's Javelin Store", '11051')).toEqual(['Monkey Madness II Complete the quest']);
    // Wiki "Martin Thwait's Lost and Found" oldid 15318685: the store stands in the Rogues' Den.
    expect(full.interiors['12109'].requirements.shop["Martin Thwait's Lost and Found"]).toEqual(['Agility level 50', 'Thieving level 50']);
    // Wiki "Ali's Discount Wares" oldid 15355193: his own stock needs nothing on members worlds.
    expect(shop("Ali's Discount Wares", '13106')).toBeUndefined();
  });

  it('keeps the reviewed requirement of a shop that has a dotted twin', () => {
    expect(shop("Gabooty's Tai Bwo Wannai Cooperative", '11055')).toEqual(['Jungle Potion Complete the quest', 'Play Tai Bwo Wannai Cleanup']);
  });
});

describe('Entrana Dungeon (slayer.d1[1])', () => {
  it('is entered from Entrana, not from its one-way exit in the Wilderness', () => {
    // Wiki "Entrana Dungeon" oldid 15353043: entrance pin 2820,3374; the magic door to 3250,3772 is an exit.
    const records = interiorsNamed('Entrana Dungeon');
    expect(records.length).toBeGreaterThan(0);
    for (const [id, interior] of records) expect(interior.entrances.map(entrance => entrance.chunkId), id).toEqual(['11316']);
  });
});

describe('Dorgesh-Kaan through the Keldagrim train (areas.d1[1])', () => {
  // Wiki "Dorgesh-Kaan–Keldagrim train system" oldid 15211839: "Completion of Another Slice of H.A.M. is required to use the train."
  const TRAIN = 'Another Slice of H.A.M. Complete the quest';

  it('asks for Another Slice of H.A.M. at the train platforms and on every route through them', () => {
    const platforms = interiorsNamed('Dorgesh-Kaan-Keldagrim Train Platforms');
    expect(platforms.length).toBeGreaterThan(0);
    for (const [id, interior] of platforms) {
      expect(interior.entrances.length, id).toBeGreaterThan(0);
      for (const entrance of interior.entrances) expect(entrance.requirements, `${id} via ${entrance.chunkId}`).toContain(TRAIN);
    }
    const viaTrain = Object.entries(full.interiors).flatMap(([id, interior]) => interior.entrances
      .filter(entrance => (entrance as { via?: string[] }).via?.includes('9814')).map(entrance => [id, entrance] as const));
    expect(viaTrain.map(([id]) => id)).toContain('10834');
    for (const [id, entrance] of viaTrain) expect(entrance.requirements, `${id} via ${entrance.chunkId}`).toContain(TRAIN);
  });

  it('leaves Keldagrim itself on The Giant Dwarf alone', () => {
    expect(full.interiors['11679'].entrances.map(entrance => entrance.requirements)).toEqual([['Started The Giant Dwarf']]);
  });
});

describe('more quest-locked areas the source marks as area unlocks (areas.d2[0])', () => {
  // Each gate from the place's own Wiki page, fetched 24 Nov 2026 (oldids in interior-access.json).
  const GATES: [string, string][] = [
    ["Yama's Domain", 'A Kingdom Divided Complete the quest'],
    ['Vampyrium', 'The Blood Moon Rises Complete the quest'],
    ['Ghorrock Dungeon', 'Secrets of the North Complete the quest'],
    ['Ghorrock Prison', 'Secrets of the North Complete the quest'],
    ['Ghorrock Prison', 'Desert Treasure II: reached Ghorrock Prison'],
    ["Tolna's rift", "A Soul's Bane Complete the quest"],
    ['Daeyalt essence mine', 'Sins of the Father Complete the quest'],
    ['The Scar', 'Desert Treasure II: reached the Scar'],
    ['Scar essence mine', 'Desert Treasure II: reached the Scar'],
    ['Scar essence mine', 'Mining level 64'],
  ];

  it.each(GATES)('asks at every entrance of %s for %s', (name, gate) => {
    const records = interiorsNamed(name);
    expect(records.length, name).toBeGreaterThan(0);
    for (const [id, interior] of records) {
      expect(interior.entrances.length, `${name} ${id}`).toBeGreaterThan(0);
      for (const entrance of interior.entrances) expect(entrance.requirements, `${name} ${id} via ${entrance.chunkId}`).toContain(gate);
    }
  });
});

describe('the true Blood Altar and the inner Meiyerditch Laboratories (areas.d2[0], area-access.d1[1])', () => {
  // Wiki "Meiyerditch Laboratories" oldid 15385627: the complete laboratory opens once the Sins of the Father
  // mutated bloodveld is killed; the altar ruins are in its northern part; the Canifis route is listed after the quest.
  // Wiki "Blood Altar" oldid 15404832: reached from the trapdoor behind the Hair of the Dog in Canifis.
  const STAGE = 'Sins of the Father: killed the mutated bloodveld';
  const entrancesOf = (id: string) => full.interiors[id].entrances;

  it.each(['11338', '14232', '14488'])('asks interior %s for the bloodveld stage from Meiyerditch and for the quest from Canifis', id => {
    const meiyerditch = entrancesOf(id).filter(entrance => entrance.chunkId === '14387');
    expect(meiyerditch.length, id).toBeGreaterThan(0);
    for (const entrance of meiyerditch) expect(entrance.requirements, id).toContain(STAGE);
    const canifis = entrancesOf(id).filter(entrance => entrance.chunkId === '13878');
    expect(canifis.length, id).toBeGreaterThan(0);
    for (const entrance of canifis) expect(entrance.requirements, id).toContain('Sins of the Father Complete the quest');
    for (const entrance of entrancesOf(id)) expect(entrance.requirements.length, `${id} via ${entrance.chunkId}`).toBeGreaterThan(0);
  });

  it('keeps the outer laboratory rooms that Darkness of Hallowvale visits open from Meiyerditch', () => {
    expect(entrancesOf('14487').map(entrance => [entrance.chunkId, entrance.requirements])).toEqual([['14387', []]]);
  });
});
