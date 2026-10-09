// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DETECTOR_POLICIES, policyFor } from '../config/detectorPolicies';
import { initialState } from '../context/GameContext';
import { BOSS_KILL_COUNTS, isRaidKey } from '../data/bossKillCounts';
import { BOSS_TIERS } from '../data/bossKeyTiers';
import { SKILLS_LIST } from '../data/items';
import type { FateEventEnvelope, FateEventType } from '../services/fateEventProtocol';
import type { GameState, UnlockState } from '../types';
import { classifyFateEvent } from './fateEventEligibility';

/**
 * The app's side of contracts/golden-bundles/detected-events.json (Stage 4): every event RuneLite
 * must make of a real game signal lands where the case says, never at a dead end. The plugin's
 * DetectedEventsContractTest runs the same cases through its detectors.
 */

interface ContractEvent {
  eventType: FateEventType;
  canonicalLabel: string | null;
  confidence: 'EXACT' | 'UNCERTAIN';
  detectorId: string;
  detectorVersion: number;
  evidence: Record<string, string | number | boolean>;
  web: { verdict: 'READY' | 'NEEDS_CONFIRMATION'; firstCandidate?: string };
}

interface ContractCase {
  id: string;
  about: string;
  given?: Partial<Pick<UnlockState, 'quests' | 'skills' | 'levels' | 'regions' | 'merchants'>>;
  signals: { kind: string }[];
  events: ContractEvent[];
}

interface DetectedEventsContract {
  schema: number;
  signals: Record<string, string>;
  cases: ContractCase[];
}

const contract: DetectedEventsContract = JSON.parse(
  readFileSync(resolve('contracts/golden-bundles/detected-events.json'), 'utf8'),
);

const ACCOUNT = 'Iron Example';

/** A Vanilla run for Iron Example with every skill unlocked at level 1 and every boss unlocked. */
function run(given: ContractCase['given'] = {}): GameState {
  const unlocks = structuredClone(initialState.unlocks);
  return {
    ...initialState,
    runId: 'contract-run',
    runRevision: 3,
    linkedAccount: ACCOUNT,
    gameModeId: 'vanilla',
    unlocks: {
      ...unlocks,
      skills: { ...Object.fromEntries(SKILLS_LIST.map((skill) => [skill, 1])), ...given.skills },
      levels: { ...unlocks.levels, ...given.levels },
      quests: [...unlocks.quests, ...(given.quests ?? [])],
      regions: [...unlocks.regions, ...(given.regions ?? [])],
      merchants: [...unlocks.merchants, ...(given.merchants ?? [])],
      bosses: [...Object.keys(BOSS_TIERS)],
    },
  };
}

const envelope = (event: ContractEvent, index: number): FateEventEnvelope => ({
  protocolVersion: 1,
  eventId: `contract-${index}`,
  runId: 'contract-run',
  account: ACCOUNT,
  runRevision: 3,
  eventType: event.eventType,
  canonicalLabel: event.canonicalLabel,
  occurredAt: Date.now(),
  sessionSequence: index,
  bundleVersion: 4,
  rulesVersion: '1',
  contentVersion: 1,
  detectorId: event.detectorId,
  detectorVersion: event.detectorVersion,
  confidence: event.confidence,
  evidence: event.evidence,
});

describe('the detected-events contract', () => {
  it('names each case once, with signals the contract describes', () => {
    expect(contract.schema).toBe(1);
    const ids = contract.cases.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of contract.cases) {
      expect(item.about.trim().length, item.id).toBeGreaterThan(10);
      expect(item.signals.length, item.id).toBeGreaterThan(0);
      for (const signal of item.signals) expect(Object.keys(contract.signals), item.id).toContain(signal.kind);
    }
  });

  it('uses only detectors the app approves, at versions it approves, for their types', () => {
    for (const item of contract.cases) {
      for (const event of item.events) {
        const policy = policyFor(event.detectorId);
        expect(policy, `${item.id}: ${event.detectorId}`).not.toBeNull();
        expect(event.detectorVersion, item.id).toBeLessThanOrEqual(policy!.maxApprovedVersion);
        expect(policy!.eventTypes, item.id).toContain(event.eventType);
        // An exact detector sends exact events, and a confirmation-only one never claims to.
        expect(event.confidence, item.id).toBe(policy!.handling === 'EXACT' ? 'EXACT' : 'UNCERTAIN');
      }
    }
  });

  it('covers every detector RuneLite copies, and has cases with no event', () => {
    const covered = new Set(contract.cases.flatMap((item) => item.events.map((event) => event.detectorId)));
    const copied = DETECTOR_POLICIES.map((policy) => policy.detectorId);
    expect([...covered].sort()).toEqual([...copied].sort());
    expect(contract.cases.filter((item) => item.events.length === 0).length).toBeGreaterThanOrEqual(5);
  });

  it("names each kill by a boss's kill-count name, and a raid as a raid", () => {
    for (const item of contract.cases) {
      for (const event of item.events.filter((one) => one.detectorId === 'boss-kill-count-v1')) {
        const names = BOSS_KILL_COUNTS[event.canonicalLabel ?? ''];
        expect(names, `${item.id}: ${event.canonicalLabel}`).toBeDefined();
        expect(names.map((name) => name.toLowerCase()), item.id)
          .toContain(String(event.evidence.killCountName).toLowerCase());
        expect(event.eventType, item.id).toBe(isRaidKey(event.canonicalLabel!) ? 'RAID_COMPLETION' : 'BOSS_KILL');
      }
    }
  });

  it('lands every event where the case says, never at a dead end', () => {
    let index = 0;
    for (const item of contract.cases) {
      const state = run(item.given);
      for (const event of item.events) {
        const verdict = classifyFateEvent(envelope(event, index++), state);
        expect(verdict.state, `${item.id}: ${event.canonicalLabel} (${'reason' in verdict ? verdict.reason : ''})`)
          .toBe(event.web.verdict);
        if (verdict.state !== 'NEEDS_CONFIRMATION') continue;
        expect(verdict.candidates?.length, `${item.id} offers choices`).toBeGreaterThan(0);
        if (event.web.firstCandidate) expect(verdict.candidates?.[0].target, item.id).toBe(event.web.firstCandidate);
      }
    }
  });
});
