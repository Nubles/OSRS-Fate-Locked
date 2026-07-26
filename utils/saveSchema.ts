import { CUSTOM_RULE_BOUNDS, type GameModeRules } from '../config/gameModes';
import { EQUIPMENT_TIER_MAX } from '../config/rules';
import { EQUIPMENT_SLOTS } from '../data/items';
import type { GameState, LogEntry, RivalState, UnlockState } from '../types';
import { migrateClogIds } from './clogIdMigrations';
import { migrateCompletedTaskIds } from './taskIdMigrations';

export const CURRENT_SAVE_VERSION = 1;
export const MAX_SAVE_BYTES = 5 * 1024 * 1024;
export const MAX_HISTORY_ENTRIES = 100_000;
export const MAX_IDENTIFIER_ARRAY = 25_000;
export const MAX_COLLECTION_LOG_ENTRIES = 25_000;
export const MAX_USER_NOTES = 5_000;
export const MAX_NOTE_CHARS = 20_000;
export const MAX_IDENTIFIER_CHARS = 512;
export const MAX_HISTORY_DETAILS_CHARS = 20_000;
export const MAX_SEED_CHARS = 256;
export const MAX_COUNTER = 2_147_483_647;

export type SaveErrorCode =
  | 'too_large'
  | 'invalid_json'
  | 'invalid_root'
  | 'unsupported_version'
  | 'invalid_field'
  | 'invalid_number'
  | 'invalid_history'
  | 'invalid_unlocks'
  | 'decode_failed';

export type SaveWarning = {
  code: 'migrated' | 'storage_warning';
  message: string;
};

export type SaveValidationResult =
  | { ok: true; state: GameState; sourceVersion: number; warnings: SaveWarning[] }
  | { ok: false; code: SaveErrorCode; message: string; path?: string };

type Failure = Extract<SaveValidationResult, { ok: false }>;
type Outcome<T> = { ok: true; value: T } | Failure;

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const LOADOUT_SLOTS = new Set<string>(EQUIPMENT_SLOTS);
const own = (record: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const messageFor = (code: SaveErrorCode, path?: string): string => {
  const suffix = path ? ` at ${path}` : '';
  switch (code) {
    case 'too_large': return 'Save data exceeds the allowed size.';
    case 'invalid_json': return 'Save data is not valid JSON.';
    case 'invalid_root': return 'Save data must be a plain object.';
    case 'unsupported_version': return 'This save version is not supported.';
    case 'invalid_number': return `Save data contains an invalid number${suffix}.`;
    case 'invalid_history': return `Save history is invalid${suffix}.`;
    case 'invalid_unlocks': return `Save unlock data is invalid${suffix}.`;
    case 'decode_failed': return 'Save data could not be decoded.';
    default: return `Save data contains an invalid field${suffix}.`;
  }
};

const invalid = (code: SaveErrorCode, path?: string): Failure => ({
  ok: false,
  code,
  message: messageFor(code, path),
  ...(path ? { path } : {}),
});

const pathOf = (base: string, key: string): string => base ? `${base}.${key}` : key;

const readOwn = (record: Record<string, unknown>, key: string): unknown =>
  Object.getOwnPropertyDescriptor(record, key)?.value;

const inspectRecord = (
  value: unknown,
  allowed: ReadonlySet<string> | null,
  code: SaveErrorCode,
  path: string,
): Outcome<Record<string, unknown>> => {
  if (!isPlainRecord(value)) return invalid(code, path || undefined);
  if (Object.getOwnPropertySymbols(value).length > 0) return invalid('invalid_field', path || undefined);
  for (const key of Object.getOwnPropertyNames(value)) {
    const fieldPath = pathOf(path, key);
    if (DANGEROUS_KEYS.has(key)) return invalid('invalid_field', fieldPath);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) return invalid(code, fieldPath);
    if (allowed && !allowed.has(key)) return invalid(code, fieldPath);
  }
  return { ok: true, value };
};

const inspectArray = (
  value: unknown,
  code: SaveErrorCode,
  path: string,
  limit: number,
): Outcome<unknown[]> => {
  if (!Array.isArray(value)) return invalid(code, path);
  if (value.length > limit) return invalid(code, path);
  if (Object.getOwnPropertySymbols(value).length > 0) return invalid('invalid_field', path);
  for (const name of Object.getOwnPropertyNames(value)) {
    if (name === 'length') continue;
    if (DANGEROUS_KEYS.has(name)) return invalid('invalid_field', pathOf(path, name));
    if (!/^(0|[1-9]\d*)$/.test(name) || Number(name) >= value.length) {
      return invalid(code, pathOf(path, name));
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor?.enumerable || !('value' in descriptor)) return invalid(code, `${path}[${name}]`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!own(value, index)) return invalid(code, `${path}[${index}]`);
  }
  return { ok: true, value };
};

const stringValue = (
  value: unknown,
  path: string,
  max: number,
  code: SaveErrorCode = 'invalid_field',
): Outcome<string> => typeof value === 'string' && value.length <= max
  ? { ok: true, value }
  : invalid(code, path);

const booleanValue = (value: unknown, path: string): Outcome<boolean> =>
  typeof value === 'boolean' ? { ok: true, value } : invalid('invalid_field', path);

const boundedInteger = (
  value: unknown,
  path: string,
  min: number,
  max: number,
  code: SaveErrorCode = 'invalid_number',
): Outcome<number> => typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= min
  && value <= max
  ? { ok: true, value }
  : invalid(code, path);

const boundedFinite = (
  value: unknown,
  path: string,
  min: number,
  max: number,
  code: SaveErrorCode = 'invalid_number',
): Outcome<number> => typeof value === 'number'
  && Number.isFinite(value)
  && value >= min
  && value <= max
  ? { ok: true, value }
  : invalid(code, path);

const identifierArray = (
  value: unknown,
  path: string,
  code: SaveErrorCode,
): Outcome<string[]> => {
  const inspected = inspectArray(value, code, path, MAX_IDENTIFIER_ARRAY);
  if (inspected.ok === false) return inspected;
  const out: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < inspected.value.length; index += 1) {
    const item = stringValue(inspected.value[index], `${path}[${index}]`, MAX_IDENTIFIER_CHARS, code);
    if (item.ok === false) return item;
    if (!seen.has(item.value)) {
      seen.add(item.value);
      out.push(item.value);
    }
  }
  return { ok: true, value: out };
};

const readPreferred = (
  input: Record<string, unknown>,
  defaults: Record<string, unknown>,
  key: string,
): { present: boolean; value: unknown } => {
  if (own(input, key)) return { present: true, value: readOwn(input, key) };
  if (own(defaults, key)) return { present: true, value: readOwn(defaults, key) };
  return { present: false, value: undefined };
};

const dynamicRecord = (
  value: unknown,
  code: SaveErrorCode,
  path: string,
  maxEntries: number,
): Outcome<Record<string, unknown>> => {
  const inspected = inspectRecord(value, null, code, path);
  if (inspected.ok === false) return inspected;
  const keys = Object.getOwnPropertyNames(inspected.value);
  if (keys.length > maxEntries) return invalid(code, path);
  for (const key of keys) {
    const checked = stringValue(key, pathOf(path, key), MAX_IDENTIFIER_CHARS, code);
    if (checked.ok === false) return checked;
  }
  return inspected;
};

const mergeBoundedIntegerRecord = (
  defaults: unknown,
  input: unknown,
  path: string,
  min: number,
  max: number,
  requireDefaultKeys = false,
): Outcome<Record<string, number>> => {
  const base = dynamicRecord(defaults, 'invalid_unlocks', path, MAX_IDENTIFIER_ARRAY);
  if (base.ok === false) return base;
  const overlay = input === undefined
    ? { ok: true as const, value: Object.create(null) as Record<string, unknown> }
    : dynamicRecord(input, 'invalid_unlocks', path, MAX_IDENTIFIER_ARRAY);
  if (overlay.ok === false) return overlay;
  const keys = new Set([
    ...Object.getOwnPropertyNames(base.value),
    ...Object.getOwnPropertyNames(overlay.value),
  ]);
  if (keys.size > MAX_IDENTIFIER_ARRAY) return invalid('invalid_unlocks', path);
  const out: Record<string, number> = {};
  for (const key of keys) {
    const source = own(overlay.value, key) ? overlay.value : base.value;
    const value = boundedInteger(readOwn(source, key), pathOf(path, key), min, max);
    if (value.ok === false) return value;
    out[key] = value.value;
  }
  if (requireDefaultKeys) {
    for (const key of Object.getOwnPropertyNames(base.value)) {
      if (!own(overlay.value, key)) return invalid('invalid_unlocks', pathOf(path, key));
    }
  }
  return { ok: true, value: out };
};

const mergeCollectionLog = (
  defaults: unknown,
  input: unknown,
): Outcome<{ value: Record<number, number>; migrated: boolean }> => {
  const path = 'unlocks.collectionLog';
  const base = dynamicRecord(defaults, 'invalid_unlocks', path, MAX_COLLECTION_LOG_ENTRIES);
  if (base.ok === false) return base;
  const overlay = input === undefined
    ? { ok: true as const, value: Object.create(null) as Record<string, unknown> }
    : dynamicRecord(input, 'invalid_unlocks', path, MAX_COLLECTION_LOG_ENTRIES);
  if (overlay.ok === false) return overlay;
  const keys = new Set([
    ...Object.getOwnPropertyNames(base.value),
    ...Object.getOwnPropertyNames(overlay.value),
  ]);
  if (keys.size > MAX_COLLECTION_LOG_ENTRIES) return invalid('invalid_unlocks', path);
  const validated: Record<number, number> = {};
  for (const key of keys) {
    const itemId = Number(key);
    if (!Number.isSafeInteger(itemId) || itemId < 0 || itemId > MAX_COUNTER || String(itemId) !== key) {
      return invalid('invalid_unlocks', pathOf(path, key));
    }
    const source = own(overlay.value, key) ? overlay.value : base.value;
    const count = boundedInteger(readOwn(source, key), pathOf(path, key), 0, MAX_COUNTER);
    if (count.ok === false) return count;
    validated[itemId] = count.value;
  }
  const migratedValue = migrateClogIds(validated);
  const migrated = Object.getOwnPropertyNames(validated).some(key => !own(migratedValue, key))
    || Object.getOwnPropertyNames(migratedValue).some(key => validated[Number(key)] !== migratedValue[Number(key)]);
  return { ok: true, value: { value: migratedValue, migrated } };
};

const UNLOCK_ARRAY_KEYS = [
  'regions', 'chunks', 'mobility', 'arcana', 'housing', 'merchants', 'minigames',
  'bosses', 'storage', 'guilds', 'farming', 'slayerUnlocks', 'banks', 'quests',
  'diaries', 'cas', 'completedTasks',
] as const;

const CURRENT_UNLOCK_KEYS = new Set([
  'equipment', 'skills', 'levels', ...UNLOCK_ARRAY_KEYS, 'collectionLog',
]);

const normalizeUnlocks = (
  value: unknown,
  defaults: UnlockState,
  sourceVersion: number,
): Outcome<{ value: UnlockState; migrated: boolean }> => {
  const allowed = new Set(CURRENT_UNLOCK_KEYS);
  if (sourceVersion === 0) {
    allowed.add('power');
    allowed.add('poh');
  }
  const inspected = inspectRecord(value, allowed, 'invalid_unlocks', 'unlocks');
  if (inspected.ok === false) return inspected;
  if (sourceVersion === CURRENT_SAVE_VERSION) {
    for (const key of CURRENT_UNLOCK_KEYS) {
      if (!own(inspected.value, key)) {
        return invalid('invalid_unlocks', `unlocks.${key}`);
      }
    }
  }
  const defaultRecord = defaults as unknown as Record<string, unknown>;
  const equipment = mergeBoundedIntegerRecord(
    readOwn(defaultRecord, 'equipment'),
    own(inspected.value, 'equipment') ? readOwn(inspected.value, 'equipment') : undefined,
    'unlocks.equipment',
    0,
    EQUIPMENT_TIER_MAX,
    sourceVersion === CURRENT_SAVE_VERSION,
  );
  if (equipment.ok === false) return equipment;
  const skills = mergeBoundedIntegerRecord(
    readOwn(defaultRecord, 'skills'),
    own(inspected.value, 'skills') ? readOwn(inspected.value, 'skills') : undefined,
    'unlocks.skills',
    0,
    10,
    sourceVersion === CURRENT_SAVE_VERSION,
  );
  if (skills.ok === false) return skills;
  const levels = mergeBoundedIntegerRecord(
    readOwn(defaultRecord, 'levels'),
    own(inspected.value, 'levels') ? readOwn(inspected.value, 'levels') : undefined,
    'unlocks.levels',
    1,
    99,
    sourceVersion === CURRENT_SAVE_VERSION,
  );
  if (levels.ok === false) return levels;

  const arrays: Record<string, string[]> = {};
  let migrated = sourceVersion === 0;
  for (const key of UNLOCK_ARRAY_KEYS) {
    const selected = own(inspected.value, key)
      ? readOwn(inspected.value, key)
      : readOwn(defaultRecord, key);
    const normalized = identifierArray(selected, `unlocks.${key}`, 'invalid_unlocks');
    if (normalized.ok === false) return normalized;
    arrays[key] = normalized.value;
  }
  if (sourceVersion === 0 && own(inspected.value, 'power')) {
    const power = identifierArray(readOwn(inspected.value, 'power'), 'unlocks.power', 'invalid_unlocks');
    if (power.ok === false) return power;
    const seen = new Set(arrays.arcana);
    for (const id of power.value) if (!seen.has(id)) {
      seen.add(id);
      arrays.arcana.push(id);
    }
  }
  if (sourceVersion === 0 && own(inspected.value, 'poh')) {
    const poh = identifierArray(readOwn(inspected.value, 'poh'), 'unlocks.poh', 'invalid_unlocks');
    if (poh.ok === false) return poh;
    const seen = new Set(arrays.housing);
    for (const id of poh.value) if (!seen.has(id)) {
      seen.add(id);
      arrays.housing.push(id);
    }
  }
  const beforeTaskMigration = arrays.completedTasks;
  arrays.completedTasks = migrateCompletedTaskIds(beforeTaskMigration);
  if (arrays.completedTasks.length !== beforeTaskMigration.length
    || arrays.completedTasks.some((id, index) => id !== beforeTaskMigration[index])) migrated = true;

  const collection = mergeCollectionLog(
    readOwn(defaultRecord, 'collectionLog'),
    own(inspected.value, 'collectionLog') ? readOwn(inspected.value, 'collectionLog') : undefined,
  );
  if (collection.ok === false) return collection;
  migrated ||= collection.value.migrated;

  const unlocks: UnlockState = {
    equipment: equipment.value,
    skills: skills.value,
    levels: levels.value,
    regions: arrays.regions,
    chunks: arrays.chunks,
    mobility: arrays.mobility,
    arcana: arrays.arcana,
    housing: arrays.housing,
    merchants: arrays.merchants,
    minigames: arrays.minigames,
    bosses: arrays.bosses,
    storage: arrays.storage,
    guilds: arrays.guilds,
    farming: arrays.farming,
    slayerUnlocks: arrays.slayerUnlocks,
    banks: arrays.banks,
    quests: arrays.quests,
    diaries: arrays.diaries,
    cas: arrays.cas,
    completedTasks: arrays.completedTasks,
    collectionLog: collection.value.value,
  };
  return { ok: true, value: { value: unlocks, migrated } };
};


const HISTORY_KEYS = new Set([
  'id', 'timestamp', 'type', 'source', 'result', 'rollValue', 'baseThreshold', 'threshold',
  'message', 'details', 'meta', 'prevHash', 'hash',
]);
const HISTORY_TYPES = new Set([
  'UNLOCK', 'PITY', 'ALTAR', 'ROLL_SUCCESS', 'ROLL_FAIL', 'ROLL_OMNI',
  'LEVEL_UP', 'XTREME_MILESTONE',
]);
const HISTORY_RESULTS = new Set(['SUCCESS', 'FAIL']);
const MAX_METADATA_DEPTH = 16;

const cloneMetadata = (
  value: unknown,
  path: string,
  depth: number,
  visiting: Set<object>,
): Outcome<unknown> => {
  if (value === null || typeof value === 'boolean') return { ok: true, value };
  if (typeof value === 'string') {
    return stringValue(value, path, MAX_HISTORY_DETAILS_CHARS, 'invalid_history');
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && Math.abs(value) <= MAX_COUNTER
      ? { ok: true, value }
      : invalid('invalid_history', path);
  }
  if (depth > MAX_METADATA_DEPTH) return invalid('invalid_history', path);
  if (typeof value !== 'object') return invalid('invalid_history', path);
  if (visiting.has(value)) return invalid('invalid_history', path);
  visiting.add(value);
  if (Array.isArray(value)) {
    const inspected = inspectArray(value, 'invalid_history', path, MAX_IDENTIFIER_ARRAY);
    if (inspected.ok === false) {
      visiting.delete(value);
      return inspected;
    }
    const out: unknown[] = [];
    for (let index = 0; index < inspected.value.length; index += 1) {
      const item = cloneMetadata(inspected.value[index], `${path}[${index}]`, depth + 1, visiting);
      if (item.ok === false) {
        visiting.delete(value);
        return item;
      }
      out.push(item.value);
    }
    visiting.delete(value);
    return { ok: true, value: out };
  }
  const inspected = inspectRecord(value, null, 'invalid_history', path);
  if (inspected.ok === false) {
    visiting.delete(value);
    return inspected;
  }
  const keys = Object.getOwnPropertyNames(inspected.value);
  if (keys.length > MAX_IDENTIFIER_ARRAY) {
    visiting.delete(value);
    return invalid('invalid_history', path);
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const keyCheck = stringValue(key, pathOf(path, key), MAX_IDENTIFIER_CHARS, 'invalid_history');
    if (keyCheck.ok === false) {
      visiting.delete(value);
      return keyCheck;
    }
    const item = cloneMetadata(readOwn(inspected.value, key), pathOf(path, key), depth + 1, visiting);
    if (item.ok === false) {
      visiting.delete(value);
      return item;
    }
    out[key] = item.value;
  }
  visiting.delete(value);
  return { ok: true, value: out };
};

const normalizeHistoryEntry = (value: unknown, index: number): Outcome<LogEntry> => {
  const path = `history[${index}]`;
  const inspected = inspectRecord(value, HISTORY_KEYS, 'invalid_history', path);
  if (inspected.ok === false) return inspected;
  for (const required of ['id', 'timestamp', 'type', 'message']) {
    if (!own(inspected.value, required)) return invalid('invalid_history', pathOf(path, required));
  }
  const id = stringValue(readOwn(inspected.value, 'id'), `${path}.id`, MAX_IDENTIFIER_CHARS, 'invalid_history');
  if (id.ok === false) return id;
  const timestamp = boundedInteger(
    readOwn(inspected.value, 'timestamp'),
    `${path}.timestamp`,
    0,
    Number.MAX_SAFE_INTEGER,
    'invalid_history',
  );
  if (timestamp.ok === false) return timestamp;
  const rawType = readOwn(inspected.value, 'type');
  if (typeof rawType !== 'string' || !HISTORY_TYPES.has(rawType)) return invalid('invalid_history', `${path}.type`);
  const message = stringValue(readOwn(inspected.value, 'message'), `${path}.message`, MAX_HISTORY_DETAILS_CHARS, 'invalid_history');
  if (message.ok === false) return message;
  const entry: LogEntry = {
    id: id.value,
    timestamp: timestamp.value,
    type: rawType as LogEntry['type'],
    message: message.value,
  };
  for (const key of ['source', 'details', 'prevHash', 'hash'] as const) {
    if (!own(inspected.value, key)) continue;
    const max = key === 'details' ? MAX_HISTORY_DETAILS_CHARS : MAX_IDENTIFIER_CHARS;
    const text = stringValue(readOwn(inspected.value, key), `${path}.${key}`, max, 'invalid_history');
    if (text.ok === false) return text;
    entry[key] = text.value;
  }
  if (own(inspected.value, 'result')) {
    const result = readOwn(inspected.value, 'result');
    if (typeof result !== 'string' || !HISTORY_RESULTS.has(result)) return invalid('invalid_history', `${path}.result`);
    entry.result = result as LogEntry['result'];
  }
  for (const key of ['rollValue', 'baseThreshold', 'threshold'] as const) {
    if (!own(inspected.value, key)) continue;
    const number = boundedFinite(readOwn(inspected.value, key), `${path}.${key}`, 0, MAX_COUNTER, 'invalid_history');
    if (number.ok === false) return number;
    entry[key] = number.value;
  }
  if (own(inspected.value, 'meta')) {
    const meta = cloneMetadata(readOwn(inspected.value, 'meta'), `${path}.meta`, 0, new Set<object>());
    if (meta.ok === false) return meta;
    if (!isPlainRecord(meta.value)) return invalid('invalid_history', `${path}.meta`);
    entry.meta = meta.value;
  }
  return { ok: true, value: entry };
};

const normalizeHistory = (value: unknown): Outcome<LogEntry[]> => {
  const inspected = inspectArray(value, 'invalid_history', 'history', MAX_HISTORY_ENTRIES);
  if (inspected.ok === false) return inspected;
  const out: LogEntry[] = new Array(inspected.value.length);
  for (let index = 0; index < inspected.value.length; index += 1) {
    const entry = normalizeHistoryEntry(inspected.value[index], index);
    if (entry.ok === false) return entry;
    out[index] = entry.value;
  }
  return { ok: true, value: out };
};

const normalizeNotes = (value: unknown): Outcome<Record<string, string>> => {
  const inspected = dynamicRecord(value, 'invalid_field', 'userNotes', MAX_USER_NOTES);
  if (inspected.ok === false) return inspected;
  const out: Record<string, string> = {};
  for (const key of Object.getOwnPropertyNames(inspected.value)) {
    const note = stringValue(readOwn(inspected.value, key), pathOf('userNotes', key), MAX_NOTE_CHARS);
    if (note.ok === false) return note;
    out[key] = note.value;
  }
  return { ok: true, value: out };
};

const normalizeLoadout = (value: unknown): Outcome<Record<string, number>> => {
  const inspected = dynamicRecord(value, 'invalid_field', 'loadout', MAX_IDENTIFIER_ARRAY);
  if (inspected.ok === false) return inspected;
  const out: Record<string, number> = {};
  for (const key of Object.getOwnPropertyNames(inspected.value)) {
    if (!LOADOUT_SLOTS.has(key)) return invalid('invalid_field', pathOf('loadout', key));
    const itemId = boundedInteger(readOwn(inspected.value, key), pathOf('loadout', key), 0, MAX_COUNTER);
    if (itemId.ok === false) return itemId;
    out[key] = itemId.value;
  }
  return { ok: true, value: out };
};


const CUSTOM_MODE_KEYS = new Set([
  'pityEnabled', 'pityThreshold', 'omniChanceBase', 'ritualCostMultiplier',
  'regionModifiers', 'startArea', 'chunkGranularity', 'bankLocks',
]);

const normalizeCustomMode = (value: unknown): Outcome<GameModeRules> => {
  const inspected = inspectRecord(value, CUSTOM_MODE_KEYS, 'invalid_field', 'customMode');
  if (inspected.ok === false) return inspected;
  for (const required of [
    'pityEnabled', 'pityThreshold', 'omniChanceBase', 'ritualCostMultiplier', 'regionModifiers',
  ]) {
    if (!own(inspected.value, required)) return invalid('invalid_field', `customMode.${required}`);
  }
  const pityEnabled = booleanValue(readOwn(inspected.value, 'pityEnabled'), 'customMode.pityEnabled');
  if (pityEnabled.ok === false) return pityEnabled;
  const pityThreshold = boundedInteger(readOwn(inspected.value, 'pityThreshold'), 'customMode.pityThreshold', CUSTOM_RULE_BOUNDS.pityThreshold.min, CUSTOM_RULE_BOUNDS.pityThreshold.max);
  if (pityThreshold.ok === false) return pityThreshold;
  const omniChanceBase = boundedFinite(readOwn(inspected.value, 'omniChanceBase'), 'customMode.omniChanceBase', CUSTOM_RULE_BOUNDS.omniChanceBase.min, CUSTOM_RULE_BOUNDS.omniChanceBase.max);
  if (omniChanceBase.ok === false) return omniChanceBase;
  const ritualCostMultiplier = boundedFinite(readOwn(inspected.value, 'ritualCostMultiplier'), 'customMode.ritualCostMultiplier', CUSTOM_RULE_BOUNDS.ritualCostMultiplier.min, CUSTOM_RULE_BOUNDS.ritualCostMultiplier.max);
  if (ritualCostMultiplier.ok === false) return ritualCostMultiplier;
  const regionModifiers = booleanValue(readOwn(inspected.value, 'regionModifiers'), 'customMode.regionModifiers');
  if (regionModifiers.ok === false) return regionModifiers;
  const out: GameModeRules = {
    pityEnabled: pityEnabled.value,
    pityThreshold: pityThreshold.value,
    omniChanceBase: omniChanceBase.value,
    ritualCostMultiplier: ritualCostMultiplier.value,
    regionModifiers: regionModifiers.value,
  };
  if (own(inspected.value, 'startArea')) {
    const startArea = readOwn(inspected.value, 'startArea');
    if (startArea !== 'misthalin' && startArea !== 'lumbridge' && startArea !== 'none') {
      return invalid('invalid_field', 'customMode.startArea');
    }
    out.startArea = startArea;
  }
  for (const key of ['chunkGranularity', 'bankLocks'] as const) {
    if (!own(inspected.value, key)) continue;
    const checked = booleanValue(readOwn(inspected.value, key), `customMode.${key}`);
    if (checked.ok === false) return checked;
    out[key] = checked.value;
  }
  return { ok: true, value: out };
};

const RIVAL_KEYS = new Set([
  'mode', 'personaId', 'name', 'emoji', 'keysPerDay', 'seed', 'startedAt',
  'lastSeenLead', 'friendPct', 'friendName',
]);

const normalizeRival = (value: unknown): Outcome<RivalState> => {
  const inspected = inspectRecord(value, RIVAL_KEYS, 'invalid_field', 'rival');
  if (inspected.ok === false) return inspected;
  for (const required of ['mode', 'personaId', 'name', 'emoji', 'keysPerDay', 'seed', 'startedAt']) {
    if (!own(inspected.value, required)) return invalid('invalid_field', `rival.${required}`);
  }
  const mode = readOwn(inspected.value, 'mode');
  if (mode !== 'sim' && mode !== 'friend') return invalid('invalid_field', 'rival.mode');
  const personaId = stringValue(readOwn(inspected.value, 'personaId'), 'rival.personaId', MAX_IDENTIFIER_CHARS);
  if (personaId.ok === false) return personaId;
  const name = stringValue(readOwn(inspected.value, 'name'), 'rival.name', MAX_IDENTIFIER_CHARS);
  if (name.ok === false) return name;
  const emoji = stringValue(readOwn(inspected.value, 'emoji'), 'rival.emoji', MAX_IDENTIFIER_CHARS);
  if (emoji.ok === false) return emoji;
  const keysPerDay = boundedFinite(readOwn(inspected.value, 'keysPerDay'), 'rival.keysPerDay', 0, MAX_COUNTER);
  if (keysPerDay.ok === false) return keysPerDay;
  const seed = boundedInteger(readOwn(inspected.value, 'seed'), 'rival.seed', 0, MAX_COUNTER);
  if (seed.ok === false) return seed;
  const startedAt = boundedInteger(readOwn(inspected.value, 'startedAt'), 'rival.startedAt', 0, Number.MAX_SAFE_INTEGER);
  if (startedAt.ok === false) return startedAt;
  const out: RivalState = {
    mode,
    personaId: personaId.value,
    name: name.value,
    emoji: emoji.value,
    keysPerDay: keysPerDay.value,
    seed: seed.value,
    startedAt: startedAt.value,
  };
  if (own(inspected.value, 'lastSeenLead')) {
    const lastSeenLead = boundedFinite(readOwn(inspected.value, 'lastSeenLead'), 'rival.lastSeenLead', -MAX_COUNTER, MAX_COUNTER);
    if (lastSeenLead.ok === false) return lastSeenLead;
    out.lastSeenLead = lastSeenLead.value;
  }
  if (own(inspected.value, 'friendPct')) {
    const friendPct = boundedFinite(readOwn(inspected.value, 'friendPct'), 'rival.friendPct', 0, 100);
    if (friendPct.ok === false) return friendPct;
    out.friendPct = friendPct.value;
  }
  if (own(inspected.value, 'friendName')) {
    const friendName = stringValue(readOwn(inspected.value, 'friendName'), 'rival.friendName', MAX_IDENTIFIER_CHARS);
    if (friendName.ok === false) return friendName;
    out.friendName = friendName.value;
  }
  return { ok: true, value: out };
};


const RFC_4122_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TOP_LEVEL_KEYS = new Set([
  'version', 'runId', 'runRevision', 'keys', 'specialKeys', 'chaosKeys', 'fatePoints', 'activeBuff',
  'unlocks', 'history', 'animationsEnabled', 'advisorsEnabled', 'revealAllFeatures',
  'hasSeenOnboarding', 'pinnedGoals', 'userNotes', 'gameModeId', 'customMode',
  'gameModeLocked', 'rngSeed', 'loadout', 'rival', 'linkedAccount',
  'xtremeMilestoneClaimed', 'chunkedMilestoneClaimed',
]);

export const parseAndMigrateSave = (
  json: string,
  defaults: GameState,
): SaveValidationResult => {
  if (typeof json !== 'string') return invalid('invalid_json');
  if (new TextEncoder().encode(json).byteLength > MAX_SAVE_BYTES) return invalid('too_large');
  try {
    return validateAndMigrateSave(JSON.parse(json) as unknown, defaults);
  } catch {
    return invalid('invalid_json');
  }
};

export const validateAndMigrateSave = (
  input: unknown,
  defaults: GameState,
): SaveValidationResult => {
  if (!isPlainRecord(input)) return invalid('invalid_root');
  const inspected = inspectRecord(input, TOP_LEVEL_KEYS, 'invalid_field', '');
  if (inspected.ok === false) return inspected;
  const hasVersion = own(input, 'version');
  const rawVersion = hasVersion ? readOwn(input, 'version') : undefined;
  if (hasVersion && (typeof rawVersion !== 'number' || !Number.isSafeInteger(rawVersion))) {
    return invalid('invalid_number', 'version');
  }
  if (hasVersion && rawVersion !== CURRENT_SAVE_VERSION) {
    return invalid('unsupported_version', 'version');
  }
  return normalizeAndRevalidate(input, defaults, hasVersion ? CURRENT_SAVE_VERSION : 0);
};

const normalizeState = (
  input: Record<string, unknown>,
  defaults: GameState,
  sourceVersion: number,
): Outcome<{ state: GameState; migrated: boolean }> => {
  if (sourceVersion === CURRENT_SAVE_VERSION) {
    for (const key of [
      'keys', 'specialKeys', 'chaosKeys', 'fatePoints', 'activeBuff',
      'unlocks', 'history', 'pinnedGoals', 'userNotes',
    ]) {
      if (!own(input, key)) return invalid('invalid_field', key);
    }
  }
  const defaultRecord = defaults as unknown as Record<string, unknown>;
  const counter = (key: 'keys' | 'specialKeys' | 'chaosKeys' | 'fatePoints'): Outcome<number> => {
    const selected = readPreferred(input, defaultRecord, key);
    return selected.present
      ? boundedInteger(selected.value, key, 0, MAX_COUNTER)
      : invalid('invalid_number', key);
  };
  const keys = counter('keys');
  if (keys.ok === false) return keys;
  const specialKeys = counter('specialKeys');
  if (specialKeys.ok === false) return specialKeys;
  const chaosKeys = counter('chaosKeys');
  if (chaosKeys.ok === false) return chaosKeys;
  const fatePoints = counter('fatePoints');
  if (fatePoints.ok === false) return fatePoints;

  const selectedBuff = readPreferred(input, defaultRecord, 'activeBuff');
  if (!selectedBuff.present
    || (selectedBuff.value !== 'NONE' && selectedBuff.value !== 'LUCK' && selectedBuff.value !== 'GREED')) {
    return invalid('invalid_field', 'activeBuff');
  }
  const selectedUnlocks = readPreferred(input, defaultRecord, 'unlocks');
  if (!selectedUnlocks.present) return invalid('invalid_unlocks', 'unlocks');
  const unlocks = normalizeUnlocks(selectedUnlocks.value, defaults.unlocks, sourceVersion);
  if (unlocks.ok === false) return unlocks;
  const selectedHistory = readPreferred(input, defaultRecord, 'history');
  if (!selectedHistory.present) return invalid('invalid_history', 'history');
  const history = normalizeHistory(selectedHistory.value);
  if (history.ok === false) return history;
  const selectedGoals = readPreferred(input, defaultRecord, 'pinnedGoals');
  if (!selectedGoals.present) return invalid('invalid_field', 'pinnedGoals');
  const pinnedGoals = identifierArray(selectedGoals.value, 'pinnedGoals', 'invalid_field');
  if (pinnedGoals.ok === false) return pinnedGoals;
  const selectedNotes = readPreferred(input, defaultRecord, 'userNotes');
  if (!selectedNotes.present) return invalid('invalid_field', 'userNotes');
  const userNotes = normalizeNotes(selectedNotes.value);
  if (userNotes.ok === false) return userNotes;
  const selectedRunId = readPreferred(input, defaultRecord, 'runId');
  if (!selectedRunId.present) return invalid('invalid_field', 'runId');
  const runId = stringValue(selectedRunId.value, 'runId', MAX_IDENTIFIER_CHARS);
  if (runId.ok === false || !RFC_4122_V4.test(runId.value)) {
    return invalid('invalid_field', 'runId');
  }
  const selectedRunRevision = readPreferred(input, defaultRecord, 'runRevision');
  if (!selectedRunRevision.present) return invalid('invalid_number', 'runRevision');
  const runRevision = boundedInteger(selectedRunRevision.value, 'runRevision', 0, MAX_COUNTER);
  if (runRevision.ok === false) return runRevision;

  const state: GameState = {
    version: CURRENT_SAVE_VERSION,
    runId: runId.value,
    runRevision: runRevision.value,
    keys: keys.value,
    specialKeys: specialKeys.value,
    chaosKeys: chaosKeys.value,
    fatePoints: fatePoints.value,
    activeBuff: selectedBuff.value,
    unlocks: unlocks.value.value,
    history: history.value,
    pinnedGoals: pinnedGoals.value,
    userNotes: userNotes.value,
  };

  for (const key of [
    'animationsEnabled', 'advisorsEnabled', 'revealAllFeatures',
    'hasSeenOnboarding', 'gameModeLocked',
  ] as const) {
    const selected = readPreferred(input, defaultRecord, key);
    if (!selected.present) continue;
    const checked = booleanValue(selected.value, key);
    if (checked.ok === false) return checked;
    state[key] = checked.value;
  }
  for (const key of ['gameModeId', 'linkedAccount'] as const) {
    const selected = readPreferred(input, defaultRecord, key);
    if (!selected.present) continue;
    const checked = stringValue(selected.value, key, MAX_IDENTIFIER_CHARS);
    if (checked.ok === false) return checked;
    state[key] = checked.value;
  }
  const selectedSeed = readPreferred(input, defaultRecord, 'rngSeed');
  if (selectedSeed.present) {
    const checked = stringValue(selectedSeed.value, 'rngSeed', MAX_SEED_CHARS);
    if (checked.ok === false) return checked;
    state.rngSeed = checked.value;
  }
  const selectedCustom = readPreferred(input, defaultRecord, 'customMode');
  if (selectedCustom.present) {
    const checked = normalizeCustomMode(selectedCustom.value);
    if (checked.ok === false) return checked;
    state.customMode = checked.value;
  }
  const selectedLoadout = readPreferred(input, defaultRecord, 'loadout');
  if (selectedLoadout.present) {
    const checked = normalizeLoadout(selectedLoadout.value);
    if (checked.ok === false) return checked;
    state.loadout = checked.value;
  }
  const selectedRival = readPreferred(input, defaultRecord, 'rival');
  if (selectedRival.present) {
    const checked = normalizeRival(selectedRival.value);
    if (checked.ok === false) return checked;
    state.rival = checked.value;
  }
  for (const key of ['xtremeMilestoneClaimed', 'chunkedMilestoneClaimed'] as const) {
    const selected = readPreferred(input, defaultRecord, key);
    if (!selected.present) continue;
    const checked = boundedInteger(selected.value, key, 0, MAX_COUNTER);
    if (checked.ok === false) return checked;
    state[key] = checked.value;
  }

  return {
    ok: true,
    value: {
      state,
      migrated: sourceVersion === 0
        || unlocks.value.migrated
        || !own(input, 'runId')
        || !own(input, 'runRevision'),
    },
  };
};

// Re-validating the freshly built current object keeps the schema boundary
// honest if a migration or default adapter is changed later.
const normalizeAndRevalidate = (
  input: Record<string, unknown>,
  defaults: GameState,
  sourceVersion: number,
): SaveValidationResult => {
  const normalized = normalizeState(input, defaults, sourceVersion);
  if (normalized.ok === false) return normalized;
  const current = normalizeState(
    normalized.value.state as unknown as Record<string, unknown>,
    defaults,
    CURRENT_SAVE_VERSION,
  );
  if (current.ok === false) return current;
  return {
    ok: true,
    state: current.value.state,
    sourceVersion,
    warnings: normalized.value.migrated
      ? [{ code: 'migrated', message: 'Save data was migrated to the current format.' }]
      : [],
  };
};
