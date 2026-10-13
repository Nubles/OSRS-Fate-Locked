// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { relaySync } from '../services/relaySync';
import { RelayPublishBanner, relayFailureReason } from './RelayPublishBanner';
import { NOT_SAVING_PUBLISH_MESSAGE } from './OnlineSyncDriver';

const CODE = 'a'.repeat(32);
const text = () => (screen.queryByTestId('relay-publish-banner')?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('RelayPublishBanner', () => {
  const storage: Record<string, string> = {};
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    for (const key of Object.keys(storage)) delete storage[key];
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
    });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    relaySync.disable();
    relaySync.adoptCode(CODE);
  });

  afterEach(() => {
    cleanup();
    relaySync.disable();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const publishAnswered = async (response: { ok: boolean; status: number }) => {
    fetchMock.mockResolvedValueOnce(response);
    await act(async () => { await relaySync.push('FLGZ:H4sI'); });
  };

  it('waits for a second failure in a row, then says what failed, what RuneLite has, and when it tries again', async () => {
    render(<RelayPublishBanner />);
    await publishAnswered({ ok: true, status: 200 });
    await publishAnswered({ ok: false, status: 503 });
    expect(text()).toBe('');

    await publishAnswered({ ok: false, status: 503 });
    act(() => relaySync.setRetryAt(Date.now() + 60_000));
    expect(text()).toMatch(/^RuneLite isn't getting your latest rules\. The relay is having trouble right now\. RuneLite is still using the rules it last received \(sent at .+\), so recent unlocks won't show there yet\. The tracker will try again by itself at .+\.Retry now$/);

    const revision = relaySync.pushRequestRevision;
    fireEvent.click(screen.getByRole('button', { name: /Retry now/ }));
    expect(relaySync.pushRequestRevision).toBe(revision + 1);
    // Still failing while the retry is on its way: the banner stays and says so.
    expect(text()).toContain('Sending again now…');

    await publishAnswered({ ok: true, status: 200 });
    expect(text()).toBe('');
  });

  it('shows at once, with what to do, when retrying cannot help', async () => {
    render(<RelayPublishBanner />);
    await publishAnswered({ ok: false, status: 403 });
    expect(text()).toContain('Press Connect tracker in RuneLite to pair this browser again.');
    expect(text()).not.toContain('try again by itself');
    expect(text()).toContain('RuneLite is still using the rules it last received, so');
  });

  it("leaves a tab that isn't saving the profile to the save banners", async () => {
    render(<RelayPublishBanner />);
    act(() => {
      relaySync.reportPushFailure(new Error(NOT_SAVING_PUBLISH_MESSAGE), false);
      relaySync.reportPushFailure(new Error(NOT_SAVING_PUBLISH_MESSAGE), false);
    });
    expect(text()).toBe('');
  });

  it('stays hidden once dismissed until sending works again', async () => {
    render(<RelayPublishBanner />);
    await publishAnswered({ ok: false, status: 502 });
    await publishAnswered({ ok: false, status: 502 });
    fireEvent.click(screen.getByRole('button', { name: 'Hide until sending works again' }));
    expect(text()).toBe('');
    await publishAnswered({ ok: false, status: 502 });
    expect(text()).toBe('');

    await publishAnswered({ ok: true, status: 200 });
    await publishAnswered({ ok: false, status: 502 });
    await publishAnswered({ ok: false, status: 502 });
    expect(text()).toContain('The relay is having trouble right now.');
  });

  it('shows nothing without a pairing', async () => {
    relaySync.disable();
    render(<RelayPublishBanner />);
    act(() => relaySync.reportPushFailure(new Error('x')));
    expect(text()).toBe('');
  });
});

describe('relayFailureReason', () => {
  it.each([
    ['relay 503', 'The relay is having trouble right now.'],
    ['relay 429', 'The relay is busy right now.'],
    ['relay 413', 'Your rules were too large for the relay to accept.'],
    ['relay timed out', "The relay didn't answer in time."],
    ['Failed to fetch', "The tracker couldn't reach the relay. Check your internet connection."],
    ['NetworkError when attempting to fetch resource.', "The tracker couldn't reach the relay. Check your internet connection."],
    ["Couldn't load chunk data, so the profile wasn't sent. Check your connection and retry.",
      "The tracker couldn't load its map data, so it didn't send your rules."],
    ['something odd', 'Sending failed (something odd).'],
    [null, 'Sending failed.'],
  ])('explains %s', (error, reason) => {
    expect(relayFailureReason(error)).toBe(reason);
  });
});
