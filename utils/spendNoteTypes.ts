import type { TableOutlook } from './tableOutlookText';

/** One Spend Keys table's extra lines, ready to show (utils/spendNotes.ts). */
export interface SpendNote {
  outlook?: TableOutlook & {
    /** "6/66 ready" */
    short: string;
    /** "6 of 66 ready if drawn (1 in 11): Obor, Bryophyta, Giant Mole and more." */
    line: string;
  };
  hope?: {
    /** The hoped entries a Key here could land, as players read them. */
    names: string[];
    /** "1 in 33" */
    odds: string;
    /** "Vorkath: 1 in 66", or "2 hopes: 1 in 33" */
    short: string;
    /** "2 of your hopes are on this table: 1 in 33 per Key." */
    line: string;
  };
}
