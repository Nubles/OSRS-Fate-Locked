import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import type { GameState } from '../types';
import { serializeCurrent } from './gamePersistence';
import { moveRole, pairingForwardUrl, trackerOrigin } from './moveRole';
import {
  MAX_MOVE_PROFILES,
  acceptMoveOffer,
  acceptMoveRequest,
  acceptMoveResult,
  buildMoveOffer,
  buildMoveRequest,
  buildMoveResult,
  copyName,
  moveBackupFile,
  parseMoveBackupFile,
  parseMovedRecord,
  planMoveImport,
  recordMoveResult,
  summarizeMovedSave,
  unmovedOutcome,
  type MoveProfile,
} from './originMove';

const OLD_URL = 'https://nubles.github.io/OSRS-Fate-Locked/';
const NEW_URL = 'https://fatelocked.github.io/';
const OLD = 'https://nubles.github.io';
const NEW = 'https://fatelocked.github.io';
const NONCE = '0b9f3c1e-4a8e-4d5c-9b1a-7f2e6d3c8a10';

const RUN_A = '123e4567-e89b-42d3-a456-426614174000';
const RUN_B = '223e4567-e89b-42d3-a456-426614174001';
const RUN_C = '323e4567-e89b-42d3-a456-426614174002';

const save = (runId: string, entries = 0): string => {
  const state = structuredClone(initialState) as GameState;
  state.runId = runId;
  state.history = Array.from({ length: entries }, (_, index) => ({
    id: `h${index}`,
    timestamp: Date.UTC(2026, 8, 1) + index,
    type: 'ROLL_FAIL' as const,
    message: 'No key.',
  }));
  return serializeCurrent(state);
};

const profile = (id: string, data: string, over: Partial<MoveProfile> = {}): MoveProfile => ({
  id, name: `Run ${id}`, createdAt: 1, active: false, data, ...over,
});

const summarize = (data: string) => summarizeMovedSave(data, structuredClone(initialState) as GameState);

describe('which side of the move a page is on', () => {
  it('is inert until the new address is set', () => {
    expect(moveRole(OLD, OLD_URL, '')).toBeNull();
    expect(moveRole(NEW, OLD_URL, '')).toBeNull();
  });

  it('knows the old and the new address by exact origin', () => {
    expect(moveRole(OLD, OLD_URL, NEW_URL)).toBe('old');
    expect(moveRole(NEW, OLD_URL, NEW_URL)).toBe('new');
    expect(moveRole('https://fatelocked.github.io.evil.example', OLD_URL, NEW_URL)).toBeNull();
    expect(moveRole('http://fatelocked.github.io', OLD_URL, NEW_URL)).toBeNull();
  });

  it('refuses a new address that is the old one, or not https', () => {
    expect(moveRole(OLD, OLD_URL, 'https://nubles.github.io/elsewhere/')).toBeNull();
    expect(moveRole(NEW, OLD_URL, 'http://fatelocked.github.io/')).toBeNull();
    expect(trackerOrigin('http://localhost:4174/')).toBe('http://localhost:4174');
    expect(trackerOrigin('not a url')).toBeNull();
  });

  it('passes a RuneLite pairing link on only once every run has moved', () => {
    const hash = `#runelite-pair=${'a'.repeat(32)}`;
    const moved = JSON.stringify({ allMoved: true });
    expect(pairingForwardUrl('old', hash, moved, NEW_URL)).toBe(`${NEW_URL}${hash}`);
    expect(pairingForwardUrl('old', hash, JSON.stringify({ allMoved: false }), NEW_URL)).toBeNull();
    expect(pairingForwardUrl('old', hash, null, NEW_URL)).toBeNull();
    expect(pairingForwardUrl('old', hash, '{broken', NEW_URL)).toBeNull();
    expect(pairingForwardUrl('new', hash, moved, NEW_URL)).toBeNull();
    expect(pairingForwardUrl('old', '#runelite-pair=nothex', moved, NEW_URL)).toBeNull();
    expect(pairingForwardUrl('old', hash, moved, '')).toBeNull();
  });
});

describe('the handshake', () => {
  const request = buildMoveRequest(NONCE);

  it('the old address answers only the exact new origin, from the tab it opened', () => {
    expect(acceptMoveRequest({ origin: NEW, data: request, fromExpectedWindow: true }, NEW))
      .toEqual({ ok: true, value: request });
    expect(acceptMoveRequest({ origin: 'https://evil.example', data: request, fromExpectedWindow: true }, NEW))
      .toEqual({ ok: false, reason: 'wrong_origin' });
    expect(acceptMoveRequest({ origin: `${NEW}.evil.example`, data: request, fromExpectedWindow: true }, NEW))
      .toEqual({ ok: false, reason: 'wrong_origin' });
    expect(acceptMoveRequest({ origin: NEW, data: request, fromExpectedWindow: false }, NEW))
      .toEqual({ ok: false, reason: 'wrong_window' });
    expect(acceptMoveRequest({ origin: NEW, data: { ...request, nonce: 'short' }, fromExpectedWindow: true }, NEW))
      .toEqual({ ok: false, reason: 'malformed' });
    expect(acceptMoveRequest({ origin: NEW, data: 'hello', fromExpectedWindow: true }, NEW))
      .toEqual({ ok: false, reason: 'malformed' });
  });

  it('the new address takes an offer only from the exact old origin, its opener, with its nonce', () => {
    const offer = buildMoveOffer(NONCE, [profile('alpha', save(RUN_A))], [], 5);
    expect(acceptMoveOffer({ origin: OLD, data: offer, fromExpectedWindow: true }, OLD, NONCE))
      .toEqual({ ok: true, value: offer });
    // Another site on another github.io address.
    expect(acceptMoveOffer({ origin: 'https://someone.github.io', data: offer, fromExpectedWindow: true }, OLD, NONCE))
      .toEqual({ ok: false, reason: 'wrong_origin' });
    expect(acceptMoveOffer({ origin: OLD, data: offer, fromExpectedWindow: false }, OLD, NONCE))
      .toEqual({ ok: false, reason: 'wrong_window' });
    expect(acceptMoveOffer({ origin: OLD, data: offer, fromExpectedWindow: true }, OLD, 'ffffffff-ffff-4fff-8fff-ffffffffffff'))
      .toEqual({ ok: false, reason: 'wrong_nonce' });
  });

  it('rejects a malformed offer as a whole', () => {
    const offer = buildMoveOffer(NONCE, [profile('alpha', save(RUN_A))], [], 5);
    const malformed = (data: unknown) => acceptMoveOffer({ origin: OLD, data, fromExpectedWindow: true }, OLD, NONCE);
    expect(malformed({ ...offer, profiles: [profile('../etc', 'x')] })).toEqual({ ok: false, reason: 'malformed' });
    expect(malformed({ ...offer, profiles: [profile('alpha', 'x'), profile('alpha', 'y')] })).toEqual({ ok: false, reason: 'malformed' });
    expect(malformed({ ...offer, profiles: [{ ...profile('alpha', 'x'), data: 7 }] })).toEqual({ ok: false, reason: 'malformed' });
    expect(malformed({ ...offer, skipped: [{ id: 'beta', name: 'B', reason: 'because' }] })).toEqual({ ok: false, reason: 'malformed' });
    expect(malformed({
      ...offer,
      profiles: Array.from({ length: MAX_MOVE_PROFILES + 1 }, (_, index) => profile(`p${index}`, 'x')),
    })).toEqual({ ok: false, reason: 'malformed' });
    expect(malformed({ ...offer, version: 2 })).toEqual({ ok: false, reason: 'malformed' });
  });

  it('cleans profile names the way the profile registry does', () => {
    const offer = buildMoveOffer(NONCE, [profile('alpha', 'x', { name: '   ' })], [], 5);
    const accepted = acceptMoveOffer({ origin: OLD, data: offer, fromExpectedWindow: true }, OLD, NONCE);
    expect(accepted.ok && accepted.value.profiles[0].name).toBe('Unnamed Profile');
  });

  it('the old address takes the result only for the nonce it answered', () => {
    const result = buildMoveResult(NONCE, [{ sourceId: 'alpha', outcome: 'moved' }]);
    expect(acceptMoveResult({ origin: NEW, data: result, fromExpectedWindow: true }, NEW, NONCE))
      .toEqual({ ok: true, value: result });
    expect(acceptMoveResult({ origin: NEW, data: result, fromExpectedWindow: true }, NEW, null))
      .toEqual({ ok: false, reason: 'wrong_nonce' });
    expect(acceptMoveResult({ origin: OLD, data: result, fromExpectedWindow: true }, NEW, NONCE))
      .toEqual({ ok: false, reason: 'wrong_origin' });
    expect(acceptMoveResult({ origin: NEW, data: { ...result, outcomes: [{ sourceId: 'alpha', outcome: 'deleted' }] }, fromExpectedWindow: true }, NEW, NONCE))
      .toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('the all-runs backup file', () => {
  it('reads back as the same runs, and refuses anything else', () => {
    const profiles = [profile('alpha', save(RUN_A), { active: true })];
    const skipped = [{ id: 'beta', name: 'Run beta', reason: 'needs_recovery' as const }];
    const parsed = parseMoveBackupFile(moveBackupFile(profiles, skipped, 9));
    expect(parsed?.profiles).toEqual(profiles);
    expect(parsed?.skipped).toEqual(skipped);
    expect(parseMoveBackupFile('FATE:abc')).toBeNull();
    expect(parseMoveBackupFile(JSON.stringify({ protocol: 'fate-locked-move', version: 1, kind: 'offer' }))).toBeNull();
  });
});

describe('planning the import on the new address', () => {
  it('validates each save with the normal save check and summarises it', () => {
    const summary = summarize(save(RUN_A, 3));
    expect(summary).toMatchObject({ ok: true, runId: RUN_A, entries: 3, lastPlayedAt: Date.UTC(2026, 8, 1) + 2 });
    expect(summarize('{"app":"rs3-fate-locked"}')).toMatchObject({ ok: false });
    expect(summarize('not json')).toMatchObject({ ok: false });
  });

  it('never plans to replace a run that is already here', () => {
    const plan = planMoveImport(
      { profiles: [profile('alpha', save(RUN_A, 2)), profile('beta', save(RUN_B))] },
      [{ profileId: 'here', name: 'Main Account', runId: RUN_A }],
      summarize,
    );
    expect(plan[0]).toMatchObject({ status: 'duplicate', choice: 'skip', choices: ['skip', 'copy'], duplicateOf: { name: 'Main Account', incoming: false } });
    expect(plan[1]).toMatchObject({ status: 'new', choice: 'import' });
    expect(unmovedOutcome(plan[0])).toBe('already_there');
  });

  it('spots the same run twice in one move', () => {
    const plan = planMoveImport(
      { profiles: [profile('alpha', save(RUN_A)), profile('copy', save(RUN_A))] },
      [],
      summarize,
    );
    expect(plan.map(item => item.status)).toEqual(['new', 'duplicate']);
    expect(plan[1]).toMatchObject({ duplicateOf: { name: 'Run alpha', incoming: true } });
    expect(unmovedOutcome(plan[1])).toBe('skipped');
  });

  it('a partial move: an unreadable save stays behind and the rest go', () => {
    const plan = planMoveImport(
      { profiles: [profile('alpha', save(RUN_A)), profile('broken', '{"history":7}'), profile('gamma', save(RUN_C))] },
      [],
      summarize,
    );
    expect(plan.map(item => [item.status, item.choice])).toEqual([['new', 'import'], ['invalid', 'skip'], ['new', 'import']]);
    expect(unmovedOutcome(plan[1])).toBe('failed');
  });

  it('names a kept copy so the two can be told apart', () => {
    expect(copyName('Main Account')).toBe('Main Account (moved)');
    expect(copyName('A very long profile name here!').length).toBeLessThanOrEqual(30);
  });
});

describe('what the old address remembers', () => {
  const result = (outcomes: [string, 'moved' | 'skipped' | 'failed' | 'already_there'][]) =>
    buildMoveResult(NONCE, outcomes.map(([sourceId, outcome]) => ({ sourceId, outcome })));

  it('a partial move is not "all moved", and a later move completes it', () => {
    const first = recordMoveResult(null, result([['alpha', 'moved'], ['beta', 'failed']]), new Set(['alpha', 'beta']), ['alpha', 'beta'], 10);
    expect(first.allMoved).toBe(false);
    const second = recordMoveResult(first, result([['alpha', 'already_there'], ['beta', 'moved']]), new Set(['alpha', 'beta']), ['alpha', 'beta'], 20);
    expect(second.allMoved).toBe(true);
    expect(second.profiles.alpha).toEqual({ outcome: 'already_there', at: 20 });
  });

  it('a profile the old address did not send is not all moved', () => {
    const record = recordMoveResult(null, result([['alpha', 'moved']]), new Set(['alpha']), ['alpha', 'needs-recovery'], 10);
    expect(record.allMoved).toBe(false);
  });

  it('never downgrades a moved run, and ignores runs it never offered', () => {
    const first = recordMoveResult(null, result([['alpha', 'moved']]), new Set(['alpha']), ['alpha'], 10);
    const second = recordMoveResult(first, result([['alpha', 'skipped'], ['stranger', 'moved']]), new Set(['alpha']), ['alpha'], 20);
    expect(second.profiles).toEqual({ alpha: { outcome: 'moved', at: 10 } });
    expect(second.allMoved).toBe(true);
  });

  it('round-trips through storage and drops junk', () => {
    const record = recordMoveResult(null, result([['alpha', 'moved']]), new Set(['alpha']), ['alpha'], 10);
    expect(parseMovedRecord(JSON.stringify(record))).toEqual(record);
    expect(parseMovedRecord('{"version":1,"updatedAt":1,"profiles":{"../x":{"outcome":"moved","at":1}}}'))
      .toEqual({ version: 1, updatedAt: 1, allMoved: false, profiles: {} });
    expect(parseMovedRecord('nope')).toBeNull();
    expect(parseMovedRecord(null)).toBeNull();
  });
});
