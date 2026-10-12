import { describe, expect, it } from 'vitest';
import { DropSource } from '../types';
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

  it("pins Doric's hut to Falador's northern gate chunk, not Goblin Village", () => {
    expect(QUEST_DATA["Doric's Quest"].locations).toEqual([
      expect.objectContaining({
        id: 'dorics-hut',
        standardAreas: ['Falador'],
        chunkOptions: [{ cx: 46, cy: 53 }],
      }),
    ]);
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
      'draynor-village', 'south-falador-farm', 'sourhog-cave', 'spria',
    ]);
    expect(q.locations?.[1].chunkOptions).toEqual([{ cx: 47, cy: 51 }]);
  });

  it("lists The Fremennik Exiles' Mining 60, as the wiki does", () => {
    expect(QUEST_DATA['The Fremennik Exiles'].skills).toMatchObject({ Mining: 60 });
  });

  it('words the Biohazard priest gown and the Brain Robbery workshop as the wiki has them', () => {
    expect(QUEST_DATA['Biohazard'].equipmentRequirements).toContainEqual(
      { slot: 'Legs', tier: 1, reason: 'Wear the priest gown to see Guidor in Varrock' });
    expect(QUEST_DATA['The Great Brain Robbery'].manualRequirements)
      .toEqual(['Access to a player-owned house workshop and crafting table']);
  });

  it('pins Fallen From Grace to canonical Wyrmscraig access points', () => {
    expect(QUEST_DATA['Fallen From Grace']).toMatchObject({
      kind: 'quest',
      accessPolicy: 'locations',
      regions: ['The Open Seas'],
      skills: { Sailing: 62, Crafting: 60, Runecraft: 47, Mining: 53 },
      prereqs: ['Pandemonium'],
      points: 2,
      difficulty: DropSource.QUEST_EXPERIENCED,
    });
    expect(QUEST_DATA['Fallen From Grace'].locations).toEqual([
      { id: 'auchrie', label: 'Auchrie', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 40, cy: 35 }] },
      { id: 'wyrmscraig-goat-pasture', label: 'Wyrmscraig Goat Pasture', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 40, cy: 34 }] },
      { id: 'ardeaglais', label: 'Ardeaglais', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 39, cy: 34 }] },
    ]);
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
