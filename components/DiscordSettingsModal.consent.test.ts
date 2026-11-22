import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildProgressSnapshot } from '../utils/progressSnapshot';

const modal = readFileSync('components/DiscordSettingsModal.tsx', 'utf8').replace(/\s+/g, ' ');
const doc = readFileSync('docs/shared-progress.md', 'utf8').replace(/\s+/g, ' ');

describe('Discord sharing and Adventurer\'s Log consent', () => {
  it('names the linked account name the summary carries, in the app and the doc', () => {
    expect(String(buildProgressSnapshot).includes('account')).toBe(true);
    expect(modal).toContain('Share a summary of this run (your linked account name, mode, start date,');
    expect(modal).toContain('anyone with the link can open: your linked account name and this run&apos;s mode, start date,');
    expect(doc).toContain('its linked OSRS account name');
    expect(doc).toContain('account name included, through `GET /p/<id>`');
  });
});
