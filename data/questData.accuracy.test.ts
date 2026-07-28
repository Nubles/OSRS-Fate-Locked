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

  it('pins all changed miniquest requirements to the reviewed evidence', () => {
    expect(QUEST_DATA["Alfred Grimhand's Barcrawl"]).toMatchObject({
      accessPolicy: 'locations',
      regions: ['Kandarin', 'Misthalin', 'Karamja', 'Asgarnia'],
      skills: {}, prereqs: [],
    });
    expect(QUEST_DATA["Alfred Grimhand's Barcrawl"].locations?.map(location => location.id))
      .toEqual([
        'barbarian-outpost', 'blue-moon-inn', 'grand-tree-bar', 'brimhaven-bar',
        'yanille-bar', 'east-ardougne-bar', 'seers-village-bar', 'jolly-boar-inn',
        'musa-point-bar', 'falador-bar', 'port-sarim-bar',
      ]);

    expect(QUEST_DATA['Bear Your Soul']).toMatchObject({
      accessPolicy: 'regions',
      regions: ['Kourend & Kebos', 'Asgarnia'],
      skills: {}, prereqs: [],
    });
    expect(QUEST_DATA['Curse of the Empty Lord']).toMatchObject({
      accessPolicy: 'regions',
      regions: ['Asgarnia', 'Kandarin', 'Wilderness'],
      skills: { Thieving: 53 }, prereqs: [],
      manualRequirements: ['Started Desert Treasure I', 'Started The Restless Ghost'],
    });

    expect(QUEST_DATA["Daddy's Home"]).toMatchObject({
      accessPolicy: 'locations', regions: ['Misthalin'], skills: {}, prereqs: [],
    });
    expect(QUEST_DATA["Daddy's Home"].locations?.map(location => location.id))
      .toEqual(['varrock-palace', 'varrock-center', 'lumber-yard']);

    expect(QUEST_DATA['The Enchanted Key']).toMatchObject({
      accessPolicy: 'regions',
      regions: ['Fremennik', 'Kandarin', 'Tirannwn', 'Asgarnia', 'Misthalin', 'Kharidian Desert'],
      skills: {}, prereqs: ['Making History'],
    });
    expect(QUEST_DATA['Enter the Abyss']).toMatchObject({
      accessPolicy: 'regions', regions: ['Misthalin', 'Wilderness'],
      skills: {}, prereqs: ['Rune Mysteries'],
    });

    expect(QUEST_DATA['Family Pest']).toMatchObject({
      accessPolicy: 'locations',
      regions: ['Misthalin', 'Kharidian Desert', 'Kandarin'],
      skills: {}, prereqs: ['Family Crest'],
    });
    expect(QUEST_DATA['Family Pest'].locations?.map(location => location.id))
      .toEqual(['east-varrock-gate', 'al-kharid-mine', 'east-catherby', 'lumber-yard']);

    expect(QUEST_DATA["The General's Shadow"]).toMatchObject({
      accessPolicy: 'regions',
      regions: ['Fremennik', 'Kandarin', 'Karamja', 'Asgarnia', 'Kharidian Desert'],
      skills: {}, prereqs: ['Fight Arena', 'Curse of the Empty Lord'],
    });
    expect(QUEST_DATA['His Faithful Servants']).toMatchObject({
      accessPolicy: 'locations', regions: ['Morytania'],
      skills: {}, prereqs: ['Priest in Peril'],
    });
    expect(QUEST_DATA['His Faithful Servants'].locations?.map(location => location.id))
      .toEqual(['barrows']);

    expect(QUEST_DATA["Hopespear's Will"]).toMatchObject({
      accessPolicy: 'regions', regions: ['Kandarin'], skills: { Prayer: 50 },
      prereqs: ['Desert Treasure I', 'Fairytale II - Cure a Queen', 'Land of the Goblins'],
      manualRequirements: ['Started The Restless Ghost'],
    });
    expect(QUEST_DATA['In Search of Knowledge']).toMatchObject({
      accessPolicy: 'regions', regions: ['Kourend & Kebos'], skills: {}, prereqs: [],
    });

    expect(QUEST_DATA['Into the Tombs']).toMatchObject({
      accessPolicy: 'locations', regions: ['Kharidian Desert'],
      skills: {}, prereqs: ['Beneath Cursed Sands'],
    });
    expect(QUEST_DATA['Into the Tombs'].locations?.map(location => location.id))
      .toEqual(['necropolis-main-temple']);
    expect(QUEST_DATA['Lair of Tarn Razorlor']).toMatchObject({
      accessPolicy: 'locations', regions: ['Morytania'],
      skills: { Slayer: 40 }, prereqs: ['Haunted Mine'],
    });
    expect(QUEST_DATA['Lair of Tarn Razorlor'].locations?.map(location => location.id))
      .toEqual(['abandoned-mine']);

    expect(QUEST_DATA['Mage Arena II']).toMatchObject({
      accessPolicy: 'regions', regions: ['Wilderness'],
      skills: { Magic: 75 }, prereqs: ['Mage Arena I'],
      manualRequirements: [
        'Cast Claws of Guthix, Flames of Zamorak, and Saradomin Strike 100 times each inside the Mage Arena',
      ],
    });
    expect(QUEST_DATA['Skippy and the Mogres']).toMatchObject({
      accessPolicy: 'locations', regions: ['Asgarnia'], skills: { Cooking: 20 }, prereqs: [],
    });
    expect(QUEST_DATA['Skippy and the Mogres'].locations?.map(location => location.id))
      .toEqual(['skippys-camp']);
    const locationChunks = (id: string) => QUEST_DATA[id].locations?.map(location =>
      location.chunkOptions.map(({ cx, cy }) => `${cx},${cy}`));
    expect(locationChunks("Alfred Grimhand's Barcrawl")).toEqual([
      ['39,55'], ['50,53'], ['38,54'], ['43,49'], ['39,48'], ['40,51'],
      ['42,54'], ['51,54'], ['45,49'], ['46,52'], ['47,50'],
    ]);
    expect(locationChunks("Daddy's Home")).toEqual([['50,54'], ['50,53'], ['51,54']]);
    expect(locationChunks('Family Pest')).toEqual([
      ['51,53'], ['51,51'], ['44,53'], ['51,54'],
    ]);
    expect(locationChunks('His Faithful Servants')).toEqual([['55,51']]);
    expect(locationChunks('Into the Tombs')).toEqual([['52,42']]);
    expect(locationChunks('Lair of Tarn Razorlor')).toEqual([['53,50']]);
    expect(locationChunks('Skippy and the Mogres')).toEqual([['46,49']]);
    expect(QUEST_DATA['Vale Totems']).toMatchObject({
      accessPolicy: 'regions', regions: ['Varlamore'],
      skills: { Fletching: 20 }, prereqs: ['Children of the Sun'],
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
