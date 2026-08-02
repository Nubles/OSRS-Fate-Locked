import { describe, expect, it } from 'vitest';
import type { GameState, LogEntry, UnlockState } from '../types';
import { EQUIPMENT_TIER_MAX } from '../config/rules';
import { serializeCurrent } from './gamePersistence';
import {
  CURRENT_SAVE_VERSION,
  MAX_COLLECTION_LOG_ENTRIES,
  MAX_COUNTER,
  MAX_HISTORY_DETAILS_CHARS,
  MAX_HISTORY_ENTRIES,
  MAX_IDENTIFIER_ARRAY,
  MAX_IDENTIFIER_CHARS,
  MAX_NOTE_CHARS,
  MAX_SAVE_BYTES,
  MAX_SEED_CHARS,
  MAX_USER_NOTES,
  parseAndMigrateSave,
  validateAndMigrateSave,
  type SaveErrorCode,
  type SaveValidationResult,
} from './saveSchema';
import { LEGACY_FATE_COMPENSATION_ID } from './fateCompensation';

const baseUnlocks = (): UnlockState => ({
  equipment: { Head: 0, Body: 0 },
  skills: { Hitpoints: 1 },
  levels: { Attack: 1, Hitpoints: 10 },
  regions: [],
  chunks: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  banks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
});

const VALID_RUN_ID = '123e4567-e89b-42d3-a456-426614174000';

const defaultsFixture = (): GameState => ({
  version: CURRENT_SAVE_VERSION,
  runId: VALID_RUN_ID,
  runRevision: 0,
  keys: 3,
  specialKeys: 0,
  chaosKeys: 0,
  bossStandardKeysAwarded: {},
  clueStandardKeysAwarded: 0,
  fatePoints: 0,
  fateCompensation: {
    releaseId: LEGACY_FATE_COMPENSATION_ID,
    status: 'not_eligible',
    chaosKeys: 0,
    pityKeys: 0,
    fatePoints: 0,
  },
  activeBuff: 'NONE',
  unlocks: baseUnlocks(),
  history: [],
  animationsEnabled: true,
  advisorsEnabled: false,
  revealAllFeatures: false,
  hasSeenOnboarding: false,
  pinnedGoals: [],
  userNotes: {},
  gameModeId: 'vanilla',
  gameModeLocked: false,
  loadout: {},
  xtremeMilestoneClaimed: 0,
  chunkedMilestoneClaimed: 0,
});

const fullStateFixture = (): GameState => ({
  version: CURRENT_SAVE_VERSION,
  runId: VALID_RUN_ID,
  runRevision: 0,
  keys: 17,
  specialKeys: 2,
  chaosKeys: 3,
  bossStandardKeysAwarded: { Zulrah: 1 },
  clueStandardKeysAwarded: 2,
  fatePoints: 41,
  fateCompensation: {
    releaseId: LEGACY_FATE_COMPENSATION_ID,
    status: 'full',
    chaosKeys: 2,
    pityKeys: 1,
    fatePoints: 5,
    choice: 'full',
  },
  activeBuff: 'LUCK',
  unlocks: {
    equipment: { Head: 9, Body: 4 },
    skills: { Hitpoints: 1, Attack: 10 },
    levels: { Attack: 99, Hitpoints: 10 },
    regions: ['Karamja'],
    chunks: ['46,51'],
    mobility: ['Fairy rings'],
    arcana: ['Protect from Melee'],
    housing: ['Kitchen'],
    merchants: ['Zaff'],
    minigames: ['Barbarian Assault'],
    bosses: ['Zulrah'],
    storage: ['Seed vault'],
    guilds: ['Myths Guild'],
    farming: ['Falador allotment'],
    slayerUnlocks: ['Bigger and Badder'],
    banks: ['11827'],
    quests: ['dragon_slayer_i'],
    diaries: ['Ardougne Easy'],
    cas: ['Easy'],
    completedTasks: ['ard_easy_1', 'ca_0'],
    collectionLog: { 104002: 3 },
  },
  history: [{
    id: 'history-1',
    timestamp: 1_752_000_000_000,
    type: 'ROLL_SUCCESS',
    source: 'Quest (Novice)',
    result: 'SUCCESS',
    rollValue: 12.5,
    threshold: 25,
    message: 'A key was earned.',
    details: 'The complete history detail.',
    meta: { roll: 12.5, nested: { values: [true, null, 'safe'] } },
    prevHash: 'prev',
    hash: 'hash',
  }],
  animationsEnabled: false,
  advisorsEnabled: true,
  revealAllFeatures: true,
  hasSeenOnboarding: true,
  pinnedGoals: ['first_goal'],
  userNotes: { first_goal: 'Try this next.' },
  gameModeId: 'custom',
  customMode: {
    pityEnabled: true,
    pityThreshold: 50,
    omniChanceBase: 2,
    ritualCostMultiplier: 1,
    regionModifiers: true,
    startArea: 'lumbridge',
    chunkGranularity: false,
    bankLocks: true,
  },
  gameModeLocked: true,
  rngSeed: 'FATE-2026-W30',
  loadout: { Head: 4151 },
  rival: {
    mode: 'friend',
    personaId: 'friend',
    name: 'Alice',
    emoji: '⚔️',
    keysPerDay: 0,
    seed: 42,
    startedAt: 1_752_000_000_000,
    lastSeenLead: -2.5,
    friendPct: 57.25,
    friendName: 'Alice',
  },
  linkedAccount: 'Alice',
  xtremeMilestoneClaimed: 4,
  chunkedMilestoneClaimed: 3,
});

const clone = <T>(value: T): T => structuredClone(value);

const candidate = (
  over: Record<string, unknown>,
  unlockOver?: Record<string, unknown>,
): unknown => {
  const state = clone(fullStateFixture()) as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(over)) state[key] = value;
  if (unlockOver) {
    const unlocks = state.unlocks as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(unlockOver)) unlocks[key] = value;
  }
  return state;
};

const expectAccepted = (result: SaveValidationResult) => {
  expect(result.ok).toBe(true);
  if (result.ok === false) throw new Error(`${result.code}: ${result.path ?? ''}`);
  return result;
};

const expectRejected = (
  input: unknown,
  code: SaveErrorCode,
  path?: string,
) => {
  const result = validateAndMigrateSave(input, defaultsFixture());
  expect(result).toMatchObject({ ok: false, code, ...(path ? { path } : {}) });
  return result;
};

describe('save schema compatibility', () => {
  it('accepts a complete strict v4 export and preserves every GameState field', () => {
    const current = fullStateFixture();
    current.version = 4;
    expect(validateAndMigrateSave(current, defaultsFixture())).toEqual({
      ok: true,
      state: current,
      sourceVersion: 4,
      warnings: [],
    });
  });

  it('migrates a v3 run into a frozen pending compensation offer', () => {
    const legacy = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    legacy.version = 3;
    delete legacy.fateCompensation;
    legacy.fatePoints = 45;
    const unlocks = legacy.unlocks as Record<string, unknown>;
    unlocks.levels = { Attack: 30, Hitpoints: 10 };
    legacy.history = [
      ...Array.from({ length: 40 }, (_, index) => ({
        id: `novice-${index}`,
        timestamp: index,
        type: 'ROLL_FAIL',
        source: 'Quest (Novice)',
        message: 'No Key.',
        meta: { fatePointsEarned: 1 },
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `master-${index}`,
        timestamp: 40 + index,
        type: 'ROLL_FAIL',
        source: 'Quest (Master)',
        message: 'No Key.',
        meta: { fatePointsEarned: 1 },
      })),
    ];

    const result = expectAccepted(validateAndMigrateSave(legacy, defaultsFixture()));

    expect(result.sourceVersion).toBe(3);
    expect(result.state.version).toBe(4);
    expect(result.state.fateCompensation).toEqual({
      releaseId: LEGACY_FATE_COMPENSATION_ID,
      status: 'pending',
      chaosKeys: 1,
      pityKeys: 1,
      fatePoints: 5,
    });
  });

  it('migrates a zero-benefit v3 run directly to not eligible', () => {
    const legacy = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    legacy.version = 3;
    delete legacy.fateCompensation;
    legacy.fatePoints = 1;
    (legacy.unlocks as Record<string, unknown>).levels = { Attack: 1, Hitpoints: 10 };
    legacy.history = [{
      id: 'legacy-fail',
      timestamp: 1,
      type: 'ROLL_FAIL',
      source: 'Quest (Novice)',
      message: 'No Key.',
      meta: { fatePointsEarned: 1 },
    }];

    const result = expectAccepted(validateAndMigrateSave(legacy, defaultsFixture()));

    expect(result.state.fateCompensation).toEqual({
      releaseId: LEGACY_FATE_COMPENSATION_ID,
      status: 'not_eligible',
      chaosKeys: 0,
      pityKeys: 0,
      fatePoints: 0,
    });
  });


  it('freezes conservative fractional metadata through a v3-to-v4 save round trip', () => {
    const legacy = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    legacy.version = 3;
    delete legacy.fateCompensation;
    legacy.fatePoints = 1;
    (legacy.unlocks as Record<string, unknown>).levels = { Attack: 1, Hitpoints: 10 };
    legacy.history = [{
      id: 'fractional-fate',
      timestamp: 1,
      type: 'ROLL_FAIL',
      source: 'Attack Level 80',
      message: 'No Key.',
      meta: { fatePointsEarned: 1.5 },
    }];

    const migrated = expectAccepted(validateAndMigrateSave(legacy, defaultsFixture()));
    const reloaded = expectAccepted(parseAndMigrateSave(
      serializeCurrent(migrated.state),
      defaultsFixture(),
    ));

    expect(migrated.state.fateCompensation).toEqual({
      releaseId: LEGACY_FATE_COMPENSATION_ID,
      status: 'pending',
      chaosKeys: 0,
      pityKeys: 0,
      fatePoints: 3,
    });
    expect(reloaded.state).toEqual(migrated.state);
  });
  it('loads version-3 quest and miniquest completion IDs without reclassification', () => {
    const completedIds = [
      "Witch's Potion",
      'In Search of Knowledge',
      'RFD: The Cook',
      'RFD: Dwarf',
      'RFD: Goblins',
      'RFD: Pirate Pete',
      'RFD: Lumbridge Guide',
      'RFD: Evil Dave',
      'RFD: Skrach Uglogwee',
      'RFD: Sir Amik Varze',
      'RFD: King Awowogei',
      'RFD: Finale',
    ];
    const current = fullStateFixture();
    current.version = 3;
    current.unlocks.quests = completedIds;

    const result = expectAccepted(validateAndMigrateSave(current, defaultsFixture()));

    expect(result.sourceVersion).toBe(3);
    expect(result.state.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.state.unlocks.quests).toEqual(completedIds);
  });
  it('renames a lone Elf Camp unlock without refunding a key', () => {
    const input = candidate({}, {
      regions: ['Prifddinas', 'Elf Camp', 'Lletya'],
    });
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.state.keys).toBe(17);
    expect(result.state.unlocks.regions).toEqual([
      'Prifddinas',
      'Iorwerth Camp',
      'Lletya',
    ]);
    expect(result.warnings).toEqual([{
      code: 'migrated',
      message: 'Save data was migrated to the current format.',
    }]);
  });

  it('freezes bounded over-limit Pity compensation through a v3-to-v4 save round trip', () => {
    const legacy = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    legacy.version = 3;
    delete legacy.fateCompensation;
    legacy.fatePoints = MAX_COUNTER;
    legacy.history = Array.from({ length: 51 }, (_, index) => ({
      id: `max-fate-${index}`,
      timestamp: index,
      type: 'ROLL_FAIL',
      source: 'Quest (Master)',
      message: 'No Key.',
      meta: { fatePointsEarned: MAX_COUNTER },
    }));

    const migrated = expectAccepted(validateAndMigrateSave(legacy, defaultsFixture()));
    const reloaded = expectAccepted(parseAndMigrateSave(
      serializeCurrent(migrated.state),
      defaultsFixture(),
    ));

    expect(migrated.state.fateCompensation).toEqual({
      releaseId: LEGACY_FATE_COMPENSATION_ID,
      status: 'pending',
      chaosKeys: 8,
      pityKeys: MAX_COUNTER,
      fatePoints: 49,
    });
    expect(reloaded.state).toEqual(migrated.state);
  });

  it('refunds exactly one regular key when both Elf Camp names were paid for', () => {
    const input = candidate({}, {
      regions: ['Prifddinas', 'Elf Camp', 'Iorwerth Camp', 'Lletya'],
    });
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.state.keys).toBe(18);
    expect(result.state.unlocks.regions).toEqual([
      'Prifddinas',
      'Iorwerth Camp',
      'Lletya',
    ]);
  });

  it('does not modify a canonical Iorwerth Camp save', () => {
    const input = candidate({}, {
      regions: ['Prifddinas', 'Iorwerth Camp', 'Lletya'],
    });
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.state.keys).toBe(17);
    expect(result.state.unlocks.regions).toEqual([
      'Prifddinas',
      'Iorwerth Camp',
      'Lletya',
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('does not refund twice when a migrated save is revalidated', () => {
    const input = candidate({}, {
      regions: ['Elf Camp', 'Iorwerth Camp'],
    });
    const first = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));
    const second = expectAccepted(validateAndMigrateSave(first.state, defaultsFixture()));

    expect(first.state.keys).toBe(18);
    expect(second.state).toEqual(first.state);
    expect(second.warnings).toEqual([]);
  });

  it('preserves complete history and unrelated region order during migration', () => {
    const input = candidate({}, {
      regions: ['Karamja', 'Elf Camp', 'Iorwerth Camp', 'Falador'],
    }) as GameState;
    const originalHistory = structuredClone(input.history);
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.state.history).toEqual(originalHistory);
    expect(result.state.unlocks.regions).toEqual([
      'Karamja',
      'Iorwerth Camp',
      'Falador',
    ]);
  });

  it('applies the same duplicate refund to an unversioned legacy save', () => {
    const input = candidate({}, {
      regions: ['Elf Camp', 'Iorwerth Camp'],
    }) as Record<string, unknown>;
    delete input.version;
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.sourceVersion).toBe(0);
    expect(result.state.keys).toBe(18);
    expect(result.state.unlocks.regions).toEqual(['Iorwerth Camp']);
  });

  it('saturates a duplicate refund at MAX_COUNTER', () => {
    const input = candidate({ keys: MAX_COUNTER }, {
      regions: ['Elf Camp', 'Iorwerth Camp'],
    });
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.state.keys).toBe(MAX_COUNTER);
    expect(result.state.unlocks.regions).toEqual(['Iorwerth Camp']);
    expect(result.warnings).toHaveLength(1);
  });
  it('migrates supported legacy aliases exactly once without double-counting collection aliases', () => {
    const legacy = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    delete legacy.version;
    const unlocks = legacy.unlocks as unknown as Record<string, unknown>;
    delete unlocks.arcana;
    delete unlocks.housing;
    unlocks.power = ['Protect from Melee', 'Protect from Melee'];
    unlocks.poh = ['Kitchen'];
    unlocks.completedTasks = [
      'ard_easy_1', 'ard_easy_1',
      'ca_0', 'ca_0',
      'kar_elite_3', 'kar_elite_3',
      'unknown_future_task', 'unknown_future_task',
      'toString', 'constructor', 'constructor',
    ];
    unlocks.collectionLog = { 104011: 5, 104002: 3 };

    const first = expectAccepted(validateAndMigrateSave(legacy, defaultsFixture()));
    const second = expectAccepted(validateAndMigrateSave(first.state, defaultsFixture()));
    expect(first.sourceVersion).toBe(0);
    expect(first.warnings).toHaveLength(1);
    expect(first.state.unlocks.arcana).toEqual(['Protect from Melee']);
    expect(first.state.unlocks.housing).toEqual(['Kitchen']);
    expect(first.state.unlocks.completedTasks).toEqual([
      'ard_easy_1',
      'ca_0',
      'kar_elite_3',
      'unknown_future_task',
      'toString',
      'constructor',
    ]);
    expect(first.state.unlocks.collectionLog).toEqual({ 104002: 5 });
    expect(second.state).toEqual(first.state);
    expect(second.warnings).toEqual([]);
  });

  it('treats a missing version as legacy, migrates version 1, and rejects future versions', () => {
    expect(expectAccepted(validateAndMigrateSave({ keys: 1 }, defaultsFixture())).sourceVersion).toBe(0);
    expect(expectAccepted(validateAndMigrateSave(fullStateFixture(), defaultsFixture())).sourceVersion)
      .toBe(CURRENT_SAVE_VERSION);

    const versionOne = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    versionOne.version = 1;
    delete versionOne.bossStandardKeysAwarded;
    delete versionOne.clueStandardKeysAwarded;
    const migrated = expectAccepted(validateAndMigrateSave(versionOne, defaultsFixture()));
    expect(migrated.sourceVersion).toBe(1);
    expect(migrated.state.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.state.bossStandardKeysAwarded).toEqual({});
    expect(migrated.state.clueStandardKeysAwarded).toBe(0);
    expect(migrated.warnings).toHaveLength(1);

    expectRejected({ version: 1 }, 'invalid_field', 'keys');
    expectRejected({ version: CURRENT_SAVE_VERSION + 1 }, 'unsupported_version', 'version');
    expectRejected({ version: 0 }, 'unsupported_version', 'version');
  });

  it('normalizes malformed Vanilla progression counters while preserving valid capped history', () => {
    const versionOne = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    versionOne.version = 1;
    versionOne.bossStandardKeysAwarded = { Brutus: 9, Zulrah: 1, Unknown: 3 };
    versionOne.clueStandardKeysAwarded = -4;

    const migrated = expectAccepted(validateAndMigrateSave(versionOne, defaultsFixture()));
    expect(migrated.state.bossStandardKeysAwarded).toEqual({ Brutus: 1, Zulrah: 1 });
    expect(migrated.state.clueStandardKeysAwarded).toBe(0);
    expect(migrated.state.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('clamps oversized legacy clue progression to the strict v3 safety bound', () => {
    const versionTwo = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    versionTwo.version = 2;
    versionTwo.clueStandardKeysAwarded = MAX_COUNTER + 1;

    const migrated = expectAccepted(validateAndMigrateSave(versionTwo, defaultsFixture()));
    expect(migrated.state.clueStandardKeysAwarded).toBe(MAX_COUNTER);
    expect(migrated.state.version).toBe(CURRENT_SAVE_VERSION);
  });
  it('migrates the feature-branch v2 shape into v4 while supplying newer main run metadata', () => {
    const featureBranchV2 = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    featureBranchV2.version = 2;
    delete featureBranchV2.runId;
    delete featureBranchV2.runRevision;

    const migrated = expectAccepted(validateAndMigrateSave(featureBranchV2, defaultsFixture()));
    expect(migrated.sourceVersion).toBe(2);
    expect(migrated.state.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.state.runId).toBe(VALID_RUN_ID);
    expect(migrated.state.runRevision).toBe(0);
    expect(migrated.state.bossStandardKeysAwarded).toEqual({ Zulrah: 1 });
    expect(migrated.state.clueStandardKeysAwarded).toBe(2);
    expect(migrated.warnings).toHaveLength(1);
  });

  it('rejects a v3 boss counter beyond its configured reserve cap', () => {
    const malformed = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    malformed.version = 3;
    malformed.bossStandardKeysAwarded = { Zulrah: 3 };

    expectRejected(malformed, 'invalid_number', 'bossStandardKeysAwarded.Zulrah');
  });

  it('rejects unknown and inherited boss counters in a strict v3 export', () => {
    const unknown = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    unknown.version = 3;
    unknown.bossStandardKeysAwarded = { Unknown: 1 };
    expectRejected(unknown, 'invalid_field', 'bossStandardKeysAwarded.Unknown');

    const inherited = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    inherited.version = 3;
    inherited.bossStandardKeysAwarded = Object.create({ Zulrah: 1 });
    expectRejected(inherited, 'invalid_field', 'bossStandardKeysAwarded');
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY])(
    'rejects malformed v3 clue counter %s instead of silently repairing it',
    clueStandardKeysAwarded => {
      const malformed = clone(fullStateFixture()) as unknown as Record<string, unknown>;
      malformed.version = 3;
      malformed.clueStandardKeysAwarded = clueStandardKeysAwarded;
      expectRejected(malformed, 'invalid_number', 'clueStandardKeysAwarded');
    },
  );

  it.each([
    'keys', 'specialKeys', 'chaosKeys', 'fatePoints', 'activeBuff',
    'bossStandardKeysAwarded', 'clueStandardKeysAwarded',
    'unlocks', 'history', 'pinnedGoals', 'userNotes', 'fateCompensation',
  ])('requires current-version field %s instead of defaulting it', field => {
    const truncated = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    delete truncated[field];
    expectRejected(truncated, 'invalid_field', field);
  });

  it('requires every current-version unlock member instead of defaulting truncated progress', () => {
    const requiredUnlockKeys = [
      'equipment', 'skills', 'levels',
      'regions', 'chunks', 'mobility', 'arcana', 'housing', 'merchants',
      'minigames', 'bosses', 'storage', 'guilds', 'farming', 'slayerUnlocks',
      'banks', 'quests', 'diaries', 'cas', 'completedTasks', 'collectionLog',
    ] as const;

    expectRejected(candidate({ unlocks: {} }), 'invalid_unlocks', 'unlocks.equipment');
    for (const key of requiredUnlockKeys) {
      const truncated = clone(fullStateFixture());
      delete truncated.unlocks[key];
      expectRejected(truncated, 'invalid_unlocks', `unlocks.${key}`);
    }
  });

  it('requires canonical nested unlock record keys on current-version saves', () => {
    const defaults = defaultsFixture();
    const fixedRecords = ['equipment', 'skills', 'levels'] as const;

    for (const record of fixedRecords) {
      const canonicalKeys = Object.keys(defaults.unlocks[record]);
      const empty = clone(fullStateFixture());
      empty.unlocks[record] = {};
      expectRejected(empty, 'invalid_unlocks', `unlocks.${record}.${canonicalKeys[0]}`);

      for (const key of canonicalKeys) {
        const truncated = clone(fullStateFixture());
        delete truncated.unlocks[record][key];
        expectRejected(truncated, 'invalid_unlocks', `unlocks.${record}.${key}`);
      }
    }
  });

  it('continues filling canonical nested unlock keys for versionless legacy saves', () => {
    const legacy = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    delete legacy.version;
    const unlocks = legacy.unlocks as Record<string, unknown>;
    unlocks.equipment = {};
    unlocks.skills = {};
    unlocks.levels = {};

    const accepted = expectAccepted(validateAndMigrateSave(legacy, defaultsFixture()));
    expect(accepted.sourceVersion).toBe(0);
    expect(accepted.state.unlocks.equipment).toEqual(defaultsFixture().unlocks.equipment);
    expect(accepted.state.unlocks.skills).toEqual(defaultsFixture().unlocks.skills);
    expect(accepted.state.unlocks.levels).toEqual(defaultsFixture().unlocks.levels);
  });

  it('fills absent optional fields from fresh defaults and never shares mutable defaults', () => {
    const input = clone(fullStateFixture()) as unknown as Record<string, unknown>;
    for (const key of [
      'animationsEnabled', 'advisorsEnabled', 'revealAllFeatures', 'hasSeenOnboarding',
      'gameModeId', 'customMode', 'gameModeLocked',
      'rngSeed', 'loadout', 'rival', 'linkedAccount', 'xtremeMilestoneClaimed',
      'chunkedMilestoneClaimed',
    ]) delete input[key];
    const accepted = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));
    expect(accepted.state).toMatchObject({
      animationsEnabled: true,
      advisorsEnabled: false,
      revealAllFeatures: false,
      hasSeenOnboarding: false,
      gameModeId: 'vanilla',
      gameModeLocked: false,
      loadout: {},
      xtremeMilestoneClaimed: 0,
      chunkedMilestoneClaimed: 0,
    });
    accepted.state.unlocks.regions.push('Mutated');
    expect(defaultsFixture().unlocks.regions).toEqual([]);
  });

  it('de-duplicates every identifier array in first-seen order', () => {
    const accepted = expectAccepted(validateAndMigrateSave(
      candidate({ pinnedGoals: ['b', 'a', 'b'] }, {
        regions: ['Karamja', 'Falador', 'Karamja'],
        completedTasks: ['ca_0', 'ard_easy_1', 'ca_0'],
      }),
      defaultsFixture(),
    ));
    expect(accepted.state.pinnedGoals).toEqual(['b', 'a']);
    expect(accepted.state.unlocks.regions).toEqual(['Karamja', 'Falador']);
    expect(accepted.state.unlocks.completedTasks).toEqual(['ca_0', 'ard_easy_1']);
  });
});

describe('save schema structural rejection', () => {
  it.each([null, [], new Date(), new Map(), Object.create({ inherited: true })])(
    'rejects a non-plain root: %s',
    input => { expectRejected(input, 'invalid_root'); },
  );

  it('accepts a null-prototype root while rebuilding an ordinary safe state', () => {
    const input = Object.create(null) as Record<string, unknown>;
    input.keys = 7;
    const accepted = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));
    expect(accepted.state.keys).toBe(7);
    expect(Object.getPrototypeOf(accepted.state)).toBe(Object.prototype);
  });

  it('rejects a supplied non-RFC 4122 v4 run id', () => {
    expectRejected(candidate({ runId: 'fixture-run' }), 'invalid_field', 'runId');
  });

  it('rejects unknown top-level and unlock fields', () => {
    expectRejected(candidate({ surprise: true }), 'invalid_field', 'surprise');
    expectRejected(candidate({}, { surprise: [] }), 'invalid_unlocks', 'unlocks.surprise');
  });

  it.each(['__proto__', 'prototype', 'constructor'])(
    'rejects dangerous key %s at any depth',
    key => {
      const input = clone(fullStateFixture());
      Object.defineProperty(input.unlocks, key, {
        value: { secret: 'never' },
        enumerable: true,
      });
      expectRejected(input, 'invalid_field', `unlocks.${key}`);
    },
  );

  it('rejects dangerous, symbol, function, BigInt, cyclic, and sparse programmatic shapes', () => {
    const symbolKey = candidate({});
    Object.defineProperty(symbolKey as object, Symbol('hidden'), { value: true, enumerable: true });
    expectRejected(symbolKey, 'invalid_field');
    expectRejected(candidate({ keys: () => 1 }), 'invalid_number', 'keys');
    expectRejected(candidate({ keys: 1n }), 'invalid_number', 'keys');

    const cyclicMeta: Record<string, unknown> = {};
    cyclicMeta.self = cyclicMeta;
    expectRejected(candidate({ history: [{ ...fullStateFixture().history[0], meta: cyclicMeta }] }), 'invalid_history', 'history[0].meta.self');

    const sparseHistory = new Array(2);
    sparseHistory[0] = fullStateFixture().history[0];
    expectRejected(candidate({ history: sparseHistory }), 'invalid_history', 'history[1]');
    const sparseRegions = new Array(2);
    sparseRegions[0] = 'Karamja';
    expectRejected(candidate({}, { regions: sparseRegions }), 'invalid_unlocks', 'unlocks.regions[1]');
    const sparseMeta = new Array(2);
    sparseMeta[0] = true;
    expectRejected(candidate({ history: [{ ...fullStateFixture().history[0], meta: sparseMeta }] }), 'invalid_history', 'history[0].meta[1]');
  });

  it('rejects invalid history records, unknown history fields, oversized metadata, and excessive depth', () => {
    expectRejected(candidate({ history: [null] }), 'invalid_history', 'history[0]');
    expectRejected(candidate({ history: [{ ...fullStateFixture().history[0], surprise: true }] }), 'invalid_history', 'history[0].surprise');
    expectRejected(candidate({ history: [{ ...fullStateFixture().history[0], type: 'ROLL' }] }), 'invalid_history', 'history[0].type');
    expectRejected(candidate({ history: [{ ...fullStateFixture().history[0], details: 'x'.repeat(MAX_HISTORY_DETAILS_CHARS + 1) }] }), 'invalid_history', 'history[0].details');
    expectRejected(candidate({ history: [{ ...fullStateFixture().history[0], meta: { text: 'x'.repeat(MAX_HISTORY_DETAILS_CHARS + 1) } }] }), 'invalid_history', 'history[0].meta.text');
    let deep: Record<string, unknown> = {};
    for (let index = 0; index < 40; index += 1) deep = { next: deep };
    expectRejected(candidate({ history: [{ ...fullStateFixture().history[0], meta: deep }] }), 'invalid_history');
  });
});

describe('save schema numeric and enum boundaries', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, MAX_COUNTER + 1, 1.5])(
    'rejects invalid key counters: %s',
    value => { expectRejected(candidate({ keys: value }), 'invalid_number', 'keys'); },
  );

  it('bounds base thresholds like effective history thresholds', () => {
    for (const key of ['baseThreshold', 'threshold'] as const) {
      for (const value of [-1, MAX_COUNTER + 1]) {
        expectRejected(candidate({
          history: [{ ...fullStateFixture().history[0], [key]: value }],
        }), 'invalid_history', `history[0].${key}`);
      }
    }
  });

  it.each([0, 100, 1.5, Number.NaN])(
    'rejects impossible skill levels: %s',
    level => { expectRejected(candidate({}, { levels: { Attack: level } }), 'invalid_number', 'unlocks.levels.Attack'); },
  );

  it.each([-1, 11, 1.5])(
    'rejects impossible skill method tiers: %s',
    tier => { expectRejected(candidate({}, { skills: { Attack: tier } }), 'invalid_number', 'unlocks.skills.Attack'); },
  );

  it.each([-1, EQUIPMENT_TIER_MAX + 1, 1.5])(
    'rejects impossible equipment tiers: %s',
    tier => { expectRejected(candidate({}, { equipment: { Head: tier } }), 'invalid_number', 'unlocks.equipment.Head'); },
  );

  it('accepts exact counter, level, method-tier, equipment, and timestamp boundaries', () => {
    const accepted = expectAccepted(validateAndMigrateSave(candidate(
      {
        keys: 0,
        specialKeys: MAX_COUNTER,
        history: [{ ...fullStateFixture().history[0], timestamp: Number.MAX_SAFE_INTEGER }],
        xtremeMilestoneClaimed: MAX_COUNTER,
      },
      {
        levels: { Attack: 1, Hitpoints: 99 },
        skills: { Attack: 0, Hitpoints: 10 },
        equipment: { Head: 0, Body: EQUIPMENT_TIER_MAX },
        collectionLog: { 1: MAX_COUNTER },
      },
    ), defaultsFixture()));
    expect(accepted.state.keys).toBe(0);
    expect(accepted.state.specialKeys).toBe(MAX_COUNTER);
  });

  it('rejects invalid timestamps, booleans, enums, loadout values, rival values, and custom rules', () => {
    expectRejected(candidate({ history: [{ ...fullStateFixture().history[0], timestamp: -1 }] }), 'invalid_history', 'history[0].timestamp');
    expectRejected(candidate({ history: [{ ...fullStateFixture().history[0], timestamp: Number.MAX_SAFE_INTEGER + 1 }] }), 'invalid_history', 'history[0].timestamp');
    expectRejected(candidate({ animationsEnabled: 1 }), 'invalid_field', 'animationsEnabled');
    expectRejected(candidate({ activeBuff: 'POWER' }), 'invalid_field', 'activeBuff');
    expectRejected(candidate({ loadout: { Head: -1 } }), 'invalid_number', 'loadout.Head');
    expectRejected(candidate({ loadout: { Head: 1.5 } }), 'invalid_number', 'loadout.Head');
    expectRejected(candidate({ loadout: { NotARealSlot: 4151 } }), 'invalid_field', 'loadout.NotARealSlot');
    expectRejected(candidate({ rival: { ...fullStateFixture().rival, mode: 'ghost' } }), 'invalid_field', 'rival.mode');
    expectRejected(candidate({ rival: { ...fullStateFixture().rival, friendPct: 101 } }), 'invalid_number', 'rival.friendPct');
    expectRejected(candidate({ customMode: { ...fullStateFixture().customMode, pityThreshold: 9 } }), 'invalid_number', 'customMode.pityThreshold');
    expectRejected(candidate({ customMode: { ...fullStateFixture().customMode, omniChanceBase: 26 } }), 'invalid_number', 'customMode.omniChanceBase');
    expectRejected(candidate({ customMode: { ...fullStateFixture().customMode, ritualCostMultiplier: 2.51 } }), 'invalid_number', 'customMode.ritualCostMultiplier');
    expectRejected(candidate({ customMode: { ...fullStateFixture().customMode, startArea: 'everywhere' } }), 'invalid_field', 'customMode.startArea');
    expectRejected(candidate({ customMode: { ...fullStateFixture().customMode, unknown: true } }), 'invalid_field', 'customMode.unknown');
  });
});

describe('fate compensation validation', () => {
  const offer = (over: Record<string, unknown> = {}) => ({
    releaseId: LEGACY_FATE_COMPENSATION_ID,
    status: 'pending',
    chaosKeys: 1,
    pityKeys: 2,
    fatePoints: 3,
    ...over,
  });

  it('rejects an unknown release id', () => {
    expectRejected(
      candidate({ fateCompensation: offer({ releaseId: 'unknown-release' }) }),
      'invalid_field',
      'fateCompensation.releaseId',
    );
  });

  it.each([
    [{ status: 'waiting' }, 'fateCompensation.status'],
    [{ choice: 'partial', status: 'chaos' }, 'fateCompensation.choice'],
    [{ choice: 'full', status: 'chaos' }, 'fateCompensation.choice'],
  ] as const)('rejects invalid compensation enum %o', (over, path) => {
    expectRejected(candidate({ fateCompensation: offer(over) }), 'invalid_field', path);
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY, MAX_COUNTER + 1])(
    'rejects invalid compensation award value %s',
    value => {
      for (const field of ['chaosKeys', 'pityKeys', 'fatePoints'] as const) {
        expectRejected(
          candidate({ fateCompensation: offer({ [field]: value }) }),
          'invalid_number',
          `fateCompensation.${field}`,
        );
      }
    },
  );

  it.each(['none', 'chaos', 'full'] as const)(
    'requires a choice for resolved status %s',
    status => {
      expectRejected(
        candidate({ fateCompensation: offer({ status }) }),
        'invalid_field',
        'fateCompensation.choice',
      );
    },
  );

  it.each(['pending', 'not_eligible'] as const)(
    'rejects status %s when it already has a choice',
    status => {
      expectRejected(
        candidate({ fateCompensation: offer({ status, choice: 'full' }) }),
        'invalid_field',
        'fateCompensation.choice',
      );
    },
  );

  it('accepts compensation history metadata in a resolved v4 save', () => {
    const accepted = expectAccepted(validateAndMigrateSave(candidate({
      history: [{
        id: 'compensation',
        timestamp: 1,
        type: 'COMPENSATION',
        message: 'Fate compensation resolved: full',
        meta: { choice: 'full', chaosKeysAwarded: 2, pityKeysAwarded: 1, fatePointsAfter: 5 },
      }],
    }), defaultsFixture()));

    expect(accepted.state.history[0].type).toBe('COMPENSATION');
  });
});


describe('save schema resource limits', () => {
  it('accepts 100,000 history entries and rejects 100,001', { timeout: 30_000 }, () => {
    const entry: LogEntry = {
      id: 'same-id',
      timestamp: 0,
      type: 'ROLL_FAIL',
      message: 'No key.',
    };
    expectAccepted(validateAndMigrateSave(candidate({ history: Array(MAX_HISTORY_ENTRIES).fill(entry) }), defaultsFixture()));
    expectRejected(candidate({ history: Array(MAX_HISTORY_ENTRIES + 1).fill(entry) }), 'invalid_history', 'history');
  });

  it('accepts 25,000 identifiers and rejects 25,001', { timeout: 20_000 }, () => {
    const ids = Array.from({ length: MAX_IDENTIFIER_ARRAY }, (_, index) => `id-${index}`);
    expect(expectAccepted(validateAndMigrateSave(candidate({ pinnedGoals: ids }), defaultsFixture())).state.pinnedGoals).toHaveLength(MAX_IDENTIFIER_ARRAY);
    expectRejected(candidate({ pinnedGoals: [...ids, 'too-many'] }), 'invalid_field', 'pinnedGoals');
  });

  it('accepts 25,000 collection entries and rejects 25,001', { timeout: 20_000 }, () => {
    const atLimit = Object.fromEntries(Array.from(
      { length: MAX_COLLECTION_LOG_ENTRIES },
      (_, index) => [String(index + 1), 1],
    ));
    expect(Object.keys(expectAccepted(validateAndMigrateSave(candidate({}, { collectionLog: atLimit }), defaultsFixture())).state.unlocks.collectionLog)).toHaveLength(MAX_COLLECTION_LOG_ENTRIES);
    atLimit[String(MAX_COLLECTION_LOG_ENTRIES + 1)] = 1;
    expectRejected(candidate({}, { collectionLog: atLimit }), 'invalid_unlocks', 'unlocks.collectionLog');
  });

  it('accepts 5,000 notes and rejects 5,001 and oversized notes', () => {
    const atLimit = Object.fromEntries(Array.from(
      { length: MAX_USER_NOTES },
      (_, index) => [`note-${index}`, 'safe'],
    ));
    expect(Object.keys(expectAccepted(validateAndMigrateSave(candidate({ userNotes: atLimit }), defaultsFixture())).state.userNotes)).toHaveLength(MAX_USER_NOTES);
    atLimit.too_many = 'no';
    expectRejected(candidate({ userNotes: atLimit }), 'invalid_field', 'userNotes');
    expectRejected(candidate({ userNotes: { note: 'x'.repeat(MAX_NOTE_CHARS + 1) } }), 'invalid_field', 'userNotes.note');
  });

  it('pins identifier, details, seed, and note string boundaries', () => {
    const identifier = 'i'.repeat(MAX_IDENTIFIER_CHARS);
    const accepted = expectAccepted(validateAndMigrateSave(candidate({
      pinnedGoals: [identifier],
      linkedAccount: identifier,
      rngSeed: 's'.repeat(MAX_SEED_CHARS),
      userNotes: { [identifier]: 'n'.repeat(MAX_NOTE_CHARS) },
      history: [{
        ...fullStateFixture().history[0],
        id: identifier,
        details: 'd'.repeat(MAX_HISTORY_DETAILS_CHARS),
      }],
    }), defaultsFixture()));
    expect(accepted.state.linkedAccount).toBe(identifier);
    expectRejected(candidate({ pinnedGoals: [`${identifier}x`] }), 'invalid_field', 'pinnedGoals[0]');
    expectRejected(candidate({ linkedAccount: `${identifier}x` }), 'invalid_field', 'linkedAccount');
    expectRejected(candidate({ rngSeed: 's'.repeat(MAX_SEED_CHARS + 1) }), 'invalid_field', 'rngSeed');
  });
});

describe('JSON parsing boundary', () => {
  it('checks UTF-8 bytes before parsing and rejects invalid JSON safely', () => {
    const exactLimit = `{${' '.repeat(MAX_SAVE_BYTES - 2)}}`;
    expect(expectAccepted(parseAndMigrateSave(exactLimit, defaultsFixture())).sourceVersion).toBe(0);
    const oversizedUtf8 = `"${'é'.repeat(Math.floor(MAX_SAVE_BYTES / 2) + 1)}"`;
    expect(parseAndMigrateSave(oversizedUtf8, defaultsFixture())).toMatchObject({
      ok: false,
      code: 'too_large',
    });
    const secret = 'SUPER-SECRET-SAVE-CONTENT';
    const invalid = parseAndMigrateSave(`{${secret}`, defaultsFixture());
    expect(invalid).toMatchObject({ ok: false, code: 'invalid_json' });
    if (invalid.ok === true) throw new Error('expected invalid JSON rejection');
    expect(invalid.message).not.toContain(secret);
  });

  it('round-trips a resolved v4 choice without recalculating eligibility', () => {
    const current = fullStateFixture();
    current.version = 4;
    const accepted = expectAccepted(validateAndMigrateSave(current, defaultsFixture()));
    const reparsed = expectAccepted(parseAndMigrateSave(serializeCurrent(accepted.state), defaultsFixture()));
    expect(reparsed.state).toEqual(accepted.state);
    expect(reparsed.state.fateCompensation).toEqual(current.fateCompensation);
  });
});
