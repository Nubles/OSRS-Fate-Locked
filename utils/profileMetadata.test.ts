import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverProfileSaveIds, parseProfileMetadata, resolveProfileMetadata } from './profileMetadata';

const profile = {
  id: 'alpha',
  name: 'Alpha',
  createdAt: 1,
};

const current = () => ({
  version: 1 as const,
  revision: 0,
  profiles: [profile],
  activeProfileId: 'alpha',
});

const legacy = () => ({
  profiles: [profile],
  activeProfileId: 'alpha',
});

const parseObject = (value: object) => {
  vi.spyOn(JSON, 'parse').mockReturnValue(value);
  return parseProfileMetadata('ignored');
};

afterEach(() => vi.restoreAllMocks());

describe('parseProfileMetadata', () => {
  it('accepts the exact current schema', () => {
    expect(parseProfileMetadata(JSON.stringify(current()))).toEqual({
      status: 'current',
      metadata: current(),
    });
  });

  it('normalizes the exact legacy schema to revision zero', () => {
    expect(parseProfileMetadata(JSON.stringify(legacy()))).toEqual({
      status: 'legacy',
      metadata: { version: 1, revision: 0, ...legacy() },
    });
  });

  it.each([
    null,
    '{bad',
    'null',
    '[]',
    JSON.stringify({ version: 1, revision: 0, profiles: [], activeProfileId: 'a' }),
    JSON.stringify({ version: 1, revision: -1, profiles: legacy().profiles, activeProfileId: 'alpha' }),
  ])('rejects malformed metadata without throwing: %s', raw => {
    expect(() => parseProfileMetadata(raw)).not.toThrow();
    expect(parseProfileMetadata(raw).status).toBe('invalid');
  });

  it('distinguishes a future schema from corruption', () => {
    expect(parseProfileMetadata(JSON.stringify({
      version: 2,
      revision: 9,
      profiles: legacy().profiles,
      activeProfileId: 'alpha',
    }))).toEqual({ status: 'unsupported', version: 2 });
  });

  it('preserves a future schema with fields unknown to this version', () => {
    expect(parseProfileMetadata(JSON.stringify({
      version: 2,
      revision: 9,
      profiles: legacy().profiles,
      activeProfileId: 'alpha',
      futureField: { preserved: true },
    }))).toEqual({ status: 'unsupported', version: 2 });
  });

  it.each(['alpha_beta', 'alpha/beta', 'alpha beta', 'a'.repeat(129)])(
    'rejects a profile ID that is unsafe for storage: %s',
    id => {
      expect(parseProfileMetadata(JSON.stringify({
        ...current(),
        profiles: [{ ...profile, id }],
        activeProfileId: id,
      }))).toEqual({ status: 'invalid', reason: 'invalid_profile' });
    },
  );

  it.each(['', 'a'.repeat(31)])('rejects an invalid profile name: %s', name => {
    expect(parseProfileMetadata(JSON.stringify({
      ...current(),
      profiles: [{ ...profile, name }],
    }))).toEqual({ status: 'invalid', reason: 'invalid_profile' });
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid profile timestamp: %s',
    createdAt => {
      const raw = Number.isFinite(createdAt)
        ? JSON.stringify({ ...current(), profiles: [{ ...profile, createdAt }] })
        : ' { "version": 1, "revision": 0, "profiles": [{ "id": "alpha", "name": "Alpha", "createdAt": 1e999 }], "activeProfileId": "alpha" } ';
      expect(parseProfileMetadata(raw)).toEqual({ status: 'invalid', reason: 'invalid_profile' });
    },
  );

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects an invalid revision: %s', revision => {
    expect(parseProfileMetadata(JSON.stringify({ ...current(), revision }))).toEqual({
      status: 'invalid',
      reason: 'invalid_revision',
    });
  });

  it('rejects more than one hundred recovered profiles', () => {
    const profiles = Array.from({ length: 101 }, (_, index) => ({
      id: `profile-${index}`,
      name: `Profile ${index}`,
      createdAt: index,
    }));
    expect(parseProfileMetadata(JSON.stringify({
      ...current(),
      profiles,
      activeProfileId: 'profile-0',
    }))).toEqual({ status: 'invalid', reason: 'invalid_profiles' });
  });

  it('rejects duplicate profile IDs', () => {
    expect(parseProfileMetadata(JSON.stringify({
      ...current(),
      profiles: [profile, { ...profile, name: 'Another' }],
    }))).toEqual({ status: 'invalid', reason: 'duplicate_id' });
  });

  it.each(['missing', 'foreign'])('rejects an active ID that is %s', activeProfileId => {
    const raw = activeProfileId === 'missing'
      ? JSON.stringify({ version: 1, revision: 0, profiles: [profile] })
      : JSON.stringify({ ...current(), activeProfileId: 'other' });
    expect(parseProfileMetadata(raw)).toEqual({
      status: 'invalid',
      reason: 'invalid_active_profile',
    });
  });

  it('rejects unknown current root and profile-entry fields', () => {
    expect(parseProfileMetadata(JSON.stringify({ ...current(), extra: true }))).toEqual({
      status: 'invalid', reason: 'unknown_field',
    });
    expect(parseProfileMetadata(JSON.stringify({
      ...current(), profiles: [{ ...profile, extra: true }],
    }))).toEqual({ status: 'invalid', reason: 'unknown_field' });
  });

  it.each([
    '{"__proto__":{},"version":1,"revision":0,"profiles":[{"id":"alpha","name":"Alpha","createdAt":1}],"activeProfileId":"alpha"}',
    '{"version":1,"revision":0,"profiles":[{"id":"alpha","name":"Alpha","createdAt":1,"constructor":{}}],"activeProfileId":"alpha"}',
    '{"version":1,"revision":0,"profiles":[{"id":"alpha","name":"Alpha","createdAt":1,"prototype":{}}],"activeProfileId":"alpha"}',
  ])('rejects dangerous object keys', raw => {
    expect(parseProfileMetadata(raw)).toEqual({ status: 'invalid', reason: 'unknown_field' });
  });

  it('rejects accessor-backed fields without invoking the accessor', () => {
    const getter = vi.fn(() => 1);
    const value = {
      version: 1,
      revision: 0,
      profiles: [profile],
      activeProfileId: 'alpha',
    };
    Object.defineProperty(value, 'revision', { enumerable: true, get: getter });

    expect(parseObject(value)).toEqual({ status: 'invalid', reason: 'invalid_root' });
    expect(getter).not.toHaveBeenCalled();
  });
});
const recoveryStorage = (entries: readonly (readonly [string, string])[]) => ({
  length: entries.length,
  getItem: (key: string) => entries.find(([entryKey]) => entryKey === key)?.[1] ?? null,
  key: (index: number) => entries[index]?.[0] ?? null,
});

const recoveryInput = (overrides: Partial<Parameters<typeof resolveProfileMetadata>[0]> = {}) => ({
  primary: JSON.stringify(current()),
  backup: null,
  legacySave: null,
  storage: recoveryStorage([]),
  now: 1234,
  validateGameSave: (raw: string) => raw.startsWith('valid:'),
  createProfileId: () => 'generated',
  ...overrides,
});

describe('profile metadata recovery planning', () => {
  it('discovers only exact profile save keys in sorted ID order', () => {
    const storage = recoveryStorage([
      ['FATE_PROFILE_alpha', 'valid:alpha'],
      ['FATE_PROFILE_zulu', 'valid:zulu'],
      ['FATE_PROFILE_alpha__backups', 'sidecar'],
      ['FATE_PROFILE_alpha__writer', 'sidecar'],
      ['FATE_PROFILE_alpha__discord', 'sidecar'],
      ['FATE_PROFILE_alpha_misleading', 'not-a-profile'],
      ['fate_features_seen_v1_alpha', 'sidecar'],
      ['FATE_PROFILES', 'metadata'],
    ]);

    expect(discoverProfileSaveIds(storage)).toEqual(['alpha', 'zulu']);
  });

  it('uses a valid primary without requesting a write', () => {
    const result = resolveProfileMetadata(recoveryInput());

    expect(result.mode).toBe('durable');
    expect(result.repair).toBeNull();
  });

  it('requests legacy migration through a repair plan', () => {
    const result = resolveProfileMetadata(recoveryInput({
      primary: JSON.stringify(legacy()),
      backup: null,
    }));

    expect(result).toMatchObject({
      mode: 'repair',
      repair: { cause: 'legacy', candidate: { version: 1, revision: 0 }, archive: null },
    });
  });

  it('prefers a valid backup when primary is corrupt', () => {
    const result = resolveProfileMetadata(recoveryInput({
      primary: '{bad',
      backup: JSON.stringify(current()),
    }));

    expect(result).toMatchObject({
      mode: 'repair',
      repair: {
        cause: 'backup',
        archive: { version: 1, capturedAt: 1234, primary: '{bad', backup: JSON.stringify(current()) },
      },
    });
  });

  it.each([
    { primary: JSON.stringify({ ...current(), version: 2 }), backup: JSON.stringify(current()) },
    { primary: '{bad', backup: JSON.stringify({ ...current(), version: 2 }) },
  ])('keeps unsupported metadata read-only', sources => {
    const result = resolveProfileMetadata(recoveryInput(sources));

    expect(result).toMatchObject({ mode: 'read_only', repair: null, notice: { kind: 'unsupported' } });
  });

  it('reconstructs validated saves in sorted order with safe legacy details', () => {
    const malformedMetadata = JSON.stringify({
      profiles: [
        { id: 'zulu', name: ' Zulu Name ', createdAt: 99 },
        { id: 'alpha', name: 'Alpha Name', createdAt: 7 },
        { id: 'unsafe', name: ' Unsafe ', createdAt: -1 },
      ],
      activeProfileId: 'zulu',
      unrelated: true,
    });
    const result = resolveProfileMetadata(recoveryInput({
      primary: malformedMetadata,
      backup: null,
      storage: recoveryStorage([
        ['FATE_PROFILE_zulu', 'valid:zulu'],
        ['FATE_PROFILE_alpha', 'valid:alpha'],
        ['FATE_PROFILE_bad', 'invalid:bad'],
      ]),
    }));

    expect(result).toMatchObject({
      mode: 'repair',
      metadata: {
        activeProfileId: 'zulu',
        profiles: [
          { id: 'alpha', name: 'Alpha Name', createdAt: 7 },
          { id: 'zulu', name: 'Zulu Name', createdAt: 99 },
        ],
      },
      repair: { cause: 'reconstructed' },
      notice: { kind: 'partial', recoveredProfiles: 2, generatedNames: 0, unreadableSaves: 1, overflowSaves: 0 },
    });
  });

  it('generates deterministic unique recovered names and uses the recovery time', () => {
    const result = resolveProfileMetadata(recoveryInput({
      primary: null,
      storage: recoveryStorage([
        ['FATE_PROFILE_zulu', 'valid:zulu'],
        ['FATE_PROFILE_alpha', 'valid:alpha'],
      ]),
    }));

    expect(result).toMatchObject({
      metadata: {
        activeProfileId: 'alpha',
        profiles: [
          { id: 'alpha', name: 'Recovered Profile 1', createdAt: 1234 },
          { id: 'zulu', name: 'Recovered Profile 2', createdAt: 1234 },
        ],
      },
      notice: { generatedNames: 2 },
    });
  });

  it('counts overflow saves without deleting them', () => {
    const entries = Array.from({ length: 101 }, (_, index) => [
      `FATE_PROFILE_${String(index).padStart(3, '0')}`,
      `valid:${index}`,
    ] as const);
    const result = resolveProfileMetadata(recoveryInput({ primary: null, storage: recoveryStorage(entries) }));

    expect(result).toMatchObject({
      notice: { recoveredProfiles: 100, overflowSaves: 1, unreadableSaves: 0 },
    });
    expect(result.metadata.profiles[0]).toMatchObject({ id: '000' });
    expect(result.metadata.profiles).toHaveLength(100);
  });

  it('does not fall back to a legacy save while recovered saves exist', () => {
    const result = resolveProfileMetadata(recoveryInput({
      primary: null,
      legacySave: 'valid:legacy',
      storage: recoveryStorage([['FATE_PROFILE_alpha', 'valid:alpha']]),
    }));

    expect(result).toMatchObject({
      metadata: { profiles: [{ id: 'alpha' }] },
      repair: { cause: 'reconstructed', legacyCopy: null },
    });
  });

  it('plans but does not perform a valid legacy-save copy', () => {
    const storage = recoveryStorage([]);
    const result = resolveProfileMetadata(recoveryInput({ primary: null, legacySave: 'valid:legacy', storage }));

    expect(result).toMatchObject({
      mode: 'repair',
      metadata: { profiles: [{ id: 'generated', name: 'Main Account', createdAt: 1234 }] },
      repair: { cause: 'fresh', legacyCopy: { fromKey: 'FATE_UIM_SAVE_V1', toProfileId: 'generated' } },
    });
    expect(storage.getItem('FATE_PROFILE_generated')).toBeNull();
  });

  it('plans a fresh account when no save is recoverable', () => {
    const result = resolveProfileMetadata(recoveryInput({ primary: null }));

    expect(result).toMatchObject({
      mode: 'repair',
      metadata: {
        profiles: [{ id: 'generated', name: 'Main Account', createdAt: 1234 }],
        activeProfileId: 'generated',
      },
      repair: { cause: 'fresh', legacyCopy: null },
    });
  });
});
describe('profile metadata recovery regressions', () => {
  it('reports unreadable exact saves when creating a fresh profile', () => {
    const result = resolveProfileMetadata(recoveryInput({
      primary: null,
      storage: recoveryStorage([['FATE_PROFILE_alpha', 'invalid:alpha']]),
    }));

    expect(result).toMatchObject({
      mode: 'repair',
      metadata: { profiles: [{ id: 'generated', name: 'Main Account', createdAt: 1234 }] },
      notice: {
        kind: 'partial',
        recoveredProfiles: 0,
        generatedNames: 0,
        unreadableSaves: 1,
        overflowSaves: 0,
      },
    });
  });

  it('reserves recovered names before assigning generated labels', () => {
    const result = resolveProfileMetadata(recoveryInput({
      primary: JSON.stringify({
        profiles: [
          { id: 'alpha', createdAt: 1 },
          { id: 'beta', name: 'Recovered Profile 2', createdAt: 2 },
          { id: 'zulu', name: 'Recovered Profile 1', createdAt: 3 },
        ],
        unrelated: true,
      }),
      backup: null,
      storage: recoveryStorage([
        ['FATE_PROFILE_zulu', 'valid:zulu'],
        ['FATE_PROFILE_alpha', 'valid:alpha'],
        ['FATE_PROFILE_beta', 'valid:beta'],
      ]),
    }));

    expect(result).toMatchObject({
      metadata: {
        profiles: [
          { id: 'alpha', name: 'Recovered Profile 3', createdAt: 1 },
          { id: 'beta', name: 'Recovered Profile 2', createdAt: 2 },
          { id: 'zulu', name: 'Recovered Profile 1', createdAt: 3 },
        ],
      },
      notice: { generatedNames: 1 },
    });
  });

  it('uses code-unit order for mixed-case recovered profile IDs', () => {
    const result = resolveProfileMetadata(recoveryInput({
      primary: null,
      storage: recoveryStorage([
        ['FATE_PROFILE_a', 'valid:a'],
        ['FATE_PROFILE_Z', 'valid:Z'],
        ['FATE_PROFILE_A', 'valid:A'],
      ]),
    }));

    expect(result.metadata.profiles).toEqual([
      { id: 'A', name: 'Recovered Profile 1', createdAt: 1234 },
      { id: 'Z', name: 'Recovered Profile 2', createdAt: 1234 },
      { id: 'a', name: 'Recovered Profile 3', createdAt: 1234 },
    ]);
    expect(result.metadata.activeProfileId).toBe('A');
  });
});
