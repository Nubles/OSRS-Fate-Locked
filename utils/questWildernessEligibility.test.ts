import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import type { UnlockState } from '../types';
import { setStartArea } from './freeAreas';
import { questCompletionDecision } from './journalCompletion';
import { evaluateQuestEligibility } from './journalStatus';
import { selectQuestGeography } from './questGeographyDisplay';

const unlocked = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [],
  arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
  guilds: [], farming: [], slayerUnlocks: [], banks: [], quests: [], diaries: [],
  cas: [], completedTasks: [], collectionLog: {},
  ...overrides,
});

describe('quest Wilderness access', () => {
  beforeEach(() => setStartArea('misthalin'));
  afterEach(() => setStartArea(undefined));

  it('allows Enter the Abyss from the default Misthalin area without a Wilderness unlock', () => {
    const result = evaluateQuestEligibility(QUEST_DATA['Enter the Abyss'], unlocked({
      quests: ['Rune Mysteries'],
      regions: ['East Ardougne'],
    }), 'vanilla');

    expect(result).toMatchObject({
      status: 'AVAILABLE',
      machineEligible: true,
      eligible: true,
      blockers: [],
    });
    expect(result.evidence).toEqual(expect.arrayContaining([
      'Edgeville ditch', 'Varrock south gate', 'Rune Mysteries',
    ]));
    expect(result.evidence).not.toContain('Wilderness');

    const display = selectQuestGeography(QUEST_DATA['Enter the Abyss'], []);
    expect(display.regions).toEqual([]);
    expect(display.locations.map(location => location.id)).toEqual([
      'edgeville-ditch', 'varrock-south-gate',
    ]);
    expect(questCompletionDecision(
      QUEST_DATA['Enter the Abyss'],
      unlocked({ quests: ['Rune Mysteries'], regions: ['East Ardougne'] }),
      'vanilla',
    )).toEqual({ ok: true });
  });

  it('requires both pinned Enter the Abyss chunks in Chunked mode', () => {
    const base = {
      quests: ['Rune Mysteries'],
      guilds: ["Wizards' Guild"],
    };

    expect(evaluateQuestEligibility(QUEST_DATA['Enter the Abyss'], unlocked({
      ...base, chunks: ['48,55'],
    }), 'chunked').blockers).toContainEqual({
      kind: 'region', label: 'Varrock south gate',
    });
    expect(evaluateQuestEligibility(QUEST_DATA['Enter the Abyss'], unlocked({
      ...base, chunks: ['48,55', '50,52'],
    }), 'chunked').status).toBe('AVAILABLE');
  });

  it('uses the actual Wilderness leaf area for every fixed-route quest', () => {
    expect(QUEST_DATA["Heroes' Quest"]).toMatchObject({
      accessPolicy: 'regions-and-locations',
      locations: [{ id: 'lava-maze-entrance', standardAreas: ['Lava Maze'] }],
    });
    expect(QUEST_DATA['Devious Minds']).toMatchObject({
      accessPolicy: 'regions-and-locations',
      locations: [{ id: 'edgeville-ditch', standardAreas: ['Edgeville'] }],
    });
    expect(QUEST_DATA['Mage Arena I'].regions).toEqual(['Mage Arena']);
    expect(QUEST_DATA['Mage Arena II'].regions).toEqual(['Mage Arena']);
    expect(QUEST_DATA['Mage Arena II'].manualRequirements).toContain(
      'Access to all three assigned demonic follower locations in the Wilderness',
    );
  });

  it.each([
    ['sequence 1', ['Wilderness Agility Course', 'Chaos Temple', "Rogues' Castle"]],
    ['sequence 2', ['Wilderness Bandit Camp', 'Graveyard of Shadows', 'Slayer Tower']],
    ['sequence 3', ['Bandit Camp', 'Lava Maze']],
  ])('allows Curse of the Empty Lord through %s without the full Wilderness', (_name, route) => {
    const result = evaluateQuestEligibility(QUEST_DATA['Curse of the Empty Lord'], unlocked({
      regions: ['Asgarnia', 'Kandarin', ...route],
      skills: { Thieving: 6 },
      levels: { Thieving: 53 },
    }), 'vanilla');

    expect(result.machineEligible).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.manualChecks).toEqual([
      'Started Desert Treasure I', 'Started The Restless Ghost',
    ]);
  });

  it('contains no machine-enforced parent Wilderness quest gate', () => {
    const offenders = Object.values(QUEST_DATA).flatMap(quest => {
      const baseRegions = quest.accessPolicy === 'locations' ? [] : quest.regions;
      const alternativeRegions = quest.oneOf?.flatMap(option => option.regions ?? []) ?? [];
      return [...baseRegions, ...alternativeRegions].includes('Wilderness')
        ? [quest.id]
        : [];
    });

    expect(offenders).toEqual([]);
    expect(QUEST_DATA['The Slug Menace'].manualRequirements?.join(' '))
      .not.toContain('with Wilderness');
  });
});
