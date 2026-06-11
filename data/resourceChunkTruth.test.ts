import { describe, it, expect } from 'vitest';
import { RESOURCE_MAP } from './resourceData';
import { REGION_GROUPS, MISTHALIN_AREAS } from './items';
// Vite-native imports (no node:fs needed): the chunk dataset as JSON, and the
// RegionMap source as a raw string so we can parse its REGION_CHUNKS literal.
import chunkDoc from '../public/chunk-content.json';
import regionMapSrc from '../components/RegionMap.tsx?raw';

/**
 * Chunk-truth invariant for the Resource Engine.
 *
 * public/chunk-content.json (synced from the Chunk Picker via
 * scripts/sync-chunk-content.mjs) proves which of our map regions contain each
 * monster. Presence is proof; absence is not (the picker doesn't list every
 * dungeon interior). So the enforceable direction is:
 *
 *   every chunk-proven region for a DROP source's monster must be listed in
 *   that source's regions (directly, via 'Any', or via a listed sub-area).
 *
 * If a chunk resync adds a monster to a new region, this fails until the
 * engine data is updated — keeping the Resource Engine current with the map.
 */

// chunk (cx,cy) -> our region, parsed from the REGION_CHUNKS literal
function loadChunkRegions(): Record<string, string> {
  const block = regionMapSrc.match(/const REGION_CHUNKS: Record<string, ChunkCoord\[\]> = \{([\s\S]*?)\n\};/)![1];
  const out: Record<string, string> = {};
  let cur = '';
  for (const line of block.split('\n')) {
    const head = line.match(/^\s*'((?:[^'\\]|\\.)+)': \[/);
    if (head) { cur = head[1].replace(/\\'/g, "'"); continue; }
    for (const m of line.matchAll(/\{ cx: (\d+), cy: (\d+) \}/g)) out[`${m[1]},${m[2]}`] = cur;
  }
  return out;
}

function monsterRegionTruth(): Map<string, Set<string>> {
  const chunkRegion = loadChunkRegions();
  const truth = new Map<string, Set<string>>();
  for (const [id, e] of Object.entries<any>(chunkDoc.chunks)) {
    const region = chunkRegion[`${Math.floor(+id / 256)},${+id % 256}`];
    if (!region) continue;
    for (const [name] of e.m ?? []) {
      const k = (name as string).toLowerCase();
      if (!truth.has(k)) truth.set(k, new Set());
      truth.get(k)!.add(region);
    }
  }
  return truth;
}

/** Is chunk-proven region `r` covered by a source's listed regions? */
function covers(listed: string[], r: string): boolean {
  if (listed.includes('Any') || listed.includes(r)) return true;
  // A listed sub-area inside continent r also counts (e.g. 'Edgeville').
  const children = r === 'Misthalin' ? MISTHALIN_AREAS : REGION_GROUPS[r];
  return !!children && listed.some(l => children.includes(l));
}

describe('resource engine ↔ chunk truth', () => {
  it('every chunk-proven region for a DROP monster is listed on the source', () => {
    const truth = monsterRegionTruth();
    const violations: string[] = [];
    for (const [item, sources] of Object.entries(RESOURCE_MAP)) {
      for (const s of sources) {
        if (s.type !== 'DROP') continue;
        const proven = truth.get(s.name.toLowerCase());
        if (!proven) continue; // not in chunk data — nothing enforceable
        for (const r of proven) {
          if (!covers(s.regions, r)) violations.push(`${item} ← ${s.name}: missing '${r}'`);
        }
      }
    }
    expect(violations, violations.slice(0, 15).join('\n')).toEqual([]);
  });

  it('chunk truth actually proves a meaningful number of monsters', () => {
    // Guards against the JSON or the REGION_CHUNKS parse silently breaking.
    expect(monsterRegionTruth().size).toBeGreaterThan(300);
  });
});
