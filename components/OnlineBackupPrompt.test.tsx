// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readOnlineBackupRecord, writeOnlineBackupRecord } from '../utils/onlineBackupRecord';
import { markExported } from '../utils/backupNag';
import { AT_RISK_BACKUP_PROMPT_MIN_HISTORY } from '../utils/persistentStorage';
import { OnlineBackupPrompt, ONLINE_BACKUP_PROMPT_MIN_HISTORY } from './OnlineBackupPrompt';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const game = vi.hoisted(() => ({ history: [] as unknown[] }));

vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../context/ProfileContext', () => ({ useProfiles: () => ({ storageKeyForActiveProfile: 'P' }) }));

const withHistory = (length: number) => {
  game.history = Array.from({ length }, (_, index) => ({ id: `event-${index}` }));
};

describe('OnlineBackupPrompt', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
    });
    withHistory(ONLINE_BACKUP_PROMPT_MIN_HISTORY);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks once a run has some progress, and Set up opens the Online backup tab', async () => {
    const opened = vi.fn();
    const onNav = (event: Event) => opened((event as CustomEvent<{ target: string }>).detail.target);
    window.addEventListener('fate:nav', onNav);
    render(<OnlineBackupPrompt />);

    expect(screen.getByRole('region', { name: 'Online backup' }).textContent).toMatch(/encrypted with a code only you keep/);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Set up' }));
    expect(opened).toHaveBeenCalledWith('open:online-backup');
    window.removeEventListener('fate:nav', onNav);
  });

  it('goes away for good on Not now', async () => {
    const { unmount } = render(<OnlineBackupPrompt />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.queryByRole('region', { name: 'Online backup' })).toBeNull();
    expect(readOnlineBackupRecord('P').promptAnsweredAt).toEqual(expect.any(Number));
    unmount();
    render(<OnlineBackupPrompt />);
    expect(screen.queryByRole('region', { name: 'Online backup' })).toBeNull();
  });

  it('waits for some progress first', () => {
    withHistory(ONLINE_BACKUP_PROMPT_MIN_HISTORY - 1);
    render(<OnlineBackupPrompt />);
    expect(screen.queryByRole('region', { name: 'Online backup' })).toBeNull();
  });

  it('goes away once backup is turned on, and never asks a run that has it on', () => {
    const { unmount } = render(<OnlineBackupPrompt />);
    expect(screen.getByRole('region', { name: 'Online backup' })).toBeTruthy();

    act(() => { writeOnlineBackupRecord('P', { code: '0123456789ABCDEFGHJK' }); });
    expect(screen.queryByRole('region', { name: 'Online backup' })).toBeNull();
    unmount();
    render(<OnlineBackupPrompt />);
    expect(screen.queryByRole('region', { name: 'Online backup' })).toBeNull();
  });
  it('says when uploads are paused, and Choose opens the Online backup tab', async () => {
    writeOnlineBackupRecord('P', { code: '0123456789ABCDEFGHJK', lastRunId: 'run-1', held: 'other-run' });
    const opened = vi.fn();
    const onNav = (event: Event) => opened((event as CustomEvent<{ target: string }>).detail.target);
    window.addEventListener('fate:nav', onNav);
    render(<OnlineBackupPrompt />);

    expect(screen.getByRole('region', { name: 'Online backup paused' }).textContent)
      .toMatch(/would replace your online backup of a different run/);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Choose' }));
    expect(opened).toHaveBeenCalledWith('open:online-backup');
    window.removeEventListener('fate:nav', onNav);

    act(() => { writeOnlineBackupRecord('P', { code: '0123456789ABCDEFGHJK', lastRunId: 'run-2' }); });
    expect(screen.queryByRole('region', { name: 'Online backup paused' })).toBeNull();
  });

  describe('on Safari and iPhone, where a week away can wipe the run', () => {
    beforeEach(() => {
      vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(IPHONE_SAFARI);
      withHistory(AT_RISK_BACKUP_PROMPT_MIN_HISTORY);
    });

    it('asks early, once, and says why', () => {
      render(<OnlineBackupPrompt />);
      expect(screen.getByRole('region', { name: 'Online backup' }).textContent).toMatch(/after 7 days without a visit/);
    });

    it('waits for the usual progress once the run has a copy outside the browser', () => {
      markExported('P');
      render(<OnlineBackupPrompt />);
      expect(screen.queryByRole('region', { name: 'Online backup' })).toBeNull();
    });

    it('is not asked early in other browsers', () => {
      vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
      render(<OnlineBackupPrompt />);
      expect(screen.queryByRole('region', { name: 'Online backup' })).toBeNull();
    });
  });
});
