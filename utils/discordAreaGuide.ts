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
import { ACTIVITY_ACCESS_AREAS, NO_HARD_LOCATION_GATE } from '../data/activityAccess';
import { AREA_ALIAS_POLICIES, canonicalAreaName } from '../data/areaMapPolicy';
import { BANK_BY_ID, bankId } from '../data/banks';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { BOSSES_LIST, MINIGAMES_LIST, MISTHALIN_AREAS, REGION_GROUPS } from '../data/items';
import { QUEST_DATA, type QuestLocationRequirement } from '../data/questData';
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
  /** Banks standing in the area's chunks, or placed in the area by the bank registry. */
  banks: string[];
  /** Ways in besides walking, as the Journal names them. */
  routes: string[];
  /**
   * Other names for the area: the tracker's own aliases and the game's current map name.
   * Left out when there are none, so guides from before it was added read the same.
   */
  aliases?: string[];
  /**
   * Achievement diary tasks the tracker blocks until this area is open, as
   * '<Diary> <Tier>: <task>', in diary and tier order. Left out when there are none.
   */
  diaryTasks?: string[];
}

/** A boss or activity a Key can roll that no single tracked area opens. */
export interface DiscordUngatedEntry {
  name: string;
  kind: 'boss' | 'activity';
  /** One plain sentence on why no single area opens it. */
  reason: string;
}

/**
 * Version 1 grows only by optional keys: the live bot reads v 1 and ignores keys it does
 * not know, so every key it reads keeps its meaning.
 */
export interface DiscordAreaGuide {
  v: 1;
  areas: DiscordAreaEntry[];
  ungated: DiscordUngatedEntry[];
}

/**
 * The game's current names for tracked areas whose tracker name is older. Each is the
 * page title on the OSRS Wiki at the revision named beside it.
 */
export const DISCORD_IN_GAME_AREA_NAMES: Readonly<Record<string, readonly string[]>> = {
  // Blighted Volcano rev 15351735: 'aka = Wilderness Volcano', labelled "Blighted Volcano" on the world map (5 Nov 2025).
  'Wilderness Volcano': ['Blighted Volcano'],
  // Paterdomus Temple rev 15390039: 'name = Paterdomus Temple' (Paterdomus redirects there).
  'Paterdomus': ['Paterdomus Temple'],
  // Port Piscarilius rev 15372002: "'''Port Piscarilius''' is one of the five cities" (Piscarilius redirects there).
  'Piscarilius': ['Port Piscarilius'],
  // Shipyard rev 15303173: 'name = Shipyard', one word (the tracker's id keeps two, audit areas[1]).
  'Ship Yard': ['Shipyard'],
};

/**
 * Why each boss or activity in NO_HARD_LOCATION_GATE has no area gate, for players.
 * Checked against the OSRS Wiki at the revision named beside each.
 */
export const DISCORD_UNGATED_REASONS: Readonly<Record<string, string>> = {
  // Abyssal Sire rev 15392068: in the Abyssal Nexus, reached through the Abyss or fairy ring DIP.
  'Abyssal Sire': 'It lives in the Abyssal Nexus, which you reach through the Abyss or by fairy ring, and no tracked area covers it.',
  // Mimic rev 15401801: challenged at the strange casket in Watson's house, Hosidius, once an elite or master casket is a Mimic.
  'Mimic': "You fight it in Watson's house in Hosidius, but only once an elite or master clue casket turns out to be a Mimic, so no area opens it on its own.",
  // Shooting Stars rev 15396110: a star crashes at a random spot from a set list about every 90 minutes.
  'Shooting Stars': 'Stars crash at random spots all over the world, so no one area holds them.',
  // Impetuous Impulses rev 15399155: Puro-Puro, entered by the Zanaris crop circle or ones that appear in wheat fields around Gielinor.
  'Impetuous Impulses': 'It is played in Puro-Puro, which you enter through the crop circle in Zanaris or one that turns up in wheat fields around the world, so no single area opens it.',
  // Mahogany Homes rev 15392909: contracts in Falador, Varrock, East Ardougne and Hosidius.
  'Mahogany Homes': 'Its contracts send you to homes in Falador, Varrock, East Ardougne and Hosidius, so no single area opens it.',
  // Forestry rev 15404827: events spawn anywhere there are eligible trees, outside the Woodcutting Guild.
  'Forestry': 'Its events can appear wherever you cut suitable trees, so no single area opens it.',
  // Barracuda Trials rev 15413758: 'location = Various Oceans', raced in a skiff.
  'Barracuda Trials': 'The trials are raced at sea, in waters the tracker has no area for.',
};

/** The bot's lookup key: lower case, apostrophes dropped, any other run of non-alphanumerics one space. */
export const discordLookupKey = (text: string): string =>
  text.toLowerCase().replace(/['\u2018\u2019`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

interface RegionRequirement { regions?: string[]; anyOfRegions?: string[] }

/**
 * Whether the Journal (utils/journalStatus.ts evaluateDiaryTaskEligibility) blocks the
 * task until `area` is open: every name in `regions` is needed (aliases count as their
 * area), an `anyOfRegions` list only when all of its names are that area, and a task with
 * `oneOf` routes needs the area when it does or when every one of its routes does.
 */
const diaryTaskNeeds = (task: RegionRequirement & { oneOf?: RegionRequirement[] }, area: string): boolean => {
  const needs = (requirement: RegionRequirement): boolean =>
    (requirement.regions ?? []).some(region => canonicalAreaName(region) === area)
    || (Boolean(requirement.anyOfRegions?.length)
      && requirement.anyOfRegions!.every(region => canonicalAreaName(region) === area));
  return needs(task) || (Boolean(task.oneOf?.length) && task.oneOf!.every(needs));
};

const DIARY_TIER_ORDER = [...new Set(ALL_DIARY_TASKS.map(task => task.tierId))];

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export function buildDiscordAreaGuide(): DiscordAreaGuide {
  const regionOf = new Map<string, string>(MISTHALIN_AREAS.map(area => [area, 'Misthalin']));
  for (const [region, areas] of Object.entries(REGION_GROUPS)) {
    for (const area of areas) regionOf.set(area, region);
  }
  const bosses = new Set(BOSSES_LIST);
  // A bank the registry places in an area stands there, not in the area of its entrance chunk.
  const banksIn = (name: string, chunks: { cx: number; cy: number }[]): string[] => [
    ...chunks.map(chunk => BANK_BY_ID[bankId(chunk.cx, chunk.cy)]).filter(bank => bank && (bank.area ?? name) === name),
    ...Object.values(BANK_BY_ID).filter(bank => bank.area === name),
  ].map(bank => bank!.name);

  const areas = [...regionOf.entries()].map(([name, region]): DiscordAreaEntry => {
    const chunks = SUB_AREA_CHUNKS[name] ?? [];
    const gated = Object.entries(ACTIVITY_ACCESS_AREAS)
      .filter(([, gates]) => gates.includes(name))
      .map(([activity]) => activity);
    // A quest needs the area when it names it, or when every one of its alternative routes does:
    // an area that only one route uses (or that an anyOfRegions list offers) is not needed.
    const names = (regions: string[] = [], locations: QuestLocationRequirement[] = []): boolean =>
      regions.includes(name) || locations.some(location => location.standardAreas.includes(name));
    const quests = Object.values(QUEST_DATA)
      .filter(quest => names(quest.regions, quest.locations)
        || (Boolean(quest.oneOf?.length) && quest.oneOf!.every(option => names(option.regions, option.locations))))
      .map(quest => quest.name);
    return {
      name,
      region,
      chunks: chunks.length,
      bosses: sorted(gated.filter(activity => bosses.has(activity))),
      activities: sorted(gated.filter(activity => !bosses.has(activity))),
      quests: sorted(quests),
      banks: sorted(banksIn(name, chunks)),
      routes: [...new Set((AREA_ENTRY_ROUTES[name] ?? []).map(route => route.label))],
    };
  });

  const minigames = new Set<string>(MINIGAMES_LIST);
  const ungated = [...NO_HARD_LOCATION_GATE]
    .filter(name => bosses.has(name) || minigames.has(name))
    .map((name): DiscordUngatedEntry => {
      const reason = DISCORD_UNGATED_REASONS[name];
      if (!reason) throw new Error(`DISCORD_UNGATED_REASONS has no reason for ${name}`);
      return { name, kind: bosses.has(name) ? 'boss' : 'activity', reason };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // A name that already answers (an area, a boss, an activity) never becomes an alias:
  // Emir's Arena is the activity two areas open, so it stays that.
  const taken = new Set([
    ...areas.flatMap(area => [area.name, ...area.bosses, ...area.activities]),
    ...ungated.map(entry => entry.name),
  ].map(discordLookupKey));
  const aliasesOf = new Map<string, string[]>();
  for (const [alias, policy] of Object.entries(AREA_ALIAS_POLICIES)) {
    (aliasesOf.get(policy.canonical) ?? aliasesOf.set(policy.canonical, []).get(policy.canonical)!).push(alias);
  }
  for (const [area, names] of Object.entries(DISCORD_IN_GAME_AREA_NAMES)) {
    (aliasesOf.get(area) ?? aliasesOf.set(area, []).get(area)!).push(...names);
  }

  const withExtras = areas.map((entry): DiscordAreaEntry => {
    const aliases = sorted((aliasesOf.get(entry.name) ?? []).filter(alias => !taken.has(discordLookupKey(alias))));
    const diaryTasks = ALL_DIARY_TASKS
      .filter(task => diaryTaskNeeds(task, entry.name))
      .map((task, index) => ({ task, index }))
      .sort((a, b) => DIARY_TIER_ORDER.indexOf(a.task.tierId) - DIARY_TIER_ORDER.indexOf(b.task.tierId) || a.index - b.index)
      .map(({ task }) => `${task.tierId}: ${task.description}`);
    return {
      ...entry,
      ...(aliases.length ? { aliases } : {}),
      ...(diaryTasks.length ? { diaryTasks } : {}),
    };
  });

  return { v: 1, areas: withExtras.sort((a, b) => a.name.localeCompare(b.name)), ungated };
}
