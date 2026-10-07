import { describe, it, expect } from 'vitest';
import { SUB_AREA_CHUNKS } from './subAreaChunks';
import { REGION_CHUNKS } from './regionChunks';
import { REGIONS_LIST, MISTHALIN_AREAS, REGION_GROUPS } from './items';
import { CHUNK_CONTENT_LITE } from './chunkContentLite';

/** Chunks on the map, as "cx,cy" keys. */
function mapChunkKeys(): Set<string> {
  const keys = new Set<string>();
  for (const chunks of Object.values(REGION_CHUNKS)) {
    for (const c of chunks) keys.add(`${c.cx},${c.cy}`);
  }
  return keys;
}

describe('sub-area chunk assignments', () => {
  it('every sub-area name is one the unlock system tracks', () => {
    const known = new Set([...REGIONS_LIST, ...MISTHALIN_AREAS]);
    const unknown = Object.keys(SUB_AREA_CHUNKS).filter(k => !known.has(k));
    expect(unknown).toEqual([]);
  });

  it('no chunk belongs to two sub-areas', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [sub, chunks] of Object.entries(SUB_AREA_CHUNKS)) {
      for (const c of chunks) {
        const k = `${c.cx},${c.cy}`;
        if (seen.has(k)) dupes.push(`${k}: ${seen.get(k)} + ${sub}`);
        seen.set(k, sub);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('every sub-area chunk exists on the map (REGION_CHUNKS)', () => {
    const map = mapChunkKeys();
    const orphans: string[] = [];
    for (const [sub, chunks] of Object.entries(SUB_AREA_CHUNKS)) {
      for (const c of chunks) if (!map.has(`${c.cx},${c.cy}`)) orphans.push(`${sub}: ${c.cx},${c.cy}`);
    }
    expect(orphans).toEqual([]);
  });

  it('keeps every named sub-area in its canonical parent continent', () => {
    const parent = new Map<string, string>();
    for (const [continent, areas] of Object.entries(REGION_GROUPS)) {
      for (const area of areas) parent.set(area, continent);
    }
    for (const area of MISTHALIN_AREAS) parent.set(area, 'Misthalin');

    const actual = new Map<string, string>();
    for (const [continent, chunks] of Object.entries(REGION_CHUNKS)) {
      for (const chunk of chunks) actual.set(`${chunk.cx},${chunk.cy}`, continent);
    }

    const mismatches = Object.entries(SUB_AREA_CHUNKS).flatMap(([area, chunks]) =>
      chunks.flatMap(({ cx, cy }) => {
        const expected = parent.get(area);
        const found = actual.get(`${cx},${cy}`);
        return expected && found !== expected
          ? [`${area} ${cx},${cy}: ${found} -> ${expected}`]
          : [];
      }),
    );
    expect(mismatches).toEqual([]);
  });

  it('gives each named place the area it is in, where the map left its chunk without one', () => {
    // Owner decisions M1 and M2 (2 October 2026), from the accuracy audit of 29 September.
    const PLACES: Readonly<Record<string, [string, string]>> = {
      '52,49': ["Giants' Plateau", "the Giants' Foundry and the Sleeping Giants start"],
      '41,55': ["Seers' Village", "Rhonen's hops patch north of McGrubor's Wood"],
      '20,58': ['Mount Karuulm', 'fairy ring CIR, south of Mount Karuulm'],
      '19,48': ['Tlati Rainforest', 'Tal Teklan'],
      '21,47': ['Tlati Rainforest', 'Kastori'],
      '25,49': ['Civitas illa Fortis', 'Kualti Headquarters and the Fortis Blacksmith'],
      '24,48': ['Civitas illa Fortis', 'Ortus Farm'],
      '21,51': ['Auburnvale', 'Nemus Retreat'],
      '35,56': ['Piscatoris Fishing Colony', 'Kraken Cove'],
      '20,54': ['Mount Quidamortem', 'fairy ring BLS and the Garden of Death start'],
      '45,46': ['Shilo Village', 'Mosol Rei, at the village entrance'],
      '54,46': ['Nardah', 'the Ancient Vault'],
      '53,47': ['Nardah', 'fairy ring DLQ, north of Nardah'],
      '51,44': ['Sophanem', 'the Wanderer, outside Sophanem'],
      '57,53': ['Darkmeyer', 'the Morytania Spider Cave (Araxxor)'],
      '36,48': ['Castle Wars', 'the Incomitatus spirit tree and the Poison Waste Dungeon entrance'],
      '27,46': ['Avium Savannah', 'Stonecutter Outpost'],
      '41,48': ['Yanille', 'Hazelmere and fairy ring CLS, on the Yanille Chain'],
      '43,56': ['Mountain Camp', 'the Fremennik Slayer Dungeon entrance'],
      // Owner decision, 7 October 2026: a Wilderness boss's spawn chunk opens with its gate area.
      '46,57': ['Forgotten Cemetery', 'the Crazy Archaeologist at the Dareeyak Ruins'],
      '46,60': ['Lava Maze', 'the Chaos Fanatic at the Western Obelisk'],
      '48,57': ['Graveyard of Shadows', "Artio's cave entrance (Hunter's End)"],
      '49,58': ['Graveyard of Shadows', "Spindel's cave entrance (Web Chasm), at the Eastern Ruins"],
    };
    for (const [chunk, [area, place]] of Object.entries(PLACES)) {
      expect(SUB_AREA_CHUNKS[area].map(({ cx, cy }) => `${cx},${cy}`), `${place} (${chunk})`).toContain(chunk);
    }
    // The dungeon's chunk moved to Fremennik with Mountain Camp.
    expect(REGION_CHUNKS.Fremennik.some(({ cx, cy }) => cx === 43 && cy === 56)).toBe(true);
    expect(REGION_CHUNKS.Kandarin.some(({ cx, cy }) => cx === 43 && cy === 56)).toBe(false);
  });

  it('puts every chunk with a shop, bank, altar, anvil, furnace or patch in an area, bar places with no area', () => {
    // A place in a chunk no area owns opens only with every area of its region, as the
    // Giants' Foundry, Kraken Cove and Tal Teklan did. These places have no area of
    // their own, so they keep opening with their whole region.
    const REVIEWED: Readonly<Record<string, string>> = {
      '41,56': 'Strange altar in the Fremennik Province, south of Rellekka',
      '35,53': 'Gorlah, in Tirannwn',
      '50,45': 'The Jaldraocht Pyramid, in the open desert (owner decision M4)',
      '53,44': 'The Ruins of Ullek, in the open desert (owner decision M4)',
      '53,49': 'Citharede Abbey, in the open desert (owner decision M4)',
      '23,50': 'Quetzacalli Gorge, in the Hailstorm Mountains',
      '25,51': 'Salvager Overlook, north of Civitas illa Fortis',
      '48,59': "Edmond's cape shop, in the Wilderness (owner decision M4)",
      '50,60': "William's cape shop on Lava Dragon Isle, in the Wilderness (owner decision M4)",
      '47,61': "Darren's cape shop at the Pirates' Hideout, in the Wilderness (owner decision M4)",
    };
    const NOTABLE = /bank|altar|anvil|furnace|patch|fairy ring|spirit tree/i;
    const owned = new Set(Object.values(SUB_AREA_CHUNKS).flat().map(({ cx, cy }) => `${cx},${cy}`));
    const content = CHUNK_CONTENT_LITE as Readonly<Record<string, { shop?: string[]; poi?: string[] }>>;
    const orphans = [...mapChunkKeys()].filter(chunk => !owned.has(chunk) && (
      (content[chunk]?.shop ?? []).length > 0 || (content[chunk]?.poi ?? []).some(poi => NOTABLE.test(poi))
    ));
    expect(orphans.sort()).toEqual(Object.keys(REVIEWED).sort());
  });

  it('covers the flagship example — Falador is a multi-chunk group', () => {
    expect(SUB_AREA_CHUNKS['Falador']?.length).toBeGreaterThanOrEqual(4);
  });
  it('assigns the reviewed Wyrmscraig coordinates only to its canonical Open Seas sub-area', () => {
    const wyrmscraigChunks = ['39,34', '39,35', '40,34', '40,35'];
    const paidSubAreaAssignments = Object.entries(SUB_AREA_CHUNKS).flatMap(([area, chunks]) =>
      chunks
        .map(({ cx, cy }) => `${cx},${cy}`)
        .filter((chunk) => wyrmscraigChunks.includes(chunk))
        .map((chunk) => `${area}: ${chunk}`),
    );

    expect(paidSubAreaAssignments).toEqual([
      'Wyrmscraig: 39,34',
      'Wyrmscraig: 39,35',
      'Wyrmscraig: 40,34',
      'Wyrmscraig: 40,35',
    ]);
    expect(wyrmscraigChunks.every(chunk =>
      REGION_CHUNKS['The Open Seas'].some(({ cx, cy }) => `${cx},${cy}` === chunk),
    )).toBe(true);
  });
});
