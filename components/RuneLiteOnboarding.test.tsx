// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNELITE_PAIRING_SUCCESS_COPY } from '../utils/runelitePairing';
import { RuneLiteOnboarding } from './RuneLiteOnboarding';

const relay = vi.hoisted(() => ({
  enabled: false,
  code: null as string | null,
  status: 'off' as 'off' | 'syncing' | 'synced' | 'error',
  lastError: null as string | null,
  lastSyncAt: null as number | null,
  subscribe: vi.fn(() => () => {}),
  requestPush: vi.fn(),
  disable: vi.fn(),
}));

vi.mock('../services/relaySync', () => ({ relaySync: relay }));

describe('RuneLiteOnboarding', () => {
  const storage: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(storage)) delete storage[key];
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
    });
    relay.enabled = false;
    relay.code = null;
    relay.status = 'off';
    relay.lastError = null;
    relay.lastSyncAt = null;
    relay.subscribe.mockClear();
    relay.requestPush.mockReset();
    relay.disable.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('starts pairing from RuneLite without legacy toggle instructions', () => {
    render(<RuneLiteOnboarding />);

    expect(screen.getByText(
      /In RuneLite, open the Fate Locked panel and click/i,
    )).toBeTruthy();
    expect(screen.getByText('Connect tracker')).toBeTruthy();
    expect(screen.queryByText(/Enable online sync/i)).toBeNull();
    expect(screen.queryByText(/Online sync code/i)).toBeNull();
    expect(screen.queryByText(/eight-character/i)).toBeNull();
  });

  it('shows directional sending and sent states without a heartbeat claim', () => {
    relay.enabled = true;
    relay.code = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    relay.status = 'syncing';
    const sending = render(<RuneLiteOnboarding />);
    expect(screen.getByText('Sending profile to RuneLite…')).toBeTruthy();
    sending.unmount();

    relay.status = 'synced';
    render(<RuneLiteOnboarding />);
    expect(screen.getByText(RUNELITE_PAIRING_SUCCESS_COPY)).toBeTruthy();
    expect(screen.queryByText(/^Connected$/i)).toBeNull();
    expect(screen.queryByText(/Plugin connected/i)).toBeNull();
  });

  it('retries a failed profile upload through a fresh driver request', async () => {
    const user = userEvent.setup();
    relay.enabled = true;
    relay.code = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    relay.status = 'error';
    relay.lastError = 'relay offline';
    relay.requestPush.mockReturnValue(true);
    render(<RuneLiteOnboarding />);

    expect(screen.getByText('relay offline')).toBeTruthy();
    await user.click(screen.getByRole('button', {
      name: 'Retry profile upload',
    }));
    expect(relay.requestPush).toHaveBeenCalledTimes(1);
  });

  it('keeps active-session controls and local-only recovery guidance', () => {
    relay.enabled = true;
    relay.code = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    relay.status = 'synced';
    render(<RuneLiteOnboarding />);

    expect(screen.getByRole('button', {
      name: 'Copy stream overlay URL',
    })).toBeTruthy();
    expect(screen.getByRole('button', {
      name: 'Disconnect',
    })).toBeTruthy();
    expect(screen.getByText(/clipboard or file import/i)).toBeTruthy();
    expect(screen.getByText(/local history is not transferred/i))
      .toBeTruthy();
  });

  it('collapses a delivered profile as Profile sent, never Connected', () => {
    storage.fate_rl_onboard_hidden_v1 = '1';
    relay.enabled = true;
    relay.status = 'synced';
    render(<RuneLiteOnboarding />);

    expect(screen.getByText('Profile sent')).toBeTruthy();
    expect(screen.queryByText(/^Connected$/i)).toBeNull();
  });
});
