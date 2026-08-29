import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../types';
import { getActivityReq } from '../data/activityRequirements';
import { SKILLS_LIST } from '../data/items';
import { evaluateActivityReadiness } from './activityReadiness';

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
    )).toEqual({
      status: 'NEEDS_CONFIRMATION',
      checks: ['A complete Frozen key from all four God Wars Dungeon generals'],
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
});
