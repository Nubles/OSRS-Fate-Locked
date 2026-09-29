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
 * - A quest the player need only have started, as the Keldagrim mine carts
 *   want of The Giant Dwarf, is never assumed missing: the app records only
 *   finished quests, and the Journal asks for a start like that by hand.
 * - Boats the graph leaves out join their docks, once the run has any quest
 *   each needs. Coins, and the items a crew turns away, are never assumed
 *   either way, as with the Diary tasks' own item checks.
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
  /** Quests the crossing needs, every one of them. */
  quests?: readonly string[];
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
    label: 'Eagle transport',
    nodes: ['31,77', 'Desert eagle lair', 'Jungle eagle lair', 'Polar eagle lair'],
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
    // The barge guard stands at 3362,3448, in the Digsite's chunk.
    label: 'The canal barge from the Digsite to Fossil Island',
    docks: ['52,53', '58,59'],
    quests: ['Bone Voyage'],
    source: wiki('Barge guard', 15040225),
  },
];
