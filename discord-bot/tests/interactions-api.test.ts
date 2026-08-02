import nacl from 'tweetnacl';
import { describe, expect, it } from 'vitest';
import { createInteractionsHandler } from '../api/interactions.js';
import type { DiscordInteraction } from '../src/handlers/interactions.js';
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
    method: 'POST',
    headers: { 'x-signature-timestamp': timestamp, 'x-signature-ed25519': Buffer.from(signature).toString('hex') },
    body,
  });
};

describe('interaction API deferred work', () => {
  it('registers journal work with Vercel only after the interaction handler has produced the defer response', async () => {
    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(9));
    const requestConfig = { ...config, publicKey: Buffer.from(keyPair.publicKey).toString('hex') };
    const events: string[] = [];
    let scheduled: Promise<unknown> | undefined;
    let releaseWork: (() => void) | undefined;
    const handler = createInteractionsHandler(
      requestConfig,
      async (_interaction: DiscordInteraction) => ({
        type: 5,
        data: { flags: 64 },
        afterAck: () => new Promise<void>((resolve) => { releaseWork = () => { events.push('work'); resolve(); }; }),
      }),
      (work) => { events.push('schedule'); scheduled = work; },
    );

    const response = await handler(signedRequest('{"type":5,"guild_id":"1533446664709341357"}', keyPair.publicKey, keyPair.secretKey));

    await expect(response.json()).resolves.toEqual({ type: 5, data: { flags: 64 } });
    expect(events).toEqual(['schedule']);
    releaseWork?.();
    await scheduled;
    expect(events).toEqual(['schedule', 'work']);
  });
});
