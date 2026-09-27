// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { ALL_CHUNK_KEYS } from '../utils/chunkAdjacency';
import { OCEAN_CHUNK_KEYS } from '../utils/oceanAccess';
import { travelDecisions } from '../utils/travelDecisions';
import { ARCANA_LIST, MOBILITY_LIST, POH_LIST } from './items';
import { DIARY_DATA } from './diaryData';
import { EQUIPMENT_CATALOGUE } from './equipmentCatalogue';
import { choice, NON_TRAVEL_OPTIONS, TRAVEL_METHODS } from './travelMethods';

/** Every chunk a player can stand in: land, ocean and interiors. */
let places: Set<string>;
/** Interior chunks by the interior's name. */
let interiorKeys: Map<string, string[]>;

beforeAll(async () => {
  const service = new ChunkContentService();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
  const interiors = service.interiorRecords();
  places = new Set([...ALL_CHUNK_KEYS, ...OCEAN_CHUNK_KEYS, ...interiors.map((record) => record.key)]);
  interiorKeys = new Map();
  for (const record of interiors) interiorKeys.set(record.name, [...(interiorKeys.get(record.name) ?? []), record.key]);
});

const destinations = (method: (typeof TRAVEL_METHODS)[number]) =>
  [...Object.values(method.options), ...Object.values(method.codes ?? {})].flatMap((option) => option.to);

describe('TRAVEL_METHODS', () => {
  it('have unique ids', () => {
    const ids = TRAVEL_METHODS.map((method) => method.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('match by exactly one kind, with ids or a spellbook and name', () => {
    for (const method of TRAVEL_METHODS) {
      const kinds = Object.keys(method.match);
      expect(kinds, method.id).toHaveLength(1);
      const match = method.match as Record<string, unknown>;
      if ('spell' in match) {
        const spell = match.spell as { book: string; name: string };
        expect(['standard', 'ancient', 'lunar', 'arceuus'], method.id).toContain(spell.book);
        expect(spell.name.trim(), method.id).not.toBe('');
      } else {
        const ids = match[kinds[0]] as number[];
        expect(['items', 'objects', 'npcs'], method.id).toContain(kinds[0]);
        expect(ids.length, method.id).toBeGreaterThan(0);
        expect(ids.every((id) => Number.isInteger(id) && id >= 0), method.id).toBe(true);
      }
    }
  });

  it('need only unlocks the app has', () => {
    const known = new Set<string>([...MOBILITY_LIST, ...ARCANA_LIST, ...POH_LIST]);
    const unknown = TRAVEL_METHODS.flatMap((method) =>
      method.unlocks.filter((id) => !known.has(id)).map((id) => `${method.id}: ${id}`));
    expect(unknown).toEqual([]);
  });

  it('name only travel options', () => {
    const never = new Set(NON_TRAVEL_OPTIONS.map((option) => option.toLowerCase()));
    for (const method of TRAVEL_METHODS) {
      const options = Object.keys(method.options);
      expect(options.length, method.id).toBeGreaterThan(0);
      expect(options.filter((option) => never.has(option.trim().toLowerCase())), method.id).toEqual([]);
    }
  });

  it('go only to land, ocean or interior chunks', () => {
    const nowhere = TRAVEL_METHODS.flatMap((method) => destinations(method)
      .filter((key) => !places.has(key)).map((key) => `${method.id}: ${key}`));
    expect(nowhere).toEqual([]);
  });

  it('cite a source', () => {
    for (const method of TRAVEL_METHODS) expect(method.source.trim(), method.id).not.toBe('');
  });
});

/** The Chunk Picker's teleport spells: spell name, lowercased, to the chunks and places it names. */
const CHUNK_PICKER_SPELLS: ReadonlyMap<string, string[]> = (() => {
  const doc = JSON.parse(gunzipSync(readFileSync(new URL('./sources/chunkpicker-chunkinfo-export.json.gz', import.meta.url)))
    .toString('utf8')) as { challenges: { Magic: Record<string, { Chunks?: string[] }> } };
  const spells = new Map<string, string[]>();
  for (const [task, record] of Object.entries(doc.challenges.Magic)) {
    const name = /^Cast ~\|(.+?)\|~$/.exec(task)?.[1];
    if (name && /tele/.test(name)) spells.set(name, record.Chunks ?? []);
  }
  return spells;
})();
/** The chunk where Tyss teaches the Arceuus spellbook, which the Chunk Picker lists first for its spells. */
const ARCEUUS_TEACHER = '26,60';
/** Named places the Chunk Picker gives that no chunk stands for. */
const NOT_A_PLACE = new Set(['Player-owned house', 'WildernessChunks[+]']);
const keyOf = (chunk: string) => {
  const id = Number(chunk.split('-')[0]);
  return `${Math.floor(id / 256)},${id % 256}`;
};

const spells = () => TRAVEL_METHODS.filter((method) => 'spell' in method.match);
const spellOf = (method: (typeof TRAVEL_METHODS)[number]) => (method.match as { spell: { book: string; name: string } }).spell;
const castTo = (method: (typeof TRAVEL_METHODS)[number]) =>
  [...method.options.Cast.to, ...(method.options.Cast.afterDiary?.to ?? [])];
/** Spell names the Chunk Picker spells its own way. */
const CHUNK_PICKER_SPELLINGS: Readonly<Record<string, string>> = {
  "fenkenstrain's castle teleport": "fenkenstain's castle teleport",
};
/** The spell's Chunk Picker record name: with the spellbook where two books share a name. */
const recordName = (method: (typeof TRAVEL_METHODS)[number]) => {
  const { book, name } = spellOf(method);
  const plain = CHUNK_PICKER_SPELLINGS[name.toLowerCase()] ?? name.toLowerCase();
  return CHUNK_PICKER_SPELLS.has(`${plain} (${book})`) ? `${plain} (${book})` : plain;
};
const recordFor = (method: (typeof TRAVEL_METHODS)[number]) => CHUNK_PICKER_SPELLS.get(recordName(method));

/** Where the wiki's landing square and the Chunk Picker disagree, reviewed. */
const REVIEWED_AGAINST_CHUNK_PICKER: Readonly<Record<string, string>> = {
  'spell:ancient:senntisten-teleport': 'The Chunk Picker names the Exam Centre (52,52); the wiki lands at 3320,3337, in 51,52.',
};

describe('teleport spells', () => {
  it('each have a Chunk Picker record, and go where it says, or differ as reviewed', () => {
    for (const method of spells()) {
      const record = recordFor(method);
      expect(record, method.id).toBeDefined();
      const to = new Set(castTo(method));
      const agrees = record!.every((chunk) => {
        if (method.unlocks.includes('Arceuus Spellbook') && keyOf(chunk) === ARCEUUS_TEACHER) return true;
        if (NOT_A_PLACE.has(chunk)) return true;
        const inside = interiorKeys.get(chunk);
        if (inside) return inside.some((key) => to.has(key));
        return /^\d+(-\d+)?$/.test(chunk) && to.has(keyOf(chunk));
      });
      expect(agrees, `${method.id}: ${REVIEWED_AGAINST_CHUNK_PICKER[method.id] ?? 'disagrees with the Chunk Picker'}`)
        .toBe(!(method.id in REVIEWED_AGAINST_CHUNK_PICKER));
    }
  });

  it('cover every Chunk Picker teleport spell that goes somewhere fixed', () => {
    const covered = new Set(spells().map(recordName));
    const somewhere = [...CHUNK_PICKER_SPELLS.entries()].filter(([, chunks]) => chunks.some((chunk) =>
      !NOT_A_PLACE.has(chunk) && keyOf(chunk) !== ARCEUUS_TEACHER)).map(([name]) => name);
    expect(somewhere.filter((name) => !covered.has(name))).toEqual([]);
  });

  it('put the spells the old table got wrong in the right places (G7)', () => {
    const byId = new Map(TRAVEL_METHODS.map((method) => [method.id, method]));
    expect(byId.get('spell:ancient:senntisten-teleport')?.options.Cast.to).toEqual(['51,52']);
    expect(byId.get('spell:ancient:carrallanger-teleport')?.options.Cast.to).toEqual(['49,57']);
    expect(spellOf(byId.get('spell:ancient:carrallanger-teleport')!).name).toBe('Carrallanger Teleport');
    // Two spells named Ape Atoll Teleport, told apart by the spellbook.
    expect(byId.get('spell:standard:ape-atoll-teleport')?.options.Cast.to).toEqual(['43,43']);
    expect(byId.get('spell:arceuus:ape-atoll-teleport')?.options.Cast.to).toEqual(['43,142']);
    expect(byId.get('spell:paddewwa-teleport')).toBeUndefined();
    expect(byId.get('spell:ancient:paddewwa-teleport')?.options.Cast.to).toEqual(['48,154']);
  });

  it("switch destination after the diary that lets them, and name only real diaries", () => {
    const switches = Object.fromEntries(spells().filter((method) => method.options.Cast.afterDiary)
      .map((method) => [method.id, method.options.Cast.afterDiary]));
    expect(switches).toEqual({
      'spell:standard:varrock-teleport': { diary: 'Varrock Medium', to: ['49,54'] },
      'spell:standard:camelot-teleport': { diary: 'Kandarin Hard', to: ['42,54'] },
      'spell:standard:watchtower-teleport': { diary: 'Ardougne Hard', to: ['40,48'] },
    });
    for (const method of TRAVEL_METHODS) {
      for (const option of Object.values(method.options)) {
        if (option.afterDiary) expect(DIARY_DATA[option.afterDiary.diary], method.id).toBeDefined();
      }
    }
  });

  it('need the spellbook they are cast from, and nothing for the standard one', () => {
    const books: Record<string, string[]> = {
      standard: [], ancient: ['Ancient Magicks'], lunar: ['Lunar Spellbook'], arceuus: ['Arceuus Spellbook'],
    };
    for (const method of spells()) expect(method.unlocks, method.id).toEqual(books[spellOf(method).book]);
  });
});

const byKind = (kind: string) => TRAVEL_METHODS.filter((method) => method.id.startsWith(`${kind}:`));

/** Where a tablet's page marks a different landing square from its spell's page, reviewed. */
const TABLET_SQUARES: Readonly<Record<string, string>> = {
  'tablet:civitas-illa-fortis-teleport': "The tablet's square lies in 26,48; the spell's crosses into 26,49.",
  'tablet:arceuus-library-teleport': "The tablet's square crosses into 25,60; the spell's lies in 25,59.",
};

describe('teleport tablets and scrolls', () => {
  it('land where their spell does, or differ as reviewed', () => {
    const spellTo = new Map(spells().map((method) => [spellOf(method).name.toLowerCase(), castTo(method)]));
    let compared = 0;
    for (const method of byKind('tablet')) {
      const to = spellTo.get(method.label.replace(/ tablet$/, '').toLowerCase());
      if (!to) continue;
      compared++;
      const same = JSON.stringify([...new Set(to)].sort())
        === JSON.stringify([...method.options.Break.to, ...(method.options.Break.afterDiary?.to ?? [])].sort());
      expect(same, `${method.id}: ${TABLET_SQUARES[method.id] ?? 'lands elsewhere than its spell'}`)
        .toBe(!(method.id in TABLET_SQUARES));
    }
    expect(compared).toBeGreaterThan(30);
  });

  it("need Teleport Tablets, or the spellbook that makes them; scrolls need nothing", () => {
    const books: Record<string, string> = { ancient: 'Ancient Magicks', lunar: 'Lunar Spellbook', arceuus: 'Arceuus Spellbook' };
    const spellBooks = new Map(spells().map((method) => [spellOf(method).name.toLowerCase(), spellOf(method).book]));
    for (const method of byKind('tablet')) {
      const book = spellBooks.get(method.label.replace(/ tablet$/, '').toLowerCase()) ?? 'standard';
      expect(method.unlocks, method.id).toEqual([books[book] ?? 'Teleport Tablets']);
    }
    for (const method of byKind('scroll')) expect(method.unlocks, method.id).toEqual([]);
  });

  it('break tablets and read scrolls', () => {
    for (const method of byKind('tablet')) expect(Object.keys(method.options), method.id).toContain('Break');
    for (const method of byKind('scroll')) expect(Object.keys(method.options), method.id).toEqual(['Teleport']);
  });

  it("offer the switchable tablets' destinations as options of their own", () => {
    const byId = new Map(TRAVEL_METHODS.map((method) => [method.id, method]));
    expect(byId.get('tablet:varrock-teleport')?.options).toMatchObject({
      Break: { to: ['50,53'], afterDiary: { diary: 'Varrock Medium', to: ['49,54'] } },
      Varrock: { to: ['50,53'] }, 'Grand Exchange': { to: ['49,54'] },
    });
    expect(byId.get('tablet:camelot-teleport')?.options["Seers' Village"]).toEqual({ to: ['42,54'] });
    expect(byId.get('tablet:watchtower-teleport')?.options.Yanille).toEqual({ to: ['40,48'] });
  });

  it('match every item id to one method only', () => {
    const owners = new Map<number, string[]>();
    for (const method of TRAVEL_METHODS) {
      const ids = (method.match as { items?: readonly number[] }).items ?? [];
      for (const id of ids) owners.set(id, [...(owners.get(id) ?? []), method.id]);
    }
    expect([...owners.entries()].filter(([, ids]) => ids.length > 1)).toEqual([]);
    expect(owners.size).toBeGreaterThan(60);
  });
});

/** The pinned equipment catalogue: each worn item's name and version, such as "(4)" or "Uncharged". */
const CATALOGUE: ReadonlyMap<number, { name: string; version: string }> = new Map(
  (JSON.parse(readFileSync(new URL(`../public/${EQUIPMENT_CATALOGUE.asset}`, import.meta.url), 'utf8')) as
    { id: number; name: string; version: string }[]).map((row) => [row.id, { name: row.name, version: row.version }]));
/** Teleport items no one wears, so the catalogue has none of their ids; they are cited from their pages. */
const NOT_WORN = new Set([
  'item:ectophial', 'item:royal-seed-pod', 'item:teleport-crystal',
  'item:grand-seed-pod', 'item:icy-basalt', 'item:stony-basalt', 'item:calcified-moth', 'item:mokhaiotl-waystone',
]);
/** A variant the catalogue names otherwise than its row. */
const ALSO_NAMED: Readonly<Record<string, string>> = {
  'item:amulet-of-glory': 'Amulet of eternal glory',
  'item:kharedsts-memoirs': 'Book of the Dead',
  'item:ardougne-cloak': 'Ardougne max cape',
  'item:mythical-cape': 'Mythical max cape',
};
/** Catalogue versions that can't teleport. */
const SPENT = new Set(['Uncharged', 'Inert', 'Empty']);
/** Lower diary tiers that don't teleport yet, as their pages have it. */
const NO_TELEPORT = new Set([
  'Desert amulet 1', "Explorer's ring 1", 'Kandarin headgear 1', 'Kandarin headgear 2', 'Karamja gloves 1',
  'Karamja gloves 2', 'Western banner 1', 'Western banner 2', 'Wilderness sword 1', 'Wilderness sword 2',
]);
/** Ids the catalogue lacks, from the item's page: the max cape in the inventory, and a newer charged amulet. */
const NOT_IN_CATALOGUE: Readonly<Record<string, readonly number[]>> = {
  'item:max-cape': [13280],
  "item:sailors-amulet": [32399],
};
/** Options that open a choice of every place the item goes. */
const CHOOSING = ['Rub', 'Teleport', 'Last Destination', 'Last-Teleport', 'Reminisce'];

type Method = (typeof TRAVEL_METHODS)[number];
const itemsOf = (method: Method) => [...(method.match as { items: readonly number[] }).items].sort((a, b) => a - b);
const ofFamily = (method: Method, name: string) => [method.label, ALSO_NAMED[method.id]]
  .some((label) => label !== undefined && name.toLowerCase().startsWith(label.toLowerCase()));
const itemRow = (id: string) => {
  const method = TRAVEL_METHODS.find((row) => row.id === id);
  if (!method) throw new Error(`no ${id}`);
  return method;
};
const nothing = { mobility: [], arcana: [], housing: [], diaries: [] };

describe('teleport jewellery and items', () => {
  it('match every charged id the equipment catalogue gives a worn item, and only those', () => {
    let worn = 0;
    for (const method of byKind('item')) {
      if (NOT_WORN.has(method.id)) {
        expect(itemsOf(method).filter((id) => CATALOGUE.has(id)), method.id).toEqual([]);
        continue;
      }
      worn++;
      const extra = NOT_IN_CATALOGUE[method.id] ?? [];
      expect(extra.filter((id) => CATALOGUE.has(id) || !itemsOf(method).includes(id)), method.id).toEqual([]);
      const charged = [...CATALOGUE]
        .filter(([, row]) => ofFamily(method, row.name) && !SPENT.has(row.version) && !NO_TELEPORT.has(row.name))
        .map(([id]) => id).sort((a, b) => a - b);
      expect(itemsOf(method).filter((id) => !extra.includes(id)), method.id).toEqual(charged);
    }
    expect(worn).toBeGreaterThan(40);
  });

  it("give the Digsite pendant, Slayer ring, Xeric's talisman and Drakan's medallion their own unlocks (G6)", () => {
    expect(itemRow('item:digsite-pendant').unlocks).toEqual(['Digsite Pendant']);
    expect(itemRow('item:slayer-ring').unlocks).toEqual(['Slayer Ring']);
    expect(itemRow('item:xerics-talisman').unlocks).toEqual(["Xeric's Talisman"]);
    expect(itemRow('item:drakans-medallion').unlocks).toEqual(["Drakan's Medallion"]);
  });

  it('take the necklace of passage to the Eyrie with Jewelry Teleports, not Eagle Transport (G6)', () => {
    const decided = travelDecisions([itemRow('item:necklace-of-passage')], {
      unlocks: { ...nothing, mobility: ['Jewelry Teleports'] },
      entries: { '53,49': 'ALLOWED' },
    })['item:necklace-of-passage'].options["Eagles' Eyrie"];
    expect(decided).toEqual({ to: ['53,49'], status: 'ALLOWED' });
  });

  it("leave a rub's choice open: it goes to every place the worn menu names (G7)", () => {
    expect(itemRow('item:digsite-pendant').options).toEqual({
      Rub: { to: ['52,53', '58,60', '55,163'] },
      Digsite: { to: ['52,53'] }, 'Fossil Island': { to: ['58,60'] }, 'Lithkren Dungeon': { to: ['55,163'] },
    });
    for (const method of byKind('item')) {
      const places = new Set(Object.values(method.options).flatMap((option) => option.to));
      for (const text of CHOOSING) {
        const option = method.options[text];
        // One place is no choice: the Desert amulet 2's Teleport goes to Nardah only.
        if (!option || option.afterDiary || option.to.length < 2) continue;
        expect([...places].filter((key) => !option.to.includes(key)), `${method.id} ${text}`).toEqual([]);
      }
    }
  });

  it("name only the Slayer ring's own options: its worn menu says Teleport, not the places", () => {
    expect(Object.keys(itemRow('item:slayer-ring').options)).toEqual(['Rub', 'Teleport']);
  });

  it('add the places a diary unlocks to the Camulet and the lyre, a harder tier too', () => {
    const decide = (id: string, text: string, diaries: string[]) => travelDecisions([itemRow(id)], {
      unlocks: { ...nothing, mobility: [itemRow(id).unlocks[0]], diaries },
      entries: { '48,145': 'ALLOWED', '41,56': 'LOCKED' },
    })[id].options[text];
    expect(decide('item:camulet', 'Rub', [])).toEqual({ to: ['48,145'], status: 'ALLOWED' });
    expect(decide('item:camulet', 'Rub', ['Desert Elite']).status).toBe('UNKNOWN');
    expect(decide('item:enchanted-lyre', 'Play', [])).toMatchObject({ to: ['41,56'], status: 'LOCKED' });
    expect(decide('item:enchanted-lyre', 'Play', ['Fremennik Hard']).to).toEqual(['41,56', '39,58', '37,59', '36,59']);
  });
});

describe('worn teleport equipment', () => {
  it('leaves Jewelry Teleports to the eight charged jewellery families', () => {
    expect(TRAVEL_METHODS.filter((method) => method.unlocks.includes('Jewelry Teleports')).map((method) => method.id))
      .toEqual([
        'item:amulet-of-glory', 'item:ring-of-dueling', 'item:games-necklace', 'item:combat-bracelet',
        'item:skills-necklace', 'item:ring-of-wealth', 'item:necklace-of-passage', 'item:burning-amulet',
      ]);
  });

  it("never lets a choice look certain because a place in it has no chunk", () => {
    expect(choice({ Here: ['50,50'], Unmapped: [] }, 'Rub').Rub).toEqual({ to: [] });
    expect(choice({ Here: ['50,50'], There: ['46,52'], Unmapped: [] }, 'Rub').Rub).toEqual({ to: ['50,50', '46,52'] });
    expect(choice({ Here: ['50,50'], Also: ['50,50'] }, 'Rub').Rub).toEqual({ to: ['50,50'] });
    expect(choice({ Here: ['50,50'], Unmapped: [] }, 'Rub').Unmapped).toEqual({ to: [] });
  });

  it("send the sea boots to Rellekka, not where the old table's text match put them (G7)", () => {
    expect(itemRow('item:fremennik-sea-boots').options.Teleport.to).toEqual(['41,57']);
  });

  it("match only the max cape's options whose places its page gives", () => {
    expect(Object.keys(itemRow('item:max-cape').options).sort())
      .toEqual(['Crafting Guild', 'Home', 'POH Portals', 'Teleports']);
  });
});

describe('the other teleport items', () => {
  it("need no unlock: the app's lists have none for them", () => {
    for (const id of ['item:grand-seed-pod', 'item:icy-basalt', 'item:stony-basalt', 'item:calcified-moth', 'item:mokhaiotl-waystone']) {
      expect(itemRow(id).unlocks, id).toEqual([]);
    }
  });

  it("send the seed pods to the Grand Tree, both ways the grand one opens", () => {
    expect(itemRow('item:grand-seed-pod').options).toEqual({ Launch: { to: ['38,54'] }, Squash: { to: ['38,54'] } });
    expect(itemRow('item:royal-seed-pod').options.Commune.to).toEqual(['38,54']);
  });
});

/** Every page the wiki's list of teleportation items links, pinned in data/sources. */
const WIKI_TELEPORT_ITEMS = (JSON.parse(readFileSync(new URL('./sources/wiki-teleportation-items.json', import.meta.url), 'utf8')) as
  { pages: string[] }).pages;
const NO_LANDING_SQUARE = 'Its page marks no landing square.';
/** Teleport items the table leaves out, and why. */
const LEFT_OUT: Readonly<Record<string, string>> = {
  'Ring of returning': 'It goes to the respawn point the player chose.',
  'Ring of life': 'It teleports by itself, when the wearer is about to die.',
  'Defence cape': 'It works as a ring of life.',
  '10th squad sigil': 'Its page names no teleport option.',
  'Sailing cape': 'Its teleport can take the boat, which has no fixed place.',
  "Ghommal's avernic defender 5": NO_LANDING_SQUARE,
  "Ghommal's avernic defender 6": NO_LANDING_SQUARE,
  "Ghommal's hilt 1": NO_LANDING_SQUARE,
  "Ghommal's hilt 2": NO_LANDING_SQUARE,
  "Ghommal's hilt 3": NO_LANDING_SQUARE,
  "Ghommal's hilt 4": NO_LANDING_SQUARE,
  "Ghommal's hilt 5": NO_LANDING_SQUARE,
  "Ghommal's hilt 6": NO_LANDING_SQUARE,
  'Teleport to boat (tablet)': 'It goes to the boat, wherever it is.',
  'Teleport to house (tablet)': 'It goes to the house, wherever it is.',
  'Deadman teleport tablet': 'A Jagex moderator item from a 2016 event.',
  'Scaperune teleport': 'A 2019 Christmas event item, no longer in the game.',
  'Target teleport': "It goes to the player's assigned target, wherever they are.",
  "Wise old man's teleport tablet": NO_LANDING_SQUARE,
  'Guthixian temple teleport': 'The app has no chunk for the temple (63,71).',
  'Revenant cave teleport': "Its page and the caves' page disagree on where it goes.",
  'Basic quetzal whistle': 'It belongs with the quetzal network.',
  Directions: 'It works only in Ardougne, during the Ratcatchers quest.',
  'Disk of Returning': 'It works only in the Dwarven Mine, into the Blackhole and back.',
  'Dorgesh-kaan sphere': 'It goes to a random spot in the city.',
  'Goblin village sphere': 'It goes to a random spot in the village.',
  'Plain of Mud sphere': 'It goes to a random spot in the cave.',
  'Escape crystal': NO_LANDING_SQUARE,
  'Hallowed crystal shard': NO_LANDING_SQUARE,
  'Magic whistle': 'It works at one spot only, into the Fisher Realm.',
  'Rum (blue)': NO_LANDING_SQUARE,
  'Rum (red)': NO_LANDING_SQUARE,
};
const pageOf = (source: string) => decodeURIComponent(/\/w\/([^?]+)/.exec(source)?.[1] ?? '').replace(/_/g, ' ');

describe('the whole table', () => {
  it('covers every teleport item the wiki lists, or leaves it out as reviewed', () => {
    const cited = new Set(TRAVEL_METHODS.map((method) => pageOf(method.source)));
    const covered = (page: string) => cited.has(page) || byKind('item').some((method) => ofFamily(method, page));
    expect(WIKI_TELEPORT_ITEMS.length).toBeGreaterThan(150);
    expect(WIKI_TELEPORT_ITEMS.filter((page) => !covered(page) && !(page in LEFT_OUT))).toEqual([]);
    // A page left out must still be on the list, and not covered after all.
    expect(Object.keys(LEFT_OUT).filter((page) => covered(page) || !WIKI_TELEPORT_ITEMS.includes(page))).toEqual([]);
  });
});
