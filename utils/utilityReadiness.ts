import { TableType } from '../types';
import { BANK_BY_ID } from '../data/banks';
import { REGIONS_LIST, GUILDS_LIST } from '../data/items';
import { getActivityReq, MINIGAME_REQUIREMENT_OVERRIDES, type ActivityReq } from '../data/activityRequirements';

/**
 * The area each guild not named for an area stands in (its entrance chunk on
 * the map; the Wiki puts the Heroes' Guild in Burthorpe). A guild named for an
 * area needs that area; those in free Misthalin need nothing more.
 */
const GUILD_AREAS: Record<string, string[]> = {
  'Mining Guild': ['Falador'],
  "Heroes' Guild": ['Taverley', 'Burthorpe'],
  'Hunter Guild': ["Hunter's Guild"],
  "Myths' Guild": ['Corsair Cove'],
  'Ranging Guild': ['Hemenster'],
  "Servants' Guild": ['East Ardougne'],
  "Wizards' Guild": ['Yanille'],
};

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
  const minigame = table === TableType.MINIGAMES ? MINIGAME_REQUIREMENT_OVERRIDES[id] : undefined;
  if (minigame) return { ...req, ...minigame, skills: { ...req?.skills, ...minigame.skills } };
  if (GUILDS_LIST.includes(id) && !req?.requiredAreas?.length) {
    const areas = GUILD_AREAS[id] ?? (REGIONS_LIST.includes(id) ? [id] : undefined);
    if (areas) return { ...req, requiredAreas: areas };
  }
  return req;
}
