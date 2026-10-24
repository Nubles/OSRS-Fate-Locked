import { describe, expect, it } from 'vitest';
import { SKILLS_LIST } from '../data/items';
import {
  pendingBaseline,
  planDetectedLevel,
  planSkillSync,
  recordBaseline,
  skillBaseline,
} from './syncBaseline';
import {
  baselineFromReading,
  readHiscoreOverall,
  readHiscoreSkill,
  type HiscoreLevel,
  type HiscoreReading,
} from './hiscoreReading';

const reading = (skills: Record<string, HiscoreLevel>, overall: number | null = null): HiscoreReading => ({
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill in skills ? skills[skill] : 'unranked'])),
  overall,
});
const allAt = (level: number): HiscoreReading => ({
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, level])),
  overall: level * SKILLS_LIST.length,
});

describe('reading the hiscores', () => {
  it('reads a ranked skill, an unranked one and a missing one apart', () => {
    expect(readHiscoreSkill({ rank: 1200, level: 74, experience: 1_100_000 })).toBe(74);
    expect(readHiscoreSkill({ rank: -1, level: 1, experience: -1 })).toBe('unranked');
    expect(readHiscoreSkill({ level: -1 })).toBe('unranked');
    expect(readHiscoreSkill({ level: 0 })).toBe('unranked');
    expect(readHiscoreSkill(undefined)).toBeNull();
    expect(readHiscoreSkill({ level: 'x' })).toBeNull();
    expect(readHiscoreSkill({ level: Number.NaN })).toBeNull();
    // Virtual levels and stray values stay inside 1 to 99.
    expect(readHiscoreSkill({ rank: 5, level: 126, experience: 200_000_000 })).toBe(99);
  });

  it('trusts the overall total only when the account ranks overall', () => {
    expect(readHiscoreOverall({ rank: 900_000, level: 1250, experience: 5_000_000 })).toBe(1250);
    expect(readHiscoreOverall({ rank: -1, level: 40, experience: -1 })).toBeNull();
    expect(readHiscoreOverall(undefined)).toBeNull();
  });
});

describe('the baseline a reading gives', () => {
  it('takes each ranked level as it is', () => {
    const baseline = baselineFromReading(allAt(99));
    expect(SKILLS_LIST.every(skill => baseline[skill] === 99)).toBe(true);
  });

  it('puts an unranked skill at its minimum when the account has no overall rank (a new account)', () => {
    const baseline = baselineFromReading(reading({}));
    expect(baseline.Attack).toBe(1);
    expect(baseline.Hitpoints).toBe(10);
  });

  it("never sets an unranked skill below what the account's total says it could be", () => {
    // Ranked: every skill at 50 but Hunter. The total says Hunter is 37.
    const skills = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 50 as HiscoreLevel]));
    skills.Hunter = 'unranked';
    const total = 50 * (SKILLS_LIST.length - 1) + 37;
    expect(baselineFromReading(reading(skills, total)).Hunter).toBe(37);

    // Two unranked skills sharing 40 levels: each is at most 40 less the other's minimum.
    skills.Construction = 'unranked';
    const shared = baselineFromReading(reading(skills, 50 * (SKILLS_LIST.length - 2) + 40));
    expect(shared.Hunter).toBe(39);
    expect(shared.Construction).toBe(39);
  });

  it('falls back to the minimum when the total contradicts the ranked levels', () => {
    const skills = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 50 as HiscoreLevel]));
    skills.Hunter = 'unranked';
    expect(baselineFromReading(reading(skills, 100)).Hunter).toBe(1);
  });

  it('leaves a skill the hiscores did not report unknown, not at level 1', () => {
    const missing = reading({ Attack: 60 });
    missing.skills.Sailing = null;
    const baseline = baselineFromReading(missing);
    expect(baseline.Sailing).toBeNull();
    expect(baseline.Attack).toBe(60);
  });
});

describe('recording the baseline on the run', () => {
  const now = 1_000;

  it('takes the whole reading for a new link and for a name change', () => {
    const taken = recordBaseline(pendingBaseline('Some Name'), 'Some Name', 'some name', baselineFromReading(allAt(70)), now);
    expect(taken).toMatchObject({ account: 'Some Name', takenAt: now });
    expect(taken?.levels?.Attack).toBe(70);
  });

  it('keeps a taken baseline, and only fills skills it could not read before', () => {
    const missing = allAt(70);
    missing.skills.Sailing = null;
    const taken = recordBaseline(pendingBaseline('A'), 'A', 'A', baselineFromReading(missing), now)!;
    expect(taken.levels?.Sailing).toBeNull();

    // Later readings never move a level already taken.
    expect(recordBaseline(taken, 'A', 'A', baselineFromReading(allAt(80)), now + 1)).toEqual({ ...taken, levels: { ...taken.levels, Sailing: 80 } });
    const full = recordBaseline(taken, 'A', 'A', baselineFromReading(allAt(80)), now + 1)!;
    expect(recordBaseline(full, 'A', 'A', baselineFromReading(allAt(90)), now + 2)).toBe(full);
  });

  it('treats anything but a level from 1 to 99 as unknown', () => {
    const taken = recordBaseline(pendingBaseline('A'), 'A', 'A', { Attack: 0, Defence: 100, Strength: 2.5, Hitpoints: 10 }, now)!;
    expect([taken.levels?.Attack, taken.levels?.Defence, taken.levels?.Strength, taken.levels?.Hitpoints]).toEqual([null, null, null, 10]);
    expect(taken.levels?.Sailing).toBeNull();
  });

  it('changes nothing for a run linked before baselines, or for a reading of another name', () => {
    expect(recordBaseline(undefined, 'A', 'A', baselineFromReading(allAt(99)), now)).toBeUndefined();
    const pending = pendingBaseline('A');
    expect(recordBaseline(pending, 'A', 'B', baselineFromReading(allAt(99)), now)).toBe(pending);
    expect(recordBaseline(pending, undefined, 'A', baselineFromReading(allAt(99)), now)).toBe(pending);
  });

  it('answers per skill: a level, unknown (null) or none (undefined)', () => {
    const taken = recordBaseline(pendingBaseline('A'), 'A', 'A', baselineFromReading(allAt(70)), now);
    expect(skillBaseline(taken, 'A', 'Attack')).toBe(70);
    expect(skillBaseline(undefined, 'A', 'Attack')).toBeUndefined();
    // Waiting for a first reading, or taken for a name the run no longer has: unknown.
    expect(skillBaseline(pendingBaseline('A'), 'A', 'Attack')).toBeNull();
    expect(skillBaseline(taken, 'B', 'Attack')).toBeNull();
    expect(skillBaseline({ account: 'A', levels: {} }, 'A', 'Attack')).toBeNull();
  });
});

describe('which levels Sync & Roll rolls', () => {
  it('rolls only levels above the baseline, recording the baseline first', () => {
    expect(planSkillSync({ tracker: 1, tier: 10, hiscore: 72, baseline: 70 })).toEqual({
      current: 1, catchUpTo: 70, from: 70, to: 72, count: 2, hold: null,
    });
  });

  it('rolls nothing the account already had when linked', () => {
    expect(planSkillSync({ tracker: 1, tier: 10, hiscore: 99, baseline: 99 })).toMatchObject({ count: 0, hold: 'linked' });
    expect(planSkillSync({ tracker: 1, tier: 10, hiscore: 50, baseline: 70 })).toMatchObject({ count: 0, hold: 'linked' });
  });

  it("adds no tier cap of its own: each level goes through the mode's manual level-up", () => {
    expect(planSkillSync({ tracker: 5, tier: 1, hiscore: 40, baseline: 1 })).toMatchObject({ from: 5, to: 40, count: 35, hold: null });
  });

  it("rolls from the run's own level when it is ahead of the baseline", () => {
    expect(planSkillSync({ tracker: 30, tier: 10, hiscore: 35, baseline: 20 })).toMatchObject({ catchUpTo: null, from: 30, to: 35, count: 5 });
  });

  it('rolls as before for a run linked before baselines', () => {
    expect(planSkillSync({ tracker: 1, tier: 2, hiscore: 15, baseline: undefined })).toMatchObject({ catchUpTo: null, from: 1, to: 15, count: 14, hold: null });
  });

  it('rolls nothing while the baseline is unknown, for a locked skill, or for an unranked or missing level', () => {
    expect(planSkillSync({ tracker: 1, tier: 10, hiscore: 50, baseline: null })).toMatchObject({ count: 0, hold: 'linked' });
    expect(planSkillSync({ tracker: 1, tier: 0, hiscore: 50, baseline: 1 })).toMatchObject({ count: 0, hold: 'locked' });
    expect(planSkillSync({ tracker: 1, tier: 10, hiscore: 'unranked', baseline: 1 })).toMatchObject({ count: 0, hold: 'unranked' });
    expect(planSkillSync({ tracker: 1, tier: 10, hiscore: null, baseline: 1 })).toMatchObject({ count: 0, hold: null });
    expect(planSkillSync({ tracker: 40, tier: 10, hiscore: 30, baseline: 1 })).toMatchObject({ count: 0, hold: null });
  });
});

describe("RuneLite's detected levels", () => {
  it('counts from the run and the baseline, whichever is higher', () => {
    expect(planDetectedLevel({ tracker: 9, level: 10, baseline: undefined })).toEqual({ hold: null, from: 9 });
    expect(planDetectedLevel({ tracker: 1, level: 71, baseline: 70 })).toEqual({ hold: null, from: 70 });
  });

  it('holds a level already recorded and one the account had when linked', () => {
    expect(planDetectedLevel({ tracker: 10, level: 10, baseline: undefined }).hold).toBe('recorded');
    expect(planDetectedLevel({ tracker: 1, level: 60, baseline: 70 }).hold).toBe('linked');
    expect(planDetectedLevel({ tracker: 1, level: 70, baseline: 70 }).hold).toBe('linked');
  });

  it("counts only the event's own level while the baseline is unknown", () => {
    expect(planDetectedLevel({ tracker: 1, level: 60, baseline: null })).toEqual({ hold: null, from: 59 });
  });
});
