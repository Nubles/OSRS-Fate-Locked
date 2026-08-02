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
export interface ProfileRecoveryEnvelopeV1 {
  version: 1;
  capturedAt: number;
  primary: string | null;
  backup: string | null;
}

export type ProfileRecoveryNotice = {
  kind: 'repaired' | 'partial' | 'read_only' | 'unsupported' | 'remote_removal';
  recoveredProfiles: number;
  generatedNames: number;
  unreadableSaves: number;
  overflowSaves: number;
  rollbackFailures: number;
};

export type ProfileMetadataResolution =
  | { mode: 'durable'; metadata: ProfileMetadata; repair: null; notice: ProfileRecoveryNotice | null }
  | { mode: 'repair'; metadata: ProfileMetadata; repair: ProfileRepairPlan; notice: ProfileRecoveryNotice | null }
  | { mode: 'read_only'; metadata: ProfileMetadata; repair: null; notice: ProfileRecoveryNotice };

export interface ProfileMetadataStorageReader {
  readonly length: number;
  getItem(key: string): string | null;
  key(index: number): string | null;
}

export type GameSaveValidator = (raw: string) => boolean;

export interface ProfileRepairPlan {
  cause: 'legacy' | 'backup' | 'reconstructed' | 'fresh';
  candidate: ProfileMetadata;
  archive: ProfileRecoveryEnvelopeV1 | null;
  legacyCopy: { fromKey: typeof LEGACY_SAVE_KEY; toProfileId: string } | null;
}

export interface ResolveProfileMetadataInput {
  primary: string | null;
  backup: string | null;
  legacySave: string | null;
  storage: ProfileMetadataStorageReader;
  now: number;
  validateGameSave: GameSaveValidator;
  createProfileId: () => string;
}

type RecoveryProfileHint = {
  name?: string;
  createdAt?: number;
};

type RecoveryHints = {
  activeProfileId: string | null;
  profiles: Map<string, RecoveryProfileHint>;
};

type ReconstructedProfiles = {
  metadata: ProfileMetadata;
  recoveredProfiles: number;
  generatedNames: number;
  unreadableSaves: number;
  overflowSaves: number;
};

const PROFILE_SAVE_KEY = /^FATE_PROFILE_([A-Za-z0-9-]{1,128})$/;

export const discoverProfileSaveIds = (storage: ProfileMetadataStorageReader): string[] => {
  const ids: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    const match = key === null ? null : PROFILE_SAVE_KEY.exec(key);
    if (match) ids.push(match[1]);
  }
  return ids.sort((left, right) => (left > right ? 1 : left < right ? -1 : 0));
};

const recoveryHints = (raw: string | null): RecoveryHints => {
  const hints: RecoveryHints = { activeProfileId: null, profiles: new Map() };
  if (raw === null) return hints;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return hints;
  }
  if (!isPlainRecord(parsed)) return hints;

  const activeProfileId = readOwn(parsed, 'activeProfileId');
  if (typeof activeProfileId === 'string' && isStorageSafeProfileId(activeProfileId)) {
    hints.activeProfileId = activeProfileId;
  }

  const entries = readOwn(parsed, 'profiles');
  if (!Array.isArray(entries)) return hints;
  for (const entry of entries) {
    if (!isPlainRecord(entry)) continue;
    const id = readOwn(entry, 'id');
    if (typeof id !== 'string' || !isStorageSafeProfileId(id)) continue;

    const hint: RecoveryProfileHint = {};
    const name = readOwn(entry, 'name');
    if (typeof name === 'string' && name.trim().length > 0) {
      hint.name = sanitizeProfileName(name);
    }
    const createdAt = readOwn(entry, 'createdAt');
    if (typeof createdAt === 'number' && Number.isSafeInteger(createdAt) && createdAt >= 0) {
      hint.createdAt = createdAt;
    }
    if (hint.name !== undefined || hint.createdAt !== undefined) {
      const previous = hints.profiles.get(id);
      hints.profiles.set(id, { ...previous, ...hint });
    }
  }
  return hints;
};

const mergedRecoveryHints = (primary: string | null, backup: string | null): RecoveryHints => {
  const primaryHints = recoveryHints(primary);
  const backupHints = recoveryHints(backup);
  const profiles = new Map(backupHints.profiles);
  for (const [id, hint] of primaryHints.profiles) {
    profiles.set(id, { ...profiles.get(id), ...hint });
  }
  return {
    activeProfileId: primaryHints.activeProfileId ?? backupHints.activeProfileId,
    profiles,
  };
};

const recoveryNotice = (
  kind: ProfileRecoveryNotice['kind'],
  recoveredProfiles = 0,
  generatedNames = 0,
  unreadableSaves = 0,
  overflowSaves = 0,
): ProfileRecoveryNotice => ({
  kind,
  recoveredProfiles,
  generatedNames,
  unreadableSaves,
  overflowSaves,
  rollbackFailures: 0,
});

const recoveryArchive = (
  primary: string | null,
  backup: string | null,
  now: number,
): ProfileRecoveryEnvelopeV1 | null => (
  primary === null && backup === null
    ? null
    : { version: 1, capturedAt: now, primary, backup }
);

const reconstructProfiles = (input: ResolveProfileMetadataInput): ReconstructedProfiles => {
  const hints = mergedRecoveryHints(input.primary, input.backup);
  const accepted: Array<{ id: string; hint: RecoveryProfileHint | undefined }> = [];
  let unreadableSaves = 0;
  let overflowSaves = 0;

  for (const id of discoverProfileSaveIds(input.storage)) {
    const raw = input.storage.getItem(`FATE_PROFILE_${id}`);
    if (raw === null || !input.validateGameSave(raw)) {
      unreadableSaves += 1;
      continue;
    }
    if (accepted.length >= MAX_RECOVERED_PROFILES) {
      overflowSaves += 1;
      continue;
    }
    accepted.push({ id, hint: hints.profiles.get(id) });
  }

  const reservedNames = new Set<string>();
  for (const { hint } of accepted) {
    if (hint?.name !== undefined) reservedNames.add(hint.name);
  }

  let generatedNames = 0;
  let nextGeneratedName = 1;
  const profiles = accepted.map(({ id, hint }) => {
    let name = hint?.name;
    if (name === undefined) {
      do {
        name = `Recovered Profile ${nextGeneratedName}`;
        nextGeneratedName += 1;
      } while (reservedNames.has(name));
      reservedNames.add(name);
      generatedNames += 1;
    }
    return { id, name, createdAt: hint?.createdAt ?? input.now };
  });

  const activeProfileId = hints.activeProfileId !== null && profiles.some(profile => profile.id === hints.activeProfileId)
    ? hints.activeProfileId
    : profiles[0]?.id ?? '';

  return {
    metadata: {
      version: PROFILE_METADATA_VERSION,
      revision: 0,
      profiles,
      activeProfileId,
    },
    recoveredProfiles: profiles.length,
    generatedNames,
    unreadableSaves,
    overflowSaves,
  };
};

const freshMetadata = (input: ResolveProfileMetadataInput): ProfileMetadata => {
  const id = input.createProfileId();
  return {
    version: PROFILE_METADATA_VERSION,
    revision: 0,
    profiles: [{ id, name: 'Main Account', createdAt: input.now }],
    activeProfileId: id,
  };
};

const readOnlyMetadata = (
  input: ResolveProfileMetadataInput,
  primaryResult: ProfileMetadataParseResult,
  backupResult: ProfileMetadataParseResult,
): { metadata: ProfileMetadata; notice: ProfileRecoveryNotice } => {
  if (primaryResult.status === 'current' || primaryResult.status === 'legacy') {
    return { metadata: primaryResult.metadata, notice: recoveryNotice('unsupported') };
  }
  if (backupResult.status === 'current' || backupResult.status === 'legacy') {
    return { metadata: backupResult.metadata, notice: recoveryNotice('unsupported') };
  }

  const recovered = reconstructProfiles(input);
  const metadata = recovered.recoveredProfiles > 0 ? recovered.metadata : freshMetadata(input);
  return {
    metadata,
    notice: recoveryNotice(
      'unsupported',
      recovered.recoveredProfiles,
      recovered.generatedNames,
      recovered.unreadableSaves,
      recovered.overflowSaves,
    ),
  };
};

export const resolveProfileMetadata = (
  input: ResolveProfileMetadataInput,
): ProfileMetadataResolution => {
  const primaryResult = parseProfileMetadata(input.primary);

  if (primaryResult.status === 'current') {
    return { mode: 'durable', metadata: primaryResult.metadata, repair: null, notice: null };
  }

  if (primaryResult.status === 'legacy') {
    const repair: ProfileRepairPlan = {
      cause: 'legacy',
      candidate: primaryResult.metadata,
      archive: null,
      legacyCopy: null,
    };
    return { mode: 'repair', metadata: repair.candidate, repair, notice: null };
  }

  const backupResult = parseProfileMetadata(input.backup);

  if (primaryResult.status === 'unsupported' || backupResult.status === 'unsupported') {
    const readOnly = readOnlyMetadata(input, primaryResult, backupResult);
    return { mode: 'read_only', metadata: readOnly.metadata, repair: null, notice: readOnly.notice };
  }

  if (backupResult.status === 'current' || backupResult.status === 'legacy') {
    const repair: ProfileRepairPlan = {
      cause: 'backup',
      candidate: backupResult.metadata,
      archive: input.primary === null ? null : recoveryArchive(input.primary, input.backup, input.now),
      legacyCopy: null,
    };
    return {
      mode: 'repair',
      metadata: repair.candidate,
      repair,
      notice: recoveryNotice('repaired'),
    };
  }

  const recovered = reconstructProfiles(input);
  if (recovered.recoveredProfiles > 0) {
    const repair: ProfileRepairPlan = {
      cause: 'reconstructed',
      candidate: recovered.metadata,
      archive: recoveryArchive(input.primary, input.backup, input.now),
      legacyCopy: null,
    };
    const kind = recovered.unreadableSaves > 0 || recovered.overflowSaves > 0 ? 'partial' : 'repaired';
    return {
      mode: 'repair',
      metadata: repair.candidate,
      repair,
      notice: recoveryNotice(
        kind,
        recovered.recoveredProfiles,
        recovered.generatedNames,
        recovered.unreadableSaves,
        recovered.overflowSaves,
      ),
    };
  }

  const metadata = freshMetadata(input);
  const repair: ProfileRepairPlan = {
    cause: 'fresh',
    candidate: metadata,
    archive: recoveryArchive(input.primary, input.backup, input.now),
    legacyCopy: input.legacySave !== null && input.validateGameSave(input.legacySave)
      ? { fromKey: LEGACY_SAVE_KEY, toProfileId: metadata.activeProfileId }
      : null,
  };
  const notice = recovered.unreadableSaves > 0 || recovered.overflowSaves > 0
    ? recoveryNotice(
      'partial',
      recovered.recoveredProfiles,
      recovered.generatedNames,
      recovered.unreadableSaves,
      recovered.overflowSaves,
    )
    : input.primary === null && input.backup === null ? null : recoveryNotice('partial');
  return {
    mode: 'repair',
    metadata,
    repair,
    notice,
  };
};
