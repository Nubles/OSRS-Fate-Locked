import { describe, expect, it } from 'vitest';
import {
  normalizeRuneProofPreviewChecks,
  readRuneProofPreviewChecks,
  RUNEPROOF_PREVIEW_MAX_CHARS,
  runeProofPreviewStorageKey,
  type RuneProofStorage,
  writeRuneProofPreviewChecks,
} from './previewChecks';

const memoryStorage = (): RuneProofStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
};

describe('RuneProof preview confirmation storage', () => {
  it('keeps separate normalized values for separate run ids', () => {
    const storage = memoryStorage();
    writeRuneProofPreviewChecks(storage, 'run-a', { "Cook's Assistant": ['egg'] });
    writeRuneProofPreviewChecks(storage, 'run-b', { "Doric's Quest": ['clay'] });

    expect(readRuneProofPreviewChecks(storage, 'run-a')).toEqual({ "Cook's Assistant": ['egg'] });
    expect(readRuneProofPreviewChecks(storage, 'run-b')).toEqual({ "Doric's Quest": ['clay'] });
    expect(runeProofPreviewStorageKey('run-a')).not.toBe(runeProofPreviewStorageKey('run-b'));
  });

  it('rejects oversized, malformed, array, primitive, and inherited payloads', () => {
    const storage = memoryStorage();
    storage.values.set(runeProofPreviewStorageKey('oversized'), 'x'.repeat(RUNEPROOF_PREVIEW_MAX_CHARS + 1));
    storage.values.set(runeProofPreviewStorageKey('malformed'), '{');
    storage.values.set(runeProofPreviewStorageKey('array'), '[]');
    storage.values.set(runeProofPreviewStorageKey('primitive'), '42');

    expect(readRuneProofPreviewChecks(storage, 'oversized')).toEqual({});
    expect(readRuneProofPreviewChecks(storage, 'malformed')).toEqual({});
    expect(readRuneProofPreviewChecks(storage, 'array')).toEqual({});
    expect(readRuneProofPreviewChecks(storage, 'primitive')).toEqual({});

    const inherited = Object.create({ "Cook's Assistant": ['egg'] });
    inherited["Doric's Quest"] = ['clay'];
    expect(normalizeRuneProofPreviewChecks(inherited)).toEqual({ "Doric's Quest": ['clay'] });
  });

  it('keeps reviewed player-obtained keys only, deduplicated in catalogue order', () => {
    expect(normalizeRuneProofPreviewChecks({
      Unknown: ['anything'],
      "Daddy's Home": ['hammer', 'plank', 'plank', 'unknown'],
      "Cook's Assistant": ['pot of flour', 'egg', 'egg', 'bucket of milk'],
    })).toEqual({
      "Cook's Assistant": ['egg', 'bucket of milk', 'pot of flour'],
      "Daddy's Home": ['plank'],
    });
  });

  it('removes empty state and contains storage failures', () => {
    const storage = memoryStorage();
    storage.values.set(runeProofPreviewStorageKey('run-a'), '{"stale":true}');
    writeRuneProofPreviewChecks(storage, 'run-a', {});
    expect(storage.values.has(runeProofPreviewStorageKey('run-a'))).toBe(false);

    const unavailable: RuneProofStorage = {
      getItem: () => { throw new Error('read unavailable'); },
      setItem: () => { throw new Error('write unavailable'); },
      removeItem: () => { throw new Error('remove unavailable'); },
    };
    expect(readRuneProofPreviewChecks(unavailable, 'run-a')).toEqual({});
    expect(() => writeRuneProofPreviewChecks(unavailable, 'run-a', { "Cook's Assistant": ['egg'] }))
      .not.toThrow();
    expect(() => writeRuneProofPreviewChecks(unavailable, 'run-a', {})).not.toThrow();
  });
});
