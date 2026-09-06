import { describe, it, expect } from 'vitest';
import {
  auditHistory, simpleHash, hashEntry, ensureChain, verifyChain,
  replayInvariants, computeRunId, buildVerifiedBundle, sha256Hex,
} from './integrity';
import { LogEntry } from '../types';

// --- fixtures ---------------------------------------------------------------

let seq = 0;
const mk = (over: Partial<LogEntry> = {}): LogEntry => ({
  id: `e${seq++}`,
  timestamp: 1_700_000_000_000 + seq,
  type: 'ROLL_FAIL',
  message: 'No Key.',
  ...over,
});

const fail = (o: Partial<LogEntry> = {}) => mk({ type: 'ROLL_FAIL', message: 'No Key.', ...o });
const success = (o: Partial<LogEntry> = {}) => mk({ type: 'ROLL_SUCCESS', message: 'Key Found!', ...o });

// --- simpleHash -------------------------------------------------------------

describe('simpleHash', () => {
  it('is deterministic', () => {
    expect(simpleHash('hello world')).toBe(simpleHash('hello world'));
  });
  it('differs for different input', () => {
    expect(simpleHash('abc')).not.toBe(simpleHash('abd'));
  });
  it('returns 8-char zero-padded hex', () => {
    expect(simpleHash('')).toMatch(/^[0-9a-f]{8}$/);
    expect(simpleHash('x')).toMatch(/^[0-9a-f]{8}$/);
  });
});

// --- hashEntry / canonicalize ----------------------------------------------

describe('hashEntry', () => {
  it('is deterministic for the same entry + prevHash', () => {
    const e = fail();
    expect(hashEntry(e, 'PREV')).toBe(hashEntry(e, 'PREV'));
  });
  it('changes when prevHash changes', () => {
    const e = fail();
    expect(hashEntry(e, 'A')).not.toBe(hashEntry(e, 'B'));
  });
  it('changes when the entry body changes', () => {
    const a = fail({ message: 'No Key.' });
    const b = { ...a, message: 'EDITED' };
    expect(hashEntry(a, 'P')).not.toBe(hashEntry(b, 'P'));
  });
  it('ignores existing hash/prevHash fields on the entry', () => {
    const e = fail();
    const withChainFields = { ...e, hash: 'deadbeef', prevHash: 'cafebabe' };
    expect(hashEntry(withChainFields, 'P')).toBe(hashEntry(e, 'P'));
  });
  it('is independent of key insertion order', () => {
    const a = { id: 'x', timestamp: 1, type: 'ROLL_FAIL', message: 'm' } as LogEntry;
    const b = { message: 'm', type: 'ROLL_FAIL', timestamp: 1, id: 'x' } as LogEntry;
    expect(hashEntry(a, 'P')).toBe(hashEntry(b, 'P'));
  });
  it('is independent of nested meta key order', () => {
    const a = fail({ id: 'm1', timestamp: 1, meta: { roll: 5, threshold: 10 } });
    const b = fail({ id: 'm1', timestamp: 1, meta: { threshold: 10, roll: 5 } });
    expect(hashEntry(a, 'P')).toBe(hashEntry(b, 'P'));
  });
});

// --- ensureChain ------------------------------------------------------------

describe('ensureChain', () => {
  it('returns empty for empty input', () => {
    expect(ensureChain([])).toEqual([]);
  });
  it('links the first entry to GENESIS', () => {
    const [first] = ensureChain([fail()]);
    expect(first.prevHash).toBe('GENESIS');
    expect(first.hash).toBeTruthy();
  });
  it('chains each entry prevHash to the previous hash', () => {
    const chained = ensureChain([fail(), fail(), fail()]);
    expect(chained[1].prevHash).toBe(chained[0].hash);
    expect(chained[2].prevHash).toBe(chained[1].hash);
  });
  it('does not mutate the input entries', () => {
    const input = [fail(), fail()];
    const snapshot = JSON.stringify(input);
    ensureChain(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
  it('is idempotent', () => {
    const once = ensureChain([fail(), success(), fail()]);
    const twice = ensureChain(once);
    expect(twice).toEqual(once);
  });
  it('returns the same reference when already fully chained', () => {
    const once = ensureChain([fail(), fail()]);
    expect(ensureChain(once)).toBe(once);
  });
});

// --- verifyChain ------------------------------------------------------------

describe('verifyChain', () => {
  it('reports ok for an empty history', () => {
    expect(verifyChain([])).toEqual({ ok: true, brokenAt: [], firstBreak: null });
  });
  it('reports ok for an untampered chain', () => {
    const report = verifyChain(ensureChain([fail(), success(), fail()]));
    expect(report.ok).toBe(true);
    expect(report.brokenAt).toEqual([]);
  });
  it('flags an entry whose body was edited after chaining', () => {
    const chained = ensureChain([fail(), fail(), fail()]);
    const tampered = chained.map((e, i) => i === 1 ? { ...e, message: 'EDITED' } : e);
    const report = verifyChain(tampered);
    expect(report.ok).toBe(false);
    expect(report.brokenAt).toContain(1);
    expect(report.firstBreak).toBe(1);
  });
  it('flags a severed prevHash link', () => {
    const chained = ensureChain([fail(), fail()]);
    const broken = chained.map((e, i) => i === 1 ? { ...e, prevHash: 'WRONGHASH' } : e);
    expect(verifyChain(broken).brokenAt).toContain(1);
  });
});

// --- replayInvariants -------------------------------------------------------

describe('replayInvariants', () => {
  it('starts from the given key count with no violations', () => {
    const { violations, final } = replayInvariants([], 3);
    expect(violations).toEqual([]);
    expect(final.keys).toBe(3);
    expect(final.rolls).toBe(0);
  });

  it('counts a successful roll', () => {
    const { final } = replayInvariants([success()], 0);
    expect(final.keys).toBe(1);
    expect(final.successes).toBe(1);
    expect(final.rolls).toBe(1);
    expect(final.fatePoints).toBe(0);
  });

  it('awards two keys for a doubled (Greed) success', () => {
    const { final } = replayInvariants(
      [success({ message: 'Key Found! (Doubled)', details: 'greed' })], 0,
    );
    expect(final.keys).toBe(2);
  });

  it('counts an Omni roll', () => {
    const { final } = replayInvariants([mk({ type: 'ROLL_OMNI', message: 'Omni!' })], 0);
    expect(final.specialKeys).toBe(1);
    expect(final.keys).toBe(1);
    expect(final.omnis).toBe(1);
  });

  it('counts a pity key', () => {
    const { final } = replayInvariants([mk({ type: 'PITY', message: 'Pity Key' })], 0);
    expect(final.keys).toBe(1);
    expect(final.pities).toBe(1);
  });

  it('accumulates fate on failed rolls', () => {
    const { final } = replayInvariants([fail(), fail(), fail()], 0);
    expect(final.fatePoints).toBe(3);
    expect(final.rolls).toBe(3);
    expect(final.successes).toBe(0);
  });

  it('replays the exact weighted Fate award recorded on a failed roll', () => {
    const { final } = replayInvariants([
      fail({ meta: { fatePointsEarned: 3 } }),
    ], 0);

    expect(final.fatePoints).toBe(3);
  });

  it('uses the legacy +1 Fate fallback when a failed roll has no award metadata', () => {
    const { final } = replayInvariants([fail()], 0);

    expect(final.fatePoints).toBe(1);
  });

  it('preserves Fate overflow after a recorded weighted Pity roll', () => {
    const history = [
      ...Array.from({ length: 49 }, () => fail()),
      mk({ type: 'PITY', message: 'Pity Key', meta: { fatePointsEarned: 3 } }),
    ];

    const { final, violations } = replayInvariants(history, 0);

    expect(final.fatePoints).toBe(2);
    expect(violations.some(v => v.kind === 'FATE_OVERFLOW')).toBe(false);
  });

  it.each([10, 100])('replays a valid custom %i-Fate pity threshold without false overflow', (pityThreshold) => {
    const history = [
      ...Array.from({ length: pityThreshold - 1 }, () => fail()),
      mk({
        type: 'PITY',
        message: 'Pity Key',
        meta: { fatePointsEarned: 3, pityThreshold },
      }),
    ];

    const { final, violations } = replayInvariants(history, 0);

    expect(final.fatePoints).toBe(2);
    expect(violations.some(v => v.kind === 'FATE_OVERFLOW')).toBe(false);
  });

  it.each([9, 101, 12.5, Number.NaN])('falls back to the legacy 50-Fate cap for invalid pity threshold %s', (pityThreshold) => {
    const history = [
      ...Array.from({ length: 49 }, () => fail()),
      mk({
        type: 'PITY',
        message: 'Pity Key',
        meta: { fatePointsEarned: 3, pityThreshold },
      }),
    ];

    expect(replayInvariants(history, 0).final.fatePoints).toBe(2);
  });

  it('spends keys on an unlock', () => {
    const { final } = replayInvariants(
      [mk({ type: 'UNLOCK', message: 'Unlocked', meta: { cost: 1, costType: 'key' } })], 3,
    );
    expect(final.keys).toBe(2);
    expect(final.unlocks).toBe(1);
  });

  it('spends a special key on a specialKey unlock', () => {
    const { final } = replayInvariants(
      [mk({ type: 'UNLOCK', message: 'Unlocked', meta: { costType: 'specialKey' } })], 0,
    );
    expect(final.specialKeys).toBe(-1); // drives the SPECIAL_NEGATIVE check
  });

  it('applies Void Altar rituals', () => {
    const chaos = replayInvariants(
      [mk({ type: 'ALTAR', message: 'Ritual of Chaos' })], 0,
    ).final;
    expect(chaos.chaosKeys).toBe(1);
    expect(chaos.fatePoints).toBe(-25);

    const transmute = replayInvariants(
      [mk({ type: 'ALTAR', message: 'Ritual of Transmutation' })], 10,
    ).final;
    expect(transmute.keys).toBe(5);
    expect(transmute.specialKeys).toBe(1);
  });

  it('replays the exact Chaos Key metadata for a current level-up entry', () => {
    const { final } = replayInvariants([
      mk({
        type: 'LEVEL_UP',
        message: '2 Chaos Keys awarded!',
        meta: { chaosKeysAwarded: 2 },
      }),
    ], 0);

    expect(final.chaosKeys).toBe(2);
  });

  it('uses the legacy Chaos Key Drop message when level-up metadata is absent', () => {
    const { final } = replayInvariants([
      mk({ type: 'LEVEL_UP', message: 'Chaos Key Drop!' }),
    ], 0);

    expect(final.chaosKeys).toBe(1);
  });

  it.each(['ROLL_FAIL', 'ROLL_SUCCESS', 'ROLL_OMNI'] as const)(
    'replays validated detected skill Chaos rewards on %s entries',
    (type) => {
      const { final } = replayInvariants([mk({
        type,
        message: 'Detected skill roll',
        meta: {
          detectorId: 'skill-level-v1',
          chaosKeysAwarded: 2,
        },
      })], 0);

      expect(final.chaosKeys).toBe(2);
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'ignores invalid detected skill Chaos award %s',
    (chaosKeysAwarded) => {
      const { final } = replayInvariants([fail({
        meta: {
          detectorId: 'skill-level-v1',
          chaosKeysAwarded,
        },
      })], 0);

      expect(final.chaosKeys).toBe(0);
    },
  );

  it('does not apply Chaos metadata from an arbitrary non-skill roll', () => {
    const { final } = replayInvariants([fail({
      meta: {
        detectorId: 'quest-widget-v1',
        chaosKeysAwarded: 2,
      },
    })], 0);

    expect(final.chaosKeys).toBe(0);
  });

  it('does not double-count level rewards merged onto their following roll', () => {
    const { final } = replayInvariants([
      mk({
        type: 'LEVEL_UP',
        message: '2 Chaos Keys awarded!',
        meta: { chaosKeysAwarded: 2 },
      }),
      fail({
        meta: {
          skill: 'Attack',
          level: 30,
          chaosKeysAwarded: 2,
        },
      }),
    ], 0);

    expect(final.chaosKeys).toBe(2);
  });

  it('replays tampered Chaos metadata exactly so the chain check can expose the edit', () => {
    const original = ensureChain([
      mk({ type: 'LEVEL_UP', message: '2 Chaos Keys awarded!', meta: { chaosKeysAwarded: 2 } }),
    ]);
    const tampered = [{ ...original[0], meta: { chaosKeysAwarded: 20 } }];

    expect(replayInvariants(tampered, 0).final.chaosKeys).toBe(20);
    expect(verifyChain(tampered).ok).toBe(false);
  });

  it('replays full compensation awards and the recorded Fate remainder', () => {
    const { final } = replayInvariants([mk({
      type: 'COMPENSATION',
      message: 'Fate compensation resolved: full',
      meta: {
        choice: 'full',
        chaosKeysAwarded: 3,
        pityKeysAwarded: 1,
        fatePointsAfter: 5,
      },
    })], 0);

    expect(final.keys).toBe(1);
    expect(final.chaosKeys).toBe(3);
    expect(final.fatePoints).toBe(5);
  });

  it('replays Chaos-only compensation without replacing Fate', () => {
    const { final } = replayInvariants([
      fail(),
      fail(),
      mk({
        type: 'COMPENSATION',
        message: 'Fate compensation resolved: chaos',
        meta: {
          choice: 'chaos',
          chaosKeysAwarded: 2,
          pityKeysAwarded: 0,
          fatePointsAfter: 2,
        },
      }),
    ], 0);

    expect(final.keys).toBe(0);
    expect(final.chaosKeys).toBe(2);
    expect(final.fatePoints).toBe(2);
  });

  it('changes replayed balances when compensation award metadata is tampered', () => {
    const entry = mk({
      type: 'COMPENSATION',
      message: 'Fate compensation resolved: full',
      meta: {
        choice: 'full',
        chaosKeysAwarded: 3,
        pityKeysAwarded: 1,
        fatePointsAfter: 5,
      },
    });
    const expected = replayInvariants([entry], 0).final;
    const tampered = replayInvariants([{
      ...entry,
      meta: { ...entry.meta, chaosKeysAwarded: 30 },
    }], 0).final;

    expect(expected).toMatchObject({ keys: 1, chaosKeys: 3, fatePoints: 5 });
    expect(tampered).not.toEqual(expected);
    expect(tampered.chaosKeys).toBe(30);
  });

  it('flags negative keys when over-spending', () => {
    const { violations } = replayInvariants(
      [mk({ type: 'UNLOCK', message: 'Unlocked', meta: { cost: 5, costType: 'key' } })], 0,
    );
    expect(violations.some(v => v.kind === 'KEYS_NEGATIVE')).toBe(true);
  });

  it('flags fate overflow above the cap', () => {
    const fails = Array.from({ length: 51 }, () => fail());
    const { violations } = replayInvariants(fails, 0);
    expect(violations.some(v => v.kind === 'FATE_OVERFLOW')).toBe(true);
  });

  it('flags roll values outside 0.1-100.0', () => {
    const zero = replayInvariants([fail({ rollValue: 0 })], 0).violations;
    const high = replayInvariants([fail({ rollValue: 100.1 })], 0).violations;
    expect(zero.some(v => v.kind === 'ROLL_OUT_OF_RANGE')).toBe(true);
    expect(high.some(v => v.kind === 'ROLL_OUT_OF_RANGE')).toBe(true);
  });

  it('accepts decimal and legacy integer roll values in range', () => {
    const { violations } = replayInvariants([
      fail({ rollValue: 0.1 }),
      fail({ rollValue: 8.2 }),
      success({ rollValue: 1 }),
      success({ rollValue: 100 }),
    ], 0);
    expect(violations.some(v => v.kind === 'ROLL_OUT_OF_RANGE')).toBe(false);
  });
});

// --- computeRunId -----------------------------------------------------------

describe('computeRunId', () => {
  it('returns null for empty history', () => {
    expect(computeRunId([])).toBeNull();
  });
  it('returns a deterministic run-<hash> id', () => {
    const history = [fail({ id: 'fixed', timestamp: 123 })];
    const a = computeRunId(history);
    const b = computeRunId(history);
    expect(a).toBe(b);
    expect(a).toMatch(/^run-/);
  });
  it('derives the id from the first entry only', () => {
    const first = fail({ id: 'first', timestamp: 1 });
    const idAlone = computeRunId([first]);
    const idWithMore = computeRunId([first, success(), fail()]);
    expect(idWithMore).toBe(idAlone);
  });
});

// --- sha256Hex --------------------------------------------------------------

describe('sha256Hex', () => {
  it('matches the known SHA-256 vector for "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
  it('returns 64 hex chars', async () => {
    expect(await sha256Hex('anything')).toMatch(/^[0-9a-f]{64}$/);
  });
});

// --- buildVerifiedBundle ----------------------------------------------------

describe('buildVerifiedBundle', () => {
  it('produces a complete, internally-consistent bundle', async () => {
    const bundle = await buildVerifiedBundle([fail(), success(), fail()]);
    expect(bundle.version).toBe(1);
    expect(bundle.runId).toMatch(/^run-/);
    expect(bundle.history).toHaveLength(3);
    expect(bundle.chainReport.ok).toBe(true);
    expect(bundle.commitmentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(bundle.finalState.rolls).toBe(3);
  });
  it('carries a broken chain report through when history was tampered', async () => {
    const chained = ensureChain([fail(), fail()]);
    const tampered = chained.map((e, i) => i === 1 ? { ...e, message: 'EDITED' } : e);
    const bundle = await buildVerifiedBundle(tampered);
    expect(bundle.chainReport.ok).toBe(false);
  });
});


describe('malformed integrity links', () => {
  it('retains legacy uncertainty across initialization and export', async () => {
    const history = [fail()];
    expect(auditHistory(history).verdict).toBe('warning');
    const migrated = ensureChain(history);
    expect(verifyChain(migrated).ok).toBe(true);
    expect(auditHistory(migrated).verdict).toBe('warning');
    const bundle = await buildVerifiedBundle(migrated);
    expect(auditHistory(bundle.history).verdict).toBe('warning');
    const strippedMarker = migrated.map(entry => ({ ...entry, meta: {} }));
    expect(verifyChain(strippedMarker).ok).toBe(false);
  });
  it.each([
    { hash: 'deadbeef' }, { prevHash: 'GENESIS' },
    { hash: '', prevHash: 'GENESIS' }, { hash: null, prevHash: 'GENESIS' },
  ])('does not repair partial fields: %j', fields => {
    const history = [fail(fields as any)];
    expect(ensureChain(history)).toBe(history);
    expect(verifyChain(history).ok).toBe(false);
    expect(auditHistory(history).verdict).toBe('tampered');
  });
  it('rejects a legacy entry inserted into an existing chain', () => {
    const history = [...ensureChain([fail()]), fail()];
    expect(ensureChain(history)).toBe(history);
    expect(auditHistory(history).verdict).toBe('tampered');
  });
  it('does not verify unhashed history without explicit legacy initialization', () => {
    expect(verifyChain([fail()]).ok).toBe(false);
    expect(verifyChain(ensureChain([fail()])).ok).toBe(true);
  });
});


describe('mode-aware and incomplete replay', () => {
  const rules = { pityEnabled: true, pityThreshold: 100, ritualCostMultiplier: 1, omniChanceBase: 2, regionModifiers: false };
  it('does not need a future Pity event to recognize a custom cap', () => {
    expect(replayInvariants(Array.from({ length: 60 }, () => fail()), 3, rules).violations).toEqual([]);
  });
  it('does not enforce a Fate cap when Pity is disabled', () => {
    expect(replayInvariants(Array.from({ length: 130 }, () => fail()), 3, { ...rules, pityEnabled: false }).violations).toEqual([]);
  });
  it('keeps legacy ritual uncertainty without falsely accusing negative balances', async () => {
    const history = [...Array.from({ length: 8 }, () => fail()), mk({ type: 'ALTAR', message: 'Ritual of Clarity' })];
    const replay = replayInvariants(history, 3, rules);
    expect(replay.uncertainAt).toEqual([8]);
    expect(replay.violations).toEqual([]);
    expect(auditHistory(history, rules).verdict).toBe('warning');
    const bundle = await buildVerifiedBundle(history, { id: 'custom', rules });
    expect(bundle.replayUncertainAt).toEqual([8]);
    expect(bundle.verdict).toBe('warning');
  });
});
