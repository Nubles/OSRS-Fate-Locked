import { TableType } from '../types';
import { BANK_BY_ID } from '../data/banks';
import { REGIONS_LIST, GUILDS_LIST } from '../data/items';
import { getActivityReq, type ActivityReq } from '../data/activityRequirements';

/** Missing catalogue data is a check for the player, never proof of access. */
export function getUtilityActivityReq(id: string, table: TableType, mode?: string): ActivityReq | undefined {
  if (table === TableType.BANKS) {
    const name = BANK_BY_ID[id]?.name ?? id;
    const area = REGIONS_LIST.find(area => area === name || name.toLowerCase() === `${area} bank`.toLowerCase());
    return { ...(area ? { requiredAreas: [area] } : {}), unverified: true,
      manualRequirements: [mode === 'chunked'
        ? `Reach the bank's chunk (${id}) and meet its entry requirements`
        : `Reach ${name} and meet its entry requirements`] };
  }
  const req = getActivityReq(id);
  if (GUILDS_LIST.includes(id) && REGIONS_LIST.includes(id)) return { ...req, requiredAreas: [id] };
  return req;
}
