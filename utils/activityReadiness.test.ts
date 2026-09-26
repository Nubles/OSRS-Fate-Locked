import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../types';
import { getActivityReq } from '../data/activityRequirements';
import { SKILLS_LIST } from '../data/items';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { evaluateActivityReadiness } from './activityReadiness';
import { evaluateDiaryTaskEligibility } from './journalStatus';

const unlocked = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [],
  arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
  guilds: [], farming: [], slayerUnlocks: [], banks: [], quests: [], diaries: [],
  cas: [], completedTasks: [], collectionLog: {}, ...over,
});

const combatReady = {
  skills: { Attack: 1, Strength: 1, Defence: 1, Hitpoints: 1, Prayer: 1 },
  levels: { Attack: 40, Strength: 40, Defence: 40, Hitpoints: 40, Prayer: 40 },
};

describe('evaluateActivityReadiness', () => {
  it('blocks The Mad Angel until Wyrmscraig and Fallen From Grace are present', () => {
    const req = getActivityReq('The Mad Angel');
    expect(evaluateActivityReadiness(true, req, unlocked())).toEqual({
      status: 'NOT_READY',
      blockers: [
        { kind: 'area', label: 'Wyrmscraig' },
        { kind: 'quest', label: 'Fallen From Grace' },
      ],
    });
    expect(evaluateActivityReadiness(true, req, unlocked({ regions: ['Wyrmscraig'] }))).toEqual({
      status: 'NOT_READY',
      blockers: [{ kind: 'quest', label: 'Fallen From Grace' }],
    });
    expect(evaluateActivityReadiness(true, req, unlocked({ quests: ['Fallen From Grace'] }))).toEqual({
      status: 'NOT_READY',
      blockers: [{ kind: 'area', label: 'Wyrmscraig' }],
    });
    expect(evaluateActivityReadiness(true, req, unlocked({
      regions: ['Wyrmscraig'],
      quests: ['Fallen From Grace'],
    }))).toEqual({ status: 'READY' });
  });

  it('evaluates ownership before all other requirements', () => {
    expect(evaluateActivityReadiness(
      false,
      { requiredAreas: ["Void Knights' Outpost"], combatLevel: 40 },
      unlocked(),
    )).toEqual({ status: 'LOCKED', blockers: [] });
  });

  it('separates Pest Control ownership from usable access', () => {
    const req = getActivityReq('Pest Control');
    expect(evaluateActivityReadiness(
      true,
      req,
      unlocked({ regions: ["Void Knights' Outpost"] }),
    )).toEqual({
      status: 'NOT_READY',
      blockers: [{ kind: 'combat', label: 'Combat level 40' }],
    });
    expect(evaluateActivityReadiness(
      true,
      req,
      unlocked(combatReady),
    )).toEqual({
      status: 'NOT_READY',
      blockers: [{ kind: 'area', label: "Void Knights' Outpost" }],
    });
    expect(evaluateActivityReadiness(
      true,
      req,
      unlocked({
        ...combatReady,
        regions: ["Void Knights' Outpost"],
      }),
    )).toEqual({ status: 'READY' });
  });

  it('uses the same area rule in chunked mode', () => {
    const req = getActivityReq('Barbarian Assault');
    expect(evaluateActivityReadiness(
      true,
      req,
      unlocked({ chunks: ['39,55'] }),
      'chunked',
    )).toEqual({ status: 'READY' });
  });

  it('enforces Soul Wars combat 40, total level 500, and tutorial confirmation', () => {
    const req = getActivityReq('Soul Wars');

    expect(evaluateActivityReadiness(true, req, unlocked())).toEqual({
      status: 'NOT_READY',
      blockers: [
        { kind: 'area', label: 'Isle of Souls' },
        { kind: 'combat', label: 'Combat level 40' },
        { kind: 'total', label: 'Total level 500' },
      ],
    });
    expect(evaluateActivityReadiness(
      true,
      req,
      unlocked({ ...combatReady, regions: ['Isle of Souls'] }),
    )).toEqual({
      status: 'NOT_READY',
      blockers: [{ kind: 'total', label: 'Total level 500' }],
    });

    const readyLevels = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 40]));
    const readySkills = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 1]));
    expect(evaluateActivityReadiness(
      true,
      req,
      unlocked({
        skills: readySkills,
        levels: readyLevels,
        regions: ['Isle of Souls'],
      }),
    )).toEqual({
      status: 'NEEDS_CONFIRMATION',
      checks: ['Completed the Soul Wars tutorial once'],
    });
  });

  it('enforces Bounty Hunter combat, location, and account-time confirmation', () => {
    const req = getActivityReq('Bounty Hunter');

    expect(evaluateActivityReadiness(true, req, unlocked({
      regions: ['Ferox Enclave'],
    }))).toEqual({
      status: 'NOT_READY',
      blockers: [{ kind: 'combat', label: 'Combat level 32' }],
    });
    expect(evaluateActivityReadiness(true, req, unlocked(combatReady))).toEqual({
      status: 'NOT_READY',
      blockers: [{ kind: 'area', label: 'Ferox Enclave' }],
    });
    expect(evaluateActivityReadiness(true, req, unlocked({
      ...combatReady,
      regions: ['Ferox Enclave'],
    }))).toEqual({
      status: 'NEEDS_CONFIRMATION',
      checks: ['At least 12 hours of account play time'],
    });
  });

  it('uses the canonical activity-access areas as alternative readiness routes', () => {
    expect(evaluateActivityReadiness(
      true,
      getActivityReq('Giant Mole'),
      unlocked(),
      'vanilla',
    )).toEqual({
      status: 'NOT_READY',
      blockers: [{ kind: 'area', label: 'Falador' }],
    });

    const templeTrekking = getActivityReq('Temple Trekking');
    expect(evaluateActivityReadiness(
      true,
      templeTrekking,
      unlocked({
        regions: ['Paterdomus'],
        quests: ['In Aid of the Myreque'],
      }),
      'vanilla',
    )).toEqual({ status: 'READY' });
  });

  it('returns manual checks only after machine gates pass', () => {
    const req = getActivityReq('Nex');
    expect(evaluateActivityReadiness(
      true,
      req,
      unlocked(),
    ).status).toBe('NOT_READY');
    expect(evaluateActivityReadiness(true, req, unlocked({
      skills: { Strength: 7, Agility: 7, Ranged: 7, Hitpoints: 7 },
      levels: { Strength: 70, Agility: 70, Ranged: 70, Hitpoints: 70 },
    }))).toMatchObject({
      status: 'NEEDS_CONFIRMATION',
      checks: expect.arrayContaining([expect.stringContaining('Frozen Door')]),
    });
  });

  it('orders area, quest, skill, and combat blockers before manual checks', () => {
    expect(evaluateActivityReadiness(
      true,
      {
        requiredAreas: ['Port Khazard'],
        quests: ['Cabin Fever'],
        skills: { Fishing: 15 },
        combatLevel: 40,
        manualRequirements: ['Confirm a key', 'Confirm a key'],
      },
      unlocked(),
    )).toEqual({
      status: 'NOT_READY',
      blockers: [
        { kind: 'area', label: 'Port Khazard' },
        { kind: 'quest', label: 'Cabin Fever' },
        { kind: 'skill', label: 'Fishing 15' },
        { kind: 'combat', label: 'Combat level 40' },
      ],
    });
  });

  it("gates Warriors' Guild entry on tier-capped levels, as its diary task does", () => {
    const task = ALL_DIARY_TASKS.find(candidate => candidate.id === 'fal_hard_10')!;
    const profile = (skills: Record<string, number>, levels: Record<string, number>) =>
      unlocked({ regions: ["Warriors' Guild"], skills, levels });
    const cases = [
      // Raw 70 + 60 is 130, but tier 5 caps both at 50.
      profile({ Attack: 5, Strength: 5 }, { Attack: 70, Strength: 60 }),
      profile({ Attack: 7, Strength: 6 }, { Attack: 70, Strength: 60 }),
      // Raw 99 Attack capped at 90 by tier 9.
      profile({ Attack: 9, Strength: 1 }, { Attack: 99, Strength: 1 }),
      profile({ Attack: 10, Strength: 1 }, { Attack: 99, Strength: 1 }),
      // A locked skill counts for nothing.
      profile({ Strength: 10 }, { Attack: 99, Strength: 40 }),
    ];

    expect(evaluateActivityReadiness(true, getActivityReq("Warriors' Guild"), cases[0], 'vanilla')).toEqual({
      status: 'NOT_READY',
      blockers: [{ kind: 'skill', label: '99 Attack or Strength, or 130 combined' }],
    });
    expect(cases.map(unlocks => evaluateActivityReadiness(true, getActivityReq("Warriors' Guild"), unlocks, 'vanilla').status))
      .toEqual(['NOT_READY', 'READY', 'NOT_READY', 'READY', 'NOT_READY']);
    for (const unlocks of cases) {
      expect(evaluateActivityReadiness(true, getActivityReq("Warriors' Guild"), unlocks, 'vanilla').status === 'READY')
        .toBe(evaluateDiaryTaskEligibility(task, unlocks, 'vanilla').eligible);
    }
  });

  it('deduplicates manual checks once machine gates are met', () => {
    expect(evaluateActivityReadiness(
      true,
      { manualRequirements: ['Confirm a key', 'Confirm a key'] },
      unlocked(),
    )).toEqual({
      status: 'NEEDS_CONFIRMATION',
      checks: ['Confirm a key'],
    });
  });

  it('needs Druidic Ritual for Mastering Mixology and Pandemonium for the Barracuda Trials', () => {
    // Their data lists only Herblore 60 and Sailing 30; the skills need the quests.
    const mixology = unlocked({ regions: ['Aldarin'], skills: { Herblore: 6 }, levels: { Herblore: 60 } });
    expect(evaluateActivityReadiness(true, getActivityReq('Mastering Mixology'), mixology, 'vanilla')).toEqual({
      status: 'NOT_READY', blockers: [{ kind: 'quest', label: 'Druidic Ritual' }],
    });
    expect(evaluateActivityReadiness(true, getActivityReq('Mastering Mixology'), {
      ...mixology, quests: ['Druidic Ritual'],
    }, 'vanilla')).toEqual({ status: 'READY' });

    const trials = unlocked({ skills: { Sailing: 3 }, levels: { Sailing: 30 } });
    expect(evaluateActivityReadiness(true, getActivityReq('Barracuda Trials'), trials, 'vanilla')).toEqual({
      status: 'NOT_READY', blockers: [{ kind: 'quest', label: 'Pandemonium' }],
    });
    expect(evaluateActivityReadiness(true, getActivityReq('Barracuda Trials'), {
      ...trials, quests: ['Pandemonium'],
    }, 'vanilla')).toEqual({ status: 'READY' });
  });
});
