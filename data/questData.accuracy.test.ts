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
