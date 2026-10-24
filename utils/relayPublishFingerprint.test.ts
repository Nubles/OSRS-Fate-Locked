import { afterEach, describe, expect, it, vi } from 'vitest';
import chunkContentJson from '../public/chunk-content.json?raw';
import { initialState } from '../context/GameContext';
import { buildBundlePayload, type RuneliteRunInput } from './runeliteExport';
import {
  RELAY_REPUBLISH_UNCHANGED_MS,
  canSkipRelayPublish,
  parseRelayPublishedRecord,
  relayFingerprint,
  relayFingerprintSource,
} from './relayPublishFingerprint';

describe('relayFingerprintSource', () => {
  it('leaves out the build time and revision, at the root and in the rules', () => {
    const a = { version: 4, exportedAt: 'x', runRevision: 1, rules: { exportedAt: 'x', runRevision: 1, runId: 'r' }, keys: 3 };
    const b = { version: 4, exportedAt: 'y', runRevision: 2, rules: { exportedAt: 'y', runRevision: 2, runId: 'r' }, keys: 3 };
    expect(relayFingerprintSource(a)).toBe(relayFingerprintSource(b));
    expect(relayFingerprintSource(a)).toBe('{"version":4,"rules":{"runId":"r"},"keys":3}');
    // Anything else counts, even a Key.
    expect(relayFingerprintSource({ ...a, keys: 2 })).not.toBe(relayFingerprintSource(a));
    expect(relayFingerprintSource({ ...a, rules: { ...a.rules, runId: 's' } })).not.toBe(relayFingerprintSource(a));
  });

  it('does not change the bundle it reads', () => {
    const bundle = { exportedAt: 'x', runRevision: 1, rules: { exportedAt: 'x', runRevision: 1 } };
    relayFingerprintSource(bundle);
    expect(bundle).toEqual({ exportedAt: 'x', runRevision: 1, rules: { exportedAt: 'x', runRevision: 1 } });
  });
});

describe('canSkipRelayPublish', () => {
  const NOW = 1_800_000_000_000;
  const record = { code: 'c', fingerprint: 'f', runRevision: 10, at: NOW - 1_000 };

  it('skips the same profile for the same code, from this revision or a later one, within six hours', () => {
    expect(canSkipRelayPublish(record, 'c', 'f', 10, NOW)).toBe(true);
    expect(canSkipRelayPublish(record, 'c', 'f', 99, NOW)).toBe(true);
  });

  it('sends anything else', () => {
    expect(canSkipRelayPublish(null, 'c', 'f', 10, NOW)).toBe(false);
    expect(canSkipRelayPublish(record, 'other', 'f', 10, NOW)).toBe(false);
    expect(canSkipRelayPublish(record, 'c', 'g', 10, NOW)).toBe(false);
    expect(canSkipRelayPublish(record, 'c', null, 10, NOW)).toBe(false);
    // A restored older save: RuneLite's revision must not run ahead of the run's.
    expect(canSkipRelayPublish(record, 'c', 'f', 9, NOW)).toBe(false);
    expect(canSkipRelayPublish(record, 'c', 'f', 10, record.at + RELAY_REPUBLISH_UNCHANGED_MS)).toBe(false);
    // A clock set back: send.
    expect(canSkipRelayPublish(record, 'c', 'f', 10, record.at - 1)).toBe(false);
  });

  it('reads back only a whole record', () => {
    expect(parseRelayPublishedRecord(JSON.stringify(record))).toEqual(record);
    expect(parseRelayPublishedRecord(null)).toBeNull();
    expect(parseRelayPublishedRecord('{')).toBeNull();
    expect(parseRelayPublishedRecord(JSON.stringify({ ...record, runRevision: 'x' }))).toBeNull();
    expect(parseRelayPublishedRecord(JSON.stringify({ code: 'c' }))).toBeNull();
  });
});

describe('the fingerprint of a real profile', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const run = (overrides: Partial<RuneliteRunInput> = {}): RuneliteRunInput => ({
    runId: 'run-fingerprint',
    runRevision: 4,
    keys: 3,
    specialKeys: 0,
    chaosKeys: 0,
    fatePoints: 0,
    activeBuff: 'NONE',
    gameModeId: 'vanilla',
    ...overrides,
  });

  it('stays the same across builds and revisions, and changes with what RuneLite shows', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (String(input).includes('chunk-content.json')
      ? new Response(chunkContentJson, { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response('{}', { status: 404 }))));
    vi.useFakeTimers({ toFake: ['Date'] });

    vi.setSystemTime(new Date('2026-10-19T10:00:00Z'));
    const first = await buildBundlePayload(initialState.unlocks, run());
    vi.setSystemTime(new Date('2026-10-19T11:30:00Z'));
    const later = await buildBundlePayload(initialState.unlocks, run({ runRevision: 40 }));
    const spentKey = await buildBundlePayload(initialState.unlocks, run({ runRevision: 41, keys: 2 }));
    const unlocked = await buildBundlePayload(
      { ...initialState.unlocks, quests: ["Witch's Potion"] },
      run({ runRevision: 42 }),
    );

    // The bytes the relay would store differ every time…
    expect(later.compressed).not.toBe(first.compressed);
    expect(JSON.parse(later.json).exportedAt).not.toBe(JSON.parse(first.json).exportedAt);
    // …but nothing RuneLite uses did, until a Key was spent or a quest done.
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(later.fingerprint).toBe(first.fingerprint);
    expect(spentKey.fingerprint).not.toBe(first.fingerprint);
    expect(unlocked.fingerprint).not.toBe(first.fingerprint);
    expect(await relayFingerprint(JSON.parse(later.json))).toBe(first.fingerprint);
  }, 60_000);
});
