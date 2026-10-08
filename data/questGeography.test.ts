// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { AREA_ALIAS_POLICIES, AREA_REFERENCES, canonicalAreaName } from './areaMapPolicy';
import { interiorArea } from './interiorAreas';
import { MISTHALIN_AREAS, REGION_GROUPS } from './items';
import { QUEST_DATA, type QuestData, type QuestLocationRequirement } from './questData';
import { REGION_CHUNKS } from './regionChunks';
import { SUB_AREA_CHUNKS } from './subAreaChunks';

/**
 * The quest audit of 29 September 2026 found quests that missed an area one
 * of their mandatory steps is in: Temple of Ikov without East Ardougne, where
 * Lucien starts it, Tree Gnome Village without the Khazard Battlefield, and
 * many more. Players read "Ready to complete" as "I can do this now".
 *
 * This holds every Chunk Picker quest task with a location (as resolved in
 * data/sources/quest-step-evidence.json.gz) to the areas its quest requires:
 * - its enforced regions, and its locations' areas or chunks;
 * - any one route of its `oneOf`;
 * - the entrance and surface chunks the map policy gives an area
 *   (data/areaMapPolicy.ts);
 * - an interior's own area (data/interiorAreas.ts), such as the Dwarven Mine;
 * - free Misthalin, as in Vanilla.
 * A task the export puts in several places is covered by any one of them.
 * Anything else is listed in REVIEWED with the reason it stands.
 */

type Chunk = { cx: number; cy: number };
interface Candidate { chunkKey: string; evidence?: { interiorName?: string } }
interface Task { sourceId: string; location: { candidates: Candidate[] } }
interface Evidence { chunkPicker: { quests: Array<{ questId: string; tasks: Task[] }> } }

/** Interiors whose entrance the export has wrong (quest audit 1E), with their real mouths. */
const ENTRANCES: Readonly<Record<string, { chunks: readonly string[]; reason: string }>> = {
  'Entrana Dungeon': { chunks: ['44,52'], reason: 'Entered on Entrana; the export lists its one-way exit to the Wilderness (50,58).' },
  'Goblin Cave': { chunks: ['40,53', '41,53'], reason: 'Its mouth is at 2622-2624,3392 by the Fishing Guild; the export lists 40,52.' },
  Abyss: { chunks: ['48,55'], reason: 'Entered through the Mage of Zamorak north of Edgeville; the export lists the Blood and Soul altars.' },
};

/** Tasks outside their quest's areas, reviewed; the quest's requirements stand. */
const REVIEWED: Readonly<Record<string, string>> = {
  '~|A Night at the Theatre|~ 3': 'The spider nest is in 57,53, Darkmeyer\'s on the map; Darkness of Hallowvale, a prerequisite\'s prerequisite, needs Darkmeyer.',
  '~|A Night at the Theatre|~ 5': 'The spider nest is in 57,53, Darkmeyer\'s on the map; Darkness of Hallowvale, a prerequisite\'s prerequisite, needs Darkmeyer.',
  '~|A Taste of Hope|~ 8': 'The Burgh de Rott hideout; Darkness of Hallowvale, a prerequisite, needs Burgh de Rott.',
  '~|Desert Treasure II - The Fallen Empire|~ 6': 'Returning the last medallion carries you into her temple; the quarry portal is only for going back in.',
  '~|Dragon Slayer II|~ 24': 'The battle is fought on the fleet off Ungael, an instance; the export files it under 45,55.',
  '~|Dragon Slayer II|~ Complete the quest': 'The battle is fought on the fleet off Ungael, an instance; the export files it under 45,55.',
  '~|Garden of Tranquillity|~ 3d1': 'Dantaera is at the Catherby allotment, in 43,54, which the map gives to Camelot; Catherby stands, as for the Diary\'s Catherby patches.',
  '~|Horror from the Deep|~ 2a': 'Gunnjorn is at the Barbarian Outpost; Alfred Grimhand\'s Barcrawl, a prerequisite, needs it.',
  '~|In Aid of the Myreque|~ 9': 'The Canifis hideout; In Search of the Myreque, a prerequisite, needs Canifis and Mort Myre Swamp.',
  '~|In Aid of the Myreque|~ 11': 'The Canifis hideout; In Search of the Myreque, a prerequisite, needs Canifis and Mort Myre Swamp.',
  '~|In Aid of the Myreque|~ 15': 'The Canifis hideout; In Search of the Myreque, a prerequisite, needs Canifis and Mort Myre Swamp.',
  '~|In Aid of the Myreque|~ Complete the quest': 'The Canifis hideout; In Search of the Myreque, a prerequisite, needs Canifis and Mort Myre Swamp.',
  '~|King\'s Ransom|~ 4': 'Keep Le Faye is in Catherby; Merlin\'s Crystal, through Holy Grail, needs Catherby.',
  '~|Pandemonium|~ 3': 'The quest\'s own Sailing tutorial takes you to the wreck; only Port Sarim is a gate (requirement audit).',
  '~|Pandemonium|~ 4': 'The quest\'s own Sailing tutorial takes you to The Pandemonium; only Port Sarim is a gate (requirement audit).',
  '~|Pandemonium|~ 5': 'The quest\'s own Sailing tutorial takes you to The Pandemonium; only Port Sarim is a gate (requirement audit).',
  '~|Pandemonium|~ Complete the quest': 'The quest\'s own Sailing tutorial takes you to The Pandemonium; only Port Sarim is a gate (requirement audit).',
  '~|Recipe for Disaster/Freeing Sir Amik Varze|~ 7': 'The Dramen tree is on Entrana; Lost City, through Heroes\' Quest, needs Entrana.',
  '~|Sins of the Father|~ 24': 'Safalaan is on the Ver Sinhaza shore; A Taste of Hope, a prerequisite, needs Ver Sinhaza.',
  '~|The Blood Moon Rises|~ 7': 'The Canifis hideout; In Search of the Myreque, earlier in the series, needs Canifis and Mort Myre Swamp.',
  '~|The Final Dawn|~ 7': 'Cam Torum; Perilous Moons, a prerequisite, needs it.',
  '~|The Final Dawn|~ 8': 'Cam Torum; Perilous Moons, a prerequisite, needs it.',
  '~|The Fremennik Exiles|~ 3d1': 'The geyser is at Mountain Camp; Mountain Daughter, a prerequisite, needs it.',
  '~|The Fremennik Exiles|~ 3d3': 'The geyser is at Mountain Camp; Mountain Daughter, a prerequisite, needs it.',
  '~|The Fremennik Trials|~ 2a2': 'One of eight trials, and seven votes are enough (owner decision of 2 Oct: kept lenient).',
  '~|The Frozen Door|~ 1': 'The messenger brings the letter wherever you are; the export puts it at the pyramid.',
  '~|The Great Brain Robbery|~ 7': 'Fenkenstrain\'s Castle; Creature of Fenkenstrain, a prerequisite, needs it.',
  '~|The Path of Glouphrie|~ 4': 'Gianne jnr. is at the Grand Tree; The Eyes of Glouphrie, a prerequisite, needs the Tree Gnome Stronghold.',
  '~|The Red Reef|~ 1': 'The Summer Shore; Troubled Tortugans, a prerequisite, needs it.',
  '~|The Red Reef|~ 2': 'The Great Conch; Troubled Tortugans, a prerequisite, needs it.',
  '~|The Red Reef|~ 3': 'The Great Conch; Troubled Tortugans, a prerequisite, needs it.',
  '~|The Red Reef|~ 8': 'The Zenith is boarded at sea, where no area is.',
  '~|The Red Reef|~ 9': 'The Summer Shore; Troubled Tortugans, a prerequisite, needs it.',
  '~|The Red Reef|~ Complete the quest': 'The Summer Shore; Troubled Tortugans, a prerequisite, needs it.',
};

/** The export's names for quests the app names otherwise. */
const EXPORT_NAMES: Readonly<Record<string, string>> = {
  "Recipe for Disaster/Another Cook's Quest": 'RFD: The Cook',
  'Recipe for Disaster/Freeing the Mountain Dwarf': 'RFD: Dwarf',
  'Recipe for Disaster/Freeing the Goblin generals': 'RFD: Goblins',
  'Recipe for Disaster/Freeing Pirate Pete': 'RFD: Pirate Pete',
  'Recipe for Disaster/Freeing the Lumbridge Guide': 'RFD: Lumbridge Guide',
  'Recipe for Disaster/Freeing Evil Dave': 'RFD: Evil Dave',
  'Recipe for Disaster/Freeing Skrach Uglogwee': 'RFD: Skrach Uglogwee',
  'Recipe for Disaster/Freeing Sir Amik Varze': 'RFD: Sir Amik Varze',
  'Recipe for Disaster/Freeing King Awowogei': 'RFD: King Awowogei',
  'Recipe for Disaster/Defeating the Culinaromancer': 'RFD: Finale',
  'Vale Totems (miniquest)': 'Vale Totems',
};

const evidence: Evidence = JSON.parse(gunzipSync(readFileSync(new URL('./sources/quest-step-evidence.json.gz', import.meta.url)))
  .toString());

const keyOf = ({ cx, cy }: Chunk) => `${cx},${cy}`;
const subAreaAt = new Map<string, string>();
for (const [area, chunks] of Object.entries(SUB_AREA_CHUNKS)) for (const chunk of chunks) subAreaAt.set(keyOf(chunk), area);
const regionAt = new Map<string, string>();
for (const [region, chunks] of Object.entries(REGION_CHUNKS)) for (const chunk of chunks) regionAt.set(keyOf(chunk), region);
type Referenced = Record<string, { chunks?: readonly Chunk[] }>;
/** The areas a chunk counts for: its own, and those whose entrance or surface it is. */
const areasAt = new Map<string, Set<string>>();
for (const [chunk, area] of subAreaAt) areasAt.set(chunk, new Set([area]));
for (const [area, reference] of [...Object.entries(AREA_REFERENCES as Referenced), ...Object.entries(AREA_ALIAS_POLICIES as Referenced)]) {
  for (const chunk of reference.chunks ?? []) {
    const areas = areasAt.get(keyOf(chunk)) ?? new Set<string>();
    areas.add(area).add(canonicalAreaName(area));
    areasAt.set(keyOf(chunk), areas);
  }
}
const parentOf = new Map<string, string>();
for (const [parent, areas] of Object.entries(REGION_GROUPS)) for (const area of areas) parentOf.set(area, parent);
for (const area of MISTHALIN_AREAS) parentOf.set(area, 'Misthalin');
const isParent = (area: string) => area === 'Misthalin' || Object.hasOwn(REGION_GROUPS, area);

interface Route { areas: Set<string>; chunks: Set<string> }
const route = (areas: readonly string[], locations: readonly QuestLocationRequirement[]): Route => ({
  areas: new Set([...areas, ...locations.flatMap(location => location.standardAreas)].map(canonicalAreaName)),
  chunks: new Set(locations.flatMap(location => location.chunkOptions.map(keyOf))),
});
/** What the quest requires, as evaluateQuestEligibility enforces it, and its alternative routes. */
const routesOf = (quest: QuestData): Route[] => [
  route(quest.accessPolicy === 'locations' ? [] : quest.regions, quest.accessPolicy === 'regions' ? [] : quest.locations ?? []),
  ...(quest.oneOf ?? []).map(option => route([...(option.regions ?? []), ...(option.anyOfRegions ?? [])], option.locations ?? [])),
];

const chunkOpen = (chunk: string, routes: readonly Route[]): boolean => {
  const area = subAreaAt.get(chunk);
  if (area ? MISTHALIN_AREAS.includes(area) : regionAt.get(chunk) === 'Misthalin') return true;
  return routes.some(({ areas, chunks }) => chunks.has(chunk)
    || [...areasAt.get(chunk) ?? []].some(name => areas.has(name))
    || [...areas].some(name => isParent(name) && (area ? parentOf.get(area) === name : regionAt.get(chunk) === name)));
};

/** Whether one of the places the export gives a task is open to the quest's run. */
const placeOpen = (candidate: Candidate, routes: readonly Route[]): boolean => {
  const interior = candidate.evidence?.interiorName;
  const owner = interior ? interiorArea(interior) : undefined;
  if (owner) {
    return MISTHALIN_AREAS.includes(owner) || routes.some(({ areas }) => areas.has(owner) || areas.has(parentOf.get(owner) ?? ''));
  }
  const fixed = interior ? ENTRANCES[interior.split('#')[0].trim()] : undefined;
  return (fixed ? fixed.chunks : [candidate.chunkKey]).some(chunk => chunkOpen(chunk, routes));
};

const questByName = new Map<string, QuestData>();
for (const quest of Object.values(QUEST_DATA)) {
  questByName.set(quest.id, quest);
  questByName.set(quest.name, quest);
}
const exportQuests = evidence.chunkPicker.quests.map(({ questId, tasks }) => ({
  questId, quest: questByName.get(EXPORT_NAMES[questId] ?? questId), tasks: tasks.filter(task => task.location.candidates.length > 0),
}));

/** The located tasks of a quest that none of its places opens. */
const uncoveredTasks = (quest: QuestData): string[] => {
  const routes = routesOf(quest);
  return exportQuests.filter(entry => entry.quest?.id === quest.id)
    .flatMap(entry => entry.tasks)
    .filter(task => !task.location.candidates.some(candidate => placeOpen(candidate, routes)))
    .map(task => task.sourceId);
};

describe('quest steps are in the areas their quests require', () => {
  it('reads a quest for every quest the Chunk Picker export has', () => {
    expect(exportQuests.filter(entry => !entry.quest).map(entry => entry.questId)).toEqual([]);
    expect(exportQuests.reduce((total, entry) => total + entry.tasks.length, 0)).toBeGreaterThan(2000);
  });

  it('puts every located task in an area its quest requires, but the reviewed ones', () => {
    const astray = Object.values(QUEST_DATA).flatMap(uncoveredTasks);
    expect(astray.sort()).toEqual(Object.keys(REVIEWED).sort());
  });

  it.each([
    ['Temple of Ikov', { regions: ['Hemenster'] }, '~|Temple of Ikov|~ 1'],
    ['Tree Gnome Village', { regions: ['Gnome Village'] }, '~|Tree Gnome Village|~ 2'],
    ['Fishing Contest', { regions: ['Hemenster'] }, '~|Fishing Contest|~ Complete the quest'],
    ['Watchtower', { regions: ['Yanille'] }, '~|Watchtower|~ 6'],
    ["Eagles' Peak", { regions: ["Eagles' Peak", 'Varrock'] }, "~|Eagles' Peak|~ 1"],
    ['A Kingdom Divided', { regions: ['Shayzien', 'Lovakengj', 'Hosidius', 'Arceuus', 'Piscarilius'] }, '~|A Kingdom Divided|~ 2'],
    ['Secrets of the North', { regions: ['East Ardougne', 'Weiss'] }, '~|Secrets of the North|~ 2'],
    ['The Red Reef', { regions: ['Last Light'] }, '~|The Red Reef|~ 4'],
    ['Dwarf Cannon', { locations: QUEST_DATA['Dwarf Cannon'].locations!.filter(location => location.id !== 'fishing-guild-watchtower') }, '~|Dwarf Cannon|~ 4'],
  ])('would have caught %s as it was', (id, before, task) => {
    expect(uncoveredTasks(QUEST_DATA[id])).not.toContain(task);
    expect(uncoveredTasks({ ...QUEST_DATA[id], ...before })).toContain(task);
  });

  it('corrects only interiors the export really names', () => {
    const interiors = new Set(exportQuests.flatMap(entry => entry.tasks)
      .flatMap(task => task.location.candidates)
      .flatMap(candidate => candidate.evidence?.interiorName ? [candidate.evidence.interiorName.split('#')[0].trim()] : []));
    expect(Object.keys(ENTRANCES).filter(name => !interiors.has(name))).toEqual([]);
  });
});

describe('quest locations ask for the area their chunks are in', () => {
  const locations = Object.values(QUEST_DATA).flatMap(quest => [
    ...(quest.locations ?? []), ...(quest.oneOf ?? []).flatMap(option => option.locations ?? []),
  ].map(location => ({ quest: quest.id, location })));

  it('asks a location in a named chunk for one of that chunk\'s areas', () => {
    const mismatched = locations.filter(({ location }) => location.chunkOptions.some(chunk => {
      const areas = areasAt.get(keyOf(chunk));
      return areas !== undefined && !location.standardAreas.some(area => areas.has(canonicalAreaName(area)));
    })).map(({ quest, location }) => `${quest}: ${location.id}`);
    expect(mismatched).toEqual([]);
  });

  it('stands one named area in for each chunk no area owns', () => {
    const standIns = locations.filter(({ location }) => location.chunkOptions.every(chunk => !areasAt.has(keyOf(chunk))));
    expect(standIns.filter(({ location }) => location.standardAreas.length !== 1 || isParent(location.standardAreas[0]))
      .map(({ quest, location }) => `${quest}: ${location.id}`)).toEqual([]);
  });
});
