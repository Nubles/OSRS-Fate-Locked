/**
 * Saradomin's Ward's test for one entry. Kept apart from utils/ritualEffects so
 * the activity requirements it reads load only when a Ward is spent, not with
 * the app's first screen.
 */
import { getActivityReq } from '../data/activityRequirements';
import { BANK_BY_ID } from '../data/banks';
import { TableType, type UnlockState } from '../types';
import { evaluateActivityReadiness } from './activityReadiness';
import { chunkSubArea, isChunkUnlocked } from './chunkAdjacency';
import { isAreaReachable } from './reachability';

/**
 * Whether an entry could be used right now if a Key landed on it: its place
 * can be reached, and an activity's quest and skill gates are met. Tables with
 * no single place (skills, gear, shops, mobility, land) always count as usable.
 */
export const wardUsable = (table: TableType, item: string, unlocks: UnlockState, modeId: string): boolean => {
  switch (table) {
    case TableType.BOSSES:
    case TableType.MINIGAMES:
    case TableType.GUILDS:
      return evaluateActivityReadiness(true, getActivityReq(item), unlocks, modeId).status !== 'NOT_READY';
    case TableType.BANKS: {
      if (!BANK_BY_ID[item] || !/^\d+$/.test(item)) return true;
      const id = Number(item);
      const key = `${Math.floor(id / 256)},${id % 256}`;
      if (modeId === 'chunked') return isChunkUnlocked(key, unlocks.chunks ?? []);
      const area = chunkSubArea(key);
      return !area || isAreaReachable(area, unlocks, modeId);
    }
    default:
      return true;
  }
};
