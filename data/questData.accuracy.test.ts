import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from './questData';
import * as questDataModule from './questData';

describe('audited current quest requirements', () => {
  it("pins Witch's Potion to Rimmington without enforcing all Asgarnia", () => {
    expect(QUEST_DATA["Witch's Potion"]).toMatchObject({
      kind: 'quest',
      accessPolicy: 'locations',
      regions: ['Asgarnia'],
    });
    expect(QUEST_DATA["Witch's Potion"].locations?.map(location => location.id))
      .toEqual(['rimmington']);
  });

  it("pins Murder Mystery to Sinclair Mansion and Seers' Village", () => {
    expect(QUEST_DATA['Murder Mystery']).toMatchObject({
      kind: 'quest',
      accessPolicy: 'locations',
      regions: ['Kandarin'],
    });
    expect(QUEST_DATA['Murder Mystery'].locations?.map(location => location.id))
      .toEqual(['sinclair-mansion', 'seers-village']);
  });
  it('uses the real Porcine route', () => {
    const q = QUEST_DATA['A Porcine of Interest'];
    expect(q.regions).not.toContain('Port Sarim');
    expect(q.locations?.map(x => x.id)).toEqual([
      'draynor-village', 'south-falador-farm',
    ]);
    expect(q.locations?.[1].chunkOptions).toEqual([{ cx: 47, cy: 51 }]);
  });

  it('models Dream Mentor as calculated combat', () => {
    const q = QUEST_DATA['Dream Mentor'];
    expect(q.combatLevel).toBe(85);
    expect(q.skills).not.toHaveProperty('Combat');
  });

  it('pins the corrected recent quest block', () => {
    expect(QUEST_DATA['Ethically Acquired Antiquities']).toMatchObject({
      skills: { Thieving: 25 },
      prereqs: ['Children of the Sun', 'Shield of Arrav'],
    });
    expect(QUEST_DATA['Ethically Acquired Antiquities'].locations?.map(x => x.id)).toEqual([
      'civitas-illa-fortis', 'port-sarim', 'varrock-museum',
    ]);
    expect(QUEST_DATA['The Curse of Arrav']).toMatchObject({
      skills: { Agility: 61, Ranged: 62, Strength: 58, Thieving: 62, Mining: 64, Slayer: 37 },
      prereqs: ['Defender of Varrock', 'Troll Romance'],
    });
    expect(QUEST_DATA['The Final Dawn']).toMatchObject({
      skills: { Thieving: 66, Fletching: 52, Runecraft: 52 },
      prereqs: ['The Heart of Darkness', 'Perilous Moons'],
    });
    expect(QUEST_DATA['Shadows of Custodia']).toMatchObject({
      skills: { Slayer: 54, Fishing: 45, Construction: 41, Hunter: 36 },
      prereqs: ['Children of the Sun'],
    });
    expect(QUEST_DATA['Scrambled!']).toMatchObject({
      skills: { Construction: 38, Cooking: 36, Smithing: 35 },
      prereqs: ['Children of the Sun'],
    });
    expect(QUEST_DATA['Pandemonium']).toMatchObject({
      skills: {},
      prereqs: [],
    });
    expect(QUEST_DATA['Pandemonium'].locations?.map(x => x.id)).toEqual(['port-sarim']);
    expect(QUEST_DATA['Prying Times']).toMatchObject({
      skills: { Smithing: 30, Sailing: 12 },
      prereqs: ['Pandemonium', "The Knight's Sword"],
      manualRequirements: ['One open Sailing task slot'],
    });
    expect(QUEST_DATA['Current Affairs']).toMatchObject({
      skills: { Sailing: 22, Fishing: 10 }, prereqs: ['Pandemonium'],
    });
    expect(QUEST_DATA['Troubled Tortugans']).toMatchObject({
      skills: { Slayer: 51, Construction: 48, Sailing: 45, Hunter: 45, Woodcutting: 40, Crafting: 34 },
      prereqs: ['Pandemonium'],
    });
  });

  it('pins the complete machine and balance projection for all 19 miniquests', () => {
    const ids = [
      "Alfred Grimhand's Barcrawl",
      "Barbarian Training",
      "Bear Your Soul",
      "Curse of the Empty Lord",
      "Daddy's Home",
      "The Enchanted Key",
      "Enter the Abyss",
      "Family Pest",
      "The Frozen Door",
      "The General's Shadow",
      "His Faithful Servants",
      "Hopespear's Will",
      "In Search of Knowledge",
      "Into the Tombs",
      "Lair of Tarn Razorlor",
      "Mage Arena I",
      "Mage Arena II",
      "Skippy and the Mogres",
      "Vale Totems"
    ] as const;
    const project = (id: typeof ids[number]) => {
      const quest = QUEST_DATA[id];
      return {
        kind: quest.kind,
        accessPolicy: quest.accessPolicy,
        regions: quest.regions,
        locations: quest.locations?.map(location => ({
          id: location.id,
          label: location.label,
          standardAreas: location.standardAreas,
          chunkOptions: location.chunkOptions,
        })) ?? null,
        skills: quest.skills,
        combatLevel: quest.combatLevel ?? null,
        prereqs: quest.prereqs,
        oneOf: quest.oneOf ?? null,
        manualRequirements: quest.manualRequirements ?? null,
        points: quest.points,
        difficulty: quest.difficulty,
      };
    };

    const actual = Object.fromEntries(ids.map(id => [id, project(id)]));
    const expected = {
      "Alfred Grimhand's Barcrawl": {
        "kind": "miniquest",
        "accessPolicy": "locations",
        "regions": [
          "Kandarin",
          "Misthalin",
          "Karamja",
          "Asgarnia"
        ],
        "locations": [
          {
            "chunkOptions": [
              {
                "cx": 39,
                "cy": 55
              }
            ],
            "id": "barbarian-outpost",
            "label": "Barbarian Outpost",
            "standardAreas": [
              "Barbarian Outpost"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 50,
                "cy": 53
              }
            ],
            "id": "blue-moon-inn",
            "label": "Blue Moon Inn",
            "standardAreas": [
              "Varrock"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 38,
                "cy": 54
              }
            ],
            "id": "grand-tree-bar",
            "label": "Blurberry Bar in the Grand Tree",
            "standardAreas": [
              "Tree Gnome Stronghold"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 43,
                "cy": 49
              }
            ],
            "id": "brimhaven-bar",
            "label": "Dead Man's Chest in Brimhaven",
            "standardAreas": [
              "Brimhaven"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 39,
                "cy": 48
              }
            ],
            "id": "yanille-bar",
            "label": "Dragon Inn in Yanille",
            "standardAreas": [
              "Yanille"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 40,
                "cy": 51
              }
            ],
            "id": "east-ardougne-bar",
            "label": "Flying Horse Inn in East Ardougne",
            "standardAreas": [
              "East Ardougne"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 42,
                "cy": 54
              }
            ],
            "id": "seers-village-bar",
            "label": "Forester's Arms in Seers' Village",
            "standardAreas": [
              "Seers' Village"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 51,
                "cy": 54
              }
            ],
            "id": "jolly-boar-inn",
            "label": "Jolly Boar Inn",
            "standardAreas": [
              "Varrock"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 45,
                "cy": 49
              }
            ],
            "id": "musa-point-bar",
            "label": "Karamja Spirits Bar at Musa Point",
            "standardAreas": [
              "Musa Point"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 46,
                "cy": 52
              }
            ],
            "id": "falador-bar",
            "label": "Rising Sun Inn in Falador",
            "standardAreas": [
              "Falador"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 47,
                "cy": 50
              }
            ],
            "id": "port-sarim-bar",
            "label": "Rusty Anchor in Port Sarim",
            "standardAreas": [
              "Port Sarim"
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Novice)"
      },
      "Barbarian Training": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Agility": 15,
          "Crafting": 11,
          "Farming": 15,
          "Firemaking": 35,
          "Fishing": 55,
          "Herblore": 4,
          "Smithing": 5,
          "Strength": 35
        },
        "combatLevel": null,
        "prereqs": [
          "Tai Bwo Wannai Trio"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Experienced)"
      },
      "Bear Your Soul": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Kourend & Kebos",
          "Asgarnia"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Intermediate)"
      },
      "Curse of the Empty Lord": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia",
          "Kandarin",
          "Wilderness"
        ],
        "locations": null,
        "skills": {
          "Thieving": 53
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": [
          "Started Desert Treasure I",
          "Started The Restless Ghost"
        ],
        "points": 0,
        "difficulty": "Quest (Experienced)"
      },
      "Daddy's Home": {
        "kind": "miniquest",
        "accessPolicy": "locations",
        "regions": [
          "Misthalin"
        ],
        "locations": [
          {
            "chunkOptions": [
              {
                "cx": 50,
                "cy": 54
              }
            ],
            "id": "varrock-palace",
            "label": "Marlo at Varrock's Estate Agent",
            "standardAreas": [
              "Varrock"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 50,
                "cy": 53
              }
            ],
            "id": "varrock-center",
            "label": "Old Man Yarlo's house in Varrock",
            "standardAreas": [
              "Varrock"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 51,
                "cy": 54
              }
            ],
            "id": "lumber-yard",
            "label": "Lumber Yard",
            "standardAreas": [
              "Varrock"
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Novice)"
      },
      "The Enchanted Key": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Fremennik",
          "Kandarin",
          "Tirannwn",
          "Asgarnia",
          "Misthalin",
          "Kharidian Desert"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Making History"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Intermediate)"
      },
      "Enter the Abyss": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin",
          "Wilderness"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Rune Mysteries"
        ],
        "oneOf": [
          {
            "regions": [
              "East Ardougne"
            ]
          },
          {
            "regions": [
              "Tree Gnome Stronghold"
            ]
          },
          {
            "guilds": [
              "Wizards' Guild"
            ]
          }
        ],
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Intermediate)"
      },
      "Family Pest": {
        "kind": "miniquest",
        "accessPolicy": "locations",
        "regions": [
          "Misthalin",
          "Kharidian Desert",
          "Kandarin"
        ],
        "locations": [
          {
            "chunkOptions": [
              {
                "cx": 51,
                "cy": 53
              }
            ],
            "id": "east-varrock-gate",
            "label": "Dimintheis's house in south-east Varrock",
            "standardAreas": [
              "Varrock"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 51,
                "cy": 51
              }
            ],
            "id": "al-kharid-mine",
            "label": "Al Kharid mine",
            "standardAreas": [
              "Al Kharid"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 44,
                "cy": 53
              }
            ],
            "id": "east-catherby",
            "label": "Caleb's house in Catherby",
            "standardAreas": [
              "Catherby"
            ]
          },
          {
            "chunkOptions": [
              {
                "cx": 51,
                "cy": 54
              }
            ],
            "id": "jolly-boar-inn",
            "label": "Jolly Boar Inn",
            "standardAreas": [
              "Varrock"
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Family Crest"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Intermediate)"
      },
      "The Frozen Door": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia"
        ],
        "locations": null,
        "skills": {
          "Agility": 70,
          "Hitpoints": 70,
          "Ranged": 70,
          "Strength": 70
        },
        "combatLevel": null,
        "prereqs": [
          "Desert Treasure I"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Master)"
      },
      "The General's Shadow": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Fremennik",
          "Kandarin",
          "Karamja",
          "Asgarnia",
          "Kharidian Desert"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Fight Arena",
          "Curse of the Empty Lord"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Experienced)"
      },
      "His Faithful Servants": {
        "kind": "miniquest",
        "accessPolicy": "locations",
        "regions": [
          "Morytania"
        ],
        "locations": [
          {
            "chunkOptions": [
              {
                "cx": 55,
                "cy": 51
              }
            ],
            "id": "barrows",
            "label": "Barrows",
            "standardAreas": [
              "Barrows"
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Priest in Peril"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Experienced)"
      },
      "Hopespear's Will": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Prayer": 50
        },
        "combatLevel": null,
        "prereqs": [
          "Desert Treasure I",
          "Fairytale II - Cure a Queen",
          "Land of the Goblins"
        ],
        "oneOf": null,
        "manualRequirements": [
          "Started The Restless Ghost"
        ],
        "points": 0,
        "difficulty": "Quest (Master)"
      },
      "In Search of Knowledge": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Kourend & Kebos"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Experienced)"
      },
      "Into the Tombs": {
        "kind": "miniquest",
        "accessPolicy": "locations",
        "regions": [
          "Kharidian Desert"
        ],
        "locations": [
          {
            "chunkOptions": [
              {
                "cx": 52,
                "cy": 42
              }
            ],
            "id": "necropolis-main-temple",
            "label": "Necropolis main temple",
            "standardAreas": [
              "Sophanem"
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Beneath Cursed Sands"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Master)"
      },
      "Lair of Tarn Razorlor": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Morytania"
        ],
        "locations": null,
        "skills": {
          "Slayer": 40
        },
        "combatLevel": null,
        "prereqs": [
          "Haunted Mine"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Experienced)"
      },
      "Mage Arena I": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Wilderness"
        ],
        "locations": null,
        "skills": {
          "Magic": 60
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Experienced)"
      },
      "Mage Arena II": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Wilderness"
        ],
        "locations": null,
        "skills": {
          "Magic": 75
        },
        "combatLevel": null,
        "prereqs": [
          "Mage Arena I"
        ],
        "oneOf": null,
        "manualRequirements": [
          "Cast Claws of Guthix, Flames of Zamorak, and Saradomin Strike 100 times each inside the Mage Arena"
        ],
        "points": 0,
        "difficulty": "Quest (Master)"
      },
      "Skippy and the Mogres": {
        "kind": "miniquest",
        "accessPolicy": "locations",
        "regions": [
          "Asgarnia"
        ],
        "locations": [
          {
            "chunkOptions": [
              {
                "cx": 46,
                "cy": 49
              }
            ],
            "id": "skippys-camp",
            "label": "Skippy's camp south-east of Rimmington",
            "standardAreas": [
              "Rimmington"
            ]
          }
        ],
        "skills": {
          "Cooking": 20
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Novice)"
      },
      "Vale Totems": {
        "kind": "miniquest",
        "accessPolicy": "regions",
        "regions": [
          "Varlamore"
        ],
        "locations": null,
        "skills": {
          "Fletching": 20
        },
        "combatLevel": null,
        "prereqs": [
          "Children of the Sun"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 0,
        "difficulty": "Quest (Novice)"
      }
    };

    expect(actual).toEqual(expected);
  });
});

describe('quest cape eligibility', () => {
  it('exports only quest-point-cape quests and excludes optional miniquests', () => {
    const questCapeIds = (questDataModule as any).QUEST_CAPE_QUEST_IDS as string[] | undefined;

    expect(questCapeIds).toBeDefined();
    expect(questCapeIds).toContain("Cook's Assistant");
    expect(questCapeIds).toContain('The Ides of Milk');
    expect(questCapeIds).not.toContain('Barbarian Training');
    expect(questCapeIds).not.toContain("Alfred Grimhand's Barcrawl");
    expect(questCapeIds).not.toContain('Mage Arena II');
    expect(questCapeIds?.every(id => QUEST_DATA[id].points > 0)).toBe(true);
  });
});
