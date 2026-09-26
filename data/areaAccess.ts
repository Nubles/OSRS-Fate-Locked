import type { DiaryTaskRequirementOption } from './diaryTasks';
import { canonicalAreaName } from './areaMapPolicy';

/**
 * Reviewed ways onto islands and enclaves that owning the area does not, by
 * itself, put you on. In the area modes an owned area listed here counts as
 * reachable for Achievement Diary tasks only once one of its routes is met;
 * every area not listed keeps plain ownership. Chunked mode ignores this
 * table because its chunk reach already models travel.
 *
 * Routes use the Diary requirement vocabulary, so utils/journalStatus.ts reads
 * them with the same evaluator as the tasks themselves:
 * - `regions` / `anyOfRegions` name the land you set off from, as the app's
 *   map owns it: the area whose chunk holds the dock, glider or path. Walking
 *   in from a neighbouring area needs a land connection in the reviewed walking
 *   graph (data/questWalkingGraph.json), never bare chunk adjacency.
 * - Areas in `anyOfRegions` never have routes of their own, so the route graph
 *   stays acyclic. Islands with routes are only ever named in `regions`.
 * - Items, coins and clue teleport scrolls are never assumed: they are manual
 *   checks, like the Diary tasks' own item checks. A clue scroll needs no
 *   Mobility unlock.
 * - Every route cites the wiki revision it was reviewed against.
 *
 * utils/areaAccess.test.ts pins the names, sources and graph shape.
 */
export interface AreaEntryRoute extends DiaryTaskRequirementOption {
  /** How the player gets there, as the Journal and goal planner show it. */
  label: string;
  /** Wiki page, pinned to the revision this route was reviewed against. */
  source: string;
  /** Set off from any one of these areas. */
  anyOfRegions?: string[];
}

/** The fairy ring network, as Diary tasks that use it already require it. */
const FAIRY_RING = {
  mobility: ['Fairy Rings'],
  equipmentRequirements: [{
    slot: 'Weapon',
    tier: 1,
    reason: 'Dramen or lunar staff for fairy rings',
    unlessDiary: 'Lumbridge Elite',
    manualCheck: 'Have Dramen or lunar staff for fairy rings and confirm that the specific item is permitted by your equipment tier',
  }],
  questProgress: [{
    quest: 'Fairytale II - Cure a Queen',
    label: 'Reached fairy ring access during Fairytale II - Cure a Queen',
  }],
} satisfies Partial<AreaEntryRoute>;

/**
 * Glider stations you can fly from without a quest of their own: Ta Quir Priw
 * (the Grand Tree), Sindarpos (White Wolf Mountain, in Taverley's chunk) and
 * Kar-Hewo (Al Kharid). Lemanto Andra at the Digsite is arrival-only.
 */
const GLIDER_STATIONS = ['Tree Gnome Stronghold', 'Taverley', 'Al Kharid'];

const LEMANTOLLY_UNDRI = {
  quest: 'One Small Favour',
  label: 'Reached the Lemantolly Undri glider in One Small Favour',
};

/**
 * Charter ship docks, by the area that owns each dock's chunk. The Musa Point
 * dock lies in Port Sarim's chunk, Deepfin Point's dock chunk has no area, and
 * the Karamja Shipyard and Mos Le'Harmless have routes of their own.
 */
const CHARTER_PORTS = [
  'Port Sarim', 'Brimhaven', 'Catherby', 'Port Khazard', 'Port Phasmatys',
  'Tyras Camp', 'Corsair Cove', 'Prifddinas', 'Piscarilius', "Land's End",
  'Civitas illa Fortis', 'Aldarin', 'Sunset Coast', 'The Pandemonium',
  'The Summer Shore', 'Red Rock', 'Port Roberts',
];

const MOORING_POINTS = 'https://oldschool.runescape.wiki/w/Mooring_point?oldid=15355932';
const GNOME_GLIDER = 'https://oldschool.runescape.wiki/w/Gnome_glider?oldid=15320406';
const CHARTER_SHIP = 'https://oldschool.runescape.wiki/w/Charter_ship?oldid=15321518';
const MINIGAME_TELEPORT = 'https://oldschool.runescape.wiki/w/Minigame_Teleport?oldid=15350988';

/** Sailing needs Pandemonium before any boat of your own, as ocean travel does. */
const sail = (level: number, quests: string[], source = MOORING_POINTS): AreaEntryRoute => ({
  label: `Sail there and moor (Sailing ${level})`,
  skills: { Sailing: level },
  quests: ['Pandemonium', ...quests],
  source,
});

export const AREA_ENTRY_ROUTES: Readonly<Record<string, readonly AreaEntryRoute[]>> = {
  "Void Knights' Outpost": [
    {
      label: "Squire's boat from Port Sarim",
      regions: ['Port Sarim'],
      source: 'https://oldschool.runescape.wiki/w/Void_Knights%27_Outpost?oldid=15325188',
    },
    {
      label: 'Minigame Teleport to Pest Control',
      mobility: ['Minigame Teleports'],
      combatLevel: 40,
      source: MINIGAME_TELEPORT,
    },
    sail(50, [], 'https://oldschool.runescape.wiki/w/Void_Knights%27_Outpost?oldid=15325188'),
    {
      label: 'Pest control teleport scroll',
      manualRequirements: ["Reach Void Knights' Outpost with a Pest control teleport scroll (a Treasure Trails reward)"],
      source: 'https://oldschool.runescape.wiki/w/Pest_control_teleport?oldid=15186015',
    },
  ],

  // The Shipyard's walking sections (11823-1 and 11822-1 with the DKP strip)
  // join no other Karamja land. Kharazi Jungle reaches only the jungle south of
  // the fence, not the yard or its Gandius glider.
  'Ship Yard': [
    {
      label: 'Gnome glider to Gandius from Ta Quir Priw, Sindarpos or Kar-Hewo',
      mobility: ['Gnome Gliders'],
      quests: ['The Grand Tree'],
      anyOfRegions: GLIDER_STATIONS,
      source: GNOME_GLIDER,
    },
    {
      label: 'Gnome glider to Gandius from Lemantolly Undri',
      mobility: ['Gnome Gliders'],
      quests: ['The Grand Tree'],
      regions: ['Feldip Hills'],
      questProgress: [LEMANTOLLY_UNDRI],
      source: GNOME_GLIDER,
    },
    {
      label: 'Charter ship to the Shipyard',
      mobility: ['Charter Ships'],
      quests: ['The Grand Tree'],
      questProgress: [{
        quest: 'Monkey Madness I',
        label: 'Completed the Shipyard part of Monkey Madness I, which opens its charter dock',
      }],
      anyOfRegions: CHARTER_PORTS,
      source: CHARTER_SHIP,
    },
    {
      // DKP lands at 2900,3111 in Tai Bwo Wannai's chunk. The path south-east
      // crosses chunk 45,47, which belongs to no named area, so it opens only
      // with every Karamja area.
      label: 'Fairy ring DKP, then walk south-east through the jungle',
      ...FAIRY_RING,
      locations: [{ label: 'Karamja jungle between the DKP fairy ring and the Shipyard', chunkOptions: [{ cx: 45, cy: 47 }] }],
      source: 'https://oldschool.runescape.wiki/w/Shipyard_(Karamja)?oldid=15315232',
    },
  ],

  // The cemetery's only walking links go north to Chaos Altar, east to the
  // Wilderness Bandit Camp and south into unnamed Wilderness. Dareeyak Teleport
  // lands in that unnamed Wilderness chunk (46,57), and the level-27 obelisk in
  // the Bandit Camp, so neither adds a route of its own.
  'Forgotten Cemetery': [
    {
      label: 'Cemetery Teleport (Arceuus spell or tablet)',
      arcana: ['Arceuus Spellbook'],
      skills: { Magic: 71 },
      source: 'https://oldschool.runescape.wiki/w/Cemetery_Teleport?oldid=15266150',
    },
    {
      label: 'Walk in from Chaos Altar',
      regions: ['Chaos Altar'],
      source: 'https://oldschool.runescape.wiki/w/The_Forgotten_Cemetery?oldid=15266153',
    },
    {
      label: 'Walk in from the Wilderness Bandit Camp',
      regions: ['Wilderness Bandit Camp'],
      source: 'https://oldschool.runescape.wiki/w/The_Forgotten_Cemetery?oldid=15266153',
    },
  ],

  // After Dragon Slayer I the island is reached only through the Karamja
  // Volcano dungeon, entered from Karamja or by leaving the TzHaar city.
  Crandor: [
    {
      label: 'Karamja Volcano dungeon from Musa Point',
      regions: ['Musa Point'],
      questProgress: [{ quest: 'Dragon Slayer I', label: 'Opened the Karamja Volcano wall to Crandor in Dragon Slayer I' }],
      source: 'https://oldschool.runescape.wiki/w/Crandor?oldid=15293774',
    },
    {
      label: 'Karamja Volcano dungeon from Mor Ul Rek',
      regions: ['Mor Ul Rek (TzHaar City)'],
      questProgress: [{ quest: 'Dragon Slayer I', label: 'Opened the Karamja Volcano wall to Crandor in Dragon Slayer I' }],
      source: 'https://oldschool.runescape.wiki/w/Crandor?oldid=15293774',
    },
  ],

  'Waterbirth Island': [
    {
      label: "Jarvald's boat from Rellekka",
      regions: ['Rellekka'],
      quests: ['The Fremennik Trials'],
      source: 'https://oldschool.runescape.wiki/w/Jarvald?oldid=15351198',
    },
    {
      label: 'Waterbirth Teleport (Lunar spell or tablet)',
      arcana: ['Lunar Spellbook'],
      skills: { Magic: 72 },
      quests: ['Lunar Diplomacy'],
      source: 'https://oldschool.runescape.wiki/w/Waterbirth_Teleport?oldid=15015720',
    },
    sail(74, ['The Fremennik Trials']),
    {
      label: "Jarvald's boat from Rellekka for 1,000 coins",
      regions: ['Rellekka'],
      manualRequirements: ['Pay Jarvald 1,000 coins for the boat to Waterbirth Island'],
      source: 'https://oldschool.runescape.wiki/w/Jarvald?oldid=15351198',
    },
  ],

  'Miscellania & Etceteria': [
    {
      label: 'Boat from Rellekka',
      regions: ['Rellekka'],
      quests: ['The Fremennik Trials'],
      source: 'https://oldschool.runescape.wiki/w/Miscellania?oldid=15351046',
    },
    {
      label: 'Ring of wealth teleport',
      mobility: ['Jewelry Teleports'],
      quests: ['Throne of Miscellania'],
      source: 'https://oldschool.runescape.wiki/w/Miscellania?oldid=15351046',
    },
    { ...sail(65, ['Royal Trouble']), label: 'Sail to Etceteria and moor (Sailing 65)' },
    {
      label: 'Fairy ring CIP',
      ...FAIRY_RING,
      quests: ['The Fremennik Trials'],
      source: 'https://oldschool.runescape.wiki/w/Miscellania?oldid=15351046',
    },
  ],

  Neitiznot: [
    {
      label: "Maria Gunnars' ferry from Rellekka",
      regions: ['Rellekka'],
      questProgress: [{ quest: 'The Fremennik Isles', label: 'Reached the part of The Fremennik Isles where Maria Gunnars ferries you to Neitiznot' }],
      source: 'https://oldschool.runescape.wiki/w/Maria_Gunnars?oldid=15351202',
    },
    sail(68, ['The Fremennik Isles']),
  ],

  Jatizso: [
    {
      label: "Mord Gunnars' ferry from Rellekka",
      regions: ['Rellekka'],
      questProgress: [{ quest: 'The Fremennik Isles', label: 'Started The Fremennik Isles, so Mord Gunnars ferries you to Jatizso' }],
      source: 'https://oldschool.runescape.wiki/w/Mord_Gunnars?oldid=15351203',
    },
    sail(68, ['The Fremennik Isles']),
  ],

  'Lunar Isle': [
    {
      label: 'Lunar Home Teleport or Moonclan Teleport',
      arcana: ['Lunar Spellbook'],
      quests: ['Lunar Diplomacy'],
      source: 'https://oldschool.runescape.wiki/w/Lunar_Isle?oldid=15351259',
    },
    {
      label: "Lokar Searunner to Pirates' Cove, then Captain Bentley",
      regions: ['Rellekka', "Pirates' Cove"],
      quests: ['The Fremennik Trials'],
      questProgress: [{ quest: 'Lunar Diplomacy', label: 'Reached the part of Lunar Diplomacy where Captain Bentley sails to Lunar Isle' }],
      source: 'https://oldschool.runescape.wiki/w/Lunar_Isle?oldid=15351259',
    },
    sail(76, ['Lunar Diplomacy']),
    {
      label: 'Lunar isle teleport scroll',
      quests: ['Lunar Diplomacy'],
      manualRequirements: ['Reach Lunar Isle with a Lunar isle teleport scroll (a Treasure Trails reward)'],
      source: 'https://oldschool.runescape.wiki/w/Lunar_isle_teleport?oldid=15186011',
    },
  ],

  // Harmony Island's boat leaves from here, so this island names no route
  // through Harmony Island (that would make the two depend on each other).
  "Mos Le'Harmless": [
    {
      label: "Bill Teach's ship from Port Phasmatys",
      regions: ['Port Phasmatys'],
      quests: ['Cabin Fever'],
      source: 'https://oldschool.runescape.wiki/w/Bill_Teach?oldid=15297848',
    },
    {
      label: 'Minigame Teleport to Trouble Brewing',
      mobility: ['Minigame Teleports'],
      quests: ['Cabin Fever'],
      skills: { Cooking: 40 },
      source: MINIGAME_TELEPORT,
    },
    {
      label: "Charter ship to Mos Le'Harmless",
      mobility: ['Charter Ships'],
      quests: ['Cabin Fever'],
      anyOfRegions: CHARTER_PORTS,
      source: CHARTER_SHIP,
    },
    {
      label: "Mos le'harmless teleport scroll",
      quests: ['Cabin Fever'],
      manualRequirements: ["Reach Mos Le'Harmless with a Mos le'harmless teleport scroll (a Treasure Trails reward)"],
      source: 'https://oldschool.runescape.wiki/w/Mos_le%27harmless_teleport?oldid=15186013',
    },
  ],

  'Harmony Island': [
    {
      label: "Brother Tranquility's boat from Mos Le'Harmless",
      regions: ["Mos Le'Harmless"],
      questProgress: [{ quest: 'The Great Brain Robbery', label: 'Started The Great Brain Robbery, so Brother Tranquility sails to Harmony Island' }],
      source: 'https://oldschool.runescape.wiki/w/Harmony_Island?oldid=15350276',
    },
    {
      label: 'Harmony Island Teleport (Arceuus spell or tablet)',
      arcana: ['Arceuus Spellbook'],
      skills: { Magic: 65 },
      quests: ['The Great Brain Robbery'],
      source: 'https://oldschool.runescape.wiki/w/Harmony_Island_Teleport?oldid=14863783',
    },
  ],

  // The app places this area at Pirate Pete's dock (chunk 57,55), which lies
  // in Port Phasmatys land north of the Ectofuntus.
  'Braindeath Island': [
    {
      label: "Pirate Pete's dock north of the Ectofuntus",
      regions: ['Port Phasmatys'],
      source: 'https://oldschool.runescape.wiki/w/Braindeath_Island?oldid=15231735',
    },
  ],

  'Dragontooth Island': [
    {
      label: "Ghost captain's boat from Port Phasmatys, wearing a ghostspeak amulet",
      regions: ['Port Phasmatys'],
      equipmentRequirements: [{ slot: 'Neck', tier: 1, reason: 'Ghostspeak amulet' }],
      manualRequirements: [
        'Have a ghostspeak amulet to speak to the Ghost Captain',
        'Pay the ghost captain 25 ecto-tokens, unless you have paid his one-off 500',
      ],
      source: 'https://oldschool.runescape.wiki/w/Dragontooth_Island?oldid=15321375',
    },
    {
      label: "Ghost captain's boat from Port Phasmatys, wearing Morytania legs 2 or better",
      regions: ['Port Phasmatys'],
      equipmentRequirements: [{
        slot: 'Legs',
        tier: 1,
        reason: 'Morytania legs 2 or better',
        manualCheck: 'Have Morytania legs 2 or better and confirm that the specific item is permitted by your equipment tier',
      }],
      manualRequirements: ['Pay the ghost captain 25 ecto-tokens, unless you have paid his one-off 500'],
      source: 'https://oldschool.runescape.wiki/w/Dragontooth_Island?oldid=15321375',
    },
  ],

  // Crash Island, where Lumdo's boat leaves, is part of this area's map.
  'Ape Atoll': [
    {
      label: "Daero's glider to Crash Island, then Lumdo's boat",
      regions: ['Tree Gnome Stronghold'],
      questProgress: [{ quest: 'Monkey Madness I', label: "Reached Daero's glider trip to Crash Island in Monkey Madness I" }],
      source: 'https://oldschool.runescape.wiki/w/Ape_Atoll?oldid=15317976',
    },
    {
      label: 'Ape Atoll Teleport (standard spellbook)',
      skills: { Magic: 64 },
      quests: ['RFD: King Awowogei'],
      source: 'https://oldschool.runescape.wiki/w/Ape_Atoll_Teleport_(standard)?oldid=14906055',
    },
    {
      label: 'Ape Atoll Teleport (Arceuus spell or tablet)',
      arcana: ['Arceuus Spellbook'],
      skills: { Magic: 90 },
      quests: ['Monkey Madness I'],
      source: 'https://oldschool.runescape.wiki/w/Ape_Atoll_Teleport_(Arceuus)?oldid=14863786',
    },
    {
      label: 'Gnome glider to Ookookolly Undri from Ta Quir Priw, Sindarpos or Kar-Hewo',
      mobility: ['Gnome Gliders'],
      quests: ['Monkey Madness II'],
      anyOfRegions: GLIDER_STATIONS,
      source: GNOME_GLIDER,
    },
    {
      label: 'Gnome glider to Ookookolly Undri from Lemantolly Undri',
      mobility: ['Gnome Gliders'],
      quests: ['Monkey Madness II'],
      regions: ['Feldip Hills'],
      questProgress: [LEMANTOLLY_UNDRI],
      source: GNOME_GLIDER,
    },
    {
      // Leaving the agility course needs 48 Agility even when failing the rope.
      label: 'Fairy ring CLR, then leave the agility course',
      ...FAIRY_RING,
      quests: ['Monkey Madness I'],
      skills: { Agility: 48 },
      source: 'https://oldschool.runescape.wiki/w/Ape_Atoll?oldid=15317976',
    },
  ],
};

/**
 * Every area and map chunk the routes into `area` can depend on, directly or
 * through another listed island. Advisors that only re-check tasks when a
 * relevant area opens use this to notice that a departure area matters too.
 */
export const areaEntryDependencies = (area: string): { areas: string[]; chunks: Array<{ cx: number; cy: number }> } => {
  const areas = new Set<string>();
  const chunks = new Map<string, { cx: number; cy: number }>();
  const visit = (name: string, seen: ReadonlySet<string>) => {
    if (seen.has(name)) return;
    const next = new Set(seen).add(name);
    for (const route of AREA_ENTRY_ROUTES[name] ?? []) {
      for (const departure of [...(route.regions ?? []), ...(route.anyOfRegions ?? [])]) {
        areas.add(departure);
        visit(departure, next);
      }
      for (const location of route.locations ?? []) {
        for (const chunk of location.chunkOptions) chunks.set(`${chunk.cx},${chunk.cy}`, chunk);
      }
    }
  };
  visit(canonicalAreaName(area), new Set());
  return { areas: [...areas], chunks: [...chunks.values()] };
};
