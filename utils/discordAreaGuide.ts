/**
 * The area guide the Fate Locked Discord bot's `/area` command answers from:
 * for each tracked area, its region, what Vanilla gates on it and how to get
 * there. The bot reads it from the deployed site (public/discord-area-guide.json),
 * so a data change reaches Discord with the next tracker deploy.
 *
 * scripts/discordAreaGuide.test.ts fails when the committed file no longer matches
 * this module; `npm run discord:areas` rewrites it.
 */
import { AREA_ENTRY_ROUTES } from '../data/areaAccess';
import { ACTIVITY_ACCESS_AREAS } from '../data/activityAccess';
import { BANK_BY_ID, bankId } from '../data/banks';
import { BOSSES_LIST, MISTHALIN_AREAS, REGION_GROUPS } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';

export interface DiscordAreaEntry {
  name: string;
  region: string;
  /** Map chunks the area owns. */
  chunks: number;
  /** Bosses Vanilla opens only with this area (or one of its alternatives). */
  bosses: string[];
  /** Minigames and other activities gated the same way. */
  activities: string[];
  /** Quests that need the area open. */
  quests: string[];
  /** Banks standing in the area's chunks. */
  banks: string[];
  /** Ways in besides walking, as the Journal names them. */
  routes: string[];
}

export interface DiscordAreaGuide {
  v: 1;
  areas: DiscordAreaEntry[];
}

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export function buildDiscordAreaGuide(): DiscordAreaGuide {
  const regionOf = new Map<string, string>(MISTHALIN_AREAS.map(area => [area, 'Misthalin']));
  for (const [region, areas] of Object.entries(REGION_GROUPS)) {
    for (const area of areas) regionOf.set(area, region);
  }
  const bosses = new Set(BOSSES_LIST);

  const areas = [...regionOf.entries()].map(([name, region]): DiscordAreaEntry => {
    const chunks = SUB_AREA_CHUNKS[name] ?? [];
    const gated = Object.entries(ACTIVITY_ACCESS_AREAS)
      .filter(([, gates]) => gates.includes(name))
      .map(([activity]) => activity);
    const quests = Object.values(QUEST_DATA)
      .filter(quest => quest.regions.includes(name)
        || (quest.locations ?? []).some(location => location.standardAreas.includes(name))
        || (quest.oneOf ?? []).some(option => [...(option.regions ?? []), ...(option.anyOfRegions ?? [])].includes(name)))
      .map(quest => quest.name);
    return {
      name,
      region,
      chunks: chunks.length,
      bosses: sorted(gated.filter(activity => bosses.has(activity))),
      activities: sorted(gated.filter(activity => !bosses.has(activity))),
      quests: sorted(quests),
      banks: sorted(chunks.map(chunk => BANK_BY_ID[bankId(chunk.cx, chunk.cy)]?.name).filter((bank): bank is string => Boolean(bank))),
      routes: [...new Set((AREA_ENTRY_ROUTES[name] ?? []).map(route => route.label))],
    };
  });

  return { v: 1, areas: areas.sort((a, b) => a.name.localeCompare(b.name)) };
}
