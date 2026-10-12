/**
 * Which collection log items a run's mode can log. Free-to-play runs log only
 * the free-to-play pages (data/f2pContent.ts); every other mode logs them all.
 */
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import { isF2PCollectionLogItem } from '../data/f2pContent';
import { isF2PMode } from '../config/gameModes';

let itemPages: Map<number, string> | null = null;
const pageOf = (itemId: number): string | undefined => {
  if (!itemPages) {
    itemPages = new Map();
    for (const tab of Object.values(COLLECTION_LOG_DATA)) {
      for (const page of Object.values(tab.pages)) {
        for (const item of page.items) if (!itemPages.has(item.id)) itemPages.set(item.id, page.name);
      }
    }
  }
  return itemPages.get(itemId);
};

export const MEMBERS_LOG_ITEM_REASON = 'This collection log item is members only, so it gives no Key in Free-to-play.';

/** Whether a run can log this collection log item. */
export const collectionLogItemInMode = (itemId: number, gameModeId?: string): boolean => {
  if (!isF2PMode(gameModeId)) return true;
  const page = pageOf(itemId);
  return page !== undefined && isF2PCollectionLogItem(page, itemId);
};
