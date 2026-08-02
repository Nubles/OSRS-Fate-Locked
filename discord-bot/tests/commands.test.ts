import { describe, expect, it } from 'vitest';
import { weeklySeed } from '../../utils/seededRng.js';
import { guildCommands } from '../src/commands/definitions.js';
import { routeInteraction } from '../src/commands/router.js';
import type { BotConfig } from '../src/types.js';

const config: BotConfig = {
  applicationId: '100000000000000001',
  publicKey: '0'.repeat(64),
  botToken: 'test-token',
  guildId: '1533446664709341357',
  channels: {
    announcements: '100000000000000002', runJournals: '100000000000000003', verificationQueue: '100000000000000004', auditLog: '100000000000000005', rules: '100000000000000006',
  },
  roles: { moderator: '100000000000000007', administrator: '100000000000000008', fatekeeper: '100000000000000009', verifiedRunner: '100000000000000010', updates: '100000000000000011', weeklySeed: '100000000000000012' },
  tags: { vanilla: '100000000000000013', chunked: '100000000000000014', custom: '100000000000000015', active: '100000000000000016', verified: '100000000000000017' },
  componentHmacKey: 'component-key-at-least-32-bytes-long', automationHmacKey: 'automation-key-at-least-32-bytes-long', allowedRepositories: ['Nubles/OSRS-Fate-Locked'], mutationsEnabled: false,
};

const command = (name: string, options?: unknown[]) => ({ type: 2, data: { name, ...(options ? { options } : {}) } });

describe('guildCommands', () => {
  it('registers only the six Fate Locked guild commands', () => {
    expect(guildCommands.map((command) => command.name)).toEqual(['tracker', 'runelite', 'rules', 'weekly-seed', 'journal', 'verify']);
    expect(guildCommands.find((command) => command.name === 'journal')).toMatchObject({
      options: [{ type: 1, name: 'create' }],
    });
  });
});

describe('routeInteraction', () => {
  it.each([
    ['tracker', 'Fate Locked tracker', 'https://nubles.github.io/OSRS-Fate-Locked/'],
    ['runelite', 'RuneLite guide', 'https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide'],
    ['rules', 'Rules', 'https://github.com/Nubles/OSRS-Fate-Locked-Runelite'],
  ])('returns an ephemeral link response for /%s', async (name, label, url) => {
    const response = await routeInteraction(command(name), config, new Date('2026-08-02T12:00:00Z'));

    expect(response).toMatchObject({ type: 4, data: { flags: 64, allowed_mentions: { parse: [] }, components: [{ type: 1, components: [{ type: 2, style: 5, label, url }] }] } });
  });

  it('mentions only the configured rules channel for /rules', async () => {
    const response = await routeInteraction(command('rules'), config, new Date('2026-08-02T12:00:00Z'));
    expect(response.data.content).toBe('Read the rules in <#100000000000000006>.');
  });

  it('uses the tracker weekly seed in an ephemeral safe response', async () => {
    const date = new Date('2026-08-02T12:00:00Z');
    const response = await routeInteraction(command('weekly-seed'), config, date);

    expect(response).toMatchObject({
      type: 4,
      data: { content: `This week's Fate Locked seed is ${weeklySeed(date)}.`, flags: 64, allowed_mentions: { parse: [] } },
    });
  });

  it('rejects unknown command, component, and modal IDs ephemerally', async () => {
    for (const interaction of [command('tracker-preview'), { type: 3, data: { custom_id: 'tracker' } }, { type: 5, data: { custom_id: 'verify:approve' } }]) {
      await expect(routeInteraction(interaction, config)).resolves.toMatchObject({
        type: 4,
        data: { flags: 64, allowed_mentions: { parse: [] } },
      });
    }
  });
});
