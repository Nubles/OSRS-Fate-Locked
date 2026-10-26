import { TableType, type UnlockState } from '../types';
import type { GameModeRules } from '../config/gameModes';
import { BANK_BY_ID } from '../data/banks';
import { randomUnlockPool } from './gameEngine';
import { hopeLine, hopeOdds, hopeParts, hopesInPool } from './hopes';
import { OUTLOOK_TABLES, tableOutlook } from './tableOutlook';
import { outlookLine, outlookShort } from './tableOutlookText';
import type { SpendNote } from './spendNoteTypes';

const hopeName = (table: TableType, id: string): string =>
  table === TableType.BANKS ? BANK_BY_ID[id]?.name ?? id : id;

/**
 * The lines under each Spend Keys table, worked out here (loaded on first
 * use, hooks/useSpendNotes.ts) so the home screen doesn't carry the sums:
 * - the outlook (Settings: Table outlook): how many draws you could use now;
 * - the hope list's odds: which of your hopes a Key here could land.
 */
export const spendNotes = (
  unlocks: UnlockState,
  gameModeId: string | undefined,
  customMode: GameModeRules | undefined,
  hopes: readonly string[] | undefined,
  outlookOn: boolean,
): Map<TableType, SpendNote> => {
  const out = new Map<TableType, SpendNote>();
  const note = (table: TableType): SpendNote => {
    const current = out.get(table) ?? {};
    out.set(table, current);
    return current;
  };
  if (outlookOn) {
    for (const table of OUTLOOK_TABLES) {
      const outlook = tableOutlook(table, unlocks, gameModeId, customMode);
      if (outlook && outlook.left > 0) note(table).outlook = { ...outlook, short: outlookShort(outlook), line: outlookLine(outlook) };
    }
  }
  if (hopes?.length) {
    const tables = new Set(hopes.map(h => hopeParts(h).table));
    for (const table of Object.values(TableType)) {
      if (!tables.has(table)) continue;
      const pool = randomUnlockPool(unlocks, gameModeId, 'key', table, customMode).map(c => c.item);
      const hoped = hopesInPool(hopes, table, pool);
      if (!hoped.length) continue;
      const names = hoped.map(id => hopeName(table, id));
      const odds = hopeOdds(hoped.length, pool.length);
      note(table).hope = {
        names, odds,
        short: `${names.length === 1 ? names[0] : `${names.length} hopes`}: ${odds}`,
        line: hopeLine(hoped.length, pool.length),
      };
    }
  }
  return out;
};
