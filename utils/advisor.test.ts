import { describe, it, expect } from 'vitest';
import { SKILLS_LIST } from '../constants';
import {
  computeUnlockImpact, prepareUnlockImpactContext, type UnlockImpactContext,
} from './unlockImpact';
import { rankAvailableQuests } from './questAdvisor';
import { rankLockedRegions, UNLOCKABLE_REGIONS } from './regionAdvisor';
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
  it('ranks every locked region, sorted by cascade score', () => {
    const ranked = rankLockedRegions(maxedUnlocks());
    expect(ranked.length).toBe(UNLOCKABLE_REGIONS.length);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].cascadeScore).toBeGreaterThanOrEqual(ranked[i].cascadeScore);
    }
  });

  it('excludes already-unlocked regions', () => {
    const someRegion = UNLOCKABLE_REGIONS[0];
    const ranked = rankLockedRegions(maxedUnlocks({ regions: [someRegion] }));
    expect(ranked.find((r) => r.id === someRegion)).toBeUndefined();
    expect(ranked.length).toBe(UNLOCKABLE_REGIONS.length - 1);
  });

  it('a high-value region unlocks at least one quest in its cascade', () => {
    const ranked = rankLockedRegions(maxedUnlocks());
    // The top region should open up something downstream.
    expect(ranked[0].cascadeScore).toBeGreaterThan(0);
  });
});
