import { describe, it, expect } from 'vitest';
import { CURATED_RESOURCE_SOURCES, RESOURCE_MAP, type ResourceSource } from './resourceData';
import { REGION_GROUPS, MISTHALIN_AREAS } from './items';
import { REGION_CHUNKS } from './regionChunks';
import chunkDoc from '../public/chunk-content.json';

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
 * A monster whose spawn in one region sits behind a quest is split into one
 * row per gate (black dragons at Mynydd need Song of the Elves), so the
 * regions are judged across an item's rows for that monster. Wiki rows borrow
 * their gates from the first hand-written row of the same monster and are
 * never shown as available; they are judged across that monster's
 * hand-written rows too.
 *
 * If a chunk resync adds a monster to a new region, this fails until the
 * engine data is updated — keeping the Resource Engine current with the map.
 */

// chunk (cx,cy) -> our region, straight from the shipped data
function loadChunkRegions(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [region, chunks] of Object.entries(REGION_CHUNKS)) {
    for (const c of chunks) out[`${c.cx},${c.cy}`] = region;
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
    const curatedDrops = new Map<string, ResourceSource[]>();
    for (const s of CURATED_RESOURCE_SOURCES) {
      if (s.type !== 'DROP') continue;
      const k = s.name.toLowerCase();
      curatedDrops.set(k, [...(curatedDrops.get(k) ?? []), s]);
    }
    for (const [item, sources] of Object.entries(RESOURCE_MAP)) {
      const byMonster = new Map<string, ResourceSource[]>();
      for (const s of sources) {
        if (s.type !== 'DROP') continue;
        const k = s.name.toLowerCase();
        byMonster.set(k, [...(byMonster.get(k) ?? []), s]);
      }
      for (const [k, group] of byMonster) {
        const proven = truth.get(k);
        if (!proven) continue; // not in chunk data — nothing enforceable
        const listed = group.every(s => s.requirementsUnverified)
          ? [...group, ...(curatedDrops.get(k) ?? [])]
          : group;
        for (const r of proven) {
          if (!listed.some(s => covers(s.regions, r))) violations.push(`${item} ← ${group[0].name}: missing '${r}'`);
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
