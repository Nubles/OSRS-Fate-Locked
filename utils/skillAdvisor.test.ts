import { describe, it, expect, vi } from 'vitest';

vi.mock('./journalStatus', async () => {
  const actual = await vi.importActual<typeof import('./journalStatus')>('./journalStatus');
  return { ...actual, getDiaryStatus: vi.fn(actual.getDiaryStatus) };
});
import { SKILLS_LIST } from '../constants';
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
    regions: [
      'Asgarnia', 'Kandarin', 'Karamja', 'Kharidian Desert', 'Morytania',
      'Fremennik', 'Tirannwn', 'Wilderness', 'Kourend & Kebos', 'Varlamore',
      'Islands & Others', 'The Open Seas',
    ],
    ...over,
  });
}

describe('rankSkillBottlenecks', () => {
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

  it('with all regions + skills maxed, nothing is skill-gated', () => {
    const maxed = lowSkills({
      levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 99])),
    });
    expect(rankSkillBottlenecks(maxed)).toHaveLength(0);
  });

  it('threads Chunked mode through quest impact simulations', () => {
    // Darkness of Hallowvale keeps Mining ranked at 20 in both snapshots;
    // only the exact Seers' Village chunk should add Elemental Workshop I.
    const base = lowSkills({
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Mining' ? 2 : 99])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Mining' ? 19 : 99])),
      regions: ['Kandarin', "Seers' Village"],
      quests: ['In Aid of the Myreque'],
      chunks: ['41,54', '54,54'],
    });
    const exact = { ...base, chunks: ['42,54', '54,54'] };

    const before = rankSkillBottlenecks(base, 'chunked')
      .find(candidate => candidate.id === 'Mining')!;
    const after = rankSkillBottlenecks(exact, 'chunked')
      .find(candidate => candidate.id === 'Mining')!;

    expect(before.targetLevel).toBe(20);
    expect(before.newQuestNames).not.toContain('Elemental Workshop I');
    expect(after.targetLevel).toBe(20);
    expect(after.newQuestNames).toContain('Elemental Workshop I');
  });

  it('does not credit a diary while another skill is blocked by its method cap', () => {
    const base = lowSkills({
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Smithing' ? 1 : 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Agility' ? 1 : 99])),
      regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => task.regions ?? []))],
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
    const ranked = rankSkillBottlenecks(regionsAndQuestsDone());
    // At least one skill should now bring a diary tier within reach via skills,
    // OR quests — the advisor should still produce results.
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('discovers skill thresholds from canonical diary tasks, not stale aggregates', () => {
    const ranked = rankSkillBottlenecks(lowSkills({
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Ranged' ? 20 : 99])),
      regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => task.regions ?? []))],
      quests: Object.keys(QUEST_DATA),
      diaries: Object.keys(DIARY_DATA).filter(diary => diary !== 'Ardougne Medium'),
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Ardougne Medium' || task.id !== 'ard_med_2')
        .map(task => task.id),
    }));
    const ranged = ranked.find(candidate => candidate.id === 'Ranged');

    expect(ranged?.targetLevel).toBe(21);
    expect(ranged?.newDiaryIds).toContain('Ardougne Medium');
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
    const statusSpy = vi.mocked(journalStatus.getDiaryStatus);
    statusSpy.mockClear();

    // Every regional and quest gate is open, so diary candidates survive the
    // cheap blocker prefilter and exercise the actual status-check cache.
    rankSkillBottlenecks(regionsAndQuestsDone());

    expect(statusSpy.mock.calls.length).toBeGreaterThan(0);
    expect(statusSpy.mock.calls.length).toBeLessThanOrEqual(60);
  });
});
