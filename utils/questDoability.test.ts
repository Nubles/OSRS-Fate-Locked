import { describe, it, expect } from 'vitest';
import { DropSource } from '../types';
import { QuestData } from '../data/questData';
import {
  questChunkStatus, doabilityBucket, entryBlockedGate, hasCanonicalQuestLocationEvidence,
} from './questDoability';

const reach = (...ids: number[]) => new Set(ids.map(String));
const allUnlocked = () => true;

describe('questChunkStatus', () => {
  it('all chunks reachable → REACHABLE, no blockers', () => {
    const r = questChunkStatus(
      [{ cx: 1, cy: 0, role: 'first' }, { cx: 1, cy: 1 }],
      reach(256, 257), allUnlocked,
    );
    expect(r.access).toBe('REACHABLE');
    expect(r.reachable).toBe(2);
    expect(r.blockers).toEqual([]);
    expect(r.startReachable).toBe(true);
  });

  it('owned but not reachable → STRANDED', () => {
    const r = questChunkStatus([{ cx: 1, cy: 0 }], reach(/* none */), () => true);
    expect(r.access).toBe('STRANDED');
    expect(r.blockers[0].access).toBe('STRANDED');
  });

  it('not owned and not reachable → LOCKED, and worst wins', () => {
    const r = questChunkStatus(
      [{ cx: 1, cy: 0 }, { cx: 2, cy: 0 }],
      reach(256), // (1,0) reachable, (2,0) not
      (cx) => cx === 1, // only chunk (1,*) owned → (2,0) is LOCKED
    );
    expect(r.access).toBe('LOCKED');
    expect(r.reachable).toBe(1);
    expect(r.blockers[0].access).toBe('LOCKED');
  });

  it('dedupes repeated chunks', () => {
    const r = questChunkStatus([{ cx: 1, cy: 0 }, { cx: 1, cy: 0 }], reach(256), allUnlocked);
    expect(r.chunkCount).toBe(1);
  });
});

describe('entryBlockedGate', () => {
  const qs = { '100': ['Pandemonium'], '200': ['Access the fishing guild'], '300': ['Dragon Slayer I'] };
  const known = new Set(['Pandemonium', 'Dragon Slayer I']);
  it('blocks a chunk whose required quest is known but not completed', () => {
    const gate = entryBlockedGate(qs, new Set<string>(), known);
    expect(gate('100')).toBe(true);
    expect(gate('300')).toBe(true);
  });
  it('does not block once the quest is completed', () => {
    const gate = entryBlockedGate(qs, new Set(['Pandemonium', 'Dragon Slayer I']), known);
    expect(gate('100')).toBe(false);
  });
  it('ignores non-quest / unknown requirements (errs toward reachable)', () => {
    const gate = entryBlockedGate(qs, new Set<string>(), known);
    expect(gate('200')).toBe(false); // "Access the fishing guild" isn't a known quest
    expect(gate('999')).toBe(false); // ungated chunk
  });
});

describe('doabilityBucket', () => {
  const reachable = { chunkCount: 2, reachable: 2, access: 'REACHABLE' as const, startReachable: true, blockers: [] };
  const baseQuest: QuestData = {
    id: 'Base quest',
    name: 'Base quest',
    regions: [],
    skills: {},
    prereqs: [],
    points: 0,
    difficulty: DropSource.QUEST_NOVICE,
  };
  it('completed → DONE regardless', () => {
    expect(doabilityBucket(true, false, reachable)).toBe('DONE');
  });
  it('reachable + reqs met → DOABLE', () => {
    expect(doabilityBucket(false, true, reachable)).toBe('DOABLE');
  });
  it('reachable but reqs unmet → REQS', () => {
    expect(doabilityBucket(false, false, reachable)).toBe('REQS');
  });
  it('locked chunk → LOCKED even if reqs met', () => {
    expect(doabilityBucket(false, true, { ...reachable, access: 'LOCKED' })).toBe('LOCKED');
  });
  it('stranded chunk → STRANDED', () => {
    expect(doabilityBucket(false, true, { ...reachable, access: 'STRANDED' })).toBe('STRANDED');
  });
  it('uses NO_DATA only when canonical and chunk evidence are both absent', () => {
    expect(doabilityBucket(false, true, null, false)).toBe('NO_DATA');
    expect(doabilityBucket(false, false, null, false)).toBe('NO_DATA');
    expect(doabilityBucket(false, true, null, true)).toBe('DOABLE');
    expect(doabilityBucket(false, false, null, true)).toBe('REQS');
  });

  it('recognises every canonical location shape', () => {
    expect(hasCanonicalQuestLocationEvidence({
      ...baseQuest, regions: ['Misthalin'],
    })).toBe(true);
    expect(hasCanonicalQuestLocationEvidence({
      ...baseQuest, regions: [], locations: [{
        id: 'south-falador-farm',
        label: 'South Falador Farm',
        standardAreas: ['Asgarnia'],
        chunkOptions: [{ cx: 47, cy: 51 }],
      }],
    })).toBe(true);
    expect(hasCanonicalQuestLocationEvidence({
      ...baseQuest, regions: [], oneOf: [{ guilds: ["Wizards' Guild"] }],
    })).toBe(true);
    expect(hasCanonicalQuestLocationEvidence({
      ...baseQuest, regions: [],
    })).toBe(false);
  });
  it('no chunk data with canonical evidence falls back to reqs', () => {
    expect(doabilityBucket(false, true, null, true)).toBe('DOABLE');
    expect(doabilityBucket(false, false, null, true)).toBe('REQS');
  });
});
