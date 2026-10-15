import { MAP_BOUNDS, CHUNK_TILES } from './mapCoords';

/** Chunk range the world map image covers (see MAP_BOUNDS). */
const MIN_CX = MAP_BOUNDS.tileMinX / CHUNK_TILES;
const MAX_CX = MAP_BOUNDS.tileMaxX / CHUNK_TILES - 1;
const MIN_CY = MAP_BOUNDS.tileMinY / CHUNK_TILES;
const MAX_CY = MAP_BOUNDS.tileMaxY / CHUNK_TILES - 1;

export const RITUAL_MAP_COLS = 5;
export const RITUAL_MAP_ROWS = 4;

export interface RitualMapCell { key: string; col: number; row: number; owned: boolean; chosen: boolean }

export interface RitualMapWindow {
  /** Westmost chunk column and northmost chunk row shown. */
  cx0: number;
  cyTop: number;
  cells: RitualMapCell[];
  chosen: { col: number; row: number };
  /** The owned chunk in view nearest the chosen one, where the trail starts. */
  from: { col: number; row: number } | null;
}

/**
 * The 5x4 patch of world map the Cartographer scene unrolls: the chosen chunk
 * one column left of centre (room for the trail from your land), clamped so
 * the patch never runs off the map image. Rows count down from the north.
 */
export const ritualMapWindow = (chosenKey: string, ownedKeys: readonly string[]): RitualMapWindow => {
  const [cx, cy] = chosenKey.split(',').map(Number);
  const cx0 = Math.max(MIN_CX, Math.min(MAX_CX - RITUAL_MAP_COLS + 1, cx - 1));
  const cyTop = Math.min(MAX_CY, Math.max(MIN_CY + RITUAL_MAP_ROWS - 1, cy + 1));
  const owned = new Set(ownedKeys.filter(k => k !== chosenKey));
  const cells: RitualMapCell[] = [];
  for (let row = 0; row < RITUAL_MAP_ROWS; row++) {
    for (let col = 0; col < RITUAL_MAP_COLS; col++) {
      const key = `${cx0 + col},${cyTop - row}`;
      cells.push({ key, col, row, owned: owned.has(key), chosen: key === chosenKey });
    }
  }
  const chosen = { col: cx - cx0, row: cyTop - cy };
  let from: RitualMapWindow['from'] = null;
  let best = Infinity;
  for (const c of cells) {
    if (!c.owned) continue;
    const d = (c.col - chosen.col) ** 2 + (c.row - chosen.row) ** 2;
    if (d < best) { best = d; from = { col: c.col, row: c.row }; }
  }
  return { cx0, cyTop, cells, chosen, from };
};
