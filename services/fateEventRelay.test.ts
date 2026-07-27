import { afterEach, describe, expect, it, vi } from 'vitest';
import { relaySync } from './relaySync';
import { fateEventRelay } from './fateEventRelay';

afterEach(() => {
  relaySync.disable();
  vi.unstubAllGlobals();
});

describe('Fate event relay client', () => {
  it('posts terminal acknowledgements with the app-owned token', async () => {
    relaySync.enable();
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ version: 1, token: 'owned', accepted: ['evt-1'], duplicates: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fateEventRelay.acknowledge([{
      eventId: 'evt-1',
      state: 'COMPLETED',
      acknowledgedAt: Date.now(),
    }]);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/acks'),
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      acknowledgements: [expect.objectContaining({ eventId: 'evt-1' })],
    });
    expect(body.token).toEqual(expect.any(String));
  });

  it('does not fetch while sync is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fateEventRelay.fetchEvents()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
