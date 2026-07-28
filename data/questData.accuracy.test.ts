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
      'grand-museum', 'fortis-cothon', 'port-sarim-jail', 'port-sarim-betty', 'varrock-museum',
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

  it('pins the complete machine and balance projection for all 44 changed A-F quests', () => {
    const ids = [
          "A Porcine of Interest",
          "A Soul's Bane",
          "A Tail of Two Cats",
          "Animal Magnetism",
          "Another Slice of H.A.M.",
          "At First Light",
          "Below Ice Mountain",
          "Between a Rock...",
          "Biohazard",
          "Black Knights' Fortress",
          "Bone Voyage",
          "Cabin Fever",
          "Children of the Sun",
          "Client of Kourend",
          "Cold War",
          "Contact!",
          "Cook's Assistant",
          "Creature of Fenkenstrain",
          "Current Affairs",
          "Darkness of Hallowvale",
          "Death on the Isle",
          "Death Plateau",
          "Defender of Varrock",
          "Demon Slayer",
          "Desert Treasure I",
          "Desert Treasure II",
          "Devious Minds",
          "Doric's Quest",
          "Dragon Slayer I",
          "Dragon Slayer II",
          "Druidic Ritual",
          "Dwarf Cannon",
          "Eagles' Peak",
          "Elemental Workshop I",
          "Elemental Workshop II",
          "Enakhra's Lament",
          "Enlightened Journey",
          "Ernest the Chicken",
          "Ethically Acquired Antiquities",
          "Fairytale I - Growing Pains",
          "Fairytale II - Cure a Queen",
          "Family Crest",
          "Fishing Contest",
          "Forgettable Tale..."
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
          "A Porcine of Interest": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Misthalin",
                      "Asgarnia"
                ],
                "locations": [
                      {
                            "id": "draynor-village",
                            "label": "Draynor Village",
                            "standardAreas": [
                                  "Draynor Village"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 48,
                                        "cy": 50
                                  }
                            ]
                      },
                      {
                            "id": "south-falador-farm",
                            "label": "South Falador Farm",
                            "standardAreas": [
                                  "Falador"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 47,
                                        "cy": 51
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "A Soul's Bane": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Misthalin"
                ],
                "locations": [
                      {
                            "id": "soul-bane-rift",
                            "label": "Rift east of Varrock",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 51,
                                        "cy": 53
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Intermediate)"
          },
          "A Tail of Two Cats": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Asgarnia",
                      "Misthalin",
                      "Kharidian Desert"
                ],
                "locations": null,
                "skills": {},
                "combatLevel": null,
                "prereqs": [
                      "Icthlarin's Little Helper"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Intermediate)"
          },
          "Animal Magnetism": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Misthalin",
                      "Asgarnia",
                      "Morytania"
                ],
                "locations": null,
                "skills": {
                      "Slayer": 18,
                      "Crafting": 19,
                      "Ranged": 30,
                      "Woodcutting": 35
                },
                "combatLevel": null,
                "prereqs": [
                      "The Restless Ghost",
                      "Ernest the Chicken",
                      "Priest in Peril"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Intermediate)"
          },
          "Another Slice of H.A.M.": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Misthalin",
                      "Asgarnia"
                ],
                "locations": null,
                "skills": {
                      "Attack": 15,
                      "Prayer": 25
                },
                "combatLevel": null,
                "prereqs": [
                      "Death to the Dorgeshuun",
                      "The Dig Site",
                      "The Giant Dwarf"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Intermediate)"
          },
          "At First Light": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Varlamore"
                ],
                "locations": null,
                "skills": {
                      "Hunter": 46,
                      "Herblore": 30,
                      "Construction": 27
                },
                "combatLevel": null,
                "prereqs": [
                      "Children of the Sun",
                      "Eagles' Peak"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Intermediate)"
          },
          "Below Ice Mountain": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Asgarnia",
                      "Misthalin"
                ],
                "locations": [
                      {
                            "id": "west-falador",
                            "label": "West Falador",
                            "standardAreas": [
                                  "Falador"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 46,
                                        "cy": 52
                                  }
                            ]
                      },
                      {
                            "id": "falador-north-gate",
                            "label": "Falador north gate",
                            "standardAreas": [
                                  "Falador"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 46,
                                        "cy": 53
                                  }
                            ]
                      },
                      {
                            "id": "goblin-village",
                            "label": "Goblin Village",
                            "standardAreas": [
                                  "Goblin Village"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 46,
                                        "cy": 54
                                  }
                            ]
                      },
                      {
                            "id": "edgeville",
                            "label": "Edgeville",
                            "standardAreas": [
                                  "Edgeville"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 48,
                                        "cy": 54
                                  }
                            ]
                      },
                      {
                            "id": "varrock-south-gate",
                            "label": "Varrock south gate",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 50,
                                        "cy": 52
                                  }
                            ]
                      },
                      {
                            "id": "varrock-square",
                            "label": "Varrock square",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 50,
                                        "cy": 53
                                  }
                            ]
                      }
                ],
                "skills": {
                      "Quest Points": 16
                },
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Between a Rock...": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Fremennik",
                      "Asgarnia",
                      "Kandarin"
                ],
                "locations": null,
                "skills": {
                      "Defence": 30,
                      "Mining": 40,
                      "Smithing": 50
                },
                "combatLevel": null,
                "prereqs": [
                      "Dwarf Cannon",
                      "Fishing Contest"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Experienced)"
          },
          "Biohazard": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Kandarin",
                      "Asgarnia",
                      "Misthalin"
                ],
                "locations": null,
                "skills": {},
                "combatLevel": null,
                "prereqs": [
                      "Plague City"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 3,
                "difficulty": "Quest (Novice)"
          },
          "Black Knights' Fortress": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Asgarnia"
                ],
                "locations": [
                      {
                            "id": "west-falador",
                            "label": "West Falador",
                            "standardAreas": [
                                  "Falador"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 46,
                                        "cy": 52
                                  }
                            ]
                      },
                      {
                            "id": "black-knights-fortress",
                            "label": "Black Knights' Fortress",
                            "standardAreas": [
                                  "Edgeville"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 47,
                                        "cy": 54
                                  }
                            ]
                      }
                ],
                "skills": {
                      "Quest Points": 12
                },
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 3,
                "difficulty": "Quest (Intermediate)"
          },
          "Bone Voyage": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Misthalin",
                      "Islands & Others",
                      "Asgarnia",
                      "Kourend & Kebos"
                ],
                "locations": null,
                "skills": {},
                "combatLevel": null,
                "prereqs": [
                      "The Dig Site"
                ],
                "oneOf": null,
                "manualRequirements": [
                      "100 Kudos"
                ],
                "points": 1,
                "difficulty": "Quest (Intermediate)"
          },
          "Cabin Fever": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Islands & Others",
                      "Morytania"
                ],
                "locations": null,
                "skills": {
                      "Ranged": 40,
                      "Smithing": 50,
                      "Crafting": 45,
                      "Agility": 42
                },
                "combatLevel": null,
                "prereqs": [
                      "Pirate's Treasure",
                      "Rum Deal"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Experienced)"
          },
          "Children of the Sun": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Misthalin"
                ],
                "locations": [
                      {
                            "id": "varrock-square",
                            "label": "Varrock square",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 50,
                                        "cy": 53
                                  }
                            ]
                      },
                      {
                            "id": "varrock-palace",
                            "label": "Varrock Palace",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 50,
                                        "cy": 54
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Client of Kourend": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Kourend & Kebos"
                ],
                "locations": null,
                "skills": {},
                "combatLevel": null,
                "prereqs": [
                      "X Marks the Spot"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Cold War": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Fremennik",
                      "Kandarin",
                      "Misthalin"
                ],
                "locations": null,
                "skills": {
                      "Hunter": 10,
                      "Agility": 30,
                      "Crafting": 30,
                      "Construction": 34,
                      "Thieving": 15
                },
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": [
                      "Access to a crafting table 3"
                ],
                "points": 1,
                "difficulty": "Quest (Intermediate)"
          },
          "Contact!": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Kharidian Desert"
                ],
                "locations": [
                      {
                            "id": "sophanem",
                            "label": "Sophanem",
                            "standardAreas": [
                                  "Sophanem"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 51,
                                        "cy": 43
                                  }
                            ]
                      },
                      {
                            "id": "al-kharid-palace",
                            "label": "Al Kharid Palace",
                            "standardAreas": [
                                  "Al Kharid"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 51,
                                        "cy": 49
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [
                      "Prince Ali Rescue",
                      "Icthlarin's Little Helper"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Experienced)"
          },
          "Cook's Assistant": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Misthalin"
                ],
                "locations": [
                      {
                            "id": "lumbridge-castle",
                            "label": "Lumbridge Castle",
                            "standardAreas": [
                                  "Lumbridge"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 50,
                                        "cy": 50
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Creature of Fenkenstrain": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Morytania"
                ],
                "locations": null,
                "skills": {
                      "Crafting": 20,
                      "Thieving": 25
                },
                "combatLevel": null,
                "prereqs": [
                      "Priest in Peril"
                ],
                "oneOf": null,
                "manualRequirements": [
                      "Started The Restless Ghost"
                ],
                "points": 2,
                "difficulty": "Quest (Intermediate)"
          },
          "Current Affairs": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "The Open Seas",
                      "Kandarin"
                ],
                "locations": null,
                "skills": {
                      "Sailing": 22,
                      "Fishing": 10
                },
                "combatLevel": null,
                "prereqs": [
                      "Pandemonium"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Darkness of Hallowvale": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Morytania",
                      "Misthalin"
                ],
                "locations": null,
                "skills": {
                      "Construction": 5,
                      "Mining": 20,
                      "Thieving": 22,
                      "Agility": 26,
                      "Crafting": 32,
                      "Magic": 33,
                      "Strength": 40
                },
                "combatLevel": null,
                "prereqs": [
                      "In Aid of the Myreque"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Experienced)"
          },
          "Death on the Isle": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Varlamore"
                ],
                "locations": [
                      {
                            "id": "villa-lucens",
                            "label": "Villa Lucens",
                            "standardAreas": [
                                  "Aldarin"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 22,
                                        "cy": 45
                                  }
                            ]
                      },
                      {
                            "id": "aldarin-mansion",
                            "label": "Northern Aldarin mansion",
                            "standardAreas": [
                                  "Aldarin"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 21,
                                        "cy": 46
                                  }
                            ]
                      },
                      {
                            "id": "villa-lucens-theatre",
                            "label": "Villa Lucens Theatre",
                            "standardAreas": [
                                  "Aldarin"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 23,
                                        "cy": 45
                                  }
                            ]
                      }
                ],
                "skills": {
                      "Thieving": 34,
                      "Agility": 32
                },
                "combatLevel": null,
                "prereqs": [
                      "Children of the Sun"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Intermediate)"
          },
          "Death Plateau": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Asgarnia"
                ],
                "locations": [
                      {
                            "id": "burthorpe",
                            "label": "Burthorpe",
                            "standardAreas": [
                                  "Burthorpe"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 45,
                                        "cy": 55
                                  }
                            ]
                      },
                      {
                            "id": "warriors-guild",
                            "label": "Warriors' Guild",
                            "standardAreas": [
                                  "Warriors' Guild"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 44,
                                        "cy": 55
                                  }
                            ]
                      },
                      {
                            "id": "death-plateau",
                            "label": "Death Plateau",
                            "standardAreas": [
                                  "Burthorpe"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 44,
                                        "cy": 56
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Defender of Varrock": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Misthalin",
                      "Asgarnia"
                ],
                "locations": null,
                "skills": {
                      "Smithing": 55,
                      "Hunter": 52
                },
                "combatLevel": null,
                "prereqs": [
                      "Shield of Arrav",
                      "Romeo & Juliet",
                      "Demon Slayer",
                      "Temple of Ikov",
                      "Below Ice Mountain",
                      "Family Crest",
                      "Garden of Tranquillity",
                      "What Lies Below"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Experienced)"
          },
          "Demon Slayer": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Misthalin"
                ],
                "locations": [
                      {
                            "id": "varrock-square",
                            "label": "Varrock square",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 50,
                                        "cy": 53
                                  }
                            ]
                      },
                      {
                            "id": "varrock-palace",
                            "label": "Varrock Palace",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 50,
                                        "cy": 54
                                  }
                            ]
                      },
                      {
                            "id": "wizards-tower",
                            "label": "Wizards' Tower",
                            "standardAreas": [
                                  "Wizards' Tower"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 48,
                                        "cy": 49
                                  }
                            ]
                      },
                      {
                            "id": "varrock-south-gate",
                            "label": "Varrock south gate",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 50,
                                        "cy": 52
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 3,
                "difficulty": "Quest (Novice)"
          },
          "Desert Treasure I": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Kharidian Desert",
                      "Asgarnia",
                      "Kandarin",
                      "Morytania",
                      "Misthalin"
                ],
                "locations": null,
                "skills": {
                      "Thieving": 53,
                      "Firemaking": 50,
                      "Slayer": 10,
                      "Magic": 50
                },
                "combatLevel": null,
                "prereqs": [
                      "The Dig Site",
                      "Temple of Ikov",
                      "The Tourist Trap",
                      "Troll Stronghold",
                      "Priest in Peril",
                      "Waterfall Quest"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 3,
                "difficulty": "Quest (Master)"
          },
          "Desert Treasure II": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Kharidian Desert",
                      "Asgarnia",
                      "Fremennik",
                      "Kourend & Kebos",
                      "Misthalin"
                ],
                "locations": null,
                "skills": {
                      "Magic": 75,
                      "Firemaking": 75,
                      "Thieving": 70,
                      "Herblore": 62,
                      "Runecraft": 60,
                      "Construction": 60
                },
                "combatLevel": null,
                "prereqs": [
                      "Desert Treasure I",
                      "Secrets of the North",
                      "Enakhra's Lament",
                      "Temple of the Eye",
                      "The Garden of Death",
                      "Below Ice Mountain"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 5,
                "difficulty": "Quest (Grandmaster)"
          },
          "Devious Minds": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Misthalin",
                      "Asgarnia",
                      "Wilderness"
                ],
                "locations": null,
                "skills": {
                      "Smithing": 65,
                      "Runecraft": 50,
                      "Fletching": 50
                },
                "combatLevel": null,
                "prereqs": [
                      "Wanted!",
                      "Troll Stronghold",
                      "Doric's Quest"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Experienced)"
          },
          "Doric's Quest": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Asgarnia"
                ],
                "locations": [
                      {
                            "id": "dorics-hut",
                            "label": "Doric's hut",
                            "standardAreas": [
                                  "Ice Mountain"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 46,
                                        "cy": 53
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Dragon Slayer I": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Misthalin",
                      "Asgarnia",
                      "Karamja"
                ],
                "locations": null,
                "skills": {
                      "Quest Points": 32
                },
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Experienced)"
          },
          "Dragon Slayer II": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Misthalin",
                      "Asgarnia",
                      "Kandarin",
                      "Fremennik",
                      "Kourend & Kebos",
                      "Karamja",
                      "Kharidian Desert",
                      "Morytania",
                      "Islands & Others"
                ],
                "locations": null,
                "skills": {
                      "Magic": 75,
                      "Smithing": 70,
                      "Mining": 68,
                      "Crafting": 62,
                      "Agility": 60,
                      "Thieving": 60,
                      "Construction": 50,
                      "Hitpoints": 50,
                      "Quest Points": 200
                },
                "combatLevel": null,
                "prereqs": [
                      "Legends' Quest",
                      "Dream Mentor",
                      "A Tail of Two Cats",
                      "Animal Magnetism",
                      "Ghosts Ahoy",
                      "Bone Voyage",
                      "Client of Kourend"
                ],
                "oneOf": null,
                "manualRequirements": [
                      "Started the pyre ship portion of Barbarian Training"
                ],
                "points": 5,
                "difficulty": "Quest (Grandmaster)"
          },
          "Druidic Ritual": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Asgarnia"
                ],
                "locations": [
                      {
                            "id": "north-taverley",
                            "label": "North Taverley",
                            "standardAreas": [
                                  "Taverley"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 45,
                                        "cy": 54
                                  }
                            ]
                      },
                      {
                            "id": "south-taverley",
                            "label": "South Taverley",
                            "standardAreas": [
                                  "Taverley"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 45,
                                        "cy": 53
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 4,
                "difficulty": "Quest (Novice)"
          },
          "Dwarf Cannon": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Kandarin",
                      "Asgarnia"
                ],
                "locations": [
                      {
                            "id": "coal-truck-mine",
                            "label": "Coal Truck Mine",
                            "standardAreas": [
                                  "Seers' Village"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 40,
                                        "cy": 54
                                  }
                            ]
                      },
                      {
                            "id": "baxtorian-falls",
                            "label": "Baxtorian Falls",
                            "standardAreas": [
                                  "Baxtorian Falls"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 39,
                                        "cy": 54
                                  }
                            ]
                      },
                      {
                            "id": "asgarnian-road",
                            "label": "Asgarnian road by the Dwarven Mine",
                            "standardAreas": [
                                  "Dwarven Mine"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 47,
                                        "cy": 53
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Eagles' Peak": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Kandarin",
                      "Misthalin"
                ],
                "locations": null,
                "skills": {
                      "Hunter": 27
                },
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Novice)"
          },
          "Elemental Workshop I": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Kandarin"
                ],
                "locations": [
                      {
                            "id": "elemental-workshop",
                            "label": "Elemental Workshop in Seers' Village",
                            "standardAreas": [
                                  "Seers' Village"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 42,
                                        "cy": 54
                                  }
                            ]
                      }
                ],
                "skills": {
                      "Mining": 20,
                      "Smithing": 20,
                      "Crafting": 20
                },
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Elemental Workshop II": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Kandarin",
                      "Misthalin"
                ],
                "locations": null,
                "skills": {
                      "Magic": 20,
                      "Smithing": 30
                },
                "combatLevel": null,
                "prereqs": [
                      "Elemental Workshop I"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Intermediate)"
          },
          "Enakhra's Lament": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Kharidian Desert"
                ],
                "locations": [
                      {
                            "id": "desert-quarry-and-temple",
                            "label": "Desert Quarry and Enakhra's Temple",
                            "standardAreas": [
                                  "Kharidian Desert"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 49,
                                        "cy": 45
                                  }
                            ]
                      }
                ],
                "skills": {
                      "Crafting": 50,
                      "Firemaking": 45,
                      "Magic": 39,
                      "Prayer": 43
                },
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": [
                      "Must be on the standard spellbook"
                ],
                "points": 2,
                "difficulty": "Quest (Experienced)"
          },
          "Enlightened Journey": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Asgarnia",
                      "Kandarin",
                      "Misthalin"
                ],
                "locations": [
                      {
                            "id": "west-entrana",
                            "label": "West Entrana",
                            "standardAreas": [
                                  "Entrana"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 43,
                                        "cy": 52
                                  }
                            ]
                      },
                      {
                            "id": "south-taverley",
                            "label": "South Taverley",
                            "standardAreas": [
                                  "Taverley"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 45,
                                        "cy": 53
                                  }
                            ]
                      }
                ],
                "skills": {
                      "Firemaking": 20,
                      "Farming": 30,
                      "Crafting": 36,
                      "Quest Points": 20
                },
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Intermediate)"
          },
          "Ernest the Chicken": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Misthalin"
                ],
                "locations": [
                      {
                            "id": "draynor-manor",
                            "label": "Draynor Manor",
                            "standardAreas": [
                                  "Draynor Village"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 48,
                                        "cy": 52
                                  }
                            ]
                      }
                ],
                "skills": {},
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 4,
                "difficulty": "Quest (Novice)"
          },
          "Ethically Acquired Antiquities": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Varlamore",
                      "Asgarnia",
                      "Misthalin"
                ],
                "locations": [
                      {
                            "id": "grand-museum",
                            "label": "Grand Museum in Civitas illa Fortis",
                            "standardAreas": [
                                  "Civitas illa Fortis"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 26,
                                        "cy": 49
                                  }
                            ]
                      },
                      {
                            "id": "fortis-cothon",
                            "label": "Fortis Cothon",
                            "standardAreas": [
                                  "Civitas illa Fortis"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 27,
                                        "cy": 48
                                  }
                            ]
                      },
                      {
                            "id": "port-sarim-jail",
                            "label": "Port Sarim jail",
                            "standardAreas": [
                                  "Port Sarim"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 47,
                                        "cy": 49
                                  }
                            ]
                      },
                      {
                            "id": "port-sarim-betty",
                            "label": "Betty's shop in Port Sarim",
                            "standardAreas": [
                                  "Port Sarim"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 47,
                                        "cy": 50
                                  }
                            ]
                      },
                      {
                            "id": "varrock-museum",
                            "label": "Varrock Museum",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 50,
                                        "cy": 53
                                  }
                            ]
                      }
                ],
                "skills": {
                      "Thieving": 25
                },
                "combatLevel": null,
                "prereqs": [
                      "Children of the Sun",
                      "Shield of Arrav"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Fairytale I - Growing Pains": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Misthalin",
                      "Asgarnia",
                      "Morytania",
                      "Islands & Others"
                ],
                "locations": null,
                "skills": {},
                "combatLevel": null,
                "prereqs": [
                      "Lost City",
                      "Nature Spirit"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Intermediate)"
          },
          "Fairytale II - Cure a Queen": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Islands & Others",
                      "Misthalin",
                      "Kandarin",
                      "Tirannwn"
                ],
                "locations": [
                      {
                            "id": "draynor-village",
                            "label": "Draynor Village",
                            "standardAreas": [
                                  "Draynor Village"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 48,
                                        "cy": 50
                                  }
                            ]
                      },
                      {
                            "id": "zanaris",
                            "label": "Zanaris",
                            "standardAreas": [
                                  "Zanaris"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 50,
                                        "cy": 49
                                  }
                            ]
                      },
                      {
                            "id": "poison-waste",
                            "label": "Poison Waste",
                            "standardAreas": [
                                  "Poison Waste"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 34,
                                        "cy": 48
                                  }
                            ]
                      },
                      {
                            "id": "horseshoe-mine",
                            "label": "Horseshoe Mine",
                            "standardAreas": [
                                  "Kandarin"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 42,
                                        "cy": 50
                                  }
                            ]
                      }
                ],
                "skills": {
                      "Thieving": 40,
                      "Farming": 49,
                      "Herblore": 57
                },
                "combatLevel": null,
                "prereqs": [
                      "Fairytale I - Growing Pains"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Experienced)"
          },
          "Family Crest": {
                "kind": "quest",
                "accessPolicy": "locations",
                "regions": [
                      "Asgarnia",
                      "Kandarin",
                      "Misthalin",
                      "Kharidian Desert"
                ],
                "locations": [
                      {
                            "id": "dimintheis-house",
                            "label": "Dimintheis's house in south-east Varrock",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 51,
                                        "cy": 53
                                  }
                            ]
                      },
                      {
                            "id": "witchaven",
                            "label": "Witchaven",
                            "standardAreas": [
                                  "Witchaven"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 42,
                                        "cy": 51
                                  }
                            ]
                      },
                      {
                            "id": "catherby",
                            "label": "Caleb's house in Catherby",
                            "standardAreas": [
                                  "Catherby"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 44,
                                        "cy": 53
                                  }
                            ]
                      },
                      {
                            "id": "dwarven-mine-boot",
                            "label": "Boot in the Dwarven Mine",
                            "standardAreas": [
                                  "Dwarven Mine"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 48,
                                        "cy": 54
                                  }
                            ]
                      },
                      {
                            "id": "north-al-kharid",
                            "label": "North Al Kharid",
                            "standardAreas": [
                                  "Al Kharid"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 51,
                                        "cy": 50
                                  }
                            ]
                      },
                      {
                            "id": "al-kharid-mine",
                            "label": "Al Kharid mine",
                            "standardAreas": [
                                  "Al Kharid"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 51,
                                        "cy": 51
                                  }
                            ]
                      },
                      {
                            "id": "jolly-boar-inn",
                            "label": "Jolly Boar Inn",
                            "standardAreas": [
                                  "Varrock"
                            ],
                            "chunkOptions": [
                                  {
                                        "cx": 51,
                                        "cy": 54
                                  }
                            ]
                      }
                ],
                "skills": {
                      "Mining": 40,
                      "Smithing": 40,
                      "Magic": 59,
                      "Crafting": 40
                },
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Experienced)"
          },
          "Fishing Contest": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Kandarin"
                ],
                "locations": null,
                "skills": {
                      "Fishing": 10
                },
                "combatLevel": null,
                "prereqs": [],
                "oneOf": null,
                "manualRequirements": null,
                "points": 1,
                "difficulty": "Quest (Novice)"
          },
          "Forgettable Tale...": {
                "kind": "quest",
                "accessPolicy": "regions",
                "regions": [
                      "Fremennik",
                      "Asgarnia",
                      "Kandarin"
                ],
                "locations": null,
                "skills": {
                      "Cooking": 22,
                      "Farming": 17
                },
                "combatLevel": null,
                "prereqs": [
                      "The Giant Dwarf",
                      "Fishing Contest"
                ],
                "oneOf": null,
                "manualRequirements": null,
                "points": 2,
                "difficulty": "Quest (Intermediate)"
          }
    };

    expect(actual).toEqual(expected);
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
  it('pins the complete machine and balance projection for all 34 G-M quests', () => {
    const ids = [
  "Garden of Tranquillity",
  "Gertrude's Cat",
  "Getting Ahead",
  "Ghosts Ahoy",
  "Goblin Diplomacy",
  "Grim Tales",
  "Haunted Mine",
  "Hazeel Cult",
  "Heroes' Quest",
  "Holy Grail",
  "Horror from the Deep",
  "Icthlarin's Little Helper",
  "Imp Catcher",
  "In Aid of the Myreque",
  "In Search of the Myreque",
  "Jungle Potion",
  "King's Ransom",
  "Land of the Goblins",
  "Legends' Quest",
  "Lost City",
  "Lunar Diplomacy",
  "Making Friends with My Arm",
  "Making History",
  "Meat and Greet",
  "Merlin's Crystal",
  "Misthalin Mystery",
  "Monk's Friend",
  "Monkey Madness I",
  "Monkey Madness II",
  "Mountain Daughter",
  "Mourning's End Part I",
  "Mourning's End Part II",
  "Murder Mystery",
  "My Arm's Big Adventure"
] as const;
    const actual = Object.fromEntries(ids.map(id => {
      const quest = QUEST_DATA[id];
      return [id, { kind: quest.kind, accessPolicy: quest.accessPolicy, regions: quest.regions, locations: quest.locations?.map(location => ({ id: location.id, label: location.label, standardAreas: location.standardAreas, chunkOptions: location.chunkOptions })) ?? null, skills: quest.skills, combatLevel: quest.combatLevel ?? null, prereqs: quest.prereqs, oneOf: quest.oneOf ?? null, manualRequirements: quest.manualRequirements ?? null, points: quest.points, difficulty: quest.difficulty }];
    }));
    const expected = {
  "Garden of Tranquillity": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Misthalin",
      "Asgarnia",
      "Kandarin",
      "Morytania"
    ],
    "locations": null,
    "skills": {
      "Farming": 25
    },
    "combatLevel": null,
    "prereqs": [
      "Creature of Fenkenstrain"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Intermediate)"
  },
  "Gertrude's Cat": {
    "kind": "quest",
    "accessPolicy": "locations",
    "regions": [
      "Misthalin"
    ],
    "locations": [
      {
        "id": "west-varrock",
        "label": "Gertrude's house in west Varrock",
        "standardAreas": [
          "Varrock"
        ],
        "chunkOptions": [
          {
            "cx": 49,
            "cy": 53
          }
        ]
      },
      {
        "id": "varrock-square",
        "label": "Varrock square",
        "standardAreas": [
          "Varrock"
        ],
        "chunkOptions": [
          {
            "cx": 50,
            "cy": 53
          }
        ]
      },
      {
        "id": "lumber-yard",
        "label": "Lumber Yard",
        "standardAreas": [
          "Varrock"
        ],
        "chunkOptions": [
          {
            "cx": 51,
            "cy": 54
          }
        ]
      }
    ],
    "skills": {},
    "combatLevel": null,
    "prereqs": [],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Novice)"
  },
  "Getting Ahead": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Kourend & Kebos"
    ],
    "locations": null,
    "skills": {
      "Construction": 26,
      "Crafting": 30
    },
    "combatLevel": null,
    "prereqs": [],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Intermediate)"
  },
  "Ghosts Ahoy": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Morytania"
    ],
    "locations": null,
    "skills": {
      "Agility": 25,
      "Cooking": 20
    },
    "combatLevel": null,
    "prereqs": [
      "Priest in Peril",
      "The Restless Ghost"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Intermediate)"
  },
  "Goblin Diplomacy": {
    "kind": "quest",
    "accessPolicy": "locations",
    "regions": [
      "Asgarnia"
    ],
    "locations": [
      {
        "id": "goblin-village",
        "label": "Goblin Village",
        "standardAreas": [
          "Goblin Village"
        ],
        "chunkOptions": [
          {
            "cx": 46,
            "cy": 54
          }
        ]
      }
    ],
    "skills": {},
    "combatLevel": null,
    "prereqs": [],
    "oneOf": null,
    "manualRequirements": null,
    "points": 5,
    "difficulty": "Quest (Novice)"
  },
  "Grim Tales": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Asgarnia"
    ],
    "locations": null,
    "skills": {
      "Farming": 45,
      "Herblore": 52,
      "Thieving": 58,
      "Agility": 59,
      "Woodcutting": 71
    },
    "combatLevel": null,
    "prereqs": [
      "Witch's House"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Master)"
  },
  "Haunted Mine": {
    "kind": "quest",
    "accessPolicy": "locations",
    "regions": [
      "Morytania"
    ],
    "locations": [
      {
        "id": "abandoned-mine",
        "label": "Haunted Mine and Tarn's Lair",
        "standardAreas": [
          "Haunted Mine"
        ],
        "chunkOptions": [
          {
            "cx": 53,
            "cy": 50
          }
        ]
      }
    ],
    "skills": {
      "Crafting": 35
    },
    "combatLevel": null,
    "prereqs": [
      "Priest in Peril"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Experienced)"
  },
  "Hazeel Cult": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Kandarin"
    ],
    "locations": null,
    "skills": {},
    "combatLevel": null,
    "prereqs": [],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Novice)"
  },
  "Heroes' Quest": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Asgarnia",
      "Misthalin",
      "Kandarin",
      "Karamja",
      "Wilderness",
      "Islands & Others"
    ],
    "locations": null,
    "skills": {
      "Quest Points": 55,
      "Cooking": 53,
      "Fishing": 53,
      "Herblore": 25,
      "Mining": 50
    },
    "combatLevel": null,
    "prereqs": [
      "Shield of Arrav",
      "Lost City",
      "Merlin's Crystal",
      "Dragon Slayer I"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Experienced)"
  },
  "Holy Grail": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Kandarin",
      "Islands & Others",
      "Asgarnia",
      "Misthalin",
      "Karamja"
    ],
    "locations": null,
    "skills": {
      "Attack": 20
    },
    "combatLevel": null,
    "prereqs": [
      "Merlin's Crystal"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Intermediate)"
  },
  "Horror from the Deep": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Fremennik"
    ],
    "locations": null,
    "skills": {
      "Agility": 35
    },
    "combatLevel": null,
    "prereqs": [
      "Alfred Grimhand's Barcrawl"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Intermediate)"
  },
  "Icthlarin's Little Helper": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Kharidian Desert"
    ],
    "locations": null,
    "skills": {},
    "combatLevel": null,
    "prereqs": [
      "Gertrude's Cat"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Intermediate)"
  },
  "Imp Catcher": {
    "kind": "quest",
    "accessPolicy": "locations",
    "regions": [
      "Misthalin"
    ],
    "locations": [
      {
        "id": "wizards-tower",
        "label": "Wizards' Tower",
        "standardAreas": [
          "Wizards' Tower"
        ],
        "chunkOptions": [
          {
            "cx": 48,
            "cy": 49
          }
        ]
      }
    ],
    "skills": {},
    "combatLevel": null,
    "prereqs": [],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Novice)"
  },
  "In Aid of the Myreque": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Morytania"
    ],
    "locations": null,
    "skills": {
      "Agility": 25,
      "Crafting": 25,
      "Magic": 7,
      "Mining": 15
    },
    "combatLevel": null,
    "prereqs": [
      "In Search of the Myreque"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Intermediate)"
  },
  "In Search of the Myreque": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Morytania"
    ],
    "locations": null,
    "skills": {
      "Agility": 25
    },
    "combatLevel": null,
    "prereqs": [
      "Nature Spirit"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Intermediate)"
  },
  "Jungle Potion": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Karamja"
    ],
    "locations": null,
    "skills": {
      "Herblore": 3
    },
    "combatLevel": null,
    "prereqs": [
      "Druidic Ritual"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Novice)"
  },
  "King's Ransom": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Kandarin",
      "Asgarnia"
    ],
    "locations": null,
    "skills": {
      "Magic": 45,
      "Defence": 65
    },
    "combatLevel": null,
    "prereqs": [
      "Black Knights' Fortress",
      "Holy Grail",
      "Murder Mystery",
      "One Small Favour"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Experienced)"
  },
  "Land of the Goblins": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Kandarin",
      "Misthalin",
      "Asgarnia"
    ],
    "locations": null,
    "skills": {
      "Agility": 38,
      "Thieving": 45,
      "Fishing": 40,
      "Herblore": 48
    },
    "combatLevel": null,
    "prereqs": [
      "Another Slice of H.A.M.",
      "Fishing Contest"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Experienced)"
  },
  "Legends' Quest": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Kandarin",
      "Karamja"
    ],
    "locations": null,
    "skills": {
      "Quest Points": 107,
      "Herblore": 45,
      "Prayer": 42,
      "Strength": 50,
      "Agility": 50,
      "Thieving": 50,
      "Crafting": 50,
      "Smithing": 50,
      "Mining": 52,
      "Woodcutting": 50,
      "Magic": 56
    },
    "combatLevel": null,
    "prereqs": [
      "Family Crest",
      "Heroes' Quest",
      "Shilo Village",
      "Underground Pass",
      "Waterfall Quest"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 4,
    "difficulty": "Quest (Master)"
  },
  "Lost City": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Misthalin",
      "Islands & Others",
      "Asgarnia"
    ],
    "locations": null,
    "skills": {
      "Crafting": 31,
      "Woodcutting": 36
    },
    "combatLevel": null,
    "prereqs": [],
    "oneOf": null,
    "manualRequirements": null,
    "points": 3,
    "difficulty": "Quest (Intermediate)"
  },
  "Lunar Diplomacy": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Fremennik"
    ],
    "locations": null,
    "skills": {
      "Herblore": 5,
      "Crafting": 61,
      "Defence": 40,
      "Firemaking": 49,
      "Magic": 65,
      "Mining": 60,
      "Woodcutting": 55
    },
    "combatLevel": null,
    "prereqs": [
      "The Fremennik Trials",
      "Lost City",
      "Rune Mysteries",
      "Shilo Village"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Experienced)"
  },
  "Making Friends with My Arm": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Asgarnia",
      "Fremennik",
      "Misthalin"
    ],
    "locations": null,
    "skills": {
      "Firemaking": 66,
      "Mining": 72,
      "Construction": 35,
      "Agility": 68
    },
    "combatLevel": null,
    "prereqs": [
      "My Arm's Big Adventure",
      "Swan Song",
      "Cold War",
      "Romeo & Juliet"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Master)"
  },
  "Making History": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Kandarin",
      "Fremennik",
      "Morytania"
    ],
    "locations": null,
    "skills": {},
    "combatLevel": null,
    "prereqs": [
      "Priest in Peril",
      "The Restless Ghost"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 3,
    "difficulty": "Quest (Intermediate)"
  },
  "Meat and Greet": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Varlamore"
    ],
    "locations": null,
    "skills": {},
    "combatLevel": null,
    "prereqs": [
      "Children of the Sun"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Experienced)"
  },
  "Merlin's Crystal": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Kandarin",
      "Asgarnia",
      "Misthalin"
    ],
    "locations": null,
    "skills": {},
    "combatLevel": null,
    "prereqs": [],
    "oneOf": null,
    "manualRequirements": null,
    "points": 6,
    "difficulty": "Quest (Intermediate)"
  },
  "Misthalin Mystery": {
    "kind": "quest",
    "accessPolicy": "locations",
    "regions": [
      "Misthalin"
    ],
    "locations": [
      {
        "id": "misthalin-mystery-island",
        "label": "Abigail and Hewey's island",
        "standardAreas": [
          "Lumbridge"
        ],
        "chunkOptions": [
          {
            "cx": 50,
            "cy": 49
          }
        ]
      }
    ],
    "skills": {},
    "combatLevel": null,
    "prereqs": [],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Novice)"
  },
  "Monk's Friend": {
    "kind": "quest",
    "accessPolicy": "locations",
    "regions": [
      "Kandarin"
    ],
    "locations": [
      {
        "id": "ardougne-monastery",
        "label": "Ardougne Monastery",
        "standardAreas": [
          "East Ardougne"
        ],
        "chunkOptions": [
          {
            "cx": 40,
            "cy": 50
          }
        ]
      }
    ],
    "skills": {},
    "combatLevel": null,
    "prereqs": [],
    "oneOf": null,
    "manualRequirements": null,
    "points": 1,
    "difficulty": "Quest (Novice)"
  },
  "Monkey Madness I": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Kandarin",
      "Karamja",
      "Islands & Others"
    ],
    "locations": null,
    "skills": {},
    "combatLevel": null,
    "prereqs": [
      "The Grand Tree",
      "Tree Gnome Village"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 3,
    "difficulty": "Quest (Master)"
  },
  "Monkey Madness II": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Islands & Others",
      "Kandarin",
      "Asgarnia"
    ],
    "locations": null,
    "skills": {
      "Slayer": 69,
      "Crafting": 70,
      "Hunter": 60,
      "Agility": 55,
      "Thieving": 55,
      "Firemaking": 60
    },
    "combatLevel": null,
    "prereqs": [
      "Monkey Madness I",
      "Enlightened Journey",
      "The Eyes of Glouphrie",
      "Troll Stronghold",
      "Watchtower",
      "RFD: King Awowogei"
    ],
    "oneOf": null,
    "manualRequirements": [
      "Unlocked the Gnome Stronghold balloon route"
    ],
    "points": 4,
    "difficulty": "Quest (Grandmaster)"
  },
  "Mountain Daughter": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Fremennik"
    ],
    "locations": null,
    "skills": {
      "Agility": 20
    },
    "combatLevel": null,
    "prereqs": [],
    "oneOf": [
      {
        "regions": [
          "Asgarnia"
        ]
      },
      {
        "regions": [
          "Kandarin"
        ]
      }
    ],
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Intermediate)"
  },
  "Mourning's End Part I": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Tirannwn",
      "Kandarin"
    ],
    "locations": null,
    "skills": {
      "Ranged": 60,
      "Thieving": 50
    },
    "combatLevel": null,
    "prereqs": [
      "Roving Elves",
      "Big Chompy Bird Hunting",
      "Sheep Herder"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Master)"
  },
  "Mourning's End Part II": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Tirannwn",
      "Kandarin"
    ],
    "locations": null,
    "skills": {
      "Agility": 65
    },
    "combatLevel": null,
    "prereqs": [
      "Mourning's End Part I"
    ],
    "oneOf": null,
    "manualRequirements": null,
    "points": 2,
    "difficulty": "Quest (Master)"
  },
  "Murder Mystery": {
    "kind": "quest",
    "accessPolicy": "locations",
    "regions": [
      "Kandarin"
    ],
    "locations": [
      {
        "id": "sinclair-mansion",
        "label": "Sinclair Mansion",
        "standardAreas": [
          "Seers' Village"
        ],
        "chunkOptions": [
          {
            "cx": 42,
            "cy": 55
          }
        ]
      },
      {
        "id": "seers-village",
        "label": "Seers' Village",
        "standardAreas": [
          "Seers' Village"
        ],
        "chunkOptions": [
          {
            "cx": 42,
            "cy": 54
          }
        ]
      }
    ],
    "skills": {},
    "combatLevel": null,
    "prereqs": [],
    "oneOf": null,
    "manualRequirements": null,
    "points": 3,
    "difficulty": "Quest (Novice)"
  },
  "My Arm's Big Adventure": {
    "kind": "quest",
    "accessPolicy": "regions",
    "regions": [
      "Asgarnia",
      "Kandarin",
      "Karamja"
    ],
    "locations": null,
    "skills": {
      "Woodcutting": 10,
      "Farming": 29
    },
    "combatLevel": null,
    "prereqs": [
      "Eadgar's Ruse",
      "The Feud",
      "Jungle Potion"
    ],
    "oneOf": null,
    "manualRequirements": [
      "60% Tai Bwo Wannai favour before starting the quest"
    ],
    "points": 1,
    "difficulty": "Quest (Experienced)"
  }
};
    expect(actual).toEqual(expected);
  });
  it('pins the complete machine and balance projection for all 47 N-S quests', () => {
    const ids = [
      "Romeo & Juliet",
      "Sheep Shearer",
      "Shield of Arrav",
      "Prince Ali Rescue",
      "Pirate's Treasure",
      "Rune Mysteries",
      "Scorpion Catcher",
      "Sheep Herder",
      "Plague City",
      "Sea Slug",
      "Shilo Village",
      "Observatory Quest",
      "Priest in Peril",
      "Nature Spirit",
      "Regicide",
      "Shades of Mort'ton",
      "Roving Elves",
      "One Small Favour",
      "Recruitment Drive",
      "Rum Deal",
      "Shadow of the Storm",
      "Ratcatchers",
      "Spirits of the Elid",
      "RFD: The Cook",
      "RFD: Dwarf",
      "RFD: Goblins",
      "RFD: Pirate Pete",
      "RFD: Lumbridge Guide",
      "RFD: Evil Dave",
      "RFD: Skrach Uglogwee",
      "RFD: Sir Amik Varze",
      "RFD: King Awowogei",
      "RFD: Finale",
      "Rag and Bone Man I",
      "Swan Song",
      "Royal Trouble",
      "Olaf's Quest",
      "Rag and Bone Man II",
      "Song of the Elves",
      "Sins of the Father",
      "Sleeping Giants",
      "Secrets of the North",
      "Perilous Moons",
      "Shadows of Custodia",
      "Scrambled!",
      "Pandemonium",
      "Prying Times"
    ] as const;
    const actual = Object.fromEntries(ids.map(id => {
      const quest = QUEST_DATA[id];
      return [id, {
        kind: quest.kind,
        accessPolicy: quest.accessPolicy,
        regions: quest.regions,
        locations: quest.locations?.map(({ id, label, standardAreas, chunkOptions }) => ({ id, label, standardAreas, chunkOptions })) ?? null,
        skills: quest.skills,
        combatLevel: quest.combatLevel ?? null,
        prereqs: quest.prereqs,
        oneOf: quest.oneOf ?? null,
        manualRequirements: quest.manualRequirements ?? null,
        points: quest.points,
        difficulty: quest.difficulty,
      }];
    }));
    const expected = {
      "Romeo & Juliet": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Misthalin"
        ],
        "locations": [
          {
            "id": "varrock-square",
            "label": "Varrock square",
            "standardAreas": [
              "Varrock"
            ],
            "chunkOptions": [
              {
                "cx": 50,
                "cy": 53
              }
            ]
          },
          {
            "id": "juliets-house",
            "label": "Juliet's house in west Varrock",
            "standardAreas": [
              "Varrock"
            ],
            "chunkOptions": [
              {
                "cx": 49,
                "cy": 53
              }
            ]
          },
          {
            "id": "varrock-church",
            "label": "Varrock church",
            "standardAreas": [
              "Varrock"
            ],
            "chunkOptions": [
              {
                "cx": 50,
                "cy": 54
              }
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 5,
        "difficulty": "Quest (Novice)"
      },
      "Sheep Shearer": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "Shield of Arrav": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": [
          "A trustworthy partner in the opposite gang"
        ],
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "Prince Ali Rescue": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Kharidian Desert",
          "Misthalin"
        ],
        "locations": [
          {
            "id": "al-kharid-palace",
            "label": "Al Kharid Palace",
            "standardAreas": [
              "Al Kharid"
            ],
            "chunkOptions": [
              {
                "cx": 51,
                "cy": 49
              }
            ]
          },
          {
            "id": "draynor-village-and-jail",
            "label": "Draynor Village and the jail",
            "standardAreas": [
              "Draynor Village"
            ],
            "chunkOptions": [
              {
                "cx": 48,
                "cy": 50
              }
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 3,
        "difficulty": "Quest (Novice)"
      },
      "Pirate's Treasure": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia",
          "Misthalin",
          "Karamja"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Novice)"
      },
      "Rune Mysteries": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Misthalin"
        ],
        "locations": [
          {
            "id": "lumbridge-castle",
            "label": "Lumbridge Castle",
            "standardAreas": [
              "Lumbridge"
            ],
            "chunkOptions": [
              {
                "cx": 50,
                "cy": 50
              }
            ]
          },
          {
            "id": "wizards-tower",
            "label": "Wizards' Tower",
            "standardAreas": [
              "Wizards' Tower"
            ],
            "chunkOptions": [
              {
                "cx": 48,
                "cy": 49
              }
            ]
          },
          {
            "id": "auburys-rune-shop",
            "label": "Aubury's rune shop in Varrock",
            "standardAreas": [
              "Varrock"
            ],
            "chunkOptions": [
              {
                "cx": 50,
                "cy": 53
              }
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "Scorpion Catcher": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin",
          "Asgarnia"
        ],
        "locations": null,
        "skills": {
          "Prayer": 31
        },
        "combatLevel": null,
        "prereqs": [
          "Alfred Grimhand's Barcrawl"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Sheep Herder": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 4,
        "difficulty": "Quest (Novice)"
      },
      "Plague City": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Kandarin"
        ],
        "locations": [
          {
            "id": "east-ardougne-edmond",
            "label": "Edmond's house in East Ardougne",
            "standardAreas": [
              "East Ardougne"
            ],
            "chunkOptions": [
              {
                "cx": 39,
                "cy": 52
              }
            ]
          },
          {
            "id": "west-ardougne",
            "label": "West Ardougne",
            "standardAreas": [
              "West Ardougne"
            ],
            "chunkOptions": [
              {
                "cx": 39,
                "cy": 51
              }
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "Sea Slug": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Kandarin"
        ],
        "locations": [
          {
            "id": "witchaven-coast",
            "label": "Witchaven coast",
            "standardAreas": [
              "Witchaven"
            ],
            "chunkOptions": [
              {
                "cx": 42,
                "cy": 51
              }
            ]
          },
          {
            "id": "fishing-platform",
            "label": "Fishing Platform",
            "standardAreas": [
              "Witchaven"
            ],
            "chunkOptions": [
              {
                "cx": 43,
                "cy": 51
              }
            ]
          }
        ],
        "skills": {
          "Firemaking": 30
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Shilo Village": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Karamja"
        ],
        "locations": null,
        "skills": {
          "Crafting": 20,
          "Agility": 32
        },
        "combatLevel": null,
        "prereqs": [
          "Jungle Potion"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "Observatory Quest": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Kandarin"
        ],
        "locations": [
          {
            "id": "observatory",
            "label": "Observatory and Observatory Dungeon",
            "standardAreas": [
              "Observatory"
            ],
            "chunkOptions": [
              {
                "cx": 38,
                "cy": 49
              }
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "Priest in Peril": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Misthalin",
          "Morytania"
        ],
        "locations": [
          {
            "id": "varrock-palace",
            "label": "Varrock Palace",
            "standardAreas": [
              "Varrock"
            ],
            "chunkOptions": [
              {
                "cx": 50,
                "cy": 54
              }
            ]
          },
          {
            "id": "paterdomus",
            "label": "Paterdomus Temple and mausoleum",
            "standardAreas": [
              "Paterdomus"
            ],
            "chunkOptions": [
              {
                "cx": 53,
                "cy": 54
              }
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "Nature Spirit": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Morytania"
        ],
        "locations": [
          {
            "id": "paterdomus",
            "label": "Paterdomus and Drezel",
            "standardAreas": [
              "Paterdomus"
            ],
            "chunkOptions": [
              {
                "cx": 53,
                "cy": 54
              }
            ]
          },
          {
            "id": "nature-grotto",
            "label": "Nature Grotto in Mort Myre Swamp",
            "standardAreas": [
              "Mort Myre Swamp"
            ],
            "chunkOptions": [
              {
                "cx": 53,
                "cy": 52
              }
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Priest in Peril",
          "The Restless Ghost"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "Regicide": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Tirannwn",
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Agility": 56,
          "Crafting": 10
        },
        "combatLevel": null,
        "prereqs": [
          "Underground Pass"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 3,
        "difficulty": "Quest (Experienced)"
      },
      "Shades of Mort'ton": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Morytania"
        ],
        "locations": [
          {
            "id": "mortton",
            "label": "Mort'ton and the Flamtaer Temple",
            "standardAreas": [
              "Mort'ton"
            ],
            "chunkOptions": [
              {
                "cx": 54,
                "cy": 51
              }
            ]
          }
        ],
        "skills": {
          "Crafting": 20,
          "Firemaking": 5,
          "Herblore": 15
        },
        "combatLevel": null,
        "prereqs": [
          "Priest in Peril"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 3,
        "difficulty": "Quest (Intermediate)"
      },
      "Roving Elves": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Tirannwn",
          "Kandarin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Regicide",
          "Waterfall Quest"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Experienced)"
      },
      "One Small Favour": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin",
          "Karamja",
          "Asgarnia",
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Agility": 36,
          "Crafting": 25,
          "Herblore": 18,
          "Smithing": 30
        },
        "combatLevel": null,
        "prereqs": [
          "Rune Mysteries",
          "Shilo Village"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Experienced)"
      },
      "Recruitment Drive": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Asgarnia"
        ],
        "locations": [
          {
            "id": "west-falador",
            "label": "White Knights' Castle and Falador Park",
            "standardAreas": [
              "Falador"
            ],
            "chunkOptions": [
              {
                "cx": 46,
                "cy": 52
              }
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Black Knights' Fortress",
          "Druidic Ritual"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "Rum Deal": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Morytania",
          "Islands & Others"
        ],
        "locations": null,
        "skills": {
          "Farming": 40,
          "Prayer": 47,
          "Slayer": 42,
          "Crafting": 42,
          "Fishing": 50
        },
        "combatLevel": null,
        "prereqs": [
          "Zogre Flesh Eaters",
          "Priest in Peril"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Experienced)"
      },
      "Shadow of the Storm": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kharidian Desert"
        ],
        "locations": null,
        "skills": {
          "Crafting": 30
        },
        "combatLevel": null,
        "prereqs": [
          "Demon Slayer",
          "The Golem"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Ratcatchers": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin",
          "Kandarin",
          "Kharidian Desert",
          "Fremennik",
          "Asgarnia"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Icthlarin's Little Helper"
        ],
        "oneOf": null,
        "manualRequirements": [
          "Started The Giant Dwarf to access Keldagrim"
        ],
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "Spirits of the Elid": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kharidian Desert"
        ],
        "locations": null,
        "skills": {
          "Magic": 33,
          "Ranged": 37,
          "Mining": 37,
          "Thieving": 37
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "RFD: The Cook": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Cooking": 10
        },
        "combatLevel": null,
        "prereqs": [
          "Cook's Assistant"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "RFD: Dwarf": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Fishing Contest"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "RFD: Goblins": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Goblin Diplomacy"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "RFD: Pirate Pete": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin",
          "Asgarnia",
          "Islands & Others"
        ],
        "locations": null,
        "skills": {
          "Cooking": 31
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "RFD: Lumbridge Guide": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Cooking": 40
        },
        "combatLevel": null,
        "prereqs": [
          "Big Chompy Bird Hunting",
          "Biohazard",
          "Demon Slayer",
          "Murder Mystery",
          "Nature Spirit",
          "Priest in Peril",
          "The Restless Ghost",
          "Witch's House"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "RFD: Evil Dave": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Cooking": 25
        },
        "combatLevel": null,
        "prereqs": [
          "Gertrude's Cat",
          "Shadow of the Storm"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "RFD: Skrach Uglogwee": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Cooking": 41,
          "Firemaking": 20
        },
        "combatLevel": null,
        "prereqs": [
          "Big Chompy Bird Hunting"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "RFD: Sir Amik Varze": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia",
          "Karamja",
          "Misthalin",
          "Islands & Others"
        ],
        "locations": null,
        "skills": {
          "Quest Points": 107
        },
        "combatLevel": null,
        "prereqs": [
          "Legends' Quest"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Experienced)"
      },
      "RFD: King Awowogei": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Islands & Others",
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Cooking": 70,
          "Agility": 48
        },
        "combatLevel": null,
        "prereqs": [
          "Monkey Madness I"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Experienced)"
      },
      "RFD: Finale": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Quest Points": 175
        },
        "combatLevel": null,
        "prereqs": [
          "RFD: The Cook",
          "RFD: Dwarf",
          "RFD: Goblins",
          "RFD: Pirate Pete",
          "RFD: Lumbridge Guide",
          "RFD: Evil Dave",
          "RFD: Skrach Uglogwee",
          "RFD: Sir Amik Varze",
          "RFD: King Awowogei"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Master)"
      },
      "Rag and Bone Man I": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "Swan Song": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin",
          "Misthalin",
          "Asgarnia"
        ],
        "locations": null,
        "skills": {
          "Quest Points": 100,
          "Magic": 66,
          "Cooking": 62,
          "Fishing": 62,
          "Smithing": 45,
          "Firemaking": 42,
          "Crafting": 40
        },
        "combatLevel": null,
        "prereqs": [
          "One Small Favour",
          "Garden of Tranquillity"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Master)"
      },
      "Royal Trouble": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Fremennik"
        ],
        "locations": [
          {
            "id": "miscellania",
            "label": "Miscellania and its dungeon",
            "standardAreas": [
              "Miscellania & Etceteria"
            ],
            "chunkOptions": [
              {
                "cx": 39,
                "cy": 60
              }
            ]
          },
          {
            "id": "etceteria",
            "label": "Etceteria",
            "standardAreas": [
              "Miscellania & Etceteria"
            ],
            "chunkOptions": [
              {
                "cx": 40,
                "cy": 60
              }
            ]
          }
        ],
        "skills": {
          "Agility": 40,
          "Slayer": 40
        },
        "combatLevel": null,
        "prereqs": [
          "Throne of Miscellania"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Experienced)"
      },
      "Olaf's Quest": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Fremennik"
        ],
        "locations": [
          {
            "id": "olafs-camp-and-cavern",
            "label": "Olaf's camp and the Brine Rat Cavern",
            "standardAreas": [
              "Rellekka"
            ],
            "chunkOptions": [
              {
                "cx": 42,
                "cy": 58
              }
            ]
          },
          {
            "id": "rellekka",
            "label": "Rellekka",
            "standardAreas": [
              "Rellekka"
            ],
            "chunkOptions": [
              {
                "cx": 41,
                "cy": 57
              }
            ]
          }
        ],
        "skills": {
          "Firemaking": 40,
          "Woodcutting": 50
        },
        "combatLevel": null,
        "prereqs": [
          "The Fremennik Trials"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Rag and Bone Man II": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin",
          "Asgarnia",
          "Kandarin",
          "Kharidian Desert",
          "Fremennik",
          "Morytania"
        ],
        "locations": null,
        "skills": {
          "Slayer": 40
        },
        "combatLevel": null,
        "prereqs": [
          "Rag and Bone Man I",
          "Skippy and the Mogres"
        ],
        "oneOf": null,
        "manualRequirements": [
          "Completed Horror from the Deep or started The Fremennik Trials for dagannoth access",
          "Reached an experiment after starting Creature of Fenkenstrain or completing Grim Tales",
          "Reached a listed fire giant source after partially completing Waterfall Quest or by an alternative route"
        ],
        "points": 1,
        "difficulty": "Quest (Experienced)"
      },
      "Song of the Elves": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Tirannwn",
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Agility": 70,
          "Construction": 70,
          "Farming": 70,
          "Herblore": 70,
          "Hunter": 70,
          "Mining": 70,
          "Smithing": 70,
          "Woodcutting": 70
        },
        "combatLevel": null,
        "prereqs": [
          "Mourning's End Part II",
          "Making History",
          "Druidic Ritual"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 4,
        "difficulty": "Quest (Grandmaster)"
      },
      "Sins of the Father": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Morytania"
        ],
        "locations": null,
        "skills": {
          "Agility": 52,
          "Attack": 50,
          "Crafting": 56,
          "Fletching": 60,
          "Magic": 49,
          "Slayer": 50,
          "Woodcutting": 62
        },
        "combatLevel": null,
        "prereqs": [
          "A Taste of Hope",
          "Vampyre Slayer"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Master)"
      },
      "Sleeping Giants": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Kharidian Desert"
        ],
        "locations": [
          {
            "id": "giants-plateau-foundry",
            "label": "Giants' Plateau and Giants' Foundry",
            "standardAreas": [
              "Giants' Plateau"
            ],
            "chunkOptions": [
              {
                "cx": 52,
                "cy": 49
              }
            ]
          }
        ],
        "skills": {
          "Smithing": 15
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Secrets of the North": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin",
          "Fremennik"
        ],
        "locations": null,
        "skills": {
          "Agility": 69,
          "Thieving": 64,
          "Hunter": 56
        },
        "combatLevel": null,
        "prereqs": [
          "Hazeel Cult",
          "The General's Shadow",
          "Making Friends with My Arm"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Master)"
      },
      "Perilous Moons": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Varlamore"
        ],
        "locations": [
          {
            "id": "cam-torum-and-neypotzli",
            "label": "Cam Torum and Neypotzli",
            "standardAreas": [
              "Cam Torum"
            ],
            "chunkOptions": [
              {
                "cx": 22,
                "cy": 48
              }
            ]
          }
        ],
        "skills": {
          "Slayer": 48,
          "Hunter": 20,
          "Fishing": 20,
          "Runecraft": 20,
          "Construction": 10
        },
        "combatLevel": null,
        "prereqs": [
          "Twilight's Promise"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Master)"
      },
      "Shadows of Custodia": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Varlamore"
        ],
        "locations": null,
        "skills": {
          "Slayer": 54,
          "Fishing": 45,
          "Construction": 41,
          "Hunter": 36
        },
        "combatLevel": null,
        "prereqs": [
          "Children of the Sun"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Experienced)"
      },
      "Scrambled!": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Varlamore"
        ],
        "locations": [
          {
            "id": "tal-teklan-dock",
            "label": "Tal Teklan dock",
            "standardAreas": [
              "Tlati Rainforest"
            ],
            "chunkOptions": [
              {
                "cx": 18,
                "cy": 48
              }
            ]
          },
          {
            "id": "tal-teok",
            "label": "Tal Teok and Tal Teklan",
            "standardAreas": [
              "Tlati Rainforest"
            ],
            "chunkOptions": [
              {
                "cx": 19,
                "cy": 49
              }
            ]
          },
          {
            "id": "tlati-rainforest",
            "label": "Central Tlati Rainforest",
            "standardAreas": [
              "Tlati Rainforest"
            ],
            "chunkOptions": [
              {
                "cx": 20,
                "cy": 48
              }
            ]
          }
        ],
        "skills": {
          "Construction": 38,
          "Cooking": 36,
          "Smithing": 35
        },
        "combatLevel": null,
        "prereqs": [
          "Children of the Sun"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Pandemonium": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [],
        "locations": [
          {
            "id": "port-sarim",
            "label": "Port Sarim",
            "standardAreas": [
              "Port Sarim"
            ],
            "chunkOptions": [
              {
                "cx": 47,
                "cy": 50
              }
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "Prying Times": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "The Open Seas"
        ],
        "locations": [
          {
            "id": "the-pandemonium",
            "label": "The Pandemonium",
            "standardAreas": [
              "The Pandemonium"
            ],
            "chunkOptions": [
              {
                "cx": 47,
                "cy": 46
              }
            ]
          },
          {
            "id": "port-sarim-docks",
            "label": "Port Sarim docks",
            "standardAreas": [
              "Port Sarim"
            ],
            "chunkOptions": [
              {
                "cx": 47,
                "cy": 49
              }
            ]
          },
          {
            "id": "thurgos-hut",
            "label": "Thurgo's hut south of Port Sarim",
            "standardAreas": [
              "Rimmington"
            ],
            "chunkOptions": [
              {
                "cx": 46,
                "cy": 49
              }
            ]
          }
        ],
        "skills": {
          "Smithing": 30,
          "Sailing": 12
        },
        "combatLevel": null,
        "prereqs": [
          "Pandemonium",
          "The Knight's Sword"
        ],
        "oneOf": null,
        "manualRequirements": [
          "One open Sailing task slot"
        ],
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      }
    };
    expect(actual).toEqual(expected);
  });
  it('pins the complete machine and balance projection for all 53 T-Z quests and both reconciled official quests', () => {
    const ids =     [
          "Tai Bwo Wannai Trio",
          "Tale of the Righteous",
          "Tears of Guthix",
          "Temple of Ikov",
          "Temple of the Eye",
          "The Ascent of Arceuus",
          "The Corsair Curse",
          "The Curse of Arrav",
          "The Depths of Despair",
          "The Dig Site",
          "The Eyes of Glouphrie",
          "The Feud",
          "The Final Dawn",
          "The Forsaken Tower",
          "The Fremennik Exiles",
          "The Fremennik Isles",
          "The Fremennik Trials",
          "The Garden of Death",
          "The Giant Dwarf",
          "The Golem",
          "The Grand Tree",
          "The Great Brain Robbery",
          "The Hand in the Sand",
          "The Heart of Darkness",
          "The Ides of Milk",
          "The Knight's Sword",
          "The Lost Tribe",
          "The Path of Glouphrie",
          "The Queen of Thieves",
          "The Red Reef",
          "The Restless Ghost",
          "The Ribbiting Tale",
          "The Slug Menace",
          "The Tourist Trap",
          "Throne of Miscellania",
          "Tower of Life",
          "Tree Gnome Village",
          "Tribal Totem",
          "Troll Romance",
          "Troll Stronghold",
          "Troubled Tortugans",
          "Twilight's Promise",
          "Underground Pass",
          "Vampyre Slayer",
          "Wanted!",
          "Watchtower",
          "Waterfall Quest",
          "What Lies Below",
          "While Guthix Sleeps",
          "Witch's House",
          "Witch's Potion",
          "X Marks the Spot",
          "Zogre Flesh Eaters",
          "Learning the Ropes",
          "The Blood Moon Rises"
    ] as const;
    const actual = Object.fromEntries(ids.map(id => {
      const quest = QUEST_DATA[id];
      return [id, {
        kind: quest?.kind,
        accessPolicy: quest?.accessPolicy,
        regions: quest?.regions,
        locations: quest?.locations?.map(({ id, label, standardAreas, chunkOptions }) => ({ id, label, standardAreas, chunkOptions })) ?? null,
        skills: quest?.skills,
        combatLevel: quest?.combatLevel ?? null,
        prereqs: quest?.prereqs,
        oneOf: quest?.oneOf ?? null,
        manualRequirements: quest?.manualRequirements ?? null,
        points: quest?.points,
        difficulty: quest?.difficulty,
      }];
    }));
    const expected =     {
      "Tai Bwo Wannai Trio": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Karamja"
        ],
        "locations": null,
        "skills": {
          "Agility": 15,
          "Cooking": 30,
          "Fishing": 5
        },
        "combatLevel": null,
        "prereqs": [
          "Jungle Potion"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "Tale of the Righteous": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kourend & Kebos"
        ],
        "locations": null,
        "skills": {
          "Strength": 16,
          "Mining": 10
        },
        "combatLevel": null,
        "prereqs": [
          "Client of Kourend"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Tears of Guthix": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Misthalin"
        ],
        "locations": [
          {
            "id": "lumbridge-swamp-caves",
            "label": "Lumbridge Swamp Caves",
            "standardAreas": [
              "Lumbridge"
            ],
            "chunkOptions": [
              {
                "cx": 49,
                "cy": 49
              },
              {
                "cx": 50,
                "cy": 50
              }
            ]
          }
        ],
        "skills": {
          "Firemaking": 49,
          "Crafting": 20,
          "Mining": 20,
          "Quest Points": 43
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Temple of Ikov": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Thieving": 42
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Temple of the Eye": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kharidian Desert",
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Runecraft": 10
        },
        "combatLevel": null,
        "prereqs": [
          "Enter the Abyss"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Ascent of Arceuus": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kourend & Kebos"
        ],
        "locations": null,
        "skills": {
          "Hunter": 12
        },
        "combatLevel": null,
        "prereqs": [
          "Client of Kourend"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Corsair Curse": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia",
          "Kandarin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "The Curse of Arrav": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin",
          "Kharidian Desert",
          "Fremennik"
        ],
        "locations": null,
        "skills": {
          "Agility": 61,
          "Ranged": 62,
          "Strength": 58,
          "Thieving": 62,
          "Mining": 64,
          "Slayer": 37
        },
        "combatLevel": null,
        "prereqs": [
          "Defender of Varrock",
          "Troll Romance"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Master)"
      },
      "The Depths of Despair": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kourend & Kebos"
        ],
        "locations": null,
        "skills": {
          "Agility": 18
        },
        "combatLevel": null,
        "prereqs": [
          "Client of Kourend"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Dig Site": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Agility": 10,
          "Herblore": 10,
          "Thieving": 25
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "The Eyes of Glouphrie": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Construction": 5,
          "Magic": 46
        },
        "combatLevel": null,
        "prereqs": [
          "The Grand Tree"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "The Feud": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kharidian Desert"
        ],
        "locations": null,
        "skills": {
          "Thieving": 30
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Final Dawn": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Varlamore"
        ],
        "locations": null,
        "skills": {
          "Thieving": 66,
          "Fletching": 52,
          "Runecraft": 52
        },
        "combatLevel": null,
        "prereqs": [
          "The Heart of Darkness",
          "Perilous Moons"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 3,
        "difficulty": "Quest (Master)"
      },
      "The Forsaken Tower": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kourend & Kebos"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Client of Kourend"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Fremennik Exiles": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Fremennik"
        ],
        "locations": null,
        "skills": {
          "Crafting": 65,
          "Slayer": 60,
          "Smithing": 60,
          "Fishing": 60,
          "Runecraft": 55,
          "Mining": 60
        },
        "combatLevel": null,
        "prereqs": [
          "The Fremennik Isles",
          "Lunar Diplomacy",
          "Mountain Daughter",
          "Heroes' Quest"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Master)"
      },
      "The Fremennik Isles": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Fremennik"
        ],
        "locations": null,
        "skills": {
          "Construction": 20
        },
        "combatLevel": null,
        "prereqs": [
          "The Fremennik Trials"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Experienced)"
      },
      "The Fremennik Trials": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Fremennik"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 3,
        "difficulty": "Quest (Intermediate)"
      },
      "The Garden of Death": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kourend & Kebos"
        ],
        "locations": null,
        "skills": {
          "Farming": 20
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Giant Dwarf": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Fremennik",
          "Misthalin",
          "Asgarnia"
        ],
        "locations": null,
        "skills": {
          "Crafting": 12,
          "Firemaking": 16,
          "Magic": 33,
          "Thieving": 14
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "The Golem": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kharidian Desert",
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Crafting": 20,
          "Thieving": 25
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Grand Tree": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin",
          "Karamja"
        ],
        "locations": null,
        "skills": {
          "Agility": 25
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 5,
        "difficulty": "Quest (Intermediate)"
      },
      "The Great Brain Robbery": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Morytania",
          "Asgarnia"
        ],
        "locations": null,
        "skills": {
          "Crafting": 16,
          "Construction": 30,
          "Prayer": 50
        },
        "combatLevel": null,
        "prereqs": [
          "Creature of Fenkenstrain",
          "Cabin Fever",
          "RFD: Pirate Pete"
        ],
        "oneOf": null,
        "manualRequirements": [
          "Access to a player-owned house workshop and crafting table, or the Grand Exchange"
        ],
        "points": 2,
        "difficulty": "Quest (Experienced)"
      },
      "The Hand in the Sand": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin",
          "Karamja",
          "Asgarnia"
        ],
        "locations": null,
        "skills": {
          "Thieving": 17,
          "Crafting": 49
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Heart of Darkness": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Varlamore"
        ],
        "locations": null,
        "skills": {
          "Mining": 55,
          "Thieving": 48,
          "Slayer": 48,
          "Agility": 46
        },
        "combatLevel": null,
        "prereqs": [
          "Twilight's Promise"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Experienced)"
      },
      "The Ides of Milk": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "The Knight's Sword": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia",
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Mining": 10
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Lost Tribe": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin",
          "Asgarnia"
        ],
        "locations": null,
        "skills": {
          "Agility": 13,
          "Mining": 17,
          "Thieving": 13
        },
        "combatLevel": null,
        "prereqs": [
          "Goblin Diplomacy",
          "Rune Mysteries"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Path of Glouphrie": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Strength": 60,
          "Slayer": 56,
          "Thieving": 56,
          "Ranged": 47,
          "Agility": 45
        },
        "combatLevel": null,
        "prereqs": [
          "The Eyes of Glouphrie",
          "Waterfall Quest",
          "Tree Gnome Village"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Experienced)"
      },
      "The Queen of Thieves": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kourend & Kebos"
        ],
        "locations": null,
        "skills": {
          "Thieving": 20
        },
        "combatLevel": null,
        "prereqs": [
          "Client of Kourend"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Red Reef": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "The Open Seas"
        ],
        "locations": null,
        "skills": {
          "Sailing": 52,
          "Smithing": 48
        },
        "combatLevel": null,
        "prereqs": [
          "Troubled Tortugans"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Experienced)"
      },
      "The Restless Ghost": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "The Ribbiting Tale": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Varlamore"
        ],
        "locations": null,
        "skills": {
          "Woodcutting": 15
        },
        "combatLevel": null,
        "prereqs": [
          "Children of the Sun"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "The Slug Menace": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin",
          "Asgarnia",
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Crafting": 30,
          "Runecraft": 30,
          "Slayer": 30,
          "Thieving": 30
        },
        "combatLevel": null,
        "prereqs": [
          "Sea Slug",
          "Wanted!"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "The Tourist Trap": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kharidian Desert"
        ],
        "locations": null,
        "skills": {
          "Fletching": 10,
          "Smithing": 20
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "Throne of Miscellania": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Fremennik"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "The Fremennik Trials",
          "Heroes' Quest"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Experienced)"
      },
      "Tower of Life": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Construction": 10
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Novice)"
      },
      "Tree Gnome Village": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "Tribal Totem": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Karamja",
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Thieving": 21
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Troll Romance": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia"
        ],
        "locations": null,
        "skills": {
          "Agility": 28
        },
        "combatLevel": null,
        "prereqs": [
          "Troll Stronghold"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 2,
        "difficulty": "Quest (Intermediate)"
      },
      "Troll Stronghold": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia"
        ],
        "locations": null,
        "skills": {
          "Agility": 15
        },
        "combatLevel": null,
        "prereqs": [
          "Death Plateau"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Troubled Tortugans": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "The Open Seas"
        ],
        "locations": null,
        "skills": {
          "Slayer": 51,
          "Construction": 48,
          "Sailing": 45,
          "Hunter": 45,
          "Woodcutting": 40,
          "Crafting": 34
        },
        "combatLevel": null,
        "prereqs": [
          "Pandemonium"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Experienced)"
      },
      "Twilight's Promise": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Varlamore"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [
          "Children of the Sun"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Underground Pass": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin",
          "Tirannwn"
        ],
        "locations": null,
        "skills": {
          "Ranged": 25
        },
        "combatLevel": null,
        "prereqs": [
          "Biohazard"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 5,
        "difficulty": "Quest (Experienced)"
      },
      "Vampyre Slayer": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 3,
        "difficulty": "Quest (Intermediate)"
      },
      "Wanted!": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia",
          "Misthalin",
          "Morytania"
        ],
        "locations": null,
        "skills": {
          "Quest Points": 32
        },
        "combatLevel": null,
        "prereqs": [
          "Recruitment Drive",
          "The Lost Tribe",
          "Priest in Peril",
          "Enter the Abyss"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Watchtower": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Magic": 14,
          "Thieving": 15,
          "Agility": 25,
          "Herblore": 14,
          "Mining": 40
        },
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 4,
        "difficulty": "Quest (Intermediate)"
      },
      "Waterfall Quest": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "What Lies Below": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin"
        ],
        "locations": null,
        "skills": {
          "Runecraft": 35
        },
        "combatLevel": null,
        "prereqs": [
          "Rune Mysteries"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "While Guthix Sleeps": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin",
          "Asgarnia",
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Quest Points": 180,
          "Thieving": 72,
          "Magic": 67,
          "Agility": 66,
          "Farming": 65,
          "Herblore": 65,
          "Hunter": 62,
          "Firemaking": 49
        },
        "combatLevel": null,
        "prereqs": [
          "Defender of Varrock",
          "The Path of Glouphrie",
          "Fight Arena",
          "Dream Mentor",
          "The Hand in the Sand",
          "Wanted!",
          "Temple of the Eye",
          "Tears of Guthix",
          "Nature Spirit",
          "A Tail of Two Cats"
        ],
        "oneOf": null,
        "manualRequirements": [
          "Warriors' Guild access with Attack + Strength at least 130, or 99 Attack, or 99 Strength"
        ],
        "points": 5,
        "difficulty": "Quest (Grandmaster)"
      },
      "Witch's House": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Asgarnia"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 4,
        "difficulty": "Quest (Intermediate)"
      },
      "Witch's Potion": {
        "kind": "quest",
        "accessPolicy": "locations",
        "regions": [
          "Asgarnia"
        ],
        "locations": [
          {
            "id": "rimmington",
            "label": "Rimmington",
            "standardAreas": [
              "Rimmington"
            ],
            "chunkOptions": [
              {
                "cx": 46,
                "cy": 50
              }
            ]
          }
        ],
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "X Marks the Spot": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Misthalin",
          "Asgarnia"
        ],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "Zogre Flesh Eaters": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Kandarin"
        ],
        "locations": null,
        "skills": {
          "Smithing": 4,
          "Herblore": 8,
          "Ranged": 30
        },
        "combatLevel": null,
        "prereqs": [
          "Big Chompy Bird Hunting",
          "Jungle Potion"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Intermediate)"
      },
      "Learning the Ropes": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [],
        "locations": null,
        "skills": {},
        "combatLevel": null,
        "prereqs": [],
        "oneOf": null,
        "manualRequirements": null,
        "points": 1,
        "difficulty": "Quest (Novice)"
      },
      "The Blood Moon Rises": {
        "kind": "quest",
        "accessPolicy": "regions",
        "regions": [
          "Morytania"
        ],
        "locations": null,
        "skills": {
          "Slayer": 74,
          "Woodcutting": 74,
          "Smithing": 72,
          "Cooking": 72,
          "Fletching": 70,
          "Mining": 66,
          "Hunter": 65,
          "Crafting": 64,
          "Herblore": 64,
          "Magic": 57
        },
        "combatLevel": null,
        "prereqs": [
          "A Night at the Theatre",
          "Sins of the Father"
        ],
        "oneOf": null,
        "manualRequirements": null,
        "points": 4,
        "difficulty": "Quest (Grandmaster)"
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
