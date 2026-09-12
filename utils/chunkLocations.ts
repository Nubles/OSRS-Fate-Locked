import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';
import { isAreaReachable } from './reachability';
import { isChunkUnlocked } from './chunkAdjacency';
import { UnlockState } from '../types';
import type { ChunkCoord } from './mapCoords';
import {
  AREA_ALIAS_POLICIES,
  AREA_REFERENCES,
  canonicalAreaName,
  displayAreaName,
} from '../data/areaMapPolicy';

/**
 * Where is chunk (cx, cy), and can the player go there?
 *
 * The shared resolver behind every "show me where" feature: maps a chunk to
 * its named sub-area + continent (from the shipped authoring data) and checks
 * the unlock state with the same semantics the world map uses — sub-area
 * first, continent fallback, Misthalin always free.
 */

const key = (cx: number, cy: number) => `${cx},${cy}`;

const CHUNK_SUB: Record<string, string> = {};
for (const [sub, chunks] of Object.entries(SUB_AREA_CHUNKS)) {
  for (const c of chunks) CHUNK_SUB[key(c.cx, c.cy)] = sub;
}
const CHUNK_REGION: Record<string, string> = {};
for (const [region, chunks] of Object.entries(REGION_CHUNKS)) {
  for (const c of chunks) CHUNK_REGION[key(c.cx, c.cy)] = region;
}

// Reverse lookup: a place NAME (sub-area or continent) → a representative chunk,
// so journal items that reference a place by name (diary tasks, etc.) can link
// to the map. Sub-areas win over continents for the same name.
const PLACE_CHUNK: Record<string, ChunkCoord> = {};
for (const [name, chunks] of Object.entries(REGION_CHUNKS)) if (chunks[0]) PLACE_CHUNK[name.toLowerCase()] = chunks[0];
for (const [name, chunks] of Object.entries(SUB_AREA_CHUNKS)) if (chunks[0]) PLACE_CHUNK[name.toLowerCase()] = chunks[0];

/** A representative chunk for a named place, or null if it isn't on the map. */
export const chunkForPlace = (name: string): ChunkCoord | null => {
  const trimmed = name.trim();
  const alias = AREA_ALIAS_POLICIES[trimmed as keyof typeof AREA_ALIAS_POLICIES];
  if (alias?.kind === 'surface-overlap') return alias.chunks[0];
  const canonical = canonicalAreaName(trimmed);
  const reference = AREA_REFERENCES[canonical as keyof typeof AREA_REFERENCES];
  if (reference) return reference.chunks[0];
  return PLACE_CHUNK[canonical.toLowerCase()] ?? null;
};


export interface ChunkPlace {
  cx: number;
  cy: number;
  /** Named sub-area (Falador, …) when the chunk has one. */
  subArea: string | null;
  /** Continent block the chunk belongs to, when painted. */
  region: string | null;
  /** "Falador · Asgarnia", "Asgarnia", or "chunk (cx, cy)". */
  label: string;
}

export const placeOf = (cx: number, cy: number): ChunkPlace => {
  const k = key(cx, cy);
  const subArea = CHUNK_SUB[k] ?? null;
  const region = CHUNK_REGION[k] ?? null;
  const displaySubArea = subArea ? displayAreaName(subArea) : null;
  const label = displaySubArea && region && subArea !== region
    ? `${displaySubArea} · ${region}`
    : displaySubArea ?? region ?? `chunk (${cx}, ${cy})`;
  return { cx, cy, subArea, region, label };
};

const nameUnlocked = (name: string, unlocks: UnlockState, gameModeId?: string): boolean => {
  if (isAreaReachable(name, unlocks, gameModeId)) return true;
  const children = name === 'Misthalin' ? MISTHALIN_AREAS : REGION_GROUPS[name];
  if (children && children.length > 0) {
    return children.every(c => isAreaReachable(c, unlocks, gameModeId));
  }
  return false;
};

/** Sub-area-first unlock check, matching the world map's colouring. */
export const chunkUnlocked = (cx: number, cy: number, unlocks: UnlockState, gameModeId?: string): boolean => {
  const k = key(cx, cy);
  if (gameModeId === 'chunked') return isChunkUnlocked(k, unlocks.chunks ?? []);
  const sub = CHUNK_SUB[k];
  if (sub) return nameUnlocked(sub, unlocks, gameModeId);
  const region = CHUNK_REGION[k];
  if (region) return nameUnlocked(region, unlocks, gameModeId);
  return false;
};

/** Which entity kinds to search per Resource Engine source type. */
export const SOURCE_TYPE_KINDS: Record<string, ('monster' | 'object' | 'npc' | 'spawn' | 'shop' | 'quest')[]> = {
  DROP: ['monster'],
  SHOP: ['shop', 'npc'],
  SPAWN: ['spawn'],
  PICKPOCKET: ['npc', 'monster'],
  SKILL: ['object', 'npc'],
};

// The map mounts lazily when the World tab opens, so a deep link fired from
// elsewhere can arrive before its listener exists. Park the request here;
// the map consumes it on mount (and the event covers the already-mounted case).
let pendingChunk: { cx: number; cy: number } | null = null;
export const consumePendingChunk = (): { cx: number; cy: number } | null => {
  const p = pendingChunk;
  pendingChunk = null;
  return p;
};

/** Jump the app to this chunk: switch to the World tab + open its panel. */
export const showChunkOnMap = (cx: number, cy: number) => {
  pendingChunk = { cx, cy };
  window.dispatchEvent(new CustomEvent('fate:nav', {
    detail: { target: 'tab:WORLD', worldView: 'MAP' },
  }));
  window.dispatchEvent(new CustomEvent('fate:show-chunk', { detail: { cx, cy } }));
};

/**
 * Dedupe raw chunk hits into named places, unlocked first, keeping one
 * representative chunk per place so a click can land somewhere concrete.
 */
export const summarisePlaces = (
  chunks: { cx: number; cy: number }[],
  unlocks: UnlockState,
  gameModeId?: string,
): (ChunkPlace & { unlocked: boolean })[] => {
  const seen = new Map<string, ChunkPlace & { unlocked: boolean }>();
  for (const { cx, cy } of chunks) {
    const place = placeOf(cx, cy);
    if (!seen.has(place.label)) {
      seen.set(place.label, { ...place, unlocked: chunkUnlocked(cx, cy, unlocks, gameModeId) });
    }
  }
  return [...seen.values()].sort((a, b) =>
    Number(b.unlocked) - Number(a.unlocked) || a.label.localeCompare(b.label));
};

/** Explain the actual owner separately from the content dataset's place name. */
export function chunkUnlockRequirement(cx: number, cy: number, unlocks: UnlockState, gameModeId?: string): {
  text: string; remaining: string[];
} {
  if (gameModeId === 'chunked') return {
    text: `Chunk ${cx}, ${cy}: ${chunkUnlocked(cx, cy, unlocks, gameModeId) ? 'unlocked' : 'unlock this exact chunk'}.`, remaining: [],
  };
  const place = placeOf(cx, cy);
  if (place.subArea) return { text: `Area unlock: ${place.subArea}.`, remaining: [] };
  if (!place.region) return { text: 'This location has no mapped area unlock.', remaining: [] };
  const children = place.region === 'Misthalin' ? MISTHALIN_AREAS : REGION_GROUPS[place.region] ?? [];
  const remaining = children.filter(area => !isAreaReachable(area, unlocks, gameModeId));
  const owned = isAreaReachable(place.region, unlocks, gameModeId);
  return {
    text: owned ? `${place.region} terrain is unlocked.`
      : `${place.region} terrain unlocks when all its named areas are unlocked (${children.length - remaining.length}/${children.length}). The region name is not a separate roll.`,
    remaining: owned ? [] : remaining,
  };
}
