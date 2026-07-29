import { describe, expect, it } from 'vitest';
import official from './sources/quest-list.json';
import audit from './sources/quest-requirement-audit.json';
import { QUEST_DATA } from './questData';
import {
  questRequirementFingerprint,
  validateQuestRequirementAudit,
} from './questRequirementAudit';

const EXPECTED_TZ_INSTANCE_EVIDENCE: Record<string, string[]> = {
  'Tale of the Righteous': [
    'Tower of Magic prison and the unstable-altar cave beneath Mount Quidamortem.',
  ],
  'Tears of Guthix': [
    'Lumbridge Swamp Caves and the cavern containing Juna and the Tears of Guthix chasm.',
  ],
  'Temple of Ikov': [
    'The Temple of Ikov dungeon, including the Chamber of Fear, ice chamber, unsteady bridge, and guardian-side chambers.',
  ],
  'Temple of the Eye': [
    "The Abyss centre, Wizards' Tower basement, underwater Temple of the Eye, and the Guardians of the Rift tutorial instance and altar portals.",
  ],
  'The Ascent of Arceuus': [
    'Tower of Magic interiors and the Karuulm Slayer Dungeon Tasakaal chamber.',
  ],
  'The Blood Moon Rises': [
    'Myreque hideout, Sisterhood Sanctuary, Crombwick Manor, Paterdomus basement, Ivandis tomb tunnel, daeyalt cavern and refinery, Castle Drakan basements, laboratories and portals, Vampyrium forest, cave and castle, the ruined laboratory, and their quest-fight instances.',
  ],
  'The Corsair Curse': [
    'Corsair Cove Dungeon and the instanced Ithoi confrontation.',
  ],
  'The Curse of Arrav': [
    "Uzer Mastaba, Trollweiss Dungeon and rubble tunnels, Zemouregal's fort basement, base and dungeon, and the kitchen sewer.",
  ],
  'The Depths of Despair': [
    'Crabclaw Caves and the instanced Sand Snake fight.',
  ],
  'The Dig Site': [
    'Digsite Dungeon, its winch shafts, and the ancient chamber.',
  ],
  'The Eyes of Glouphrie': [
    "Brimstail's Cave and singing-bowl chamber.",
  ],
  'The Final Dawn': [
    'Twilight Temple basement, the safe-house basement, Crypt of Tonali, and the Neypotzli cavern, sun chamber, moon chamber, and encounter instances.',
  ],
  'The Forsaken Tower': [
    'Forsaken Tower interiors, basement, refinery, and pylon rooms.',
  ],
  'The Fremennik Exiles': [
    'The basilisk market fight instance and the Island of Stone cave and Jormungand fight instance; Waterbirth Island Dungeon and the Lunar Isle mine are optional routes.',
  ],
  'The Fremennik Isles': [
    'Ice Troll Caves and the instanced Troll King fight; the Jatizso mine is optional.',
  ],
  'The Fremennik Trials': [
    "Swensen's portal maze and Thorvald's basement and Koschei arena.",
  ],
  'The Garden of Death': [
    'The four underground dungeons beneath the swamp settlement, Molch Island, Xeric Shrine, and the Ruins of Morra.',
  ],
  'The Giant Dwarf': [
    'The Keldagrim entrance cave, underground city, and River Kelda route.',
  ],
  'The Golem': [
    'The Uzer temple dungeon and demon portal chamber.',
  ],
  'The Grand Tree': [
    "The Grand Tree root tunnels and Glough's trapdoor cave and black-demon tunnel.",
  ],
  'The Great Brain Robbery': [
    "The underwater tunnel, Fenkenstrain's windmill basement surgery, and the instanced Barrelchest fight.",
  ],
  'The Heart of Darkness': [
    'The blocked Twilight Temple passage, Ruins of Tapoyauik dungeon, and instanced Amoxliatl fight.',
  ],
  'The Ides of Milk': [
    'The instanced bull fight.',
  ],
  "The Knight's Sword": [
    'The Asgarnian Ice Dungeon blurite cave.',
  ],
  'The Lost Tribe': [
    'Lumbridge cellar tunnels, the goblin maze, Dorgeshuun Mine, and the final peace-treaty cutscene instance.',
  ],
  'The Path of Glouphrie': [
    'Tree Gnome Village Dungeon storeroom and the Poison Waste Dungeon.',
  ],
  'The Queen of Thieves': [
    'The Warrens beneath Port Piscarilius and the gang route and tent interiors.',
  ],
  'The Red Reef': [
    'The required instanced confrontation at Last Light; the preceding ship-combat route can be skipped.',
  ],
  'The Restless Ghost': [
    "Wizards' Tower basement and the skull-skeleton chamber.",
  ],
  'The Slug Menace': [
    'Witchaven Dungeon, the Pillars of Zanash, and the Slug Prince chamber.',
  ],
  'The Tourist Trap': [
    'The underground Desert Mining Camp and mine-cart tunnels.',
  ],
  'Tower of Life': [
    'Tower of Life interiors and the basement dungeon and Homunculus chamber.',
  ],
  'Troll Romance': [
    'Trollweiss Dungeon, cave and sled tunnel, and the troll-arena fight.',
  ],
  'Troll Stronghold': [
    'The troll arena, mountain cave, and Troll Stronghold and prison interiors.',
  ],
  'Troubled Tortugans': [
    'The tracked cave and the Shellbane gryphon fight.',
  ],
  "Twilight's Promise": [
    'The crypt beneath the Civitas illa Fortis temple.',
  ],
  'Underground Pass': [
    "The fully quest-instanced Underground Pass dungeon, including Iban's lair, tomb, temple, and collapse cavern.",
  ],
  'Vampyre Slayer': [
    'Draynor Manor basement and the Count Draynor coffin fight.',
  ],
  'Wanted!': [
    'Taverley Dungeon Black Knight hideout, Dorgesh-Kaan Mine, the rune essence mine, and the instanced Solus confrontation.',
  ],
  'Watchtower': [
    'The Skavid caves and Ogre Enclave cave.',
  ],
  'Waterfall Quest': [
    "Tree Gnome Village Dungeon, Glarial's Tomb, and Waterfall Dungeon.",
  ],
  'What Lies Below': [
    'The Tunnel of Chaos, Dagon-hai chambers and second level, portal chamber, and the instanced Surok and King Roald confrontation.',
  ],
  'While Guthix Sleeps': [
    "Black Knight Catacombs, Movario's base, Lucien's camp, the Ancient Guthixian Temple, and the Balance Elemental and tormented-demon fight sequence.",
  ],
  "Witch's House": [
    "The Witch's House basement.",
  ],
  'Zogre Flesh Eaters': [
    'Jiggig Dungeon, the zogre cave, and the crypt.',
  ],
};

const EXPECTED_TZ_SURFACE_ONLY = [
  'Tai Bwo Wannai Trio',
  'The Feud',
  'The Hand in the Sand',
  'The Ribbiting Tale',
  'Throne of Miscellania',
  'Tree Gnome Village',
  'Tribal Totem',
  "Witch's Potion",
  'X Marks the Spot',
];
const expectReviewedBatch = (start: string, end?: string) => {
  const rows = audit.entries.filter(entry =>
    entry.kind === 'quest' &&
    entry.id.localeCompare(start) >= 0 &&
    (end === undefined || entry.id.localeCompare(end) < 0));

  expect(rows.length).toBeGreaterThan(0);
  expect(rows.flatMap(entry => {
    const quest = QUEST_DATA[entry.id];
    if (!quest) return [`${entry.id}:missing-runtime`];
    if (!entry.source.url.startsWith('https://oldschool.runescape.wiki/w/')) {
      return [`${entry.id}:unstable-source-url`];
    }
    if (!Number.isInteger(entry.source.revision) || entry.source.revision <= 0) {
      return [`${entry.id}:missing-source-revision`];
    }
    if (entry.chunkSourceCommit !== 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926') {
      return [`${entry.id}:wrong-chunk-source`];
    }
    if (entry.requirementFingerprint !== questRequirementFingerprint(quest)) {
      return [`${entry.id}:stale-fingerprint`];
    }
    if (entry.status === 'unresolved' &&
        (!entry.discrepancy || !entry.conservativeReason)) {
      return [`${entry.id}:unexplained-unresolved`];
    }
    return [];
  })).toEqual([]);
};

describe('official quest and miniquest audit coverage', () => {
  it('matches official, runtime, and audit IDs one-to-one', () => {
    expect(validateQuestRequirementAudit(QUEST_DATA, official, audit).errors)
      .toEqual([]);
  });

  it('has no unaudited official or runtime entry', () => {
    expect(validateQuestRequirementAudit(QUEST_DATA, official, audit).errors).toEqual([]);
    expect(audit.entries.filter(entry =>
      entry.status === 'unresolved' &&
      (!entry.discrepancy || !entry.conservativeReason)))
      .toEqual([]);
  });

  it('pins the current reviewed baseline by explicit kind', () => {
    expect(official.entries.filter(entry => entry.kind === 'quest')).toHaveLength(190);
    expect(official.entries.filter(entry => entry.kind === 'miniquest')).toHaveLength(19);
    expect(Object.values(QUEST_DATA).filter(entry => entry.kind === 'quest')).toHaveLength(190);
    expect(Object.values(QUEST_DATA).filter(entry => entry.kind === 'miniquest')).toHaveLength(19);
  });

  it('matches every runtime requirement fingerprint', () => {
    const byId = new Map(audit.entries.map(entry => [entry.id, entry]));
    expect(Object.values(QUEST_DATA).flatMap(quest => {
      const entry = byId.get(quest.id);
      return entry?.requirementFingerprint === questRequirementFingerprint(quest)
        ? []
        : [quest.id];
    })).toEqual([]);
  });

  it('reviews every A-F quest', () => expectReviewedBatch('A', 'G'));

  it('reviews every G-M quest', () => expectReviewedBatch('G', 'N'));

  it('reviews every N-S quest', () => expectReviewedBatch('N', 'T'));

  it('reviews every T-Z quest', () => expectReviewedBatch('T'));

  it('leaves no unexplained T-Z review placeholders', () => {
    expect(audit.entries
      .filter(entry =>
        entry.kind === 'quest' &&
        entry.id.localeCompare('T') >= 0 &&
        entry.status === 'unresolved')
      .map(entry => entry.id))
      .toEqual([]);
  });

  it('pins concrete non-surface evidence for every reviewed T-Z quest', () => {
    const rows = audit.entries.filter(entry =>
      entry.kind === 'quest' && entry.id.localeCompare('T') >= 0);
    const actual = Object.fromEntries(rows
      .filter(entry => entry.notes.instances.length > 0)
      .map(entry => [entry.id, entry.notes.instances]));

    expect(actual).toEqual(EXPECTED_TZ_INSTANCE_EVIDENCE);
    expect(rows
      .filter(entry => entry.notes.instances.length === 0)
      .map(entry => entry.id))
      .toEqual(EXPECTED_TZ_SURFACE_ONLY);
  });

  it('keeps committed quest-source JSON free of apostrophe mojibake', () => {
    expect(JSON.stringify({ official, audit })).not.toContain('\u00e2\u20ac\u2122');
  });
  it('leaves no unexplained N-S review placeholders', () => {
    expect(audit.entries
      .filter(entry =>
        entry.kind === 'quest' &&
        entry.id.localeCompare('N') >= 0 &&
        entry.id.localeCompare('T') < 0 &&
        entry.status === 'unresolved')
      .map(entry => entry.id))
      .toEqual([]);
  });

  it('leaves no unexplained G-M review placeholders', () => {
    expect(audit.entries
      .filter(entry =>
        entry.kind === 'quest' &&
        entry.id.localeCompare('G') >= 0 &&
        entry.id.localeCompare('N') < 0 &&
        entry.status === 'unresolved')
      .map(entry => entry.id))
      .toEqual([]);
  });

  it('leaves only the concrete A-F alternative-requirement conflict unresolved', () => {
    expect(audit.entries
      .filter(entry =>
        entry.kind === 'quest' &&
        entry.id.localeCompare('A') >= 0 &&
        entry.id.localeCompare('G') < 0 &&
        entry.status === 'unresolved')
      .map(entry => entry.id))
      .toEqual(['Desert Treasure I']);
  });

  it('has reviewed evidence and matching requirements for all 19 miniquests', () => {
    const rows = audit.entries.filter(entry => entry.kind === 'miniquest');
    expect(rows).toHaveLength(19);
    expect(rows.flatMap(entry => {
      if (entry.status !== 'unresolved') return [];
      return entry.discrepancy && entry.conservativeReason ? [] : [entry.id];
    })).toEqual([]);
    expect(rows.flatMap(entry => {
      const quest = QUEST_DATA[entry.id];
      return entry.requirementFingerprint === questRequirementFingerprint(quest)
        ? []
        : [entry.id];
    })).toEqual([]);
  });

  it('leaves only the two concrete miniquest evidence conflicts unresolved', () => {
    expect(audit.entries
      .filter(entry => entry.kind === 'miniquest' && entry.status === 'unresolved')
      .map(entry => entry.id))
      .toEqual(['Bear Your Soul', 'The Enchanted Key']);
  });

  it('records concrete source gaps for every generated discrepancy category', () => {
    const byId = new Map(audit.entries.map(entry => [entry.id, entry]));
    const cases = [
      {
        id: 'Desert Treasure I',
        discrepancy: ['regions policy', 'Kharidian Desert', 'Bedabin Camp', '49,47', 'The Dig Site'],
      },
      {
        id: 'Bear Your Soul',
        discrepancy: ['regions policy', 'Soul Altar', 'Blood Altar', '26,59'],
      },
      {
        id: 'The Enchanted Key',
        discrepancy: ['eleven fixed treasure sites', 'Falador', 'Grand Exchange', 'Jorral'],
      },
    ];

    for (const example of cases) {
      const entry = byId.get(example.id)!;
      for (const detail of example.discrepancy) {
        expect(entry.discrepancy, `${example.id}: ${detail}`).toContain(detail);
      }
      expect(entry.conservativeReason, example.id).toContain(example.id);
      expect(entry.conservativeReason, example.id).toContain(`${entry.accessPolicy} policy`);
      expect(entry.conservativeReason, example.id).toMatch(/premature completion\/key-roll eligibility/i);
    }
  });

  it("pins reviewed Witch's Potion and Murder Mystery source evidence", () => {
    const byId = new Map(audit.entries.map(entry => [entry.id, entry]));

    expect(byId.get("Witch's Potion")).toMatchObject({
      status: 'verified-with-notes',
      accessPolicy: 'locations',
      source: { revision: 15166776 },
      chunkEvidence: [{ chunkId: '46,50', role: 'first', place: 'Rimmington' }],
    });
    expect(byId.get("Witch's Potion")?.notes.items).toEqual([
      'An eye of newt may be obtained before the quest; Port Sarim travel and item possession are not machine-enforced.',
    ]);
    expect(byId.get('Murder Mystery')).toMatchObject({
      status: 'verified',
      accessPolicy: 'locations',
      source: { revision: 15271664 },
      chunkEvidence: [
        { chunkId: '42,55', role: 'first', place: 'Sinclair Mansion' },
        { chunkId: '42,54', role: 'step', place: "Seers' Village" },
      ],
    });
  });

  it('rejects generic procedural unresolved placeholders', () => {
    const generic = structuredClone(audit);
    const unresolved = generic.entries.find(entry => entry.id === 'Desert Treasure I')!;
    unresolved.discrepancy =
      'Pending review of the permanent Wiki and Chunk Picker sources.';
    unresolved.conservativeReason =
      'Retained until Tasks 6-11 finish the review.';

    expect(validateQuestRequirementAudit(QUEST_DATA, official, generic).errors)
      .toEqual(expect.arrayContaining([
        expect.stringContaining('generic procedural discrepancy'),
        expect.stringContaining('does not explain premature completion/key-roll eligibility'),
      ]));
  });
});

describe('quest access policy structure', () => {
  const validationErrorsAfterRuntimeMutation = (
    id: string,
    mutate: (quest: (typeof QUEST_DATA)[string]) => void,
  ): string[] => {
    const runtime = structuredClone(QUEST_DATA);
    const matchingAudit = structuredClone(audit);
    mutate(runtime[id]);
    const matchingEntry = matchingAudit.entries.find(entry => entry.id === id)!;
    matchingEntry.accessPolicy = runtime[id].accessPolicy;
    matchingEntry.requirementFingerprint = questRequirementFingerprint(runtime[id]);
    return validateQuestRequirementAudit(runtime, official, matchingAudit).errors;
  };

  it.each([
    {
      name: 'locations policy with missing locations',
      id: "Witch's Potion",
      mutate: (quest: (typeof QUEST_DATA)[string]) => {
        quest.oneOf = [{ regions: ['Misthalin'] }];
        delete quest.locations;
      },
      error: "Witch's Potion: invalid quest access configuration: locations policy requires at least one base location",
    },
    {
      name: 'locations policy with empty locations',
      id: "Witch's Potion",
      mutate: (quest: (typeof QUEST_DATA)[string]) => {
        quest.locations = [];
      },
      error: "Witch's Potion: invalid quest access configuration: locations policy requires at least one base location",
    },
    {
      name: 'regions-and-locations policy with missing locations',
      id: 'A Porcine of Interest',
      mutate: (quest: (typeof QUEST_DATA)[string]) => {
        quest.accessPolicy = 'regions-and-locations';
        delete quest.locations;
      },
      error: 'A Porcine of Interest: invalid quest access configuration: regions-and-locations policy requires at least one base location',
    },
    {
      name: 'regions-and-locations policy with empty locations',
      id: 'A Porcine of Interest',
      mutate: (quest: (typeof QUEST_DATA)[string]) => {
        quest.accessPolicy = 'regions-and-locations';
        quest.locations = [];
      },
      error: 'A Porcine of Interest: invalid quest access configuration: regions-and-locations policy requires at least one base location',
    },
    {
      name: 'regions-and-locations policy with empty regions',
      id: 'A Porcine of Interest',
      mutate: (quest: (typeof QUEST_DATA)[string]) => {
        quest.accessPolicy = 'regions-and-locations';
        quest.regions = [];
      },
      error: 'A Porcine of Interest: invalid quest access configuration: regions-and-locations policy requires at least one region',
    },
  ])('rejects a runtime record using $name even with a matching fingerprint', ({
    id,
    mutate,
    error,
  }) => {
    expect(validationErrorsAfterRuntimeMutation(id, mutate)).toContain(error);
  });
});
