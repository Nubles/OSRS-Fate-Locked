import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parseAutomationEvent } from '../src/automation.js';
import * as automationModule from '../src/automation.js';
import { releaseMarker } from '../src/markers.js';
import { handleAutomationRequest } from '../src/handlers/automation.js';
import type { AutomationEvent } from '../src/automation.js';
import type { BotConfig } from '../src/types.js';

const config: BotConfig = {
  applicationId: '100000000000000001',
  publicKey: '',
  botToken: 'test-token-not-a-real-secret',
  guildId: '1533446664709341357',
  channels: {
    announcements: '100000000000000002',
    runJournals: '100000000000000003',
    verificationQueue: '100000000000000004',
    auditLog: '100000000000000005',
    rules: '100000000000000006',
  },
  roles: {
    moderator: '100000000000000007',
    administrator: '100000000000000008',
    fatekeeper: '100000000000000009',
    verifiedRunner: '100000000000000010',
    updates: '100000000000000011',
    weeklySeed: '100000000000000012',
  },
  tags: {
    vanilla: '100000000000000013',
    chunked: '100000000000000014',
    custom: '100000000000000015',
    active: '100000000000000016',
    verified: '100000000000000017',
  },
  componentHmacKey: 'component-key-at-least-32-bytes-long',
  automationHmacKey: 'automation-key-at-least-32-bytes-long',
  allowedRepositories: ['Nubles/OSRS-Fate-Locked', 'Nubles/OSRS-Fate-Locked-Runelite'],
  mutationsEnabled: false,
};

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

const signedRequest = (body: string, timestamp = '1700000000'): Request => {
  const signature = `v1=${createHmac('sha256', config.automationHmacKey)
    .update(`${timestamp}.${body}`)
    .digest('hex')}`;

  return new Request('https://example.test/api/automation', {
    method: 'POST',
    headers: {
      'x-fate-timestamp': timestamp,
      'x-fate-signature': signature,
    },
    body,
  });
};

describe('automation event envelope', () => {
  it('rejects an allow-listed repository paired with an unsupported event after HMAC verification', async () => {
    const handleEvent = vi.fn(async () => json({ accepted: true }, 202));
    const body = JSON.stringify({
      type: 'weekly_seed',
      repository: 'Nubles/OSRS-Fate-Locked-Runelite',
      sentAt: '2026-08-03T09:15:00.000Z',
    });

    const response = await handleAutomationRequest(
      signedRequest(body),
      { config, handleEvent },
      1_700_000_100,
    );

    expect(response.status).toBe(400);
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it('accepts a complete release envelope for a supported release repository', () => {
    const event = {
      type: 'release',
      repository: 'Nubles/OSRS-Fate-Locked-Runelite',
      sentAt: '2026-08-03T09:15:00.000Z',
      release: {
        id: 42,
        tagName: 'v1.2.3',
        name: 'A release',
        url: 'https://github.com/Nubles/OSRS-Fate-Locked-Runelite/releases/tag/v1.2.3',
        body: 'Release notes',
        publishedAt: '2026-08-03T09:00:00.000Z',
      },
    };

    expect(parseAutomationEvent(event)).toEqual(event);
  });

  it('rejects release URLs that are not under the matching GitHub repository', () => {
    const base = {
      type: 'release',
      repository: 'Nubles/OSRS-Fate-Locked',
      sentAt: '2026-08-03T09:15:00.000Z',
      release: {
        id: 43,
        tagName: 'v1.2.4',
        name: 'Another release',
        url: 'https://github.com/Nubles/OSRS-Fate-Locked/releases/tag/v1.2.4',
        body: 'Release notes',
        publishedAt: '2026-08-03T09:00:00.000Z',
      },
    };

    for (const url of [
      'https://example.test/Nubles/OSRS-Fate-Locked/releases/tag/v1.2.4',
      'https://github.com/Nubles/OSRS-Fate-Locked-Runelite/releases/tag/v1.2.4',
    ]) {
      expect(parseAutomationEvent({ ...base, release: { ...base.release, url } })).toBeNull();
    }
  });
});

describe('announcement idempotency', () => {
  it('does not post a release whose exact marker appears on a bot-authored announcement', async () => {
    const event: Extract<AutomationEvent, { type: 'release' }> = {
      type: 'release',
      repository: 'Nubles/OSRS-Fate-Locked',
      sentAt: '2026-08-03T09:15:00.000Z',
      release: {
        id: 44,
        tagName: 'v1.2.5',
        name: 'Duplicate release',
        url: 'https://github.com/Nubles/OSRS-Fate-Locked/releases/tag/v1.2.5',
        body: 'Release notes',
        publishedAt: '2026-08-03T09:00:00.000Z',
      },
    };

    const getChannelMessages = vi.fn(async () => [{
      author: { id: config.applicationId, bot: true },
      embeds: [{ footer: { text: releaseMarker(event.repository, event.release.id) } }],
    }]);
    const createMessage = vi.fn(async () => ({ id: '100000000000000099' }));
    const publish = Reflect.get(automationModule, 'publishAnnouncement');
    expect(publish).toBeTypeOf('function');
    if (typeof publish !== 'function') return;

    await expect(publish(event, { config, rest: { getChannelMessages, createMessage } })).resolves.toEqual({ ok: true, duplicate: true, type: 'release' });
    expect(getChannelMessages).toHaveBeenCalledWith(config.channels.announcements, 100);
    expect(createMessage).not.toHaveBeenCalled();
  });
});

describe('weekly announcements', () => {
  it('posts the canonical seed from sentAt with only the Weekly Seed role allow-listed', async () => {
    const event: Extract<AutomationEvent, { type: 'weekly_seed' }> = {
      type: 'weekly_seed',
      repository: 'Nubles/OSRS-Fate-Locked',
      sentAt: '2027-01-01T12:00:00.000Z',
    };

    const getChannelMessages = vi.fn(async () => []);
    const createMessage = vi.fn(async () => ({ id: '100000000000000099' }));
    const publish = Reflect.get(automationModule, 'publishAnnouncement');
    if (typeof publish !== 'function') throw new Error('publishAnnouncement is required');

    await expect(publish(event, { config, rest: { getChannelMessages, createMessage } })).resolves.toEqual({ ok: true, duplicate: false, type: 'weekly_seed' });
    expect(createMessage).toHaveBeenCalledWith(
      config.channels.announcements,
      expect.objectContaining({
        content: '<@&100000000000000012>',
        allowed_mentions: { roles: ['100000000000000012'], parse: [] },
        embeds: [expect.objectContaining({
          color: 0xd4af37,
          footer: { text: 'FLS1 seed=FATE-2026-W53' },
          description: expect.stringContaining('[Open the Fate Locked tracker](https://nubles.github.io/OSRS-Fate-Locked/)'),
        })],
      }),
    );
  });
});

describe('release announcements', () => {
  it('posts a bounded release embed with only the Updates role allow-listed', async () => {
    const event: Extract<AutomationEvent, { type: 'release' }> = {
      type: 'release',
      repository: 'Nubles/OSRS-Fate-Locked-Runelite',
      sentAt: '2026-08-03T09:15:00.000Z',
      release: {
        id: 45,
        tagName: 'T'.repeat(200),
        name: 'N'.repeat(300),
        url: 'https://github.com/Nubles/OSRS-Fate-Locked-Runelite/releases/tag/v1.2.6',
        body: `@everyone @here <@100000000000000090>\n${'x'.repeat(1100)}`,
        publishedAt: '2026-08-03T09:00:00.000Z',
      },
    };

    const getChannelMessages = vi.fn(async () => []);
    const createMessage = vi.fn(async (_channelId: string, _body: unknown) => ({ id: '100000000000000099' }));
    const publish = Reflect.get(automationModule, 'publishAnnouncement');
    if (typeof publish !== 'function') throw new Error('publishAnnouncement is required');

    await expect(publish(event, { config, rest: { getChannelMessages, createMessage } })).resolves.toEqual({ ok: true, duplicate: false, type: 'release' });
    const payload = createMessage.mock.calls[0]?.[1] as {
      content: string;
      allowed_mentions: { roles: string[]; parse: string[] };
      embeds: Array<{ title: string; url: string; description: string; fields: Array<{ name: string; value: string }>; timestamp: string; footer: { text: string } }>;
    };
    const embed = payload.embeds[0]!;

    expect(payload.content).toBe('<@&100000000000000011>');
    expect(payload.allowed_mentions).toEqual({ roles: ['100000000000000011'], parse: [] });
    expect(embed.title).toBe('N'.repeat(256));
    expect(embed.url).toBe('https://github.com/Nubles/OSRS-Fate-Locked-Runelite/releases/tag/v1.2.6');
    expect(embed.description).toHaveLength(1000);
    expect(embed.description.startsWith('@everyone @here <@100000000000000090> ')).toBe(true);
    expect(embed.fields).toEqual([
      { name: 'Repository', value: 'Nubles/OSRS-Fate-Locked-Runelite' },
      { name: 'Tag', value: 'T'.repeat(128) },
    ]);
    expect(embed.timestamp).toBe('2026-08-03T09:00:00.000Z');
    expect(embed.footer).toEqual({ text: 'FLR1 repository=Nubles/OSRS-Fate-Locked-Runelite release=45' });
  });
});
const senderScript = fileURLToPath(new URL('../scripts/send-automation-event.mjs', import.meta.url));

const runSender = (env: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [senderScript], { env });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });

describe('automation sender', () => {
  it('signs the exact serialized event and logs only its safe response fields', async () => {
    const received: Array<{ body: string; timestamp: string; signature: string }> = [];
    const server = createServer((request, response) => {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => { body += chunk; });
      request.on('end', () => {
        received.push({
          body,
          timestamp: String(request.headers['x-fate-timestamp'] ?? ''),
          signature: String(request.headers['x-fate-signature'] ?? ''),
        });
        response.writeHead(202, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, duplicate: false, type: 'weekly_seed', channelId: '100000000000000099' }));
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Local sender test server did not bind');
    const endpoint = `http://127.0.0.1:${address.port}/automation`;
    const hmac = 'automation-sender-key-at-least-32-bytes-long';
    const result = await runSender({
      ...process.env,
      DISCORD_AUTOMATION_ENDPOINT: endpoint,
      DISCORD_AUTOMATION_HMAC: hmac,
      AUTOMATION_EVENT_JSON: '{"type":"weekly_seed","repository":"Nubles/OSRS-Fate-Locked"}',
    }).finally(() => new Promise<void>((resolve) => server.close(() => resolve())));

    expect(result.code).toBe(0);
    expect(received).toHaveLength(1);
    const request = received[0];
    if (!request) throw new Error('Sender did not make a request');
    const event = JSON.parse(request.body) as { type: string; repository: string; sentAt: string };
    expect(event).toMatchObject({ type: 'weekly_seed', repository: 'Nubles/OSRS-Fate-Locked' });
    expect(typeof event.sentAt).toBe('string');
    expect(new Date(event.sentAt).toISOString()).toBe(event.sentAt);
    expect(request.timestamp).toMatch(/^\d+$/);
    const expectedSignature = `v1=${createHmac('sha256', hmac).update(`${request.timestamp}.${request.body}`).digest('hex')}`;
    expect(request.signature).toBe(expectedSignature);
    expect(result.stdout).toContain('weekly_seed');
    expect(result.stdout).toContain('202');
    expect(result.stdout).not.toContain(hmac);
    expect(result.stdout).not.toContain('100000000000000099');
  });
});

const workflowText = (file: string): Promise<string> =>
  readFile(new URL(`../../.github/workflows/${file}`, import.meta.url), 'utf8');

describe('Discord automation workflows', () => {
  it('expose only the automation endpoint and HMAC secrets', async () => {
    const [register, release, weekly] = await Promise.all([
      workflowText('discord-register-commands.yml'),
      workflowText('discord-release.yml'),
      workflowText('discord-weekly-seed.yml'),
    ]);

    for (const workflow of [register, release, weekly]) {
      expect(workflow).toMatch(/permissions:\s*\n\s+contents: read/);
      expect(workflow).toContain('DISCORD_AUTOMATION_ENDPOINT: ${{ secrets.DISCORD_AUTOMATION_ENDPOINT }}');
      expect(workflow).toContain('DISCORD_AUTOMATION_HMAC: ${{ secrets.DISCORD_AUTOMATION_HMAC }}');
      expect(workflow).toContain('cancel-in-progress: false');
      expect(workflow).not.toMatch(/DISCORD_BOT_TOKEN/i);
      expect(workflow).not.toMatch(/discord(?:app)?\.com\/api\/webhooks/i);
    }

    expect(register).toMatch(/on:\s*\n\s+workflow_dispatch:/);
    expect(register).toContain('AUTOMATION_EVENT_JSON: \'{"type":"register_commands","repository":"Nubles/OSRS-Fate-Locked"}\'');
    expect(weekly).toMatch(/cron: '15 9 \* \* 1'/);
    expect(weekly).toContain('AUTOMATION_EVENT_JSON: \'{"type":"weekly_seed","repository":"Nubles/OSRS-Fate-Locked"}\'');
    expect(release).toMatch(/release:\s*\n\s+types: \[published\]/);
    expect(release).toContain('node discord-bot/scripts/send-release-event.mjs "$GITHUB_EVENT_PATH"');
    expect(release).not.toContain('github.event.release.body');

    const scripts = await Promise.all([
      readFile(new URL('../scripts/send-automation-event.mjs', import.meta.url), 'utf8'),
      readFile(new URL('../scripts/send-release-event.mjs', import.meta.url), 'utf8'),
    ]);
    for (const script of scripts) {
      expect(script).not.toMatch(/DISCORD_BOT_TOKEN/i);
      expect(script).not.toMatch(/discord(?:app)?\.com\/api\/webhooks/i);
    }
  });
});

describe('automation API', () => {
  it('returns a safe 503 without posting when announcement history is unavailable', async () => {
    const api = await import('../api/automation.js').catch(() => null);
    const factory = api && typeof api === 'object' ? Reflect.get(api, 'createAutomationHandler') : undefined;
    expect(factory).toBeTypeOf('function');
    if (typeof factory !== 'function') return;

    const getChannelMessages = vi.fn(async () => { throw new Error('Discord unavailable'); });
    const createMessage = vi.fn(async () => ({ id: '100000000000000099' }));
    const handler = factory(config, {
      registerGuildCommands: vi.fn(async () => []),
      getChannelMessages,
      createMessage,
    });
    const body = JSON.stringify({
      type: 'weekly_seed',
      repository: 'Nubles/OSRS-Fate-Locked',
      sentAt: '2026-08-03T09:15:00.000Z',
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await handler(signedRequest(body, timestamp));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, duplicate: false, type: 'weekly_seed' });
    expect(createMessage).not.toHaveBeenCalled();
  });
});
