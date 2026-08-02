import type { Profile, ProfileMetadata } from '../types';

export const PROFILE_METADATA_VERSION = 1 as const;
export const MAX_PROFILES = 10;
export const MAX_RECOVERED_PROFILES = 100;
export const MAX_PROFILE_NAME_LENGTH = 30;
export const PROFILES_KEY = 'FATE_PROFILES';
export const PROFILE_METADATA_BACKUP_KEY = 'FATE_PROFILES__backup';
export const PROFILE_METADATA_LOCK_KEY = 'FATE_PROFILES__lock';
export const PROFILE_METADATA_RECOVERY_KEY = 'FATE_PROFILES__recovery';
export const LEGACY_SAVE_KEY = 'FATE_UIM_SAVE_V1';

export type ProfileMetadataInvalidReason =
  | 'missing'
  | 'invalid_json'
  | 'invalid_root'
  | 'invalid_version'
  | 'invalid_revision'
  | 'invalid_profiles'
  | 'duplicate_id'
  | 'invalid_profile'
  | 'invalid_active_profile'
  | 'unknown_field';

export type ProfileMetadataParseResult =
  | { status: 'current'; metadata: ProfileMetadata }
  | { status: 'legacy'; metadata: ProfileMetadata }
  | { status: 'unsupported'; version: number }
  | { status: 'invalid'; reason: ProfileMetadataInvalidReason };

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const CURRENT_ROOT_KEYS = new Set(['version', 'revision', 'profiles', 'activeProfileId']);
const LEGACY_ROOT_KEYS = new Set(['profiles', 'activeProfileId']);
const PROFILE_KEYS = new Set(['id', 'name', 'createdAt']);
const STORAGE_SAFE_PROFILE_ID = /^[A-Za-z0-9-]{1,128}$/;

const own = (record: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const invalid = (reason: ProfileMetadataInvalidReason): ProfileMetadataParseResult => ({
  status: 'invalid',
  reason,
});

const readOwn = (record: Record<string, unknown>, key: string): unknown =>
  Object.getOwnPropertyDescriptor(record, key)?.value;

const inspectRecord = (
  value: unknown,
  allowed: ReadonlySet<string>,
  invalidReason: ProfileMetadataInvalidReason,
): Record<string, unknown> | ProfileMetadataParseResult => {
  if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length > 0) {
    return invalid(invalidReason);
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (DANGEROUS_KEYS.has(key) || !allowed.has(key)) return invalid('unknown_field');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) return invalid(invalidReason);
  }
  return value;
};

const isInvalid = (value: unknown): value is ProfileMetadataParseResult =>
  typeof value === 'object' && value !== null && 'status' in value;

const inspectProfiles = (value: unknown): Profile[] | ProfileMetadataParseResult => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_RECOVERED_PROFILES) {
    return invalid('invalid_profiles');
  }
  if (Object.getOwnPropertySymbols(value).length > 0) return invalid('invalid_profiles');
  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === 'length') continue;
    if (DANGEROUS_KEYS.has(key) || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
      return invalid('invalid_profiles');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) return invalid('invalid_profiles');
  }

  const profiles: Profile[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    if (!own(value, index)) return invalid('invalid_profiles');
    const entry = inspectRecord(value[index], PROFILE_KEYS, 'invalid_profile');
    if (isInvalid(entry)) return entry;
    if (!own(entry, 'id') || !own(entry, 'name') || !own(entry, 'createdAt')) {
      return invalid('invalid_profile');
    }
    const id = readOwn(entry, 'id');
    const name = readOwn(entry, 'name');
    const createdAt = readOwn(entry, 'createdAt');
    if (typeof id !== 'string' || !isStorageSafeProfileId(id)
      || typeof name !== 'string' || name !== sanitizeProfileName(name)) {
      return invalid('invalid_profile');
    }
    if (typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt < 0) {
      return invalid('invalid_profile');
    }
    if (ids.has(id)) return invalid('duplicate_id');
    ids.add(id);
    profiles.push({ id, name, createdAt });
  }
  return profiles;
};

export const sanitizeProfileName = (name: string): string =>
  name.trim().slice(0, MAX_PROFILE_NAME_LENGTH) || 'Unnamed Profile';

export const isStorageSafeProfileId = (id: string): boolean => STORAGE_SAFE_PROFILE_ID.test(id);

export const parseProfileMetadata = (raw: string | null): ProfileMetadataParseResult => {
  if (raw === null) return invalid('missing');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalid('invalid_json');
  }
  if (!isPlainRecord(parsed)) return invalid('invalid_root');

  const versionDescriptor = Object.getOwnPropertyDescriptor(parsed, 'version');
  if (versionDescriptor && 'value' in versionDescriptor
    && typeof versionDescriptor.value === 'number'
    && Number.isSafeInteger(versionDescriptor.value)
    && versionDescriptor.value > PROFILE_METADATA_VERSION) {
    return { status: 'unsupported', version: versionDescriptor.value };
  }

  const currentCandidate = own(parsed, 'version') || own(parsed, 'revision');
  const root = inspectRecord(
    parsed,
    currentCandidate ? CURRENT_ROOT_KEYS : LEGACY_ROOT_KEYS,
    'invalid_root',
  );
  if (isInvalid(root)) return root;

  if (currentCandidate) {
    if (!own(root, 'version')) return invalid('invalid_version');
    const version = readOwn(root, 'version');
    if (typeof version !== 'number' || !Number.isSafeInteger(version)) {
      return invalid('invalid_version');
    }
    if (version < PROFILE_METADATA_VERSION) {
      return invalid('invalid_version');
    }
    if (version > PROFILE_METADATA_VERSION) return { status: 'unsupported', version };
    if (!own(root, 'revision')) return invalid('invalid_revision');
    const revision = readOwn(root, 'revision');
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) {
      return invalid('invalid_revision');
    }
    if (!own(root, 'profiles')) return invalid('invalid_profiles');
    if (!own(root, 'activeProfileId')) return invalid('invalid_active_profile');
    const profiles = inspectProfiles(readOwn(root, 'profiles'));
    if (isInvalid(profiles)) return profiles;
    const activeProfileId = readOwn(root, 'activeProfileId');
    if (typeof activeProfileId !== 'string' || !profiles.some(profile => profile.id === activeProfileId)) {
      return invalid('invalid_active_profile');
    }
    return {
      status: 'current',
      metadata: { version: PROFILE_METADATA_VERSION, revision, profiles, activeProfileId },
    };
  }

  if (!own(root, 'profiles')) return invalid('invalid_profiles');
  if (!own(root, 'activeProfileId')) return invalid('invalid_active_profile');
  const profiles = inspectProfiles(readOwn(root, 'profiles'));
  if (isInvalid(profiles)) return profiles;
  const activeProfileId = readOwn(root, 'activeProfileId');
  if (typeof activeProfileId !== 'string' || !profiles.some(profile => profile.id === activeProfileId)) {
    return invalid('invalid_active_profile');
  }
  return {
    status: 'legacy',
    metadata: { version: PROFILE_METADATA_VERSION, revision: 0, profiles, activeProfileId },
  };
};
