import { BANKS } from '../data/banks';

/**
 * The bank ids as the Banks list shows them: A to Z by place name. BANK_IDS is
 * the roll pool and keeps a fixed order (data/sources/bank-roll-order.json), so
 * a renamed bank keeps its place in the pool and still sits by its name here.
 */
export const BANK_IDS_BY_NAME: string[] = [...BANKS]
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  .map((bank) => bank.id);
