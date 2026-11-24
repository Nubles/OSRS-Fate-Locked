// @ts-expect-error Node types are intentionally excluded from the browser app.
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

  it('says before linking that unlocks post in #live-unlocks and the Clan chat, and what /unlink leaves', () => {
    // feed.ts titles each post with the member's server name; clan.ts reads the
    // channel back for the relay's public GET /clan, which the Clan tab shows.
    // "new unlocks", not "each new unlock": the relay posts none when the area count
    // leaps and at most FEED_POSTS_PER_HOUR an hour (workers/fate-relay/progress.js).
    expect(modal).toContain('Once you <span className="text-gray-200">/link</span>, new unlocks post in #live-unlocks with your Discord server name,');
    expect(modal).not.toContain('each new unlock posts');
    expect(modal).toContain('and the tracker&apos;s Clan chat shows those posts to everyone who opens the tracker.');
    expect(modal).toContain('<span className="text-gray-200">/unlink</span> stops new posts but does not remove ones already posted.');
    const linkNote = modal.slice(modal.indexOf('Once you <span'), modal.indexOf('ones already posted.'));
    expect(linkNote).not.toMatch(/\u2014|&mdash;/);
  });
});
