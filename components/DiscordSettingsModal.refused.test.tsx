// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressShareRecord } from '../utils/progressShareRecord';

const publishProgress = vi.hoisted(() => vi.fn());
const requestLinkCode = vi.hoisted(() => vi.fn());

vi.mock('../context/ProfileContext', () => ({ useProfiles: () => ({ storageKeyForActiveProfile: 'P' }) }));
vi.mock('../context/GameContext', () => ({
  useGame: () => ({ unlocks: {}, history: [], gameModeId: 'vanilla', customMode: undefined, linkedAccount: undefined }),
}));
vi.mock('../hooks/useEscapeKey', () => ({ useEscapeKey: () => undefined }));
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => undefined }));
vi.mock('../services/relaySync', () => ({ relaySync: { base: () => 'https://relay.test' } }));
vi.mock('../utils/progressSnapshot', () => ({ buildProgressSnapshot: () => ({ v: 1 }) }));
vi.mock('../utils/progressShare', async importOriginal => ({
  ...await importOriginal<typeof import('../utils/progressShare')>(),
  publishProgress,
  requestLinkCode,
}));

import { DiscordSettingsModal } from './DiscordSettingsModal';
import { readProgressShare, writeProgressShare } from '../utils/progressShare';

const record = (fill: string): ProgressShareRecord => ({ id: fill.repeat(22), token: 'T'.repeat(43), enabled: true });
const publishedIds = () => publishProgress.mock.calls.map(([, sent]) => (sent as ProgressShareRecord).id);

describe('Discord settings when the relay refuses this browser\'s own run id', () => {
  let toasts: string[];
  const onToast = (event: Event) => toasts.push((event as CustomEvent<{ message: string }>).detail.message);

  beforeEach(() => {
    localStorage.clear();
    toasts = [];
    window.addEventListener('fate:toast', onToast);
    publishProgress.mockReset();
    requestLinkCode.mockReset();
    requestLinkCode.mockResolvedValue({ ok: true, code: 'ABCDEFGH', expiresAt: Date.now() + 600_000 });
  });

  afterEach(() => {
    window.removeEventListener('fate:toast', onToast);
    cleanup();
  });

  const getCode = async () => {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /link code/i })); });
  };

  it('moves the run to a new id, says the links changed, and gets a code for the new id', async () => {
    writeProgressShare('P', { ...record('A'), publicLog: true });
    publishProgress.mockImplementation(async (_base: string, sent: ProgressShareRecord) =>
      (sent.id === record('A').id ? { ok: false, error: 'forbidden' } : { ok: true }));
    render(<DiscordSettingsModal onClose={() => undefined} />);
    await getCode();

    const moved = readProgressShare('P')!;
    expect(moved.id).not.toBe(record('A').id);
    expect(moved.token).not.toBe(record('A').token);
    expect(moved).toMatchObject({ enabled: true, publicLog: true });
    expect(publishedIds()).toEqual([record('A').id, moved.id]);
    expect(requestLinkCode.mock.calls[0][1]).toMatchObject({ id: moved.id });
    expect(screen.getByText('/link ABCD-EFGH')).toBeTruthy();
    expect(toasts).toEqual(['Your Adventurer\'s Log link changed and Discord needs linking again.']);
    expect((screen.getByLabelText('Adventurer\'s Log link') as HTMLInputElement).value).toContain(`#/log/${moved.id}`);
    expect(document.body.textContent).not.toContain('Turn sharing off and on');
  });

  it('makes one new id at most, however often the relay refuses', async () => {
    writeProgressShare('P', record('B'));
    publishProgress.mockResolvedValue({ ok: false, error: 'forbidden' });
    render(<DiscordSettingsModal onClose={() => undefined} />);
    await getCode();
    await getCode();
    await getCode();

    const ids = publishedIds();
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe(record('B').id);
    expect(readProgressShare('P')!.id).toBe(ids[1]);
    expect(requestLinkCode).not.toHaveBeenCalled();
    expect(screen.getByText('The relay refused this run\'s progress. Try again later.')).toBeTruthy();
    expect(toasts).toHaveLength(1);
  });
});
