import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import automation from '../api/automation.js';
import interactions from '../api/interactions.js';

type WebEndpoint = {
  fetch(request: Request): Promise<Response>;
};

const environment = {
  DISCORD_APPLICATION_ID: '100000000000000001',
  DISCORD_PUBLIC_KEY: '11'.repeat(32),
  DISCORD_BOT_TOKEN: 'test-token-not-a-real-secret',
  DISCORD_GUILD_ID: '1533446664709341357',
  DISCORD_ANNOUNCEMENTS_CHANNEL_ID: '100000000000000002',
  DISCORD_RUN_JOURNALS_CHANNEL_ID: '100000000000000003',
  DISCORD_VERIFICATION_QUEUE_CHANNEL_ID: '100000000000000004',
  DISCORD_AUDIT_LOG_CHANNEL_ID: '100000000000000005',
  DISCORD_RULES_CHANNEL_ID: '100000000000000006',
  DISCORD_MODERATOR_ROLE_ID: '100000000000000007',
  DISCORD_ADMINISTRATOR_ROLE_ID: '100000000000000008',
  DISCORD_FATEKEEPER_ROLE_ID: '100000000000000009',
  DISCORD_VERIFIED_RUNNER_ROLE_ID: '100000000000000010',
  DISCORD_UPDATES_ROLE_ID: '100000000000000011',
  DISCORD_WEEKLY_SEED_ROLE_ID: '100000000000000012',
  DISCORD_TAG_VANILLA_ID: '100000000000000013',
  DISCORD_TAG_CHUNKED_ID: '100000000000000014',
  DISCORD_TAG_CUSTOM_ID: '100000000000000015',
  DISCORD_TAG_ACTIVE_ID: '100000000000000016',
  DISCORD_TAG_VERIFIED_ID: '100000000000000017',
  DISCORD_COMPONENT_HMAC_KEY: 'component-key-at-least-32-bytes-long',
  AUTOMATION_HMAC_KEY: 'automation-key-at-least-32-bytes-long',
  AUTOMATION_ALLOWED_REPOSITORIES: 'Nubles/OSRS-Fate-Locked,Nubles/OSRS-Fate-Locked-Runelite',
  DISCORD_MUTATIONS_ENABLED: 'false',
};

let originalEnvironment: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnvironment = { ...process.env };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, environment);
});

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
});

describe('default Vercel API web handlers', () => {
  it('returns 401 from the interactions endpoint for an unsigned Web Request', async () => {
    const response = await (interactions as unknown as WebEndpoint).fetch(new Request('https://example.test/api/interactions', {
      method: 'POST',
      body: '{"type":1}',
    }));

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(401);
  });

  it('returns 401 from the automation endpoint for an unsigned Web Request', async () => {
    const response = await (automation as unknown as WebEndpoint).fetch(new Request('https://example.test/api/automation', {
      method: 'POST',
      body: '{"type":"weekly_seed"}',
    }));

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(401);
  });
});
