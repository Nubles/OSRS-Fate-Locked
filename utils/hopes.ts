import type { TableType } from '../types';
import { hopeKey } from './hopeKey';

/**
 * The hope list: locked unlocks a player stars because they're hoping fate
 * draws them. Kept on the run (GameState.hopes) as "<table>|<entry id>" so it
 * travels with backups. Nothing that draws reads it: a hope only changes what
 * the player sees (the odds on Spend Keys, and the reveal when one lands).
 */
export { MAX_HOPES, hopeKey } from './hopeKey';

export const hopeParts = (key: string): { table: string; id: string } => {
  const at = key.indexOf('|');
  return at < 0 ? { table: '', id: key } : { table: key.slice(0, at), id: key.slice(at + 1) };
};

export const isHoped = (hopes: readonly string[] | undefined, table: TableType | string, id: string): boolean =>
  !!hopes?.includes(hopeKey(table, id));

/** The hoped entries among those a Key on this table can draw now. */
export const hopesInPool = (hopes: readonly string[] | undefined, table: TableType | string, pool: readonly string[]): string[] => {
  if (!hopes?.length) return [];
  const drawable = new Set(pool);
  return hopes.map(hopeParts).filter(h => h.table === table && drawable.has(h.id)).map(h => h.id);
};

/** "1 in 33" for 2 hopes in 66 entries; "every draw" when the whole table is hoped for. */
export const hopeOdds = (hoped: number, left: number): string =>
  hoped <= 0 || left <= 0 ? '' : hoped >= left ? 'every draw' : `1 in ${Math.max(1, Math.round(left / hoped))}`;

/** "2 of your hopes are on this table: 1 in 33 per Key." */
export const hopeLine = (hoped: number, left: number): string =>
  hoped <= 0 ? '' : `${hoped === 1 ? '1 of your hopes is' : `${hoped} of your hopes are`} on this table: ${hopeOdds(hoped, left)} per Key.`;
