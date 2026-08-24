import { describe, expect, it } from 'vitest';
import type { RuneProofStorage } from '../questRoutes/previewChecks';
import { preflightRuneProofObjectives, rankRuneProofObjectives } from './objectives';
import {
  readRuneProofProgressIndex,
  runeProofProgressIndexStorageKey,
} from './progress';
import { makeCatalogueSummaries, readyRequirementSnapshot } from './testFixtures';

const instrumentedProgressStorage = (): RuneProofStorage & {
  readonly indexReads: number;
  readonly indexWrites: number;
  readonly questRecordReads: number;
  readonly questRecordWrites: number;
  readonly questRecordRemoves: number;
} => {
  const indexKey = runeProofProgressIndexStorageKey('run-a');
  const values = new Map<string, string>([[indexKey, JSON.stringify({
    schemaVersion: 2,
    runId: 'run-a',
    entries: {},
  })]]);
  let indexReads = 0;
  let indexWrites = 0;
  let questRecordReads = 0;
  let questRecordWrites = 0;
  let questRecordRemoves = 0;

  return {
    get indexReads() { return indexReads; },
    get indexWrites() { return indexWrites; },
    get questRecordReads() { return questRecordReads; },
    get questRecordWrites() { return questRecordWrites; },
    get questRecordRemoves() { return questRecordRemoves; },
    getItem: (key) => {
      if (key === indexKey) indexReads += 1;
      if (key.startsWith('fate_runeproof_progress_v2:')) questRecordReads += 1;
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (key === indexKey) indexWrites += 1;
      if (key.startsWith('fate_runeproof_progress_v2:')) questRecordWrites += 1;
      values.set(key, value);
    },
    removeItem: key => {
      if (key.startsWith('fate_runeproof_progress_v2:')) questRecordRemoves += 1;
      values.delete(key);
    },
  };
};

describe('RuneProof deterministic performance gates', () => {
  it('preflights 210 headers with zero pack loads and deep analyses', () => {
    const summaries = makeCatalogueSummaries(210);
    const result = preflightRuneProofObjectives({
      summaries,
      snapshot: readyRequirementSnapshot(),
      progressIndex: { schemaVersion: 2, runId: 'run-a', entries: {} },
    });

    expect(result.metrics).toEqual({
      headerEvaluations: 210,
      progressIndexLookups: 210,
      packLoads: 0,
      deepAnalyses: 0,
    });
    expect(result.candidates).toHaveLength(210);
    expect(summaries.every(summary => !('actions' in summary))).toBe(true);
    expect(rankRuneProofObjectives(result.candidates)).toHaveLength(3);
  });

  it('reads one compact index and zero quest records for catalogue ranking', () => {
    const storage = instrumentedProgressStorage();
    const result = readRuneProofProgressIndex(storage, 'run-a');

    expect(result.index.runId).toBe('run-a');
    expect(result.warnings).toEqual([]);
    expect(storage.indexReads).toBe(1);
    expect(storage.indexWrites).toBe(0);
    expect(storage.questRecordReads).toBe(0);
    expect(storage.questRecordWrites).toBe(0);
    expect(storage.questRecordRemoves).toBe(0);
  });
});
