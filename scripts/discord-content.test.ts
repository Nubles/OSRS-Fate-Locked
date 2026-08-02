import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'docs/discord/server-content.md',
  'docs/discord/permission-matrix.md',
  'docs/discord/launch-checklist.md',
];

const publicChannels = [
  'welcome', 'rules-and-safety', 'roles-and-pings', 'announcements',
  'general', 'introductions', 'help-and-strategy', 'theorycrafting',
  'media-and-clips', 'run-journals', 'verified-showcase', 'live-unlocks',
  'support-desk', 'ideas-and-feedback', 'events-and-lfg',
  'The Campfire', 'Quiet Grind',
];
const staffChannels = [
  'staff-chat', 'mod-alerts', 'reports-and-appeals',
  'verification-queue', 'audit-log',
];
const roles = [
  'Administrator', 'Moderator', 'Fatekeeper', 'Verified Runner',
  'Vanilla', 'Chunked', 'Custom', 'Spectator',
  'Updates', 'Events', 'Weekly Seed',
];
const canonicalLinks = [
  'https://nubles.github.io/OSRS-Fate-Locked/',
  'https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide',
  'https://github.com/Nubles/OSRS-Fate-Locked',
  'https://github.com/Nubles/OSRS-Fate-Locked-Runelite',
];

describe('Discord launch content', () => {
  it('covers every channel and role', () => {
    const corpus = paths.map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n');
    for (const name of [...publicChannels, ...staffChannels, ...roles]) {
      expect(corpus, `missing ${name}`).toContain(name);
    }
  });

  it('contains canonical links and disclaimer', () => {
    const content = readFileSync(resolve(root, 'docs/discord/server-content.md'), 'utf8');
    for (const link of canonicalLinks) expect(content).toContain(link);
    expect(content).toContain('Not affiliated with Jagex.');
  });

  it('contains no real webhook URL', () => {
    const corpus = paths.map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n');
    expect(corpus).not.toMatch(/https:\/\/[^\s]*discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/i);
  });
});
