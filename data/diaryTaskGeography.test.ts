// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import source from './sources/achievement-diary-tasks.json';
import { canonicalAreaName } from './areaMapPolicy';
import { REGION_CHUNKS } from './regionChunks';
import { SUB_AREA_CHUNKS } from './subAreaChunks';

/**
 * A player reported on 29 September 2026 Diary tasks tagged with an area
 * they aren't in: "Mine 5 clay in the north-eastern desert" and "Kill a
 * Vulture" as Al Kharid, among others. Tasks naming no place had been given
 * their diary's gateway area. This holds every task the Chunk Picker export
 * places to where it places it: by the task's own chunks, its diary code on a
 * chunk, or where the monster, NPC or object it names is.
 *
 * Where the export has the task in named areas, the task must name one of
 * them. Where it has it only in chunks with no area of its own (the desert's
 * open sand, say), one must border an area the task names, as the map files
 * such chunks' tasks under the named place beside them.
 */

type Chunk = { cx: number; cy: number };
type Place = { chunkOptions: Chunk[] };
interface SourceTask {
  id: string; area: string; tier: string; ordinal: number; description: string;
  regions?: string[]; anyOfRegions?: string[]; oneOf?: { regions?: string[] }[]; locations?: Place[];
}

/** Where the export and the app's map disagree, reviewed; the tag stands. */
const REVIEWED: Readonly<Record<string, string>> = {
  ard_hard_3: "The export's record puts Ardougne Castle's chest in 42,51, which holds no chest; the castle is 40,51.",
  ard_hard_11: 'The anvil is in 39,52, which the map gives to East Ardougne.',
  des_hard_2: 'The granite quarry, 49,45, is the Agility Pyramid\'s on the map.',
  frem_med_8: 'The export marks Waterbirth Island, where the trip starts; the task is visiting the Lighthouse.',
  kan_med_8: 'The Catherby patches are in 43,54, which the map gives to Camelot.',
  kan_elite_2: 'The Catherby patches are in 43,54, which the map gives to Camelot.',
  kar_easy_4: 'The Musa Point dock is in 46,49, which the map gives to Port Sarim.',
  mor_hard_7: 'The Canifis mushroom patch is in 53,54, which the map gives to Paterdomus.',
  wilderness_easy_2: 'The task is pulling a lever; the export marks where the levers land.',
  wild_hard_3: 'The export names the young trees the traps use, which grow everywhere.',
  wild_hard_8: "The shortcut lands at 46,57, beside the Wilderness God Wars Dungeon's entrance at 47,58.",
};

const EXPORT_DIARY: Readonly<Record<string, string>> = {
  Ardougne: 'Ardougne', Desert: 'Desert', Falador: 'Falador', Fremennik: 'Fremennik', Kandarin: 'Kandarin',
  Karamja: 'Karamja', Kourend: 'Kourend & Kebos', Lumbridge: 'Lumbridge & Draynor', Morytania: 'Morytania',
  Varrock: 'Varrock', Western: 'Western Provinces', Wilderness: 'Wilderness',
};
const TIER_CODE: Readonly<Record<string, string>> = { Easy: 'EA', Medium: 'MD', Hard: 'HD', Elite: 'EL' };

interface ExportSection {
  Monster?: Record<string, unknown>; NPC?: Record<string, unknown>; Object?: Record<string, unknown>;
  Diary?: Record<string, string>;
}
interface ExportDoc {
  chunks: Record<string, { Sections?: Record<string, ExportSection> }>;
  challenges: { Diary: Record<string, { Chunks?: string[]; Monsters?: string[]; NPCs?: string[]; Objects?: string[] }> };
}

const doc: ExportDoc = JSON.parse(gunzipSync(readFileSync(new URL('./sources/chunkpicker-chunkinfo-export.json.gz', import.meta.url)))
  .toString());

const areaOf = new Map<string, string>();
for (const [name, chunks] of Object.entries(SUB_AREA_CHUNKS as Record<string, Chunk[]>)) {
  for (const { cx, cy } of chunks) areaOf.set(String(cx * 256 + cy), name);
}
// The surface the map covers; dungeons and instances are elsewhere.
const onMap = new Set([...areaOf.keys(), ...Object.values(REGION_CHUNKS as Record<string, Chunk[]>)
  .flatMap(chunks => chunks.map(({ cx, cy }) => String(cx * 256 + cy)))]);
const base = (name: string) => name.split('#')[0].toLowerCase();
const standing = { Monsters: new Map<string, Set<string>>(), NPCs: new Map<string, Set<string>>(), Objects: new Map<string, Set<string>>() };
const coded = new Map<string, Set<string>>();
const add = (map: Map<string, Set<string>>, key: string, id: string) => {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(id);
};
for (const [id, chunk] of Object.entries(doc.chunks)) {
  for (const section of Object.values(chunk.Sections ?? {})) {
    for (const name of Object.keys(section.Monster ?? {})) add(standing.Monsters, base(name), id);
    for (const name of Object.keys(section.NPC ?? {})) add(standing.NPCs, base(name), id);
    for (const name of Object.keys(section.Object ?? {})) add(standing.Objects, base(name), id);
    for (const [diary, codes] of Object.entries(section.Diary ?? {})) {
      for (const code of codes.split(',').map(value => value.trim()).filter(Boolean)) add(coded, `${diary}|${code}`, id);
    }
  }
}

/** The chunks of the map the export places a task in. */
const placesOf = (task: SourceTask): string[] => {
  const diary = EXPORT_DIARY[task.area];
  const record = doc.challenges.Diary[`~|${diary} Diary#${task.tier}|~ Task ${task.ordinal}`];
  const chunks = new Set<string>((record?.Chunks ?? []).map(chunk => chunk.split('-')[0]));
  for (const id of coded.get(`${diary}|${TIER_CODE[task.tier]}${task.ordinal}`) ?? []) chunks.add(id);
  if (!chunks.size) {
    for (const kind of ['Monsters', 'NPCs', 'Objects'] as const) {
      for (const name of record?.[kind] ?? []) for (const id of standing[kind].get(base(name)) ?? []) chunks.add(id);
    }
  }
  return [...chunks].filter(id => onMap.has(id));
};

/** Whether the task's areas and locations take in where the export places it. */
const agrees = (task: SourceTask, places: readonly string[]): boolean => {
  const tags = new Set([
    ...(task.regions ?? []), ...(task.anyOfRegions ?? []), ...(task.oneOf ?? []).flatMap(option => option.regions ?? []),
  ].map(canonicalAreaName));
  const located = (id: string) => (task.locations ?? [])
    .some(place => place.chunkOptions.some(({ cx, cy }) => String(cx * 256 + cy) === id));
  const tagged = (id: string) => areaOf.has(id) && tags.has(canonicalAreaName(areaOf.get(id)!));
  const borders = (id: string) => {
    const cx = Math.floor(Number(id) / 256);
    const cy = Number(id) % 256;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && tagged(String((cx + dx) * 256 + cy + dy))) return true;
    }
    return false;
  };
  if (places.some(located)) return true;
  const named = places.filter(id => areaOf.has(id));
  return named.length ? named.some(tagged) : places.some(borders);
};

const tasks = (source as { tasks: SourceTask[] }).tasks;

describe('Diary tasks are tagged where the game has them', () => {
  it('names an area for every task the Chunk Picker places, but the reviewed ones', () => {
    const astray = tasks
      .filter(task => {
        const places = placesOf(task);
        return places.length > 0 && !agrees(task, places);
      })
      .map(task => task.id);
    expect(astray.sort()).toEqual(Object.keys(REVIEWED).sort());
  });

  it('places the reported tasks, so the check covers them', () => {
    const byId = new Map(tasks.map(task => [task.id, task]));
    for (const id of ['des_easy_2', 'des_easy_5', 'des_easy_10', 'des_med_4', 'mor_med_1', 'mor_med_3', 'kar_easy_6']) {
      const task = byId.get(id)!;
      const places = placesOf(task);
      expect(places.length, id).toBeGreaterThan(0);
      expect(agrees(task, places), id).toBe(true);
      expect(agrees({ ...task, regions: ['Al Kharid'], anyOfRegions: undefined }, places), id).toBe(false);
    }
  });
});
