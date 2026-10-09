import { describe, expect, it } from 'vitest';
import { CHANGELOG_RELEASES } from '../data/changelog';
import {
  FIRST_ANNOUNCED_DATE,
  MAX_RELEASES,
  releasesToAnnounce,
  whatsNewEvent,
} from './whats-new-event.mjs';

const release = (id: string, date: string) => ({ id, title: id, date, sections: { fixed: [`${id} note`] } });

describe("What's New entries for the Discord announcements", () => {
  it('sends the newest entries since the first announced date, oldest first', () => {
    const releases = [
      release('c', '2026-10-11'),
      release('b', '2026-10-10'),
      release('a', FIRST_ANNOUNCED_DATE),
      release('old', '2026-10-08'),
    ];
    expect(releasesToAnnounce(releases).map((entry: { id: string }) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('sends at most ten, the newest', () => {
    const releases = Array.from({ length: 12 }, (_, index) => release(`r${index}`, '2026-10-20'));
    const ids = releasesToAnnounce(releases).map((entry: { id: string }) => entry.id);
    expect(ids).toHaveLength(MAX_RELEASES);
    expect(ids[ids.length - 1]).toBe('r0');
    expect(ids).not.toContain('r10');
  });

  it("carries each entry's id, title, date and notes unchanged", () => {
    const event = whatsNewEvent(CHANGELOG_RELEASES, '2026-10-09T12:00:00.000Z');
    expect(event).toMatchObject({ type: 'whats_new', repository: 'Nubles/OSRS-Fate-Locked', sentAt: '2026-10-09T12:00:00.000Z' });
    const newest = event.releases[event.releases.length - 1];
    const { id, title, date, sections } = CHANGELOG_RELEASES[0];
    expect(newest).toEqual({ id, title, date, sections });
  });
});
