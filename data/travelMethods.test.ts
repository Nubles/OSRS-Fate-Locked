// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { ALL_CHUNK_KEYS } from '../utils/chunkAdjacency';
import { OCEAN_CHUNK_KEYS } from '../utils/oceanAccess';
import { ARCANA_LIST, MOBILITY_LIST, POH_LIST } from './items';
import { DIARY_DATA } from './diaryData';
import { NON_TRAVEL_OPTIONS, TRAVEL_METHODS } from './travelMethods';

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
