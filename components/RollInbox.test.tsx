// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import type { FateEventEnvelope, FateEventType } from '../services/fateEventProtocol';
import { createRollInboxStore } from '../services/rollInboxStore';
import type { GameState } from '../types';
import { RollInboxView, type RollInboxGame } from './RollInbox';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const gameState = (overrides: Partial<GameState> = {}): GameState => ({
  ...initialState,
  runId: 'run-1',
  runRevision: 7,
  linkedAccount: 'Nubles',
  ...overrides,
});

const event = (
  eventType: FateEventType = 'QUEST',
  canonicalLabel: string | null = 'Dragon Slayer I',
  overrides: Partial<FateEventEnvelope> = {},
): FateEventEnvelope => ({
  protocolVersion: 1,
  eventId: 'evt-1',
  runId: 'run-1',
  account: 'Nubles',
  runRevision: 7,
  eventType,
  canonicalLabel,
  occurredAt: Date.now(),
  sessionSequence: 1,
  bundleVersion: 1,
  rulesVersion: '1',
  contentVersion: 1,
  detectorId: {
    SKILL_LEVEL: 'skill-level-v1',
    QUEST: 'quest-widget-v1',
    COMBAT_ACHIEVEMENT: 'combat-achievement-chat-v1',
    COLLECTION_LOG: 'collection-log-chat-v1',
    CLUE_CASKET: 'clue-casket-loot-v1',
    BOSS_KILL: 'boss-loot-v1',
    RAID_COMPLETION: 'raid-loot-v1',
  }[eventType],
  detectorVersion: 1,
  confidence: 'EXACT',
  evidence: {},
  ...overrides,
});

function setup(envelope = event(), state = gameState(), storage = new MemoryStorage()) {
  const store = createRollInboxStore(storage, state.runId);
  store.ingest([envelope]);
  const rollForKey = vi.fn();
  const reconcileDetectedProgress = vi.fn();
  const acknowledge = vi.fn().mockResolvedValue(true);
  const game: RollInboxGame = {
    state,
    rollForKey,
    reconcileDetectedProgress,
  };
  render(<RollInboxView store={store} game={game} acknowledge={acknowledge} />);
  return { store, rollForKey, reconcileDetectedProgress, acknowledge };
}

afterEach(cleanup);

describe('RollInbox', () => {
  it('never rolls on ingest or render', async () => {
    const { rollForKey } = setup();
    expect(await screen.findByText('Dragon Slayer I')).toBeTruthy();
    expect(rollForKey).not.toHaveBeenCalled();
  });

  it('rolls exactly once after the player presses Roll', async () => {
    const user = userEvent.setup();
    const { rollForKey, acknowledge } = setup();
    const button = await screen.findByRole('button', { name: /^Roll$/ });
    await user.dblClick(button);

    expect(rollForKey).toHaveBeenCalledTimes(1);
    expect(rollForKey).toHaveBeenCalledWith(
      'Quest (Experienced)',
      75,
      undefined,
      undefined,
      expect.objectContaining({ fateEventId: 'evt-1' }),
    );
    expect(acknowledge).toHaveBeenCalledWith([
      expect.objectContaining({ eventId: 'evt-1', state: 'COMPLETED' }),
    ]);
  });

  it('marks a ready row Not eligible without rolling', async () => {
    const user = userEvent.setup();
    const { store, rollForKey, acknowledge } = setup();
    await user.click(await screen.findByRole('button', { name: 'Not eligible' }));

    expect(rollForKey).not.toHaveBeenCalled();
    expect(store.list()[0]).toMatchObject({
      state: 'DISMISSED',
      reason: 'Marked not eligible by player.',
    });
    expect(acknowledge).toHaveBeenCalledWith([
      expect.objectContaining({ eventId: 'evt-1', state: 'DISMISSED' }),
    ]);
  });

  it('never exposes Roll for wrong-account or stale-run rows', async () => {
    setup(event('QUEST', 'Dragon Slayer I', { account: 'Other' }));
    expect(await screen.findByText('Account does not match this run.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Roll$/ })).toBeNull();

    cleanup();
    setup(event('QUEST', 'Dragon Slayer I', { runRevision: 6 }));
    expect(await screen.findByText('The run changed after this event was detected.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Roll$/ })).toBeNull();
  });

  it('reviews an ambiguous candidate before exposing Roll', async () => {
    const counts = new Map<string, number>();
    for (const tab of Object.values(COLLECTION_LOG_DATA)) {
      for (const page of Object.values(tab.pages)) {
        for (const item of page.items) {
          const key = item.name.trim().toLowerCase();
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
    const ambiguous = [...counts.entries()].find(([, count]) => count > 1)?.[0];
    expect(ambiguous).toBeTruthy();

    const user = userEvent.setup();
    const { store } = setup(event('COLLECTION_LOG', ambiguous!));
    expect(await screen.findByRole('button', { name: 'Review' })).toBeTruthy();
    const options = screen.getAllByRole('option');
    await user.selectOptions(screen.getByRole('combobox'), options[1]);
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByRole('button', { name: /^Roll$/ })).toBeTruthy();
    expect(store.list()[0].reviewOutcome).toBe('CORRECTED');
  });

  it('dismisses unsupported and duplicate rows without presenting Roll', async () => {
    const user = userEvent.setup();
    const blocked = setup(event('QUEST', 'Dragon Slayer I', { detectorVersion: 99 }));
    expect(await screen.findByText('Detector version is not approved for exact handling.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Roll$/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(blocked.store.list()[0].state).toBe('DISMISSED');

    cleanup();
    const duplicateState = gameState({
      history: [{
        id: 'log-1',
        timestamp: Date.now(),
        type: 'ROLL_FAIL',
        message: 'No key',
        meta: { fateEventId: 'evt-1' },
      }],
    });
    const duplicate = setup(event(), duplicateState);
    await user.click(await screen.findByRole('button', { name: 'Dismiss duplicate events' }));
    expect(duplicate.store.list()[0].state).toBe('DUPLICATE');
  });

  it('preserves terminal rows when the store is recreated', async () => {
    const storage = new MemoryStorage();
    const { store } = setup(event(), gameState(), storage);
    store.transition('evt-1', 'COMPLETED');
    cleanup();

    const refreshed = createRollInboxStore(storage, 'run-1');
    expect(refreshed.list()[0].state).toBe('COMPLETED');
  });
});
