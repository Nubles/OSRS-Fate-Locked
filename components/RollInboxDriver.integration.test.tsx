// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventAcknowledgement, FateEventEnvelope } from '../services/fateEventProtocol';
import type { RollInboxRow } from '../services/rollInboxStore';
import worker from '../workers/fate-relay/worker.js';

const harness = vi.hoisted(() => ({
  game: {
    current: {
      runId: 'run-1',
      runRevision: 1,
      linkedAccount: 'Nubles',
    },
  },
  store: { current: null as unknown as { list(): RollInboxRow[] } },
  acknowledge: {
    current: async (_items: EventAcknowledgement[]): Promise<boolean> => false,
  },
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => harness.game.current,
}));
vi.mock('../services/rollInboxRuntime', () => ({
  getRollInboxStore: () => harness.store.current,
}));
vi.mock('../services/relaySync', () => ({
  relaySync: {
    enabled: false,
    subscribe: () => () => undefined,
  },
}));
vi.mock('../services/fateEventRelay', () => ({
  fateEventRelay: {
    fetchEvents: async () => [],
    acknowledge: (items: EventAcknowledgement[]) => harness.acknowledge.current(items),
  },
}));

import RollInboxDriver from './RollInboxDriver';

class MemoryKv {
  records = new Map<string, string>();

  async get(key: string, options?: { type?: string }) {
    const value = this.records.get(key);
    if (value === undefined) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }

  async put(key: string, value: string) {
    this.records.set(key, value);
  }
}

const row = (index: number): RollInboxRow => ({
  event: {
    protocolVersion: 1,
    eventId: `evt-${index}`,
    runId: 'run-1',
    account: 'Nubles',
    runRevision: 1,
    eventType: 'QUEST',
    canonicalLabel: 'Dragon Slayer I',
    occurredAt: index,
    sessionSequence: index,
    bundleVersion: 4,
    rulesVersion: '1',
    contentVersion: 1,
    detectorId: 'quest-widget-v1',
    detectorVersion: 1,
    confidence: 'EXACT',
    evidence: {},
  } satisfies FateEventEnvelope,
  state: 'COMPLETED',
  updatedAt: 1_000 + index,
});

afterEach(() => {
  cleanup();
});

describe('RollInboxDriver acknowledgement scheduling', () => {
  it('makes all 205 terminal acknowledgements observable with one plugin GET after each app cycle', async () => {
    const kv = new MemoryKv();
    const env = { RELAY: kv };
    const rows = Array.from({ length: 205 }, (_, index) => row(index));
    const postedBatches: string[][] = [];
    let failNextPost = true;
    let token: string | undefined;
    harness.store.current = { list: () => rows };
    harness.game.current = { runId: 'run-1', runRevision: 1, linkedAccount: 'Nubles' };
    harness.acknowledge.current = async (acknowledgements) => {
      postedBatches.push(acknowledgements.map(item => item.eventId));
      if (failNextPost) {
        failNextPost = false;
        return false;
      }
      const response = await worker.fetch(
        new Request('https://relay.test/r/ABCD/acks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, acknowledgements }),
        }),
        env,
      );
      token = (await response.json()).token;
      return response.ok;
    };

    const observed = new Set<string>();
    let view: ReturnType<typeof render> | undefined;
    for (let cycle = 0; cycle < 5; cycle += 1) {
      const postsBeforeCycle = postedBatches.length;
      if (cycle === 0) {
        view = render(<RollInboxDriver />);
      } else {
        harness.game.current = {
          ...harness.game.current,
          runRevision: harness.game.current.runRevision + 1,
        };
        view!.rerender(<RollInboxDriver />);
      }
      await waitFor(() => expect(postedBatches.length).toBeGreaterThan(postsBeforeCycle));
      await act(async () => {
        await new Promise(resolve => window.setTimeout(resolve, 0));
      });

      expect(postedBatches.length - postsBeforeCycle).toBe(1);
      expect(postedBatches.at(-1)?.length).toBeLessThanOrEqual(100);
      const response = await worker.fetch(
        new Request('https://relay.test/r/ABCD/acks'),
        env,
      );
      if (response.ok) {
        const visible = await response.json();
        for (const acknowledgement of visible.acknowledgements) {
          observed.add(acknowledgement.eventId);
        }
      }
    }

    expect(postedBatches[1]).toEqual(postedBatches[0]);
    expect(observed.size).toBe(205);
    expect(Array.from({ length: 205 }, (_, index) => `evt-${index}`)
      .every(eventId => observed.has(eventId))).toBe(true);
  });
});
