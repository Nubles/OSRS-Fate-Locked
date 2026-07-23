import { describe, expect, it } from 'vitest';
import { SKILLS_LIST } from '../constants';
import { questLogEligibility } from '../components/QuestLog';
import {
  journalNextBestQuestAction, selectJournalNextBestActions,
} from '../components/JournalNextBest';
import { QUEST_DATA } from './questData';
import { DIARY_DATA } from './diaryData';
import { ALL_DIARY_TASKS } from './diaryTasks';
import { ALL_CA_TASKS } from './caTasks';
import { CA_DATA } from './caData';
import { LATEST_CHANGELOG } from './changelog';
import diarySource from './sources/achievement-diary-tasks.json';
import caSource from './sources/combat-achievement-tasks.json';
import legacyDiaryIds from './sources/achievement-diary-legacy-ids.json';
import { rankAvailableQuests } from '../utils/questAdvisor';
import { planForTarget } from '../utils/goalPlanner';
import { questCompletionDecision } from '../utils/journalCompletion';
import { CA_TASK_POINTS, CA_TIER_ORDER } from '../utils/caProgress';
import { DIARY_TASK_ID_MIGRATIONS } from '../utils/taskIdMigrations';

const maxedChunkedUnlocks = (chunks: string[]) => ({
  equipment: {},
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: [],
  chunks,
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
});

const porcineOnlyUnlocks = (chunks: string[]) => ({
  ...maxedChunkedUnlocks(chunks),
  quests: Object.keys(QUEST_DATA).filter(id => id !== 'A Porcine of Interest'),
  diaries: Object.keys(DIARY_DATA),
});

const questRequirementFields = (id: string) => {
  const quest = QUEST_DATA[id];
  return {
    regions: quest.regions,
    locations: quest.locations?.map(location => location.id),
    skills: quest.skills,
    combatLevel: quest.combatLevel,
    prereqs: quest.prereqs,
    oneOf: quest.oneOf,
    manualRequirements: quest.manualRequirements,
  };
};

describe('cross-surface quest eligibility contract', () => {
  it.each([
    {
      expected: 'LOCKED_REGION',
      unlocks: porcineOnlyUnlocks(['46,51', '48,50']),
      blocker: 'South Falador Farm',
    },
    {
      expected: 'AVAILABLE',
      unlocks: porcineOnlyUnlocks(['46,51', '48,50', '47,51']),
      blocker: undefined,
    },
  ] as const)(
    'keeps A Porcine of Interest $expected across every Journal surface',
    ({ expected, unlocks, blocker }) => {
      const quest = QUEST_DATA['A Porcine of Interest'];
      const advisorAvailable = rankAvailableQuests(unlocks, 'chunked')
        .some(candidate => candidate.id === quest.id);
      const plan = planForTarget('quest', quest.id, unlocks, 'chunked')!;
      const nextBest = journalNextBestQuestAction(quest, unlocks, 'chunked')!;
      const selectedActions = selectJournalNextBestActions(unlocks, 'chunked');
      const selected = selectedActions.find(action => action.id === quest.id)!;
      const completion = questCompletionDecision(quest, unlocks, 'chunked');

      const statuses = [
        questLogEligibility(quest, unlocks, 'chunked').status,
        advisorAvailable ? 'AVAILABLE' : 'LOCKED_REGION',
        plan.alreadyReachable ? 'AVAILABLE' : 'LOCKED_REGION',
        selected.unmet === 0 ? 'AVAILABLE' : 'LOCKED_REGION',
        completion.ok ? 'AVAILABLE' : 'LOCKED_REGION',
      ];

      expect(statuses).toEqual(Array(5).fill(expected));
      expect(selectedActions).toEqual([nextBest]);
      expect(selected.firstBlocker).toBe(blocker);
      expect(plan.regionSteps.map(step => step.label)).toEqual(
        blocker ? [blocker] : [],
      );
    },
  );
});

describe('deterministic current content baseline', () => {
  it('pins audited quest requirement fields with exact equality', () => {
    expect(questRequirementFields('A Porcine of Interest')).toEqual({
      regions: ['Misthalin'],
      locations: ['draynor-village', 'south-falador-farm'],
      skills: { Slayer: 1 },
      combatLevel: undefined,
      prereqs: [],
      oneOf: undefined,
      manualRequirements: undefined,
    });
    expect(questRequirementFields('Dream Mentor')).toEqual({
      regions: ['Fremennik'], locations: undefined, skills: {}, combatLevel: 85,
      prereqs: ['Lunar Diplomacy', "Eadgar's Ruse"], oneOf: undefined,
      manualRequirements: undefined,
    });
    expect(questRequirementFields('Ethically Acquired Antiquities')).toEqual({
      regions: ['Varlamore'],
      locations: ['civitas-illa-fortis', 'port-sarim', 'varrock-museum'],
      skills: { Thieving: 25 }, combatLevel: undefined,
      prereqs: ['Children of the Sun', 'Shield of Arrav'], oneOf: undefined,
      manualRequirements: undefined,
    });
    expect(questRequirementFields('The Curse of Arrav')).toEqual({
      regions: ['Misthalin'], locations: undefined,
      skills: {
        Agility: 61, Ranged: 62, Strength: 58, Thieving: 62, Mining: 64,
        Slayer: 37,
      },
      combatLevel: undefined, prereqs: ['Defender of Varrock', 'Troll Romance'],
      oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('The Final Dawn')).toEqual({
      regions: ['Varlamore'], locations: undefined,
      skills: { Thieving: 66, Fletching: 52, Runecraft: 52 },
      combatLevel: undefined, prereqs: ['The Heart of Darkness', 'Perilous Moons'],
      oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('Shadows of Custodia')).toEqual({
      regions: ['Varlamore'], locations: undefined,
      skills: { Slayer: 54, Fishing: 45, Construction: 41, Hunter: 36 },
      combatLevel: undefined, prereqs: ['Children of the Sun'],
      oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('Scrambled!')).toEqual({
      regions: ['Varlamore'], locations: undefined,
      skills: { Construction: 38, Cooking: 36, Smithing: 35 },
      combatLevel: undefined, prereqs: ['Children of the Sun'],
      oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('Pandemonium')).toEqual({
      regions: [], locations: ['port-sarim'], skills: {}, combatLevel: undefined,
      prereqs: [], oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('Prying Times')).toEqual({
      regions: ['The Open Seas'], locations: undefined,
      skills: { Smithing: 30, Sailing: 12 }, combatLevel: undefined,
      prereqs: ['Pandemonium', "The Knight's Sword"], oneOf: undefined,
      manualRequirements: ['One open Sailing task slot'],
    });
    expect(questRequirementFields('Current Affairs')).toEqual({
      regions: ['The Open Seas'], locations: undefined,
      skills: { Sailing: 22, Fishing: 10 }, combatLevel: undefined,
      prereqs: ['Pandemonium'], oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('Troubled Tortugans')).toEqual({
      regions: ['The Open Seas'], locations: undefined,
      skills: {
        Slayer: 51, Construction: 48, Sailing: 45, Hunter: 45,
        Woodcutting: 40, Crafting: 34,
      },
      combatLevel: undefined, prereqs: ['Pandemonium'], oneOf: undefined,
      manualRequirements: undefined,
    });
  });

  it('pins 492 Diaries to the reviewed official source revision', () => {
    expect(ALL_DIARY_TASKS).toHaveLength(492);
    expect(new Set(ALL_DIARY_TASKS.map(task => task.id)).size).toBe(492);
    expect(diarySource).toMatchObject({
      verifiedAt: '2026-07-23',
      source: {
        url: 'https://oldschool.runescape.wiki/w/Achievement_Diary/All_achievements',
        revision: 15263582,
        revisionTimestamp: '2026-07-14T22:14:59Z',
        officialRows: 492,
      },
    });
    expect(diarySource.source.supportingPages).toHaveLength(12);
    expect(diarySource.source.supportingPages.every(page =>
      page.url.startsWith('https://oldschool.runescape.wiki/w/') &&
      page.revision > 0 &&
      /^2026-/.test(page.revisionTimestamp),
    )).toBe(true);
    expect(diarySource.tasks).toHaveLength(492);
  });

  it('describes only the game-data and save-integrity work that has landed', () => {
    const wording = Object.values(LATEST_CHANGELOG.sections)
      .flatMap(lines => lines ?? [])
      .join(' ');

    expect(wording).toContain('Draynor Village and South Falador Farm');
    expect(wording).toContain('Recent quest skill, combat, prerequisite, and access requirements were refreshed');
    expect(wording).toContain('492 current tasks');
    expect(wording).toContain('646 current tasks, including the Maggot King');
    expect(wording).toContain('cumulative points');
    expect(wording).toContain('Exports now capture the run currently visible on screen.');
    expect(wording).toContain('Malformed or oversized imports and backups are now rejected without overwriting progress.');
    expect(wording).toContain('File imports, sync-code imports, and backup restores now report their real outcomes.');
    expect(wording).toContain('Deleting a profile now also clears its local backups and profile-specific settings.');
    expect(wording).not.toMatch(/plugin|relay|balance/i);
  });

  it('pins 646 Combat Achievements, tier counts, thresholds, and provenance', () => {
    const tiers = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'] as const;
    expect(ALL_CA_TASKS).toHaveLength(646);
    expect(Object.fromEntries(tiers.map(tier => [
      tier,
      ALL_CA_TASKS.filter(task => task.tierId === tier).length,
    ]))).toEqual({
      Easy: 41,
      Medium: 60,
      Hard: 86,
      Elite: 164,
      Master: 174,
      Grandmaster: 121,
    });
    expect(tiers.map(tier => CA_DATA[tier].pointsRequired))
      .toEqual([41, 161, 419, 1075, 1945, 2671]);
    expect(caSource).toMatchObject({
      verifiedAt: '2026-07-23',
      source: {
        url: 'https://oldschool.runescape.wiki/w/Combat_Achievements',
        revision: 15272408,
        revisionTimestamp: '2026-07-22T17:11:33Z',
        officialRows: 646,
        authoritativeGlobals: {
          counts: {
            Easy: 41,
            Medium: 60,
            Hard: 86,
            Elite: 164,
            Master: 174,
            Grandmaster: 121,
          },
          thresholds: [41, 161, 419, 1075, 1945, 2671],
        },
      },
    });
    expect(caSource.source.tierSources).toHaveLength(6);
    expect(caSource.source.tierSources.reduce(
      (total, source) => total + source.officialRows,
      0,
    )).toBe(646);
    expect(caSource.source.tierSources.every(source =>
      source.url.startsWith('https://oldschool.runescape.wiki/w/') &&
      source.revision > 0 &&
      /^202[5-6]-/.test(source.revisionTimestamp),
    )).toBe(true);
    expect(caSource.tasks).toHaveLength(646);
  });
});

describe('independent generated-content contract', () => {
  it('classifies every historical Diary id exactly once', () => {
    const historicalIds = [
      ...diarySource.tasks
        .filter(task => task.classification === 'preserved-exact'
          || task.classification === 'preserved-semantic')
        .map(task => task.id),
      ...diarySource.tasks
        .filter(task => task.classification === 'renamed-or-replaced')
        .flatMap(task => task.aliases),
      ...diarySource.retired.map(task => task.id),
    ];

    expect(diarySource.classification).toEqual({
      existingRows: 485,
      preservedIds: 471,
      renamedOrReplacedAliases: 0,
      retiredExistingIds: 14,
      newCanonicalIds: 21,
      unresolvedExistingRows: 0,
      unresolvedDuplicateIds: 0,
      unknownReferences: 0,
      combatLevelRequirementsRecordedOnly: 9,
    });
    expect(historicalIds).toHaveLength(485);
    expect(new Set(historicalIds).size).toBe(485);
    expect([...historicalIds].sort()).toEqual([...legacyDiaryIds.ids].sort());
    expect(legacyDiaryIds.source).toEqual({
      description: 'Exact Achievement Diary task IDs before the 492-task refresh.',
      commit: 'fe4654ffef34700422480c4e41c9a50a4dc92b55',
      file: 'data/diaryTasks.ts',
      rowCount: 485,
    });
  });

  it('keeps every reviewed Diary id and tier ordinal aligned with generated data', () => {
    const sourceIds = diarySource.tasks.map(task => task.id);
    const generatedIds = ALL_DIARY_TASKS.map(task => task.id);
    const tierOrdinals = diarySource.tasks.map(task => task.tierId + '|' + task.ordinal);

    expect(sourceIds).toHaveLength(492);
    expect(new Set(sourceIds).size).toBe(492);
    expect(new Set(tierOrdinals).size).toBe(492);
    expect([...generatedIds].sort()).toEqual([...sourceIds].sort());
    expect(diarySource.tasks.every(task => Object.hasOwn(DIARY_DATA, task.tierId))).toBe(true);
  });

  it('keeps every Diary migration source-supported with a current target', () => {
    const expectedMigrations = diarySource.tasks.flatMap(task =>
      task.aliases.map(alias => [alias, task.id] as const));
    const currentIds = new Set(ALL_DIARY_TASKS.map(task => task.id));
    const actualMigrations = Object.entries(DIARY_TASK_ID_MIGRATIONS);

    expect(actualMigrations.sort()).toEqual(expectedMigrations.sort());
    expect(actualMigrations.filter(([, target]) => !currentIds.has(target))).toEqual([]);
    expect(actualMigrations.filter(([source]) => currentIds.has(source))).toEqual([]);
  });

  it('pins official CA point values and the cumulative maximum independently', () => {
    expect(CA_TIER_ORDER).toEqual([
      'Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster',
    ]);
    expect(CA_TASK_POINTS).toEqual({
      Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5, Grandmaster: 6,
    });
    expect(CA_TIER_ORDER.map(tier => CA_DATA[tier].pointsRequired)).toEqual([
      41, 161, 419, 1075, 1945, 2671,
    ]);
    expect(ALL_CA_TASKS.reduce(
      (total, task) => total + CA_TASK_POINTS[task.tierId as keyof typeof CA_TASK_POINTS],
      0,
    )).toBe(2671);
  });

  it('keeps all 646 reviewed CA rows field-for-field aligned with generated data', () => {
    const generatedById = new Map(ALL_CA_TASKS.map(task => [task.id, task]));
    const mismatches = caSource.tasks.flatMap(sourceTask => {
      const generated = generatedById.get(sourceTask.id);
      return generated && JSON.stringify(generated) === JSON.stringify(sourceTask)
        ? []
        : [sourceTask.id];
    });

    expect(caSource.tasks).toHaveLength(646);
    expect(new Set(caSource.tasks.map(task => task.id)).size).toBe(646);
    expect(caSource.tasks.every(task => /^ca_\d+$/.test(task.id))).toBe(true);
    expect(generatedById.size).toBe(646);
    expect(mismatches, 'CA rows whose generated form differs from the snapshot').toEqual([]);
  });

  it('pins the nine Maggot King additions by stable official id', () => {
    const byId = new Map(ALL_CA_TASKS.map(task => [task.id, task]));

    expect(Array.from({ length: 9 }, (_, index) => {
      const task = byId.get('ca_' + (637 + index));
      return [task?.id, task?.tierId, task?.monster, task?.name];
    })).toEqual([
      ['ca_637', 'Hard', 'Maggot King', 'Maggot Squasher'],
      ['ca_638', 'Elite', 'Maggot King', 'Maggot Exterminator'],
      ['ca_639', 'Master', 'Maggot King', 'Camping the King'],
      ['ca_640', 'Master', 'Maggot King', 'Maggot King Speed Chaser'],
      ['ca_641', 'Elite', 'Maggot King', 'Trying to fit in'],
      ['ca_642', 'Master', 'Maggot King', 'King-sized clobbering'],
      ['ca_643', 'Master', 'Maggot King', 'Digging in'],
      ['ca_644', 'Master', 'Maggot King', 'Cordoned Off'],
      ['ca_645', 'Master', 'Maggot King', 'Perfect Maggot King'],
    ]);
  });

  it('pins every reviewed Diary supporting revision', () => {
    expect(diarySource.source.supportingPages.map(page => [
      page.title, page.revision, page.revisionTimestamp,
    ])).toEqual([
      ['Ardougne Diary', 15262389, '2026-07-13T10:58:32Z'],
      ['Desert Diary', 15212994, '2026-05-19T02:22:36Z'],
      ['Falador Diary', 15167531, '2026-04-07T04:42:10Z'],
      ['Fremennik Diary', 15267932, '2026-07-20T02:35:57Z'],
      ['Kandarin Diary', 15261093, '2026-07-11T16:12:48Z'],
      ['Karamja Diary', 15265693, '2026-07-16T23:30:13Z'],
      ['Kourend & Kebos Diary', 15203434, '2026-04-29T08:08:12Z'],
      ['Lumbridge & Draynor Diary', 15233767, '2026-06-15T03:19:28Z'],
      ['Morytania Diary', 15250417, '2026-07-03T17:00:45Z'],
      ['Varrock Diary', 15270202, '2026-07-20T15:17:53Z'],
      ['Western Provinces Diary', 15263014, '2026-07-14T11:17:53Z'],
      ['Wilderness Diary', 15270788, '2026-07-20T23:23:09Z'],
    ]);
  });

  it('pins the authoritative CA query and all six reviewed tier revisions', () => {
    expect(caSource.source).toMatchObject({
      endpoint: 'https://oldschool.runescape.wiki/api.php',
      taskTableQuery: {
        action: 'parse', page: 'Combat Achievements/<tier>', prop: 'text', format: 'json',
      },
      globalsQuery: {
        action: 'parse',
        text: '{{Globals|ca <tier> tasks}} and {{Globals|ca <tier> points}}',
        contentmodel: 'wikitext', prop: 'text', format: 'json',
      },
      retrievedAt: '2026-07-23T19:13:36.119Z',
      overviewDeclaredRows: 637,
    });
    expect(caSource.source.discrepancy).toMatch(/overview.*637.*live.*646.*Maggot King/i);
    expect(caSource.source.tierSources.map(source => [
      source.tier, source.revision, source.revisionTimestamp, source.officialRows,
    ])).toEqual([
      ['Easy', 15272565, '2026-07-22T19:56:56Z', 41],
      ['Medium', 15135540, '2026-02-25T18:48:27Z', 60],
      ['Hard', 15272569, '2026-07-22T19:58:23Z', 86],
      ['Elite', 15272563, '2026-07-22T19:55:28Z', 164],
      ['Master', 15272564, '2026-07-22T19:55:46Z', 174],
      ['Grandmaster', 15025941, '2025-11-13T02:26:22Z', 121],
    ]);
  });
});
