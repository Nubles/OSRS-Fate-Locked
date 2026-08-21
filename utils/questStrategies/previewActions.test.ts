import { describe, expect, it } from 'vitest';
import {
  RUNEPROOF_PREVIEW_MAX_CHARS,
  runeProofPreviewStorageKey,
  type RuneProofStorage,
} from '../questRoutes/previewChecks';
import type { QuestStrategyDefinition } from './model';
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

const cookActionIds = [
  'cooks-assistant:start-quest',
  'cooks-assistant:take-pot',
  'cooks-assistant:take-bucket',
  'cooks-assistant:milk-cow',
  'cooks-assistant:take-egg',
  'cooks-assistant:pick-grain',
  'cooks-assistant:make-flour',
  'cooks-assistant:return-to-cook',
  'cooks-assistant:complete',
] as const;

const strategy = (
  questId: string,
  actionIds: readonly string[],
  progressionPriority: number,
): QuestStrategyDefinition => ({
  questId,
  kind: 'quest',
  rolloutWave: 1,
  progressionPriority,
  revision: questId.toLowerCase().replaceAll(' ', '-'),
  source: {},
  sourceLines: [],
  actions: actionIds.map((id, index) => ({
    id,
    mapChunks: ['50,50'],
    coach: {
      consumes: [],
      fulfils: [],
      completion: index === actionIds.length - 1
        ? { kind: 'QUEST_COMPLETED', questId }
        : { kind: 'MANUAL' },
      fallbackPolicy: 'NONE',
    },
  })) as unknown as QuestStrategyDefinition['actions'],
} as unknown as QuestStrategyDefinition);

const cookStrategy = (): QuestStrategyDefinition => strategy(
  "Cook's Assistant",
  cookActionIds,
  1,
);

const sheepStrategy = (): QuestStrategyDefinition => strategy(
  'Sheep Shearer',
  ['sheep-shearer:start-with-fred', 'sheep-shearer:complete'],
  2,
);

const catalogue = (): readonly QuestStrategyDefinition[] => [cookStrategy(), sheepStrategy()];

describe('RuneProof preview action storage', () => {
  it('keeps every valid quest record while removing unknown and inherited progress', () => {
    const strategies = catalogue();
    const inherited = Object.create({
      "Cook's Assistant": ['cooks-assistant:start-quest'],
    });

    expect(normalizeRuneProofPreviewActions(inherited, strategies)).toEqual({});
    expect(normalizeRuneProofPreviewActions({
      "Cook's Assistant": [
        'cooks-assistant:complete',
        'unknown-action',
        'cooks-assistant:complete',
      ],
      'Sheep Shearer': ['sheep-shearer:start-with-fred'],
      'Unknown Quest': ['unknown:action'],
    }, strategies)).toEqual({
      "Cook's Assistant": ['cooks-assistant:complete'],
      'Sheep Shearer': ['sheep-shearer:start-with-fred'],
    });
  });

  it('rejects oversized and corrupt stored progress', () => {
    const storage = memoryStorage();
    const strategies = catalogue();
    storage.values.set(
      runeProofPreviewActionStorageKey('oversized'),
      'x'.repeat(RUNEPROOF_PREVIEW_MAX_CHARS + 1),
    );
    storage.values.set(runeProofPreviewActionStorageKey('corrupt'), '{');

    expect(readRuneProofPreviewActions(storage, 'oversized', strategies)).toEqual({});
    expect(readRuneProofPreviewActions(storage, 'corrupt', strategies)).toEqual({});
  });

  it('keeps complete catalogue progress isolated by run ID', () => {
    const storage = memoryStorage();
    const strategies = catalogue();
    writeRuneProofPreviewActions(storage, 'run-a', strategies, {
      "Cook's Assistant": ['cooks-assistant:complete'],
      'Sheep Shearer': ['sheep-shearer:start-with-fred'],
    });
    writeRuneProofPreviewActions(storage, 'run-b', strategies, {
      "Cook's Assistant": ['cooks-assistant:make-flour'],
    });

    expect(readRuneProofPreviewActions(storage, 'run-a', strategies)).toEqual({
      "Cook's Assistant": ['cooks-assistant:complete'],
      'Sheep Shearer': ['sheep-shearer:start-with-fred'],
    });
    expect(readRuneProofPreviewActions(storage, 'run-b', strategies)).toEqual({
      "Cook's Assistant": ['cooks-assistant:make-flour'],
    });
    expect(runeProofPreviewActionStorageKey('run-a')).not.toBe(
      runeProofPreviewActionStorageKey('run-b'),
    );
  });

  it('never reads or changes legacy item confirmation storage', () => {
    const storage = memoryStorage();
    const strategies = catalogue();
    const legacyKey = runeProofPreviewStorageKey('run-a');
    storage.values.set(legacyKey, JSON.stringify({ "Cook's Assistant": ['egg'] }));

    writeRuneProofPreviewActions(storage, 'run-a', strategies, {
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    });
    readRuneProofPreviewActions(storage, 'run-a', strategies);
    writeRuneProofPreviewActions(storage, 'run-a', strategies, {});

    expect(storage.values.get(legacyKey)).toBe(JSON.stringify({ "Cook's Assistant": ['egg'] }));
    expect(storage.calls.filter(call => call.key === legacyKey)).toEqual([]);
  });

  it('does not overwrite persisted progress when a valid catalogue payload exceeds 64 KiB', () => {
    const storage = memoryStorage();
    const oversizedActionId = 'x'.repeat(RUNEPROOF_PREVIEW_MAX_CHARS);
    const strategies = [strategy("Cook's Assistant", [oversizedActionId], 1)];
    const key = runeProofPreviewActionStorageKey('run-a');
    storage.values.set(key, '{"preserved":true}');

    writeRuneProofPreviewActions(storage, 'run-a', strategies, {
      "Cook's Assistant": [oversizedActionId],
    });

    expect(storage.values.get(key)).toBe('{"preserved":true}');
  });

  it('removes empty action progress and contains storage failures', () => {
    const storage = memoryStorage();
    const strategies = catalogue();
    const key = runeProofPreviewActionStorageKey('run-a');
    storage.values.set(key, JSON.stringify({ "Cook's Assistant": ['cooks-assistant:take-egg'] }));

    writeRuneProofPreviewActions(storage, 'run-a', strategies, {});
    expect(storage.values.has(key)).toBe(false);

    const unavailable: RuneProofStorage = {
      getItem: () => { throw new Error('read unavailable'); },
      setItem: () => { throw new Error('write unavailable'); },
      removeItem: () => { throw new Error('remove unavailable'); },
    };
    expect(readRuneProofPreviewActions(unavailable, 'run-a', strategies)).toEqual({});
    expect(() => writeRuneProofPreviewActions(unavailable, 'run-a', strategies, {
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    })).not.toThrow();
    expect(() => writeRuneProofPreviewActions(unavailable, 'run-a', strategies, {})).not.toThrow();
  });
});
