// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import type { FateEventEnvelope, FateEventType } from '../services/fateEventProtocol';
import { createRollInboxStore } from '../services/rollInboxStore';
import type { GameState } from '../types';
import { RollInboxView, type RollInboxGame } from './RollInbox';
import { classifyRollInboxDriverRow } from './RollInboxDriver';

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
  const acceptDetectedEvent = vi.fn().mockReturnValue(true);
  const acknowledge = vi.fn().mockResolvedValue(true);
  const game: RollInboxGame = {
    state,
    acceptDetectedEvent,
  };
  render(<RollInboxView store={store} game={game} acknowledge={acknowledge} />);
  return { store, acceptDetectedEvent, acknowledge };
}

afterEach(cleanup);

describe('RollInbox', () => {
  it('never rolls on ingest or render', async () => {
    const { acceptDetectedEvent } = setup();
    expect(await screen.findByText('Dragon Slayer I')).toBeTruthy();
    expect(acceptDetectedEvent).not.toHaveBeenCalled();
  });

  it('rolls exactly once after the player presses Roll', async () => {
    const user = userEvent.setup();
    const { acceptDetectedEvent, acknowledge } = setup();
    const button = await screen.findByRole('button', { name: /^Roll$/ });
    await user.dblClick(button);

    expect(acceptDetectedEvent).toHaveBeenCalledTimes(1);
    expect(acceptDetectedEvent).toHaveBeenCalledWith(
      { kind: 'QUEST', questId: 'Dragon Slayer I' },
      expect.objectContaining({ source: 'Quest (Experienced)', threshold: 75 }),
      expect.objectContaining({ fateEventId: 'evt-1' }),
      expect.objectContaining({ runId: 'run-1', account: 'Nubles', runRevision: 7 }),
    );
    expect(acknowledge).toHaveBeenCalledWith([
      expect.objectContaining({ eventId: 'evt-1', state: 'COMPLETED' }),
    ]);
  });

  it('marks a ready row Not eligible without rolling', async () => {
    const user = userEvent.setup();
    const { store, acceptDetectedEvent, acknowledge } = setup();
    await user.click(await screen.findByRole('button', { name: 'Not eligible' }));

    expect(acceptDetectedEvent).not.toHaveBeenCalled();
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

  it('returns a persisted READY row to review after an unrelated revision change', async () => {
    const storage = new MemoryStorage();
    const store = createRollInboxStore(storage, 'run-1');
    store.ingest([event()]);
    store.transition('evt-1', 'READY');
    const acceptDetectedEvent = vi.fn().mockReturnValue(true);
    const acknowledge = vi.fn().mockResolvedValue(true);
    const first = gameState({ runRevision: 7 });
    expect(classifyRollInboxDriverRow(store.list()[0], { ...first, runRevision: 8 })).toMatchObject({
      state: 'NEEDS_CONFIRMATION',
      reason: 'The run changed after this event was detected.',
    });
    const view = render(
      <RollInboxView store={store} game={{ state: first, acceptDetectedEvent }} acknowledge={acknowledge} />,
    );
    expect(await screen.findByRole('button', { name: /^Roll$/ })).toBeTruthy();

    view.rerender(
      <RollInboxView
        store={store}
        game={{ state: { ...first, runRevision: 8 }, acceptDetectedEvent }}
        acknowledge={acknowledge}
      />,
    );

    expect(await screen.findByText('The run changed after this event was detected.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Roll$/ })).toBeNull();
    expect(store.list()[0].event.runRevision).toBe(7);
    expect(acceptDetectedEvent).not.toHaveBeenCalled();
  });

  it('does not roll, reconcile, complete, or acknowledge when live identity changes before click', async () => {
    const store = createRollInboxStore(new MemoryStorage(), 'run-1');
    store.ingest([event()]);
    let live = gameState();
    const applied = vi.fn();
    const acceptDetectedEvent = vi.fn((
      _progress: unknown,
      _intent: unknown,
      _meta: unknown,
      expected: { runId: string; account: string; runRevision: number } | undefined,
    ) => {
      if (
        !expected
        || expected.runId !== live.runId
        || expected.account !== live.linkedAccount
        || expected.runRevision !== live.runRevision
      ) return false;
      applied();
      return true;
    });
    const acknowledge = vi.fn().mockResolvedValue(true);
    render(
      <RollInboxView
        store={store}
        game={{ state: live, acceptDetectedEvent }}
        acknowledge={acknowledge}
      />,
    );
    expect(await screen.findByRole('button', { name: /^Roll$/ })).toBeTruthy();

    live = { ...live, runRevision: live.runRevision + 1 };
    await userEvent.setup().click(screen.getByRole('button', { name: /^Roll$/ }));

    expect(acceptDetectedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ fateEventId: 'evt-1' }),
      expect.objectContaining({ runId: 'run-1', account: 'Nubles', runRevision: 7 }),
    );
    expect(applied).not.toHaveBeenCalled();
    expect(store.list()[0].state).toBe('RECEIVED');
    expect(acknowledge).not.toHaveBeenCalled();
  });
  it('explicitly revalidates a stale event and rolls against the reviewed revision', async () => {
    const user = userEvent.setup();
    const { store, acceptDetectedEvent } = setup(event(), gameState({ runRevision: 8 }));
    expect(screen.queryByRole('button', { name: /^Roll$/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Review$/ }));
    expect(store.list()[0].event.runRevision).toBe(7);
    expect(classifyRollInboxDriverRow(store.list()[0], gameState({ runRevision: 8 })).state).toBe('READY');
    await user.click(screen.getByRole('button', { name: /^Roll$/ }));
    expect(acceptDetectedEvent).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({runRevision:8}));
  });
  it('requires another review after changes and does not reaward recorded progress', async () => {
    const user = userEvent.setup();
    const { store } = setup(event(), gameState({ runRevision: 8 }));
    await user.click(screen.getByRole('button', { name: /^Review$/ }));
    expect(classifyRollInboxDriverRow(store.list()[0], gameState({ runRevision:9 })).state).toBe('NEEDS_CONFIRMATION');
    expect(classifyRollInboxDriverRow(store.list()[0], gameState({ runRevision:8, unlocks:{...initialState.unlocks,quests:['Dragon Slayer I']} })).state).toBe('DUPLICATE');
    expect(classifyRollInboxDriverRow(store.list()[0], gameState({ runRevision:8,linkedAccount:'Other' })).state).toBe('BLOCKED');
  });

  it('preserves revised context while a stale event still needs a candidate choice', async () => {
    const user = userEvent.setup();
    const { store, acceptDetectedEvent } = setup(event('SLAYER_TASK','Slayer task',{detectorId:'slayer-task-v1'}), gameState({runRevision:8}));
    await user.click(screen.getByRole('button',{name:/^Review$/}));
    const row = store.list()[0];
    const reviewed = classifyRollInboxDriverRow(row,gameState({runRevision:8}));
    expect(reviewed.state).toBe('NEEDS_CONFIRMATION');
    act(() => { store.transition(row.event.eventId,'NEEDS_CONFIRMATION',row.reason); });
    await user.click(screen.getByRole('button',{name:/^Review$/}));
    expect(store.list()[0].reason).toContain('Slayer');
    expect(classifyRollInboxDriverRow(store.list()[0],gameState({runRevision:8})).state).toBe('READY');
    await user.click(screen.getByRole('button',{name:/^Roll$/}));
    expect(acceptDetectedEvent).toHaveBeenCalledOnce();
    expect(store.list()[0].event.runRevision).toBe(7);
  });

});
