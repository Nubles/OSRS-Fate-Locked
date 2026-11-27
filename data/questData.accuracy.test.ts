import { describe, expect, it } from 'vitest';
import { DropSource } from '../types';
import { QUEST_DATA } from './questData';
import * as questDataModule from './questData';
import chunkDoc from '../public/chunk-content.json';

describe('audited current quest requirements', () => {
  it("puts A Ruff Situation's Outlaw Camp fight in 48,54, not the Grand Exchange chunk", () => {
    // OSRS Wiki 'Outlaw Camp' (rev 15394973): map x=3123 y=3472 r=6, all inside chunk 48,54.
    expect(QUEST_DATA['A Ruff Situation'].locations?.find(location => location.id === 'outlaw-camp'))
      .toMatchObject({ standardAreas: ['Edgeville'], chunkOptions: [{ cx: 48, cy: 54 }] });
    const chunks = chunkDoc.chunks as Record<string, { q?: Record<string, string> }>;
    expect(chunks['12342'].q?.['A Ruff Situation']).toBe('step');
    expect(chunks['12598'].q?.['A Ruff Situation']).toBeUndefined();
  });

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

describe('18 November 2026 quests (OSRS Wiki, 22 Nov revisions)', () => {
  it('lists A New Leaf with its quest points, difficulty and requirements', () => {
    expect(QUEST_DATA['A New Leaf']).toMatchObject({
      kind: 'quest', points: 2, difficulty: DropSource.QUEST_INTERMEDIATE,
      skills: { Farming: 45, Cooking: 35, Herblore: 32 }, prereqs: ['Priest in Peril'],
      manualRequirements: ['Completed at least one farming contract'],
      oneOf: [{ guilds: ['Farming Guild'], regions: ['Farming Guild'] }],
    });
    expect(QUEST_DATA['A New Leaf'].series).toBeUndefined();
    expect(QUEST_DATA['A New Leaf'].locations?.[0]).toMatchObject({ id: 'hosidius-cabbage-field', chunkOptions: [{ cx: 27, cy: 55 }] });
  });

  it('lists Rag and Bone Man III as the third of its series, started in Silvarea', () => {
    expect(QUEST_DATA['Rag and Bone Man III']).toMatchObject({
      kind: 'quest', points: 3, difficulty: DropSource.QUEST_EXPERIENCED, series: 'Rag and Bone Man',
      skills: { Slayer: 58 },
      prereqs: ['Rag and Bone Man II', 'Dragon Slayer I', 'The Great Brain Robbery', 'Defender of Varrock', 'Tower of Life', "A Soul's Bane"],
      locations: [expect.objectContaining({ standardAreas: ['Silvarea'], chunkOptions: [{ cx: 52, cy: 54 }] })],
    });
    expect(QUEST_DATA['Rag and Bone Man III'].equipmentRequirements?.map(requirement => requirement.slot)).toEqual(['Head', 'Weapon']);
  });

});

describe('25 November 2026 quest update', () => {
  it('tracks The Graveyard with its required levels, quests and starting chunk', () => {
    const quest = QUEST_DATA['The Graveyard'];
    expect(quest).toMatchObject({
      kind: 'quest', points: 3, difficulty: DropSource.QUEST_MASTER, series: 'Fremennik',
      skills: { Sailing: 65, Agility: 65, Woodcutting: 56, Fletching: 54 },
      prereqs: ["Olaf's Quest", 'The Fremennik Exiles', 'Pandemonium'],
    });
    expect(quest.locations?.[0].chunkOptions).toEqual([{ cx: 42, cy: 58 }]);
    expect(quest.combatLevel).toBeUndefined();
  });

  it('adds up to the Wiki total of 357 quest points', () => {
    expect(Object.values(QUEST_DATA).reduce((total, quest) => total + quest.points, 0)).toBe(357);
  });
});

describe('quest series', () => {
  it('tags all three Twisted Tales quests, as the Wiki infoboxes do', () => {
    expect(Object.values(QUEST_DATA)
      .filter(quest => quest.series === 'Twisted Tales')
      .map(quest => quest.id)
      .sort())
      .toEqual(['Getting Ahead', 'The Garden of Death', "The Writing's on the Wall"]);
  });

  it('spells the Fairytale series as the Wiki does', () => {
    expect(Object.values(QUEST_DATA)
      .filter(quest => quest.series === 'Fairytale')
      .map(quest => quest.id)
      .sort())
      .toEqual(['Fairytale I - Growing Pains', 'Fairytale II - Cure a Queen']);
    expect(Object.values(QUEST_DATA).some(quest => quest.series === 'Fairy Tale')).toBe(false);
  });

  it('gives no series to the related story quests the Wiki lists as series = None', () => {
    // Wiki infoboxes (Nov 2026): Cook's Assistant, Waterfall Quest, Priest in Peril and
    // Nature Spirit are standalone quests, only named as lead-ins on Quests/Series.
    for (const id of ["Cook's Assistant", 'Waterfall Quest', 'Priest in Peril', 'Nature Spirit']) {
      expect(QUEST_DATA[id].series, id).toBeUndefined();
    }
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
