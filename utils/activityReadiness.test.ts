import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../types';
import { getActivityReq } from '../data/activityRequirements';
import { SKILLS_LIST } from '../data/items';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { evaluateActivityReadiness } from './activityReadiness';
import { evaluateDiaryTaskEligibility } from './journalStatus';
import { bossAreaBlocker } from './caTaskAccess';
import type { AreaRoutes } from './areaRoutes';

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

  it('needs the entrance chunk itself in chunked mode, not any chunk of the area', () => {
    const req = getActivityReq('Giant Mole');
    // 47,52 is Falador, but the mole hills are in 46,52.
    expect(evaluateActivityReadiness(true, req, unlocked({ chunks: ['47,52'] }), 'chunked')).toMatchObject({
      status: 'NOT_READY',
      blockers: [{ kind: 'area', label: 'Falador (46, 52)' }],
    });
    expect(evaluateActivityReadiness(true, req, unlocked({ chunks: ['46,52'] }), 'chunked').status).not.toBe('NOT_READY');
    // Vanilla keeps the named area.
    expect(evaluateActivityReadiness(true, req, unlocked({ regions: ['Falador'] }), 'vanilla').status).not.toBe('NOT_READY');
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
        // The Paterdomus side counts only after Darkness of Hallowvale (area-access.d1[2]).
        quests: ['In Aid of the Myreque', 'Darkness of Hallowvale'],
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
    // The God Wars Dungeon's entrance is in Burthorpe's chunk, which gates Nex.
    expect(evaluateActivityReadiness(true, req, unlocked({
      regions: ['Burthorpe'],
      quests: ['Desert Treasure I'],
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
    // The diary task also names the guild itself, which this compares only for its levels.
    const profile = (skills: Record<string, number>, levels: Record<string, number>) =>
      unlocked({ regions: ["Warriors' Guild"], guilds: ["Warriors' Guild"], skills, levels });
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
    // Their data lists Herblore 60 (plus Children of the Sun) and Sailing 30; the skills need the quests.
    const mixology = unlocked({ regions: ['Aldarin'], skills: { Herblore: 6 }, levels: { Herblore: 60 } });
    expect(evaluateActivityReadiness(true, getActivityReq('Mastering Mixology'), mixology, 'vanilla')).toEqual({
      status: 'NOT_READY', blockers: [{ kind: 'quest', label: 'Children of the Sun' }, { kind: 'quest', label: 'Druidic Ritual' }],
    });
    expect(evaluateActivityReadiness(true, getActivityReq('Mastering Mixology'), {
      ...mixology, quests: ['Druidic Ritual', 'Children of the Sun'],
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

describe('evaluateActivityReadiness with routes', () => {
  const zulrah = () => unlocked({ regions: ['Lumbridge', 'Zul-Andra'], quests: ['Regicide'], bosses: ['Zulrah'] });
  const stranded: AreaRoutes = { strandedAreas: new Set(['Zul-Andra']), strandedChunks: new Set() };

  it('is Not ready for an owned area no route reaches, as the Journal says', () => {
    const unlocks = zulrah();
    expect(evaluateActivityReadiness(true, getActivityReq('Zulrah'), unlocks, 'vanilla', stranded)).toEqual({
      status: 'NOT_READY', blockers: [{ kind: 'area', label: 'a route to Zul-Andra' }],
    });
    expect(bossAreaBlocker('Zulrah', unlocks, 'vanilla', stranded)).toBe('No route to Zul-Andra yet');
  });

  it('is unchanged once a route reaches it, and while routes load', () => {
    const unlocks = zulrah();
    const reached: AreaRoutes = { strandedAreas: new Set(), strandedChunks: new Set() };
    const withRoute = evaluateActivityReadiness(true, getActivityReq('Zulrah'), unlocks, 'vanilla', reached);
    expect(withRoute.status).not.toBe('NOT_READY');
    expect(evaluateActivityReadiness(true, getActivityReq('Zulrah'), unlocks, 'vanilla')).toEqual(withRoute);
    expect(bossAreaBlocker('Zulrah', unlocks, 'vanilla', reached)).toBeUndefined();
  });
});

describe('ways in that carry their own requirement, read by the readiness badge (area-access.d3[0], d3[1], d1[2])', () => {
  const areaBlockers = (name: string, over: Partial<UnlockState>, mode: string) => {
    const readiness = evaluateActivityReadiness(true, getActivityReq(name), unlocked(over), mode);
    return readiness.status === 'NOT_READY' ? readiness.blockers.filter(blocker => blocker.kind === 'area').map(blocker => blocker.label) : [];
  };

  it('counts the Lumbridge castle cellar way to Juna once The Lost Tribe is done', () => {
    for (const name of ['Tears of Guthix', 'The Fractured Archive', 'Tormented Demons']) {
      expect(areaBlockers(name, { chunks: ['50,50'], quests: ['The Lost Tribe', 'While Guthix Sleeps', 'Tears of Guthix'] }, 'chunked'), name).toEqual([]);
      expect(areaBlockers(name, { chunks: ['50,50'] }, 'chunked'), name)
        .toEqual(['Lumbridge (49, 49) or Lumbridge (50, 50) with The Lost Tribe started']);
      expect(areaBlockers(name, { chunks: ['49,49'] }, 'chunked'), name).toEqual([]);
    }
    expect(evaluateActivityReadiness(true, getActivityReq('The Fractured Archive'), unlocked({ chunks: ['50,50'], quests: ['The Lost Tribe', 'While Guthix Sleeps'] }), 'chunked').status).not.toBe('NOT_READY');
  });

  it('counts the 51 Agility pipe from the Varrock Sewers for Obor', () => {
    const agility = (level: number) => ({ chunks: ['50,54'], skills: { Agility: 6 }, levels: { Agility: level } });
    expect(areaBlockers('Obor', agility(51), 'chunked')).toEqual([]);
    expect(areaBlockers('Obor', agility(50), 'chunked')).toEqual(['Edgeville (48, 54) or Varrock (50, 54) with Agility level 51']);
  });

  it('counts Temple Trekking from the Paterdomus only after Darkness of Hallowvale, in both modes', () => {
    const myreque = ['Priest in Peril', 'In Aid of the Myreque'];
    expect(evaluateActivityReadiness(true, getActivityReq('Temple Trekking'), unlocked({ regions: ['Paterdomus'], quests: myreque }), 'vanilla'))
      .toEqual({ status: 'NOT_READY', blockers: [{ kind: 'area', label: 'Burgh de Rott, or Paterdomus after Darkness of Hallowvale' }] });
    expect(evaluateActivityReadiness(true, getActivityReq('Temple Trekking'), unlocked({ regions: ['Paterdomus'], quests: [...myreque, 'Darkness of Hallowvale'] }), 'vanilla').status).toBe('READY');
    expect(evaluateActivityReadiness(true, getActivityReq('Temple Trekking'), unlocked({ regions: ['Burgh de Rott'], quests: myreque }), 'vanilla').status).toBe('READY');
    expect(areaBlockers('Temple Trekking', { chunks: ['53,54'], quests: [...myreque, 'Darkness of Hallowvale'] }, 'chunked')).toEqual([]);
    expect(areaBlockers('Temple Trekking', { chunks: ['53,54'], quests: myreque }, 'chunked'))
      .toEqual(['Burgh de Rott (54, 50) or Paterdomus (53, 54) with Darkness of Hallowvale']);
  });
});

describe('Mahogany Homes: the first contract comes from Amy (area-access.d2[0])', () => {
  const AMY_FIRST = 'Take your first contract from Amy in Falador (Marlo, Ellie and Angelo give contracts only after that)';

  it('opens at any contractor in Chunked and asks the player to confirm the first contract', () => {
    for (const office of ['46,52', '50,54', '41,51', '27,56']) {
      expect(evaluateActivityReadiness(true, getActivityReq('Mahogany Homes'), unlocked({ chunks: [office] }), 'chunked'), office)
        .toEqual({ status: 'NEEDS_CONFIRMATION', checks: [AMY_FIRST] });
    }
    expect(evaluateActivityReadiness(true, getActivityReq('Mahogany Homes'), unlocked({ chunks: ['47,52'] }), 'chunked').status).toBe('NOT_READY');
  });

  it('carries the same line in Vanilla', () => {
    expect(evaluateActivityReadiness(true, getActivityReq('Mahogany Homes'), unlocked(), 'vanilla'))
      .toEqual({ status: 'NEEDS_CONFIRMATION', checks: [AMY_FIRST] });
  });
});
