import { describe, expect, it } from 'vitest';
import { questWalkthroughFor } from '../../data/questWalkthroughs';
import {
  RUNEPROOF_PREVIEW_MAX_CHARS,
  runeProofPreviewStorageKey,
  type RuneProofStorage,
} from '../questRoutes/previewChecks';
import { questStrategyFromWalkthrough, type QuestStrategyDefinition } from './model';
import {
  normalizeRuneProofPreviewActions,
  readRuneProofPreviewActions,
  runeProofPreviewActionStorageKey,
  writeRuneProofPreviewActions,
} from './previewActions';

type StorageCall = {
  readonly method: 'getItem' | 'setItem' | 'removeItem';
  readonly key: string;
};

const memoryStorage = (): RuneProofStorage & {
  readonly values: Map<string, string>;
  readonly calls: StorageCall[];
} => {
  const values = new Map<string, string>();
  const calls: StorageCall[] = [];
  return {
    values,
    calls,
    getItem: key => {
      calls.push({ method: 'getItem', key });
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      calls.push({ method: 'setItem', key });
      values.set(key, value);
    },
    removeItem: key => {
      calls.push({ method: 'removeItem', key });
      values.delete(key);
    },
  };
};

const cookStrategy = (): QuestStrategyDefinition => {
  const walkthrough = questWalkthroughFor("Cook's Assistant");
  const strategy = walkthrough && questStrategyFromWalkthrough(walkthrough);
  if (!strategy) throw new Error("Cook's Assistant strategy fixture did not load.");
  return strategy;
};

const alternateStrategy = (): QuestStrategyDefinition => {
  const cook = cookStrategy();
  return {
    ...cook,
    questId: "Doric's Quest",
    actions: [
      { ...cook.actions[0], id: 'dorics-quest:bring-clay', dependsOn: [] },
      {
        ...cook.actions[1],
        id: 'dorics-quest:complete',
        dependsOn: ['dorics-quest:bring-clay'],
      },
    ],
  };
};

describe('RuneProof preview action storage', () => {
  it('keeps valid action IDs while removing unknown and inherited progress', () => {
    const strategy = cookStrategy();
    const inherited = Object.create({
      "Cook's Assistant": ['cooks-assistant:start-quest'],
    });

    expect(normalizeRuneProofPreviewActions(inherited, strategy)).toEqual({});
    expect(normalizeRuneProofPreviewActions({
      "Cook's Assistant": [
      'cooks-assistant:take-egg',
      'unknown-action',
      'cooks-assistant:take-egg',
      ],
    }, strategy)).toEqual({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    });
  });

  it('rejects oversized and corrupt stored progress', () => {
    const storage = memoryStorage();
    const strategy = cookStrategy();
    storage.values.set(
      runeProofPreviewActionStorageKey('oversized'),
      'x'.repeat(RUNEPROOF_PREVIEW_MAX_CHARS + 1),
    );
    storage.values.set(runeProofPreviewActionStorageKey('corrupt'), '{');

    expect(readRuneProofPreviewActions(storage, 'oversized', strategy)).toEqual({});
    expect(readRuneProofPreviewActions(storage, 'corrupt', strategy)).toEqual({});
  });

  it('keeps action progress isolated by run ID', () => {
    const storage = memoryStorage();
    const strategy = cookStrategy();
    writeRuneProofPreviewActions(storage, 'run-a', strategy, {
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    });
    writeRuneProofPreviewActions(storage, 'run-b', strategy, {
      "Cook's Assistant": ['cooks-assistant:make-flour'],
    });

    expect(readRuneProofPreviewActions(storage, 'run-a', strategy)).toEqual({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    });
    expect(readRuneProofPreviewActions(storage, 'run-b', strategy)).toEqual({
      "Cook's Assistant": ['cooks-assistant:make-flour'],
    });
    expect(runeProofPreviewActionStorageKey('run-a')).not.toBe(
      runeProofPreviewActionStorageKey('run-b'),
    );
  });

  it('returns only the current loaded strategy action IDs', () => {
    const storage = memoryStorage();
    const cook = cookStrategy();
    const alternate = alternateStrategy();
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
      "Doric's Quest": ['dorics-quest:bring-clay', 'cooks-assistant:take-egg'],
    }));

    expect(readRuneProofPreviewActions(storage, 'run-a', cook)).toEqual({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    });
    expect(readRuneProofPreviewActions(storage, 'run-a', alternate)).toEqual({
      "Doric's Quest": ['dorics-quest:bring-clay'],
    });
  });

  it('never reads or changes legacy item confirmation storage', () => {
    const storage = memoryStorage();
    const strategy = cookStrategy();
    const legacyKey = runeProofPreviewStorageKey('run-a');
    storage.values.set(legacyKey, JSON.stringify({ "Cook's Assistant": ['egg'] }));

    writeRuneProofPreviewActions(storage, 'run-a', strategy, {
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    });
    readRuneProofPreviewActions(storage, 'run-a', strategy);
    writeRuneProofPreviewActions(storage, 'run-a', strategy, {});

    expect(storage.values.get(legacyKey)).toBe(JSON.stringify({ "Cook's Assistant": ['egg'] }));
    expect(storage.calls.filter(call => call.key === legacyKey)).toEqual([]);
  });

  it('removes empty action progress and contains storage failures', () => {
    const storage = memoryStorage();
    const strategy = cookStrategy();
    const key = runeProofPreviewActionStorageKey('run-a');
    storage.values.set(key, JSON.stringify({ "Cook's Assistant": ['cooks-assistant:take-egg'] }));

    writeRuneProofPreviewActions(storage, 'run-a', strategy, {});
    expect(storage.values.has(key)).toBe(false);

    const unavailable: RuneProofStorage = {
      getItem: () => { throw new Error('read unavailable'); },
      setItem: () => { throw new Error('write unavailable'); },
      removeItem: () => { throw new Error('remove unavailable'); },
    };
    expect(readRuneProofPreviewActions(unavailable, 'run-a', strategy)).toEqual({});
    expect(() => writeRuneProofPreviewActions(unavailable, 'run-a', strategy, {
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    })).not.toThrow();
    expect(() => writeRuneProofPreviewActions(unavailable, 'run-a', strategy, {})).not.toThrow();
  });
});
