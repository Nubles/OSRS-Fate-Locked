import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseProfileMetadata } from './profileMetadata';

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
