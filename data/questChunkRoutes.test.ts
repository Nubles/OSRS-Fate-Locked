import { describe, expect, it } from 'vitest';
import review from './sources/quest-chunk-route-review.json';
import { QUEST_DATA } from './questData';
import { ALL_CHUNK_KEYS, chunkKey } from '../utils/chunkAdjacency';
import { evaluateQuestEligibility } from '../utils/journalStatus';
import type { UnlockState } from '../types';

describe('remaining quest chunk route review', () => {
  it('accounts for all 49 remaining quests and preserves Standard geography', () => {
    expect(review.scope).toHaveLength(49);
    expect(new Set(review.entries.map(entry => entry.id)).size).toBe(49);
    expect(review.entries.map(entry => entry.id).sort()).toEqual([...review.scope].sort());
    for (const entry of review.entries) {
      const quest = QUEST_DATA[entry.id];
      expect(quest, entry.id).toBeDefined();
      expect({accessPolicy: quest.accessPolicy, regions: quest.regions,
        locations: quest.locations ?? null, oneOf: quest.oneOf ?? null}, entry.id).toEqual(entry.standardBaseline);
      expect(quest.chunkedGeography ?? null, entry.id).toEqual(entry.model);
      if (entry.model === null) expect(entry.id).toBe('Learning the Ropes');
      expect(entry.sourceEvidence.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('uses canonical chunks and retains requirements on direct-access alternatives', () => {
    const known = new Set(ALL_CHUNK_KEYS);
    for (const entry of review.entries) {
      const model = QUEST_DATA[entry.id].chunkedGeography;
      if (!model) continue;
      expect(model.locations.length + model.groups.length + model.unknowns.length, entry.id).toBeGreaterThan(0);
      const locations = [...model.locations, ...model.groups.flatMap(group => group.routes.flatMap(route => route.locations))];
      for (const location of locations) {
        expect(location.chunkOptions.length, `${entry.id}: ${location.id}`).toBeGreaterThan(0);
        for (const point of location.chunkOptions) expect(known.has(chunkKey(point)), `${entry.id}: ${location.id}`).toBe(true);
      }
      for (const group of model.groups) {
        expect(group.routes.length, entry.id).toBeGreaterThan(0);
        for (const route of group.routes) {
          if (!route.locations.length) expect((route.unknowns?.length ?? 0) + (route.requirements?.length ?? 0), entry.id).toBeGreaterThan(0);
        }
      }
    }
  });

  const unlocks = (chunks: string[]): UnlockState => ({
    skills: {}, levels: {}, quests: [], regions: [], guilds: [], chunks,
  } as unknown as UnlockState);

  it('uses exact chunks without inventing new Standard area permissions', () => {
    const quest = {...QUEST_DATA['Mountain Daughter'], skills: {}, prereqs: [], manualRequirements: [], operationalRequirements: []};
    const owned = quest.chunkedGeography!.locations.flatMap(location => location.chunkOptions.map(chunkKey));
    const chunked = evaluateQuestEligibility(quest, unlocks(owned), 'chunked');
    expect(chunked.blockers.filter(blocker => blocker.kind === 'region')).toEqual([]);
    const missing = evaluateQuestEligibility(quest, unlocks(owned.filter(key => key !== '44,54')), 'chunked');
    expect(missing.blockers.some(blocker => blocker.kind === 'region' && blocker.label.includes('White Wolf'))).toBe(true);
    const standard = evaluateQuestEligibility(quest, unlocks(owned));
    expect(standard.blockers.some(blocker => blocker.kind === 'region' && blocker.label === 'Mountain Camp')).toBe(true);
  });

  it('never treats an unobserved assigned route as ready even with all known chunks', () => {
    const quest = {...QUEST_DATA['Curse of the Empty Lord'], skills: {}, prereqs: [], manualRequirements: [], operationalRequirements: []};
    const result = evaluateQuestEligibility(quest, unlocks([...ALL_CHUNK_KEYS]), 'chunked');
    expect(result.status).toBe('UNKNOWN');
    expect(result.eligible).toBe(false);
    expect(result.blockers.some(blocker => blocker.kind === 'requirement' && blocker.internalOnly)).toBe(true);
  });

  it('leaves existing Standard eligibility unchanged across every reviewed quest', () => {
    for (const id of review.scope) {
      const quest = {...QUEST_DATA[id], operationalRequirements: []};
      const {chunkedGeography: _geography, ...previous} = quest;
      for (const regions of [[], quest.regions]) {
        const state = {...unlocks([]), regions, levels: {}, skills: {}, equipment: {}, mobility: [], arcana: [],
          housing: [], merchants: [], minigames: [], bosses: [], storage: [], farming: [], slayerUnlocks: [],
          diaries: [], cas: [], completedTasks: [], collectionLog: {}} as UnlockState;
        expect(evaluateQuestEligibility(quest, state), id).toEqual(evaluateQuestEligibility(previous, state));
      }
    }
  });
});

it('keeps unmodeled Keldagrim transport as an alternative, not a mandatory entrance', () => {
  const quest = {...QUEST_DATA['Ratcatchers'], skills: {}, prereqs: [], manualRequirements: [], operationalRequirements: []};
  const chunks = quest.chunkedGeography!.locations.flatMap(location => location.chunkOptions.map(chunkKey));
  const result = evaluateQuestEligibility(quest, {skills: {}, levels: {}, quests: [], regions: [], guilds: [], chunks} as unknown as UnlockState, 'chunked');
  expect(result.blockers.filter(blocker => blocker.kind === 'region')).toEqual([]);
  expect(result.status).toBe('UNKNOWN');
  expect(result.eligible).toBe(false);
});
