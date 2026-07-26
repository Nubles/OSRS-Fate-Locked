import { describe, expect, it } from 'vitest';
import type { GameState, LogEntry, UnlockState } from '../types';
import { EQUIPMENT_TIER_MAX } from '../config/rules';
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

const defaultsFixture = (): GameState => ({
  version: CURRENT_SAVE_VERSION,
  runId: 'fixture-run',
  runRevision: 0,
  keys: 3,
  specialKeys: 0,
  chaosKeys: 0,
  fatePoints: 0,
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
  runId: 'fixture-run',
  runRevision: 0,
  keys: 17,
  specialKeys: 2,
  chaosKeys: 3,
  fatePoints: 41,
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
  it('accepts a complete current export and preserves every GameState field', () => {
    const current = fullStateFixture();
    expect(validateAndMigrateSave(current, defaultsFixture())).toEqual({
      ok: true,
      state: current,
      sourceVersion: CURRENT_SAVE_VERSION,
      warnings: [],
    });
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

  it('treats a missing version as legacy, accepts version 1, and rejects future versions', () => {
    expect(expectAccepted(validateAndMigrateSave({ keys: 1 }, defaultsFixture())).sourceVersion).toBe(0);
    expect(expectAccepted(validateAndMigrateSave(fullStateFixture(), defaultsFixture())).sourceVersion).toBe(1);
    expectRejected({ version: 1 }, 'invalid_field', 'keys');
    expectRejected({ version: 2 }, 'unsupported_version', 'version');
    expectRejected({ version: 0 }, 'unsupported_version', 'version');
  });

  it.each([
    'keys', 'specialKeys', 'chaosKeys', 'fatePoints', 'activeBuff',
    'unlocks', 'history', 'pinnedGoals', 'userNotes',
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

  it('round-trips an accepted current state losslessly', () => {
    const accepted = expectAccepted(validateAndMigrateSave(fullStateFixture(), defaultsFixture()));
    const reparsed = expectAccepted(parseAndMigrateSave(JSON.stringify(accepted.state), defaultsFixture()));
    expect(reparsed.state).toEqual(accepted.state);
  });
});
