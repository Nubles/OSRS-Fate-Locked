/**
 * A run's entry for every chunk a player can stand in, and what the chunks
 * that aren't land are. The export sends them as rules.chunkEntries and
 * rules.places, so RuneLite knows the ocean and interiors as well as land.
 */
import { interiorArea } from '../data/interiorAreas';
import type { UnlockState } from '../types';
import { ALL_CHUNK_KEYS } from './chunkAdjacency';
import { chunkEntry } from './chunkEntry';
import type { PermissionStatus } from './chunkPermissionSnapshot';
import { interiorEntry, type InteriorRecord } from './interiorEntry';
import { OCEAN_CHUNK_KEYS } from './oceanAccess';

export interface ChunkEntriesSource {
  interiorRecords(): InteriorRecord[];
  chunkEntryRequirements(cx: number, cy: number): string[];
}

const coordsOf = (key: string) => {
  const [cx, cy] = key.split(',').map(Number);
  return { cx, cy };
};
const byChunk = ([left]: [string, unknown], [right]: [string, unknown]) => {
  const a = coordsOf(left);
  const b = coordsOf(right);
  return a.cx - b.cx || a.cy - b.cy;
};
const keyOf = (id: number) => `${Math.floor(id / 256)},${id % 256}`;

/** Every land, ocean and interior chunk's entry, keyed "cx,cy". */
export function chunkEntries(
  source: ChunkEntriesSource,
  unlocks: UnlockState,
  gameModeId: string,
  reachable?: Set<string>,
): Record<string, PermissionStatus> {
  const entries: Record<string, PermissionStatus> = {};
  for (const key of [...ALL_CHUNK_KEYS, ...OCEAN_CHUNK_KEYS]) {
    entries[key] = chunkEntry(coordsOf(key), unlocks, gameModeId, reachable);
  }
  const context = {
    unlocks, gameModeId, reachable,
    chunkEntryRequirements: (cx: number, cy: number) => source.chunkEntryRequirements(cx, cy),
  };
  for (const record of source.interiorRecords()) entries[record.key] = interiorEntry(record, context);
  return Object.fromEntries(Object.entries(entries).sort(byChunk));
}

export type RulesPlace =
  | { kind: 'ocean' }
  | { kind: 'interior'; name?: string; area?: string; entrances: string[] };

/**
 * An interior's name as a place label: "Mor Ul Rek#Outer Area" reads
 * "Mor Ul Rek · Outer Area". The source's placeholders ("Interior 7244")
 * name nothing.
 */
export const placeName = (name: string): string | undefined =>
  /^Interior \d+$/.test(name) ? undefined : name.split('#').map((part) => part.trim()).join(' · ');

/** The ocean, and each interior with its name, its area and the chunks it is entered from. */
export function rulesPlaces(source: Pick<ChunkEntriesSource, 'interiorRecords'>): Record<string, RulesPlace> {
  const places: Record<string, RulesPlace> = {};
  for (const key of OCEAN_CHUNK_KEYS) places[key] = { kind: 'ocean' };
  for (const record of source.interiorRecords()) {
    const name = placeName(record.name);
    const area = interiorArea(record.name);
    const entrances = [...new Set(record.entrances.map((entrance) => Number(entrance.chunkId)))]
      .sort((a, b) => a - b).map(keyOf);
    places[record.key] = { kind: 'interior', ...(name ? { name } : {}), ...(area ? { area } : {}), entrances };
  }
  return Object.fromEntries(Object.entries(places).sort(byChunk));
}
