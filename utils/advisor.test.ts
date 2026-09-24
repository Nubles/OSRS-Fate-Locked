import { describe, it, expect } from 'vitest';
import { REGION_GROUPS, SKILLS_LIST } from '../constants';
import {
  computeUnlockImpact, prepareUnlockImpactContext, type UnlockImpactContext,
} from './unlockImpact';
import { rankAvailableQuests } from './questAdvisor';
import { rankLockedRegions } from './regionAdvisor';
import { getQuestStatus } from './journalStatus';
import { QUEST_DATA } from '../data/questData';

// A generous fixture: every skill unlocked & maxed so quest availability is
// gated only by regions, prereqs, and quest-point totals — which is exactly
// what the advisors reason about.
function maxedUnlocks(over: Record<string, any> = {}) {
  return {
    equipment: {},
    skills: Object.fromEntries(SKILLS_LIST.map((s) => [s, 10])),
    levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 99])),
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

describe('computeUnlockImpact', () => {
  it('preserves legacy context assignability and aliases the prepared status map', () => {
    const prepared = prepareUnlockImpactContext(maxedUnlocks());
    const { questStatusById: _questStatusById, ...legacyFields } = prepared;
    const legacyContext: UnlockImpactContext = legacyFields;

    expect(legacyContext.baseQuestStatus).toBe(prepared.baseQuestStatus);
    expect(prepared.questStatusById).toBe(prepared.baseQuestStatus);
  });
  it('does not auto-complete a manually pending quest after a region unlock', () => {
    const base = maxedUnlocks({
      skills: { Smithing: 3, Sailing: 2 },
      levels: { Smithing: 30, Sailing: 12 },
      quests: ['Pandemonium', "The Knight's Sword"],
    });
    const machineReadyButManualPending = {
      ...base,
      regions: ['The Open Seas'],
    };
    const context = prepareUnlockImpactContext(machineReadyButManualPending);

    expect(context.baseAvailableIds).not.toContain('Prying Times');

    const impact = computeUnlockImpact(
      base,
      { ...base, regions: ['The Open Seas'] },
      undefined,
      { diaryIds: [] },
    );

    expect(impact.directQuestNames).not.toContain('Prying Times');
    expect(impact.cascadeQuestNames).not.toContain('Prying Times');
    expect(impact.finalQuestIds).not.toContain('Prying Times');
  });

  it('cascade always contains the direct set (score & counts)', () => {
    const base = maxedUnlocks();
    const available = Object.values(QUEST_DATA).filter(
      (q) => getQuestStatus(q, base) === 'AVAILABLE',
    );
    expect(available.length).toBeGreaterThan(0);

    for (const q of available) {
      const sim = { ...base, quests: [...base.quests, q.id] };
      const impact = computeUnlockImpact(base, sim);
      expect(impact.cascadeScore).toBeGreaterThanOrEqual(impact.directScore);
      expect(impact.cascadeQuestNames.length).toBeGreaterThanOrEqual(impact.directQuestNames.length);
      expect(impact.cascadeDiaryIds.length).toBeGreaterThanOrEqual(impact.directDiaryIds.length);
    }
  });

  it('never credits the candidate quest or the existing backlog as a new unlock', () => {
    const base = maxedUnlocks();
    const available = Object.values(QUEST_DATA).filter(
      (q) => getQuestStatus(q, base) === 'AVAILABLE',
    );
    const availableNames = new Set(available.map((q) => q.name));

    for (const q of available) {
      const sim = { ...base, quests: [...base.quests, q.id] };
      const impact = computeUnlockImpact(base, sim);
      // The candidate itself must not appear.
      expect(impact.cascadeQuestNames).not.toContain(q.name);
      // No already-AVAILABLE quest should be reported as "newly" unlocked.
      for (const name of impact.directQuestNames) {
        expect(availableNames.has(name)).toBe(false);
      }
    }
  });

  it('is monotonic — a no-op simulation yields zero impact', () => {
    const base = maxedUnlocks();
    const impact = computeUnlockImpact(base, { ...base });
    expect(impact.directScore).toBe(0);
    expect(impact.cascadeScore).toBe(0);
  });
});

describe('rankAvailableQuests', () => {
  it('returns quests sorted by cascade score (descending)', () => {
    const ranked = rankAvailableQuests(maxedUnlocks());
    expect(ranked.length).toBeGreaterThan(0);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].cascadeScore).toBeGreaterThanOrEqual(ranked[i].cascadeScore);
    }
  });

  it('only ranks currently-AVAILABLE quests', () => {
    const base = maxedUnlocks();
    const ranked = rankAvailableQuests(base);
    for (const r of ranked) {
      expect(getQuestStatus(QUEST_DATA[r.id], base)).toBe('AVAILABLE');
    }
  });

  it('threads Chunked-mode access through quest ranking and impact', () => {
    const before = maxedUnlocks({ chunks: ['48,50'] });
    const after = maxedUnlocks({ chunks: ['48,50', '47,51'] });

    expect(rankAvailableQuests(before, 'chunked').map(q => q.id))
      .not.toContain('A Porcine of Interest');
    expect(rankAvailableQuests(after, 'chunked').map(q => q.id))
      .toContain('A Porcine of Interest');
  });
});

describe('rankLockedRegions', () => {
  const ALL_AREAS = Object.values(REGION_GROUPS).flat();

  it('ranks every area the Areas table can still roll, never a whole continent', () => {
    const ranked = rankLockedRegions(maxedUnlocks(), 'vanilla');
    expect(ranked.map(r => r.id).sort()).toEqual([...ALL_AREAS].sort());
    expect(ranked.some(r => Object.hasOwn(REGION_GROUPS, r.id))).toBe(false);
    for (const r of ranked) expect(REGION_GROUPS[r.region]).toContain(r.id);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].cascadeScore).toBeGreaterThanOrEqual(ranked[i].cascadeScore);
    }
  });

  it('excludes areas that are already reachable, including through a continent unlock', () => {
    const one = rankLockedRegions(maxedUnlocks({ regions: ['Falador'] }), 'vanilla');
    expect(one.find(r => r.id === 'Falador')).toBeUndefined();
    expect(one.length).toBe(ALL_AREAS.length - 1);

    const continent = rankLockedRegions(maxedUnlocks({ regions: ['Wilderness'] }), 'vanilla');
    expect(continent.some(r => r.region === 'Wilderness')).toBe(false);
    expect(continent.length).toBe(ALL_AREAS.length - REGION_GROUPS.Wilderness.length);
  });

  it('scores one area as a single unlock grants it', () => {
    // Black Knights' Fortress needs all of Asgarnia; Falador is the last area missing.
    const base = maxedUnlocks({
      regions: REGION_GROUPS.Asgarnia.filter(area => area !== 'Falador'),
      quests: Object.keys(QUEST_DATA).filter(id => QUEST_DATA[id].kind === 'quest').slice(0, 30),
      equipment: { Head: 1, Body: 1 },
    });
    const falador = rankLockedRegions(base, 'vanilla').find(r => r.id === 'Falador')!;
    const expected = computeUnlockImpact(base, { ...base, regions: [...base.regions, 'Falador'] }, 'vanilla');

    expect(falador.region).toBe('Asgarnia');
    expect(expected.directQuestNames.length).toBeGreaterThan(0);
    expect(falador).toMatchObject({
      newQuestNames: expected.directQuestNames, newDiaryIds: expected.directDiaryIds,
      cascadeQuestNames: expected.cascadeQuestNames, cascadeDiaryIds: expected.cascadeDiaryIds,
      score: expected.directScore, cascadeScore: expected.cascadeScore,
    });
  });

  it('matches a full simulation of every area it ranks', () => {
    // Areas it skips must open nothing, whether skills are maxed or still gating.
    const states = [
      maxedUnlocks({ regions: ['Falador', 'Port Sarim', 'Catherby', 'Al Kharid'], quests: ["Cook's Assistant"] }),
      maxedUnlocks({
        skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 5])),
        levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 45])),
        regions: ['Falador', 'Taverley', "Seers' Village"],
        quests: Object.keys(QUEST_DATA).slice(0, 40),
      }),
    ];
    for (const base of states) {
      const context = prepareUnlockImpactContext(base, 'vanilla');
      for (const row of rankLockedRegions(base, 'vanilla')) {
        const full = computeUnlockImpact(base, { ...base, regions: [...base.regions, row.id] }, 'vanilla', { context });
        expect(row, row.id).toMatchObject({
          newQuestNames: full.directQuestNames, newDiaryIds: full.directDiaryIds,
          cascadeQuestNames: full.cascadeQuestNames, cascadeDiaryIds: full.cascadeDiaryIds,
          score: full.directScore, cascadeScore: full.cascadeScore,
        });
      }
    }
  }, 60_000);

  it('a high-value area unlocks at least one quest in its cascade', () => {
    const ranked = rankLockedRegions(maxedUnlocks(), 'vanilla');
    // The top area should open up something downstream.
    expect(ranked[0].cascadeScore).toBeGreaterThan(0);
  });

  it('ranks nothing in Chunked mode, which has no Areas table', () => {
    expect(rankLockedRegions(maxedUnlocks(), 'chunked')).toEqual([]);
  });
});
