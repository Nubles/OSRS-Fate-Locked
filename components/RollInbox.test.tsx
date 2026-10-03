// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import { PETS } from '../data/pets';
import type { FateEventEnvelope, FateEventType } from '../services/fateEventProtocol';
import { RUNELITE_COPY_FORMAT } from '../utils/runelitePaste';
import { relaySync } from '../services/relaySync';
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
  canonicalLabel: string | null = "Cook's Assistant",
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
    QUEST: 'quest-state-v1',
    COMBAT_ACHIEVEMENT: 'combat-achievement-chat-v1',
    COLLECTION_LOG: 'collection-log-chat-v1',
    CLUE_CASKET: 'clue-completion-v1',
    BOSS_KILL: 'boss-kill-count-v1',
    RAID_COMPLETION: 'boss-kill-count-v1',
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
  it('makes the player pick a pet, then claims its Omni-Key instead of rolling', async () => {
    const user = userEvent.setup();
    const vorki = PETS.find((pet) => pet.name === 'Vorki')!;
    const { acceptDetectedEvent } = setup(
      event('PET_DROP', null, { detectorId: 'pet-drop-v1', confidence: 'UNCERTAIN', evidence: { signature: 'followed' } }),
      gameState({ petsClaimed: [PETS[0].id] }),
    );
    const review = await screen.findByRole('button', { name: 'Review' });
    // RuneLite can't tell which pet it was, so nothing is chosen for the player.
    expect(review).toHaveProperty('disabled', true);
    const select = screen.getByLabelText('The pet you got') as HTMLSelectElement;
    expect([...select.options].map((option) => option.text)).not.toContain(PETS[0].name);
    await user.selectOptions(select, String(vorki.id));
    await user.click(review);

    expect(await screen.findByText('An Omni-Key, once per pet')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Claim' }));
    expect(acceptDetectedEvent).toHaveBeenCalledWith(
      { kind: 'PET', petId: vorki.id },
      expect.objectContaining({ source: 'Pet Drop', target: 'Vorki' }),
      expect.objectContaining({ fateEventId: 'evt-1', detectorId: 'pet-drop-v1' }),
      expect.objectContaining({ runId: 'run-1' }),
    );
  });

  it('never rolls on ingest or render', async () => {
    const { acceptDetectedEvent } = setup();
    expect(await screen.findByText("Cook's Assistant")).toBeTruthy();
    expect(acceptDetectedEvent).not.toHaveBeenCalled();
  });

  it('rolls exactly once after the player presses Roll', async () => {
    const user = userEvent.setup();
    const { acceptDetectedEvent, acknowledge } = setup();
    const button = await screen.findByRole('button', { name: /^Roll$/ });
    await user.dblClick(button);

    expect(acceptDetectedEvent).toHaveBeenCalledTimes(1);
    expect(acceptDetectedEvent).toHaveBeenCalledWith(
      { kind: 'QUEST', questId: "Cook's Assistant" },
      expect.objectContaining({ source: 'Quest (Novice)', threshold: 25 }),
      expect.objectContaining({ fateEventId: 'evt-1' }),
      expect.objectContaining({ runId: 'run-1', account: 'Nubles', runRevision: 7 }),
    );
    expect(acknowledge).toHaveBeenCalledWith([
      expect.objectContaining({ eventId: 'evt-1', state: 'COMPLETED' }),
    ]);
  });

  it('keeps decisions local instead of acknowledging on the legacy relay route', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    relaySync.enable(); // a paired relay session exists
    try {
      const user = userEvent.setup();
      const store = createRollInboxStore(new MemoryStorage(), 'run-1');
      store.ingest([event(), event('QUEST', "Cook's Assistant", { eventId: 'evt-2' })]);
      render(
        <RollInboxView
          store={store}
          game={{ state: gameState(), acceptDetectedEvent: vi.fn().mockReturnValue(true) }}
        />,
      );
      await user.click((await screen.findAllByRole('button', { name: /^Roll$/ }))[0]);
      await user.click(screen.getByRole('button', { name: 'Not eligible' }));

      expect(store.list().map((row) => row.state).sort()).toEqual(['COMPLETED', 'DISMISSED']);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      relaySync.disable();
      vi.unstubAllGlobals();
    }
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

  it("never exposes Roll for another character's row or a newer run's", async () => {
    setup(event('QUEST', 'Dragon Slayer I', { account: 'Other' }));
    expect(await screen.findByText('This event is from another character.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Roll$/ })).toBeNull();

    cleanup();
    setup(event('QUEST', 'Dragon Slayer I', { runRevision: 8 }));
    expect(await screen.findByText('The event was detected against a newer run state.')).toBeTruthy();
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

  it('keeps the review select mounted and focused across re-renders', async () => {
    const names = Object.values(COLLECTION_LOG_DATA)
      .flatMap(tab => Object.values(tab.pages))
      .flatMap(page => page.items.map(item => item.name.trim().toLowerCase()));
    const ambiguous = names.find((name, index) => names.indexOf(name) !== index);
    expect(ambiguous).toBeTruthy();
    const store = createRollInboxStore(new MemoryStorage(), 'run-1');
    store.ingest([event('COLLECTION_LOG', ambiguous!)]);
    const state = gameState();
    const acceptDetectedEvent = vi.fn().mockReturnValue(true);
    const acknowledge = vi.fn().mockResolvedValue(true);
    const view = render(
      <RollInboxView store={store} game={{ state, acceptDetectedEvent }} acknowledge={acknowledge} />,
    );

    const select = await screen.findByRole('combobox') as HTMLSelectElement;
    const choice = (screen.getAllByRole('option')[1] as HTMLOptionElement).value;
    select.focus();
    await userEvent.setup().selectOptions(select, choice);

    expect(screen.getByRole('combobox')).toBe(select);
    expect(document.activeElement).toBe(select);

    // A relay event re-renders the inbox with a new game object.
    view.rerender(
      <RollInboxView store={store} game={{ state: { ...state }, acceptDetectedEvent }} acknowledge={acknowledge} />,
    );

    expect(screen.getByRole('combobox')).toBe(select);
    expect(document.activeElement).toBe(select);
    expect(select.value).toBe(choice);
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

  it("keeps every row of a paste ready after a roll raises the run's revision", async () => {
    const store = createRollInboxStore(new MemoryStorage(), 'run-1');
    store.ingest([event(), event('QUEST', "Cook's Assistant", { eventId: 'evt-2' })]);
    const acceptDetectedEvent = vi.fn().mockReturnValue(true);
    const first = gameState({ runRevision: 7 });
    const view = render(<RollInboxView store={store} game={{ state: first, acceptDetectedEvent }} />);
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole('button', { name: /^Roll$/ }))[0]);

    // The roll raised the revision; the other row was detected before it.
    const rolled = { ...first, runRevision: 8 };
    view.rerender(<RollInboxView store={store} game={{ state: rolled, acceptDetectedEvent }} />);
    const other = store.list().find((row) => row.event.eventId === 'evt-2')!;
    expect(classifyRollInboxDriverRow(other, rolled).state).toBe('READY');
    const remaining = await screen.findAllByRole('button', { name: /^Roll$/ });
    expect(remaining).toHaveLength(1);
    await user.click(remaining[0]);

    expect(acceptDetectedEvent).toHaveBeenCalledTimes(2);
    expect(acceptDetectedEvent).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ fateEventId: 'evt-2' }),
      expect.objectContaining({ runId: 'run-1', account: 'Nubles', runRevision: 7 }),
    );
  });

  it('does not complete or acknowledge a row the run refuses at the click', async () => {
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
});

describe('Paste from RuneLite', () => {
  const copyOf = (...events: FateEventEnvelope[]) => JSON.stringify({ format: RUNELITE_COPY_FORMAT, events });

  function view(state = gameState()) {
    const store = createRollInboxStore(new MemoryStorage(), state.runId);
    const game: RollInboxGame = { state, acceptDetectedEvent: vi.fn().mockReturnValue(true) };
    render(<RollInboxView store={store} game={game} acknowledge={vi.fn().mockResolvedValue(true)} />);
    return store;
  }

  afterEach(() => vi.restoreAllMocks());

  it('asks for RuneLite’s copy while the inbox is empty', () => {
    view();

    expect(screen.getByText('In RuneLite, open the Roll inbox card and choose Copy for tracker, then paste here.'))
      .toBeTruthy();
  });

  it('adds what RuneLite copied, says what it added, and rolls nothing', async () => {
    const user = userEvent.setup();
    const store = view();
    store.ingest([event('QUEST', "Cook's Assistant", { eventId: 'evt-1' })]);
    await navigator.clipboard.writeText(copyOf(
      event('QUEST', "Cook's Assistant", { eventId: 'evt-1' }),
      event('QUEST', 'Rune Mysteries', { eventId: 'evt-2' }),
    ));

    await user.click(screen.getByRole('button', { name: 'Paste from RuneLite' }));

    expect((await screen.findByRole('status')).textContent).toBe('Added 1. 1 was already here.');
    expect(screen.getByText('Rune Mysteries')).toBeTruthy();
    expect(store.list().map((row) => row.state)).toEqual(['RECEIVED', 'RECEIVED']);
    expect(screen.getByText('Skip any you’ve already logged by hand.')).toBeTruthy();
    // A linked run's rows are all its character's own.
    expect(screen.queryByText('Nubles')).toBeNull();
  });

  it('offers a box to paste into when the browser won’t read the clipboard', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'readText').mockRejectedValue(new Error('Not allowed'));
    view();

    await user.click(screen.getByRole('button', { name: 'Paste from RuneLite' }));
    const box = await screen.findByLabelText('Paste RuneLite’s copy here');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty('disabled', true);
    fireEvent.change(box, { target: { value: copyOf(event()) } });
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByRole('status').textContent).toBe('Added 1.');
    expect(screen.getByText("Cook's Assistant")).toBeTruthy();
    expect(screen.queryByLabelText('Paste RuneLite’s copy here')).toBeNull();
  });

  it('says so when the text is no copy from RuneLite, and the box stays for another try', async () => {
    const user = userEvent.setup();
    view();
    await navigator.clipboard.writeText('Dragon Slayer');

    await user.click(screen.getByRole('button', { name: 'Paste from RuneLite' }));

    expect((await screen.findByRole('status')).textContent)
      .toBe('That isn’t a copy from RuneLite. In its Roll inbox card, choose Copy for tracker first.');
    const box = screen.getByLabelText('Paste RuneLite’s copy here');
    fireEvent.change(box, { target: { value: 'still not it' } });
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('Paste RuneLite’s copy here')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Paste RuneLite’s copy here')).toBeNull();
  });

  it('names whose events a run linked to no one took, on the line and each row', async () => {
    const user = userEvent.setup();
    view(gameState({ linkedAccount: undefined }));
    await navigator.clipboard.writeText(copyOf(
      event('QUEST', "Cook's Assistant", { eventId: 'evt-1', account: 'Zezima' }),
      event('QUEST', 'Rune Mysteries', { eventId: 'evt-2', account: 'Zezima' }),
    ));

    await user.click(screen.getByRole('button', { name: 'Paste from RuneLite' }));

    expect((await screen.findByRole('status')).textContent).toBe('Added 2 from Zezima.');
    expect(screen.getAllByText('Zezima')).toHaveLength(2);
  });
});
