import nacl from 'tweetnacl';
import { describe, expect, it, vi } from 'vitest';
import { createInteractionsHandler } from '../api/interactions.js';
import { handleJournalSubmit } from '../src/journals.js';
import type { BotConfig } from '../src/types.js';

const config: BotConfig = {
  applicationId: '100000000000000001', publicKey: '', botToken: 'test-token', guildId: '1533446664709341357',
  channels: { announcements: '100000000000000002', runJournals: '100000000000000003', verificationQueue: '100000000000000004', auditLog: '100000000000000005', rules: '100000000000000006' },
  roles: { moderator: '100000000000000007', administrator: '100000000000000008', fatekeeper: '100000000000000009', verifiedRunner: '100000000000000010', updates: '100000000000000011', weeklySeed: '100000000000000012' },
  tags: { vanilla: '100000000000000013', chunked: '100000000000000014', custom: '100000000000000015', active: '100000000000000016', verified: '100000000000000017' },
  componentHmacKey: 'component-key-at-least-32-bytes-long', automationHmacKey: 'automation-key-at-least-32-bytes-long', allowedRepositories: ['Nubles/OSRS-Fate-Locked'], mutationsEnabled: false,
};

const signedRequest = (body: string, publicKey: Uint8Array, secretKey: Uint8Array): Request => {
  const timestamp = '1700000000';
  const signature = nacl.sign.detached(new TextEncoder().encode(`${timestamp}${body}`), secretKey);
  return new Request('https://example.test/api/interactions', {
    method: 'POST', headers: { 'x-signature-timestamp': timestamp, 'x-signature-ed25519': Buffer.from(signature).toString('hex') }, body,
  });
};

const journalModalSubmit = '{"type":5,"guild_id":"1533446664709341357","token":"private-interaction-token","data":{"custom_id":"journal:create:v1","components":[{"type":1,"components":[{"type":4,"custom_id":"rsn","value":"Zezima"}]},{"type":1,"components":[{"type":4,"custom_id":"path","value":"Vanilla"}]},{"type":1,"components":[{"type":4,"custom_id":"intro","value":""}]}]}}';

describe('interaction API deferred work', () => {
  it('returns the defer response before real journal work starts while Vercel tracks that work', async () => {
    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(9));
    const requestConfig = { ...config, publicKey: Buffer.from(keyPair.publicKey).toString('hex') };
    const events: string[] = [];
    let scheduled: Promise<unknown> | undefined;
    const createForumPost = vi.fn(async () => { events.push('work-start'); return { id: '100000000000000099' }; });
    const editOriginalInteractionResponse = vi.fn(async () => ({ id: '100000000000000098' }));
    const handler = createInteractionsHandler(
      requestConfig,
      async (interaction) => handleJournalSubmit(interaction, { config: requestConfig, rest: { createForumPost, editOriginalInteractionResponse } }),
      (work) => { events.push('schedule'); scheduled = work; },
    );

    events.push('handler-called');
    const response = await handler(signedRequest(journalModalSubmit, keyPair.publicKey, keyPair.secretKey));
    events.push('handler-returned');

    await expect(response.json()).resolves.toEqual({ type: 5, data: { flags: 64 } });
    expect(events).toEqual(['handler-called', 'schedule', 'handler-returned']);
    await scheduled;
    expect(events).toEqual(['handler-called', 'schedule', 'handler-returned', 'work-start']);
  });
});