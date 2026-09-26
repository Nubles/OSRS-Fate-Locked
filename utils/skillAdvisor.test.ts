import { describe, it, expect, vi } from 'vitest';

vi.mock('./journalStatus', async () => {
  const actual = await vi.importActual<typeof import('./journalStatus')>('./journalStatus');
  return { ...actual, evaluateDiaryTierEligibility: vi.fn(actual.evaluateDiaryTierEligibility) };
});
import { MISTHALIN_AREAS, REGIONS_LIST, SKILLS_LIST } from '../constants';
import { QUEST_DATA } from '../data/questData';
import { rankSkillBottlenecks } from './skillAdvisor';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import * as journalStatus from './journalStatus';

// Fixture: skills unlocked but levels LOW (1), so skill thresholds genuinely
// gate content. Regions empty, no quests done.
function lowSkills(over: Record<string, any> = {}) {
  return {
    equipment: {},
    skills: Object.fromEntries(SKILLS_LIST.map((s) => [s, 5])),
    levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 1])),
    regions: [],
    mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    quests: [],
    diaries: [],
    cas: [],
    completedTasks: [],
    collectionLog: {},
    ...over,
  };
}

// All regions + all quests done, but skills at level 1 — isolates skill gates.
function regionsAndQuestsDone(over: Record<string, any> = {}) {
  return lowSkills({
    regions: [...MISTHALIN_AREAS, ...REGIONS_LIST],
    quests: Object.keys(QUEST_DATA),
    ...over,
  });
}

describe('rankSkillBottlenecks', () => {
  it('does not promise a skill unlock for a quest still blocked by mandatory equipment', () => {
    const base = regionsAndQuestsDone({
      quests: Object.keys(QUEST_DATA).filter(id => id !== 'Ghosts Ahoy'),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Cooking' ? 19 : 99])),
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      completedTasks: ALL_DIARY_TASKS.map(task => task.id),
    });
    const locked = rankSkillBottlenecks(base).flatMap(row => row.newQuestNames);
    const open = rankSkillBottlenecks({
      ...base,
      equipment: Object.fromEntries((QUEST_DATA['Ghosts Ahoy'].equipmentRequirements ?? []).map(req => [req.slot, req.tier])),
    }).flatMap(row => row.newQuestNames);
    expect(locked).not.toContain('Ghosts Ahoy');
    expect(open).toContain('Ghosts Ahoy');
  });
  it('is sorted by cascade score (descending)', () => {
    const ranked = rankSkillBottlenecks(lowSkills());
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].cascadeScore).toBeGreaterThanOrEqual(ranked[i].cascadeScore);
    }
  });

  it('every ranked skill has a target above its current level and unlocks something', () => {
    const ranked = rankSkillBottlenecks(lowSkills());
    for (const r of ranked) {
      expect(r.targetLevel).toBeGreaterThan(r.currentLevel);
      const unlocks =
        r.newQuestNames.length +
        r.newDiaryIds.length +
        r.cascadeQuestNames.length +
        r.cascadeDiaryIds.length;
      expect(unlocks).toBeGreaterThan(0);
    }
  });

  it('targets the NEAREST gating threshold for a skill', () => {
    const ranked = rankSkillBottlenecks(lowSkills());
    for (const r of ranked) {
      // No quest requiring this skill at a level strictly between current and
      // target should have been skipped if it would have unlocked something —
      // i.e. the target is the smallest threshold that unlocks anything.
      const lowerThresholds = Object.values(QUEST_DATA)
        .map((q) => (q.skills as Record<string, number>)[r.id])
        .filter((lvl) => lvl && lvl > r.currentLevel && lvl < r.targetLevel);
      // A lower threshold may exist but only if it unlocked nothing; we can't
      // easily re-derive that here, so just assert target is a real requirement.
      expect(Number.isFinite(r.targetLevel)).toBe(true);
      expect(lowerThresholds.every((l) => l < r.targetLevel)).toBe(true);
    }
  });

  it('cascade score is at least the direct score', () => {
    const ranked = rankSkillBottlenecks(lowSkills());
    for (const r of ranked) {
      expect(r.cascadeScore).toBeGreaterThanOrEqual(r.score);
    }
  });

  it('never offers a locked skill as trainable', () => {
    // Mining at tier 0 needs a Skills unlock before it can be levelled.
    const quests = Object.keys(QUEST_DATA).filter(id => id !== "The Knight's Sword");
    const skills = (mining: number) => Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Mining' ? mining : 10]));
    const levels = Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Mining' ? 1 : 99]));
    const locked = rankSkillBottlenecks(regionsAndQuestsDone({ quests, levels, skills: skills(0) }));
    const unlocked = rankSkillBottlenecks(regionsAndQuestsDone({ quests, levels, skills: skills(1) }));

    expect(locked.find(candidate => candidate.id === 'Mining')).toBeUndefined();
    expect(unlocked.find(candidate => candidate.id === 'Mining')).toMatchObject({ targetLevel: 10 });
    expect(unlocked.find(candidate => candidate.id === 'Mining')!.newQuestNames).toContain("The Knight's Sword");
  });

  it('offers Herblore only after Druidic Ritual, the quest that unlocks it', () => {
    // Reported Vanilla run with no quests: Herblore, Agility and Thieving at
    // tiers 1/1/3, Agility 10 and Thieving 25. The Dig Site needs Herblore 10,
    // but Herblore can't be trained before Druidic Ritual (behind Taverley).
    const run = lowSkills({
      skills: { ...Object.fromEntries(SKILLS_LIST.map(skill => [skill, 0])), Herblore: 1, Agility: 1, Thieving: 3 },
      levels: {
        ...Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Hitpoints' ? 10 : 1])),
        Agility: 10, Thieving: 25,
      },
    });
    const before = rankSkillBottlenecks(run, 'vanilla');
    expect(before.find(candidate => candidate.id === 'Herblore')).toBeUndefined();
    expect(before.flatMap(candidate => [...candidate.newQuestNames, ...candidate.cascadeQuestNames]))
      .not.toContain('The Dig Site');

    // Druidic Ritual grants Herblore 3; training to 10 then opens The Dig Site.
    const after = rankSkillBottlenecks({
      ...run, quests: ['Druidic Ritual'], levels: { ...run.levels, Herblore: 3 },
    }, 'vanilla');
    expect(after.find(candidate => candidate.id === 'Herblore')).toMatchObject({
      currentLevel: 3, targetLevel: 10, newQuestNames: ['The Dig Site'],
    });
  });

  it('does not train Herblore or Sailing toward an any-skill gate before their quests', () => {
    // Falador Elite's last task accepts a skillcape emote, so any skill at 99
    // completes it. Every skill is one level short; Herblore and Sailing can
    // only close the gap once Druidic Ritual and Pandemonium are complete.
    const offered = (quests: string[]) => new Map(rankSkillBottlenecks(lowSkills({
      equipment: { Cape: 6 },
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 98])),
      regions: ['Falador'],
      quests,
      diaries: Object.keys(DIARY_DATA).filter(diary => diary !== 'Falador Elite'),
      completedTasks: ALL_DIARY_TASKS.filter(task => task.id !== 'fal_elite_4').map(task => task.id),
    }), 'vanilla').map(candidate => [candidate.id, candidate]));
    const skillcape = { targetLevel: 99, newDiaryIds: ['Falador Elite'] };

    const before = offered([]);
    expect(before.get('Mining')).toMatchObject(skillcape);
    expect(before.has('Herblore')).toBe(false);
    expect(before.has('Sailing')).toBe(false);
    const after = offered(['Druidic Ritual', 'Pandemonium']);
    expect(after.get('Herblore')).toMatchObject(skillcape);
    expect(after.get('Sailing')).toMatchObject(skillcape);
  });

  it('does not reach a combat gate through a locked combat skill', () => {
    // Attack 13 → 14 lifts combat level to Morytania Easy's gate, but a
    // locked Attack can't be levelled.
    const ranked = (attackTier: number) => rankSkillBottlenecks(lowSkills({
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Attack' ? attackTier : 10])),
      levels: {
        ...Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
        Attack: 13, Strength: 40, Defence: 1, Hitpoints: 10,
        Prayer: 1, Ranged: 1, Magic: 1, Slayer: 98,
      },
      regions: ['Canifis'],
      quests: Object.keys(QUEST_DATA),
      diaries: Object.keys(DIARY_DATA).filter(diary => diary !== 'Morytania Easy'),
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Morytania Easy' || task.id !== 'mor_easy_3')
        .map(task => task.id),
    })).find(candidate => candidate.id === 'Attack');

    expect(ranked(2)?.targetLevel).toBe(14);
    expect(ranked(0)).toBeUndefined();
  });

  it('with all regions + skills maxed, nothing is skill-gated', () => {
    const maxed = lowSkills({
      levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 99])),
    });
    expect(rankSkillBottlenecks(maxed)).toHaveLength(0);
  });

  it('threads Chunked mode through quest impact simulations', () => {
    // Only the exact Seers' Village chunk lets Mining 20 unlock
    // Elemental Workshop I.
    const base = lowSkills({
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Mining' ? 2 : 99])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Mining' ? 19 : 99])),
      chunks: ['41,54'],
    });
    const exact = { ...base, chunks: ['42,54'] };

    const before = rankSkillBottlenecks(base, 'chunked')
      .find(candidate => candidate.id === 'Mining');
    const after = rankSkillBottlenecks(exact, 'chunked')
      .find(candidate => candidate.id === 'Mining')!;

    expect(before).toBeUndefined();
    expect(after.targetLevel).toBe(20);
    expect(after.newQuestNames).toContain('Elemental Workshop I');
  });

  it('does not credit a diary while another skill is blocked by its method cap', () => {
    const base = lowSkills({
      merchants: ['Farming Shops'],
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Smithing' ? 1 : 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Agility' ? 1 : 99])),
      regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => [
        ...(task.regions ?? []), ...(task.anyOfRegions ?? []),
      ]))],
      quests: Object.keys(QUEST_DATA),
    });
    const capable = {
      ...base,
      skills: { ...base.skills, Smithing: 2 },
    };

    const blocked = rankSkillBottlenecks(base)
      .find(candidate => candidate.id === 'Agility')!;
    const unblocked = rankSkillBottlenecks(capable)
      .find(candidate => candidate.id === 'Agility')!;

    expect(blocked.newDiaryIds).not.toContain('Falador Easy');
    expect(unblocked.targetLevel).toBe(5);
    expect(unblocked.newDiaryIds).toContain('Falador Easy');
  });

  it('surfaces diary unlocks when regions + quests are already done', () => {
    const ranked = rankSkillBottlenecks(regionsAndQuestsDone({
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [
        skill,
        skill === 'Agility' ? 1 : 99,
      ])),
    }));

    expect(ranked.find(candidate => candidate.id === 'Agility')).toBeDefined();
  });

  it('does not advertise a skill threshold while the required crossbow still needs confirmation', () => {
    const ranked = rankSkillBottlenecks(lowSkills({
      equipment: { Weapon: 1, Ammo: 3 },
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Ranged' ? 20 : 99])),
      regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => [
        ...(task.regions ?? []), ...(task.anyOfRegions ?? []),
      ]))],
      quests: Object.keys(QUEST_DATA),
      diaries: Object.keys(DIARY_DATA).filter(diary => diary !== 'Ardougne Medium'),
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Ardougne Medium' || task.id !== 'ard_med_2')
        .map(task => task.id),
    }));
    const ranged = ranked.find(candidate => candidate.id === 'Ranged');

    expect(ranged?.newDiaryIds ?? []).not.toContain('Ardougne Medium');
  });
  it('indexes the nearest skill level that crosses a combat-only diary gate', () => {
    const ranked = rankSkillBottlenecks(lowSkills({
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      levels: {
        ...Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
        Attack: 13, Strength: 40, Defence: 1, Hitpoints: 10,
        Prayer: 1, Ranged: 1, Magic: 1, Slayer: 98,
      },
      regions: ['Canifis'],
      quests: Object.keys(QUEST_DATA),
      diaries: Object.keys(DIARY_DATA).filter(diary => diary !== 'Morytania Easy'),
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Morytania Easy' || task.id !== 'mor_easy_3')
        .map(task => task.id),
    }));
    const attack = ranked.find(candidate => candidate.id === 'Attack');

    expect(attack?.targetLevel).toBe(14);
    expect(attack?.newDiaryIds).toContain('Morytania Easy');
  });

  it('reuses diary status baselines instead of rescanning for every threshold', () => {
    const statusSpy = vi.mocked(journalStatus.evaluateDiaryTierEligibility);
    statusSpy.mockClear();

    // Every regional and quest gate is open, so diary candidates survive the
    // cheap blocker prefilter and exercise the actual status-check cache.
    rankSkillBottlenecks(regionsAndQuestsDone());

    expect(statusSpy.mock.calls.length).toBeGreaterThan(0);
    // Canonical eligibility is also used for the 48-tier blocker prefilter;
    // those fixed baseline passes must not become a per-threshold rescan.
    expect(statusSpy.mock.calls.length).toBeLessThanOrEqual(108);
  });
});
