// @vitest-environment jsdom
// Sync & Roll in both layouts: "Ask before Key clicks" asks before rolling,
// only the latest answer for the linked name is shown, and a reading survives
// a tab switch. The hiscores (Wise Old Man) are always stubbed here.
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const game = vi.hoisted(() => ({
  runId: 'run-1',
  unlocks: { levels: { Attack: 1 }, skills: { Attack: 10 } } as { levels: Record<string, number>; skills: Record<string, number> },
  createBackup: vi.fn(async () => ({ stored: true })),
  levelUpSkill: vi.fn(),
  keys: 0,
  specialKeys: 0,
  chaosKeys: 0,
  linkedAccount: null as string | null,
  syncBaseline: undefined as { account: string; levels?: Record<string, number | null> } | undefined,
  setLinkedAccount: vi.fn(),
  renameLinkedAccount: vi.fn(),
  recordSyncBaseline: vi.fn(),
  recordSyncScores: vi.fn(),
  catchUpSyncLevel: vi.fn(() => true),
}));
const ui = vi.hoisted(() => ({ osrs: false }));
const ask = vi.hoisted(() => ({ pref: false, answer: false, questions: [] as string[] }));

vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('./RollInbox', () => ({ RollInbox: () => null }));
vi.mock('./RuneLiteOnboarding', () => ({ RuneLiteOnboarding: () => null }));
vi.mock('../utils/uiStyle', async () => ({
  ...(await vi.importActual<typeof import('../utils/uiStyle')>('../utils/uiStyle')),
  useIsOsrsUi: () => ui.osrs,
}));
vi.mock('../utils/spendConfirm', () => ({
  warmSpendConfirm: () => Promise.resolve(),
  askBeforeSpending: (q: string) => { ask.questions.push(q); return Promise.resolve(ask.answer); },
  confirmThen: (q: string, act: () => void) => {
    if (!ask.pref) { act(); return; }
    ask.questions.push(q);
    void Promise.resolve(ask.answer).then(yes => { if (yes) act(); });
  },
}));

import { AutoRollPanel, forgetSyncReadings } from './AutoRollPanel';

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} };

const reading = (displayName: string, attack: number) => ({
  ok: true,
  status: 200,
  json: async () => ({ displayName, type: 'ironman', latestSnapshot: { data: { skills: { overall: { level: 22 + attack }, attack: { rank: 10, level: attack, experience: 1 } } } } }),
});
const rateLimited = { ok: false, status: 429, json: async () => ({ code: 'PLAYER_IS_RATE_LIMITED' }) };
const flush = () => act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); });
const placeholder = () => (ui.osrs ? 'OSRS username...' : 'OSRS username…');
// The OSRS panel loads lazily: wait for its name box before acting.
const mount = async () => { const view = render(<AutoRollPanel />); await screen.findByPlaceholderText(placeholder()); return view; };

beforeEach(() => {
  forgetSyncReadings();
  ask.pref = false; ask.answer = false; ask.questions = [];
  game.linkedAccount = null;
  game.syncBaseline = undefined;
  game.unlocks = { levels: { Attack: 1 }, skills: { Attack: 10 } };
  game.createBackup.mockClear();
  game.setLinkedAccount.mockReset();
  game.renameLinkedAccount.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe.each([['classic', false], ['OSRS', true]])('Sync & Roll in the %s layout', (_layout, osrs) => {
  beforeEach(() => { ui.osrs = osrs; });

  it('asks before rolling with Ask before Key clicks on, and rolls nothing on No', async () => {
    game.linkedAccount = 'Alex';
    game.syncBaseline = { account: 'Alex', levels: { Attack: 1 } };
    vi.stubGlobal('fetch', vi.fn(async () => reading('Alex', 5)));
    ask.pref = true;
    await mount();
    await flush();
    const button = screen.getByRole('button', { name: /Auto-roll 1 skill \(\+4\)/ });

    ask.answer = false;
    fireEvent.click(button);
    await flush();
    expect(ask.questions).toEqual(['Roll for Keys on everything this sync found?']);
    expect(game.createBackup).not.toHaveBeenCalled();

    ask.answer = true;
    fireEvent.click(button);
    await flush();
    expect(ask.questions).toHaveLength(2);
    expect(game.createBackup).toHaveBeenCalledWith('Before Auto-Roll skill sync');
  });

  it('ignores Enter in the name box while a lookup is loading', async () => {
    const request = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', request);
    await mount();
    const box = screen.getByPlaceholderText(placeholder());
    fireEvent.change(box, { target: { value: 'Maxed Main' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await flush();
    fireEvent.change(box, { target: { value: 'Fresh Iron' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('drops a late answer for the name the run was linked to before a name change', async () => {
    game.linkedAccount = 'Alex';
    game.syncBaseline = { account: 'Alex', levels: { Attack: 1 } };
    game.renameLinkedAccount.mockImplementation((_from: string, to: string) => {
      game.linkedAccount = to;
      game.syncBaseline = { account: to, levels: { Attack: 1 } };
    });
    const answers = new Map<string, (value: unknown) => void>();
    vi.stubGlobal('fetch', vi.fn((url: string) => new Promise(resolve => { answers.set(decodeURIComponent(url.split('/').pop()!), resolve); })));
    await mount();
    await flush();
    expect([...answers.keys()]).toEqual(['Alex']);

    fireEvent.click(screen.getByRole('button', { name: /Change name/ }));
    const field = screen.getAllByRole('textbox').find(el => (el as HTMLInputElement).value === '')!;
    fireEvent.change(field, { target: { value: 'Bob' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await flush();
    expect(answers.has('Bob')).toBe(true);

    // The new name answers first, the old one a moment later.
    await act(async () => { answers.get('Bob')!(reading('Bob', 5)); });
    await flush();
    await act(async () => { answers.get('Alex')!(reading('Alex', 90)); });
    await flush();

    expect(screen.queryByText('Alex')).toBeNull();
    expect(screen.getByRole('button', { name: /Auto-roll 1 skill \(\+4\)/ })).toBeTruthy();
  });

  it('is not left loading when the run is unlinked while its lookup is in flight', async () => {
    game.linkedAccount = 'Alex';
    game.syncBaseline = { account: 'Alex', levels: { Attack: 1 } };
    let answer: (value: unknown) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { answer = resolve; })));
    const view = await mount();
    await flush();
    expect(screen.getByRole('button', { name: /Refresh|Loading/ }).hasAttribute('disabled')).toBe(true);

    // A run reset (or a save replaced elsewhere) unlinks the name under the lookup.
    game.linkedAccount = null;
    game.syncBaseline = undefined;
    view.rerender(<AutoRollPanel />);
    await act(async () => { answer(reading('Alex', 90)); });
    await flush();

    expect(screen.getByRole('button', { name: /Fetch/ }).hasAttribute('disabled')).toBe(false);
    expect(game.setLinkedAccount).not.toHaveBeenCalled();
  });

  it('keeps the reading across a tab switch and asks Wise Old Man only once within a minute', async () => {
    game.linkedAccount = 'Alex';
    game.syncBaseline = { account: 'Alex', levels: { Attack: 5 } };
    game.unlocks = { levels: { Attack: 5 }, skills: { Attack: 10 } };
    let updates = 0;
    const request = vi.fn(async () => (++updates > 1 ? rateLimited : reading('Alex', 12)));
    vi.stubGlobal('fetch', request);

    const first = await mount();
    await flush();
    expect(screen.getByRole('button', { name: /Auto-roll 1 skill \(\+7\)/ })).toBeTruthy();
    first.unmount();

    await mount();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Auto-roll 1 skill \(\+7\)/ })).toBeTruthy();

    // A Refresh inside Wise Old Man's minute keeps the reading beside the note.
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Rate-limited by the API/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Auto-roll 1 skill \(\+7\)/ })).toBeTruthy();
  });
});
