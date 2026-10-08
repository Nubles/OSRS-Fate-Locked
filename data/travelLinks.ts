/**
 * Corrections to the map's route graph (the `connect` records in
 * public/chunk-content.json, from the Chunk Picker), which joins places
 * through teleport networks as if they were tunnels and has no boats.
 * utils/travelReach.ts reads the graph with both:
 * - A travel network's nodes are closed until the run has what opens it: its
 *   unlock and the quests it needs. The fairy rings need Fairy Rings,
 *   Fairytale I and a staff, for example, and a respawn or a crop circle
 *   never makes a route: without this, Lumbridge "reached" Brimhaven through
 *   Zanaris and Kourend Castle through Death's Office (a player's report,
 *   29 Sept 2026). A stop with a quest of its own, such as Ape Atoll's ring,
 *   is left off the network until that quest is done.
 * - A way that only leads out, such as the Entrana Dungeon's magic door to
 *   the Wilderness, is closed like a network that never opens: the graph
 *   has no direction, so it would otherwise lead in as well.
 * - A quest the player need only have started, as the Keldagrim mine carts
 *   want of The Giant Dwarf, is never assumed missing: the app records only
 *   finished quests, and the Journal asks for a start like that by hand. The
 *   quests it takes to start one are asked for instead: Maria Gunnars ferries
 *   the player during The Fremennik Isles, which needs The Fremennik Trials.
 * - Boats the graph leaves out join their docks, once the run has what each
 *   needs: its unlock (the charter ships need Charter Ships) and its quests. A
 *   dock with a quest of its own, such as the charter ships' Port Tyras, is
 *   left out until that quest is done. Coins, and the items a crew turns
 *   away, are never assumed either way, as with the Diary tasks' own item
 *   checks.
 *
 * Nodes are the graph's own names ("Zanaris") or chunk keys ("37,69"); docks
 * are chunk keys. utils/travelReach.test.ts checks every one against the
 * graph and the map, and every row cites the wiki revision it was reviewed
 * against.
 */

/** One way to open a network: all of it together. */
export interface NetworkOpener {
  mobility?: string;
  housing?: string;
  /** Finished quests. */
  quests?: readonly string[];
  /** A weapon this tier or better, unless this diary is done (the fairy rings' staff). */
  weapon?: { tier: number; unlessDiary?: string };
}

/** A stop the network reaches only once these quests are done. */
export interface NetworkStop {
  node: string;
  quests: readonly string[];
}

export interface TravelNetwork {
  label: string;
  /** The network's nodes in the route graph. */
  nodes: readonly string[];
  /** Any one of these opens it; none means it never makes a route. */
  opensWith: readonly NetworkOpener[];
  stops?: readonly NetworkStop[];
  source: string;
}

export interface BoatCrossing {
  label: string;
  /** Every dock the boat serves; it sails between any two. */
  docks: readonly string[];
  /** The Mobility unlock the crossing needs. */
  mobility?: string;
  /** Quests the crossing needs, every one of them. */
  quests?: readonly string[];
  /** Docks served only once these quests are done too. */
  stops?: readonly NetworkStop[];
  source: string;
}

const wiki = (page: string, oldid: number) =>
  `https://oldschool.runescape.wiki/w/${encodeURIComponent(page.replace(/ /g, '_'))}?oldid=${oldid}`;

export const TRAVEL_NETWORKS: readonly TravelNetwork[] = [
  {
    // The Zanaris hub and its interior chunk link every ring the graph knows. The rings open partway
    // through Fairytale II, which the app can't see, and Fairytale I must be done; a dramen or lunar
    // staff is needed, as the Diary's own fairy ring route has it (data/areaAccess.ts).
    label: 'Fairy rings',
    nodes: ['Zanaris', '37,69'],
    opensWith: [{
      mobility: 'Fairy Rings',
      quests: ['Fairytale I - Growing Pains'],
      weapon: { tier: 1, unlessDiary: 'Lumbridge Elite' },
    }],
    // AIS, AJP and CKQ; BJS; CIP; CLR.
    stops: [
      { node: '22,51', quests: ['Children of the Sun'] },
      { node: '25,47', quests: ['Children of the Sun'] },
      { node: '21,45', quests: ['Children of the Sun'] },
      { node: '33,47', quests: ['Regicide'] },
      { node: '39,60', quests: ['The Fremennik Trials'] },
      { node: '42,42', quests: ['Monkey Madness I'] },
    ],
    source: wiki('Fairy ring', 15345150),
  },
  {
    // Death sends the player to their respawn point, not wherever they choose.
    label: "Death's Office",
    nodes: ["Death's Office", '49,89'],
    opensWith: [],
    source: wiki("Death's Office", 15273706),
  },
  {
    // Leaving Puro-Puro returns the player to the wheat field they came in by.
    label: 'Puro-Puro',
    nodes: ['Puro-Puro', '40,67'],
    opensWith: [],
    source: wiki('Crop circle', 15333817),
  },
  {
    // Its only way out is a one-way magic door to level 32 Wilderness; no route into Entrana goes through it.
    label: 'Entrana Dungeon',
    nodes: ['Entrana Dungeon', '44,152'],
    opensWith: [],
    source: wiki('Entrana Dungeon', 15353043),
  },
  {
    // Its portals leave the player back with the wizard who sent them.
    label: 'Rune essence mine',
    nodes: ['45,75'],
    opensWith: [],
    source: wiki('Rune essence mine', 15236022),
  },
  {
    // The house's teleport portals; its entrances are the portals in town.
    label: 'House portals',
    nodes: ['Player-owned house', '28,89'],
    opensWith: [{ housing: 'Portal Chamber' }, { housing: 'Portal Nexus' }],
    source: wiki('Portal chamber', 15223409),
  },
  {
    label: 'The Abyss',
    nodes: ['Abyss', '47,74', '47,75'],
    opensWith: [{ quests: ['Enter the Abyss'] }],
    source: wiki('Abyss', 15228428),
  },
  {
    // The eyrie in Eagles' Peak (31,77) links the desert, jungle and polar lairs.
    // The graph also joins the lairs' caves to Eagles' Peak through the
    // dungeon, which is the same flight.
    label: 'Eagle transport',
    nodes: ['31,77', 'Desert eagle lair', 'Jungle eagle lair', 'Polar eagle lair', "Eagles' Peak Dungeon"],
    opensWith: [{ mobility: 'Eagle Transport', quests: ["Eagles' Peak"] }],
    source: wiki('Eagle transport system', 15212928),
  },
  {
    // The carts want The Giant Dwarf started, which the app can't see.
    label: 'Keldagrim mine carts',
    nodes: ['Keldagrim'],
    opensWith: [{ mobility: 'Mine Carts' }],
    source: wiki('Keldagrim minecart system', 15323246),
  },
  {
    // Auguste's flight (28,76) links Entrana with the other launch sites.
    label: 'Balloons',
    nodes: ['28,76'],
    opensWith: [{ mobility: 'Balloon Transport', quests: ['Enlightened Journey'] }],
    source: wiki('Balloon transport system', 15356815),
  },
];

export const BOAT_CROSSINGS: readonly BoatCrossing[] = [
  {
    // Cabin Boy Herbert stands in for him during A Kingdom Divided.
    label: 'Veos, from Port Sarim to Port Piscarilius and Land\'s End',
    docks: ['47,50', '28,57', '23,53'],
    source: wiki('Veos', 15289968),
  },
  {
    label: 'The monks of Entrana, from Port Sarim',
    docks: ['47,50', '44,52'],
    source: wiki('Monk of Entrana', 15258509),
  },
  {
    label: 'Captain Barnaby, between East Ardougne, Brimhaven and Rimmington',
    docks: ['41,51', '43,50', '45,50'],
    source: wiki('Captain Barnaby', 15315238),
  },
  {
    // Captain Tock sails once The Corsair Curse is started, and Cabin Boy Colin after it; the quest has no
    // requirements to start, so the crossing asks for none (a player's report, 29 Sept 2026).
    label: 'Captain Tock and Cabin Boy Colin, from Rimmington to Corsair Cove',
    docks: ['45,50', '40,44'],
    source: wiki('Corsair Cove', 15352458),
  },
  {
    // The barge guard stands at 3362,3448, in the Digsite's chunk.
    label: 'The canal barge from the Digsite to Fossil Island',
    docks: ['52,53', '58,59'],
    quests: ['Bone Voyage'],
    source: wiki('Barge guard', 15040225),
  },
  {
    label: "The squire's boat, from Port Sarim to the Void Knights' Outpost",
    docks: ['47,50', '41,41'],
    source: wiki('Squire (Void Knights)', 15239656),
  },
  {
    // Free after The Fremennik Trials; 1,000 coins a trip before.
    label: "Jarvald's boat, from Rellekka to Waterbirth Island",
    docks: ['40,57', '39,58'],
    source: wiki('Jarvald', 15351198),
  },
  {
    label: 'The sailor, from Rellekka to Miscellania',
    docks: ['41,57', '40,60'],
    quests: ['The Fremennik Trials'],
    source: wiki('Sailor', 15351110),
  },
  {
    // During and after The Fremennik Isles, which needs The Fremennik Trials to start.
    label: "Maria Gunnars' ferry, from Rellekka to Neitiznot",
    docks: ['41,57', '36,59'],
    quests: ['The Fremennik Trials'],
    source: wiki('Maria Gunnars', 15351202),
  },
  {
    // During and after The Fremennik Isles, which needs The Fremennik Trials to start.
    label: "Mord Gunnars' ferry, from Rellekka to Jatizso",
    docks: ['41,57', '37,59'],
    quests: ['The Fremennik Trials'],
    source: wiki('Mord Gunnars', 15351203),
  },
  {
    label: "Lokar Searunner, from Rellekka to Pirates' Cove",
    docks: ['40,57', '34,59'],
    quests: ['The Fremennik Trials'],
    source: wiki('Lokar Searunner', 15351199),
  },
  {
    // From partway through Lunar Diplomacy, which needs these quests to start.
    label: "Captain Bentley, from Pirates' Cove to Lunar Isle",
    docks: ['34,59', '33,60'],
    quests: ['The Fremennik Trials', 'Lost City', 'Rune Mysteries', 'Shilo Village'],
    source: wiki('Captain Bentley', 15229124),
  },
  {
    label: "Bill Teach, from Port Phasmatys to Mos Le'Harmless",
    docks: ['57,54', '57,46'],
    quests: ['Cabin Fever'],
    source: wiki('Bill Teach', 15297848),
  },
  {
    // From the start of The Great Brain Robbery, which needs these quests.
    label: "Brother Tranquility, from Mos Le'Harmless to Harmony Island",
    docks: ['57,46', '59,44'],
    quests: ['Creature of Fenkenstrain', 'Cabin Fever', 'RFD: Pirate Pete'],
    source: wiki('Harmony Island', 15350276),
  },
  {
    // He speaks only to a player with a ghostspeak amulet or Morytania legs 2, which the island's
    // entry routes ask for (data/areaAccess.ts).
    label: 'The ghost captain, from Port Phasmatys to Dragontooth Island',
    docks: ['57,54', '59,55'],
    source: wiki('Ghost captain', 15315341),
  },
  {
    // Every port but Deepfin Point and Port Roberts: the ships call there only for a player who has sailed
    // there already, and the open sea reaches them for such a player (utils/oceanAccess.ts).
    label: 'Charter ships',
    docks: [
      '47,49', '46,49', '43,50', '43,53', '41,49', '40,44', '57,54', '57,45', '46,47', '33,48', '33,52',
      '28,57', '23,53', '27,49', '22,46', '23,46', '47,46', '49,37', '43,39',
    ],
    mobility: 'Charter Ships',
    // Port Phasmatys; Mos Le'Harmless; the Shipyard, from partway through Monkey Madness I, which needs
    // The Grand Tree and Tree Gnome Village to start; Port Tyras; Prifddinas; Civitas illa Fortis,
    // Aldarin and the Sunset Coast; the Summer Shore, from partway through Troubled Tortugans, which
    // needs Pandemonium; Red Rock, from partway through The Red Reef, which needs Troubled Tortugans.
    stops: [
      { node: '57,54', quests: ['Priest in Peril'] },
      { node: '57,45', quests: ['Cabin Fever'] },
      { node: '46,47', quests: ['The Grand Tree', 'Tree Gnome Village'] },
      { node: '33,48', quests: ['Regicide'] },
      { node: '33,52', quests: ['Song of the Elves'] },
      { node: '27,49', quests: ['Children of the Sun'] },
      { node: '22,46', quests: ['Children of the Sun'] },
      { node: '23,46', quests: ['Children of the Sun'] },
      { node: '49,37', quests: ['Pandemonium'] },
      { node: '43,39', quests: ['Troubled Tortugans'] },
    ],
    source: wiki('Charter ship', 15321518),
  },
];
