import { MERGED_BANKS } from '../data/banks';

export interface MergedBankSettlement {
  banks: string[];
  /** Standard Keys paid back for a merged unlock whose bank the run already owned. */
  refunds: number;
  migrated: boolean;
}

/** The bank a merged unlock leads to, or the id itself. */
export const mergedBankId = (id: string): string =>
  Object.hasOwn(MERGED_BANKS, id) ? MERGED_BANKS[id] : id;

/**
 * Bank unlocks that open no bank become the bank they lead to, as merged
 * areas do (data/areaMapPolicy.ts). A run that owns both is paid one Key back
 * for the merged unlock, as far as the Key counter has room; past that the
 * merged id stays, unused, until a later load can pay it.
 */
export function settleMergedBanks(banks: readonly string[], refundCapacity: number): MergedBankSettlement {
  const owned = new Set(banks.filter(id => !Object.hasOwn(MERGED_BANKS, id)));
  const settled: string[] = [];
  let refunds = 0;
  let migrated = false;
  for (const id of banks) {
    const into = mergedBankId(id);
    if (into === id) {
      settled.push(id);
    } else if (!owned.has(into)) {
      owned.add(into);
      settled.push(into);
      migrated = true;
    } else if (refunds < refundCapacity) {
      refunds += 1;
      migrated = true;
    } else {
      settled.push(id);
    }
  }
  return { banks: settled, refunds, migrated };
}
