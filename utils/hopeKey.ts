import type { TableType } from '../types';

/** The most hopes a run keeps (the newest win). utils/hopes.ts has the rest; this stays small for the reducer. */
export const MAX_HOPES = 50;

/** "Bosses|Vorkath": a hope as GameState.hopes keeps it. */
export const hopeKey = (table: TableType | string, id: string): string => `${table}|${id}`;
