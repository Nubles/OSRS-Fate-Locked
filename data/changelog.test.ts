import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_RELEASES,
  LATEST_CHANGELOG,
  type ChangelogNote,
  type ChangelogSection,
} from './changelog';
import { LATEST_CHANGELOG_ID } from './changelogLatest';

const allowedSections = new Set<ChangelogSection>([
  'added',
  'changed',
  'fixed',
  'balance',
]);

const noteText = (note: ChangelogNote): string =>
  typeof note === 'string' ? note : `${note.text} ${note.link.label}.`;

const allNotes = CHANGELOG_RELEASES.flatMap((release) =>
  Object.values(release.sections).flatMap((notes) =>
    (notes ?? []).map((note) => ({ id: release.id, text: noteText(note) })),
  ),
);

describe('authored changelog releases', () => {
  it('keeps unique release ids in newest-first ISO date order', () => {
    const ids = CHANGELOG_RELEASES.map((release) => release.id);
    const dates = CHANGELOG_RELEASES.map((release) => release.date);

    expect(new Set(ids).size).toBe(ids.length);
    expect(dates).toEqual([...dates].sort((left, right) => right.localeCompare(left)));
    expect(LATEST_CHANGELOG.id).toBe('2026-10-09-pandemonium-route');
  });

  it('names the newest release in changelogLatest.ts, which the app reads up front', () => {
    // Add a release? Set LATEST_CHANGELOG_ID in data/changelogLatest.ts to its id.
    expect(LATEST_CHANGELOG_ID).toBe(CHANGELOG_RELEASES[0].id);
  });

  it('contains only non-empty, supported sections', () => {
    for (const release of CHANGELOG_RELEASES) {
      for (const [section, notes] of Object.entries(release.sections)) {
        expect(allowedSections.has(section as ChangelogSection)).toBe(true);
        expect(notes).toBeDefined();
        expect(notes?.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the Plugin Hub link on the RuneLite plugin launch', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-07-28-runelite-companion-update');
    expect(release?.sections.changed).toContainEqual(expect.objectContaining({
      link: { label: 'Plugin Hub PR #14395', href: 'https://github.com/runelite/plugin-hub/pull/14395' },
    }));
  });
});

// The writing rules at the top of data/changelog.ts. Entries are read in the
// app and in the Discord's #updates channel, so they stay short and plain.
describe('What’s New writing style', () => {
  it('keeps titles short', () => {
    const long = CHANGELOG_RELEASES
      .filter((release) => release.title.length > 50)
      .map((release) => `${release.id}: ${release.title} (${release.title.length})`);
    expect(long).toEqual([]);
  });

  it('writes titles in sentence case, not Title Case', () => {
    // Every word after the first starting with a capital is Title Case. Names
    // are fine, so a title only fails when all its later words are capitalised.
    const smallWords = /^(?:a|an|and|as|at|by|for|from|in|into|of|on|or|the|to|with)$/i;
    const titleCase = CHANGELOG_RELEASES
      .filter((release) => {
        const words = release.title.split(/\s+/).slice(1).filter((word) => /^[A-Za-z]/.test(word) && !smallWords.test(word));
        return words.length >= 3 && words.every((word) => /^[A-Z]/.test(word));
      })
      .map((release) => `${release.id}: ${release.title}`);
    expect(titleCase).toEqual([]);
  });

  it('keeps each bullet to one short line', () => {
    const long = allNotes
      .filter((note) => note.text.length > 160)
      .map((note) => `${note.id}: ${note.text.length} characters`);
    expect(long).toEqual([]);
  });

  it('keeps each release to six bullets at most', () => {
    const crowded = CHANGELOG_RELEASES
      .map((release) => ({
        id: release.id,
        count: Object.values(release.sections).reduce((total, notes) => total + (notes?.length ?? 0), 0),
      }))
      .filter((release) => release.count > 6)
      .map((release) => `${release.id}: ${release.count} bullets`);
    expect(crowded).toEqual([]);
  });

  it('skips the backstory and the em dashes', () => {
    const flagged = allNotes
      .filter((note) => /—|\bBefore,|\bPreviously\b|\bseamless|\brobust\b|\bcomprehensive\b|\bstreamlined?\b|\bleverag/i.test(note.text))
      .map((note) => `${note.id}: ${note.text}`);
    expect(flagged).toEqual([]);
  });
});
