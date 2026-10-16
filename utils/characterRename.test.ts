import { describe, expect, it, vi } from 'vitest';
import { checkCharacterRename, womNameKey } from './characterRename';

type Reply = { status: number; body: unknown };

/** A fetch that answers each Wise Old Man call in turn and records them. */
const wom = (...replies: Reply[]) => {
  const fetchImpl = vi.fn(async () => {
    const reply = replies.shift();
    if (!reply) throw new Error('unexpected call');
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => reply.body,
    } as Response;
  });
  return fetchImpl as unknown as typeof fetch & typeof fetchImpl;
};

const change = (oldName: string, newName: string, status: string, extra: Record<string, unknown> = {}) => ({
  id: 1, playerId: 7, oldName, newName, status, resolvedAt: null, createdAt: '2026-10-15T10:00:00.000Z', ...extra,
});

describe('checkCharacterRename', () => {
  it('approves a name Wise Old Man has an approved change to from the bound name', async () => {
    const fetchImpl = wom({ status: 200, body: [change('old_name', 'New Name', 'approved')] });
    await expect(checkCharacterRename('Old Name', 'new name', fetchImpl))
      .resolves.toEqual({ status: 'approved', name: 'New Name' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl.mock.calls[0] as unknown[])[0]).toBe('https://api.wiseoldman.net/v2/players/new%20name/names');
  });

  it('follows a character through several approved changes', async () => {
    const fetchImpl = wom({ status: 200, body: [
      change('Middle', 'Newest', 'approved', { createdAt: '2026-10-15T00:00:00.000Z' }),
      change('Old Name', 'Middle', 'approved', { createdAt: '2026-01-01T00:00:00.000Z' }),
    ] });
    await expect(checkCharacterRename('Old Name', 'Newest', fetchImpl))
      .resolves.toEqual({ status: 'approved', name: 'Newest' });
  });

  it('never approves from a pending or denied change, or one from another name', async () => {
    const fetchImpl = wom(
      { status: 200, body: [change('Old Name', 'New Name', 'pending'), change('Someone Else', 'New Name', 'approved')] },
      { status: 200, body: [change('Old Name', 'New Name', 'pending')] },
    );
    await expect(checkCharacterRename('Old Name', 'New Name', fetchImpl))
      .resolves.toEqual({ status: 'pending' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('explains a change Wise Old Man turned down', async () => {
    const fetchImpl = wom(
      { status: 404, body: { message: 'Player not found.' } },
      { status: 200, body: [change('Old Name', 'New Name', 'denied', { reviewContext: { reason: 'negative_gains' } })] },
    );
    const result = await checkCharacterRename('Old Name', 'New Name', fetchImpl);
    expect(result.status).toBe('denied');
    expect(result).toMatchObject({ message: expect.stringMatching(/lower stats/) });
  });

  it('sends a change Wise Old Man has not seen for review', async () => {
    const fetchImpl = wom(
      { status: 404, body: { message: 'Player not found.' } },
      { status: 200, body: [] },
      { status: 201, body: change('Old Name', 'New Name', 'pending') },
    );
    await expect(checkCharacterRename('Old Name', 'New Name', fetchImpl))
      .resolves.toEqual({ status: 'pending' });
    const [url, init] = fetchImpl.mock.calls[2] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.wiseoldman.net/v2/names');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ oldName: 'Old Name', newName: 'New Name' });
  });

  it("passes on Wise Old Man's reason when it won't take a change", async () => {
    const fetchImpl = wom(
      { status: 200, body: [] },
      { status: 200, body: [] },
      { status: 400, body: { message: 'Old name and new name cannot be the same.' } },
    );
    await expect(checkCharacterRename('Old Name', 'New Name', fetchImpl)).resolves.toEqual({
      status: 'error',
      message: "Wise Old Man couldn't take this name change: Old name and new name cannot be the same.",
    });
  });

  it('turns away names that cannot exist in game, or are the bound name, without asking', async () => {
    const fetchImpl = wom();
    expect((await checkCharacterRename('Old Name', 'Far too long a name', fetchImpl)).status).toBe('error');
    expect((await checkCharacterRename('Old Name', 'bad!name', fetchImpl)).status).toBe('error');
    expect((await checkCharacterRename('Old Name', 'old_name', fetchImpl)).status).toBe('error');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports an unreachable Wise Old Man as an error, not an approval', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect((await checkCharacterRename('Old Name', 'New Name', fetchImpl)).status).toBe('error');
    const busy = wom({ status: 429, body: null });
    expect((await checkCharacterRename('Old Name', 'New Name', busy)).status).toBe('error');
  });

  it('compares names the way Wise Old Man does', () => {
    expect(womNameKey(' Old_Name ')).toBe('old name');
    expect(womNameKey('Old-Name')).toBe('old name');
  });
});
