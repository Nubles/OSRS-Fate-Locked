/**
 * Fated sites and region seals on a Chunked run's map and in fate's spin
 * (components/FateLandLayer.tsx, components/FateDrawsMap.tsx). Kept apart from
 * utils/fateMap.ts, which the app loads up front, so these load with the map.
 * Pure, so vitest pins it; looks only, it never changes what fate draws.
 */
import type { FateLand, FateSite } from '../types';
import { FATE_SITE_SIGHT } from '../config/economy';
import {
  CHUNK_PX, FATE_MARK_EFFECTS, MARK_NAME, SEAL_BOON_EFFECTS, chunkBox, isBaneMark, omenColor, sealLine, siteLine,
} from './fateMap';

const parse = (key: string): [number, number] => {
  const [cx, cy] = key.split(',').map(Number);
  return [cx, cy];
};

/** The blue of a found site in the log and on the map. */
export const SITE_BLUE = '#5fb4ff';
/** Each site's item sprite under public/osrs-ui/items. */
export const SITE_SPRITE: Record<FateSite, string> = { SHRINE: '3840.png', HOARD: '405.png', RIFT: '8013.png', WAYSTONE: '2575.png' };
/** The parchment of a sealed region's border and a site seen in the fog. */
export const SEAL_EDGE = '#e0d3b2';

/**
 * Where held land meets a region still sealed: each edge between a held
 * chunk and an unheld land chunk next door whose region has no broken seal,
 * as [x1, y1, x2, y2] in map-image pixels.
 */
export const sealEdges = (
  held: ReadonlySet<string>,
  regionOf: (key: string) => string | undefined,
  seals: Readonly<Record<string, string>> | undefined,
): Array<[number, number, number, number]> => {
  if (!seals) return [];
  const edges: Array<[number, number, number, number]> = [];
  for (const key of held) {
    const [cx, cy] = parse(key);
    const { x, y } = chunkBox(key);
    const r = x + CHUNK_PX, b = y + CHUNK_PX;
    const sides: Array<[string, [number, number, number, number]]> = [
      [`${cx},${cy + 1}`, [x, y, r, y]], [`${cx},${cy - 1}`, [x, b, r, b]],
      [`${cx - 1},${cy}`, [x, y, x, b]], [`${cx + 1},${cy}`, [r, y, r, b]],
    ];
    for (const [next, edge] of sides) {
      const region = regionOf(next);
      if (!held.has(next) && region !== undefined && !(region in seals)) edges.push(edge);
    }
  }
  return edges;
};

/**
 * The hidden sites a run can see: those not yet held within FATE_SITE_SIGHT
 * chunks (grid steps) of land it holds. They show only as a mark in the fog;
 * which kind of site waits there stays hidden until a draw lands on it.
 */
export const sightedSites = (sites: Readonly<Record<string, FateSite>> | undefined, held: ReadonlySet<string>): string[] => {
  if (!sites) return [];
  const near: string[] = [];
  const heldAt = [...held].map(parse);
  for (const key of Object.keys(sites).sort()) {
    if (held.has(key)) continue;
    const [cx, cy] = parse(key);
    if (heldAt.some(([x, y]) => Math.abs(x - cx) + Math.abs(y - cy) <= FATE_SITE_SIGHT)) near.push(key);
  }
  return near;
};

export interface FateBeat { text: string; color: string }
/**
 * What fate's spin says once a drawn chunk is in colour: the seal it broke,
 * the site it held, and its omen (a broken seal's boon is doubled).
 */
export const fateBeats = (chunk: string, land: FateLand | undefined): FateBeat[] => {
  if (!land) return [];
  const beats: FateBeat[] = [];
  const region = Object.entries(land.seals ?? {}).find(([, key]) => key === chunk)?.[0];
  if (region) beats.push({ text: sealLine(region), color: '#ffff00' });
  const site = land.sites?.[chunk];
  if (site) beats.push({ text: siteLine(site), color: SITE_BLUE });
  const mark = land.marks[chunk];
  if (mark) {
    beats.push({
      text: region ? `Fate's gift: ${MARK_NAME[mark]}, doubled. ${SEAL_BOON_EFFECTS[mark] ?? FATE_MARK_EFFECTS[mark]}`
        : `${isBaneMark(mark) ? 'A bane' : 'A boon'}: ${MARK_NAME[mark]}. ${FATE_MARK_EFFECTS[mark]}`,
      color: omenColor(mark),
    });
  }
  return beats;
};

