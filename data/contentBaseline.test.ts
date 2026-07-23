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
import { rankAvailableQuests } from '../utils/questAdvisor';
import { planForTarget } from '../utils/goalPlanner';
import { questCompletionDecision } from '../utils/journalCompletion';

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
