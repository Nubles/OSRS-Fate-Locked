import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_RELEASES,
  LATEST_CHANGELOG,
  type ChangelogSection,
} from './changelog';

const allowedSections = new Set<ChangelogSection>([
  'added',
  'changed',
  'fixed',
  'balance',
]);

describe('authored changelog releases', () => {
  it('keeps unique release ids in newest-first ISO date order', () => {
    const ids = CHANGELOG_RELEASES.map((release) => release.id);
    const dates = CHANGELOG_RELEASES.map((release) => release.date);

    expect(new Set(ids).size).toBe(ids.length);
    expect(dates).toEqual([...dates].sort((left, right) => right.localeCompare(left)));
    expect(LATEST_CHANGELOG.id).toBe('2026-07-28-runelite-companion-update');
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

  it('describes the complete RuneLite companion update in player language', () => {
    expect(LATEST_CHANGELOG).toMatchObject({
      id: '2026-07-28-runelite-companion-update',
      title: 'RuneLite Companion Update',
      date: '2026-07-28',
    });
    expect(LATEST_CHANGELOG.sections.added).toContain(
      'Connect the companion to RuneLite with one guided, copyable pairing command.',
    );
    expect(LATEST_CHANGELOG.sections.changed).toEqual(expect.arrayContaining([
      'RuneLite reads your app-authored run rules while detected gameplay events remain local to RuneLite.',
      'The complete RuneLite experience now lives in one panel with collapsible sections.',
    ]));
    expect(LATEST_CHANGELOG.sections.changed).toContainEqual({
      text: 'The RuneLite Plugin Hub update has been approved and is now live. View the merged',
      link: {
        label: 'Plugin Hub PR #14395',
        href: 'https://github.com/runelite/plugin-hub/pull/14395',
      },
    });
    expect(LATEST_CHANGELOG.sections.fixed).toEqual(expect.arrayContaining([
      'RuneLite controls no longer appear clipped or overlap adjacent colour settings.',
      'Run balances are now labelled Keys, Omni Keys, and Chaos Keys.',
    ]));
  });

  it('records every approved Vanilla safety-valve balance change', () => {
    const vanillaSafetyValve = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-26-vanilla-key-safety-valve',
    );

    expect(vanillaSafetyValve?.sections.balance).toEqual([
      'Bosses now provide a finite, diminishing Vanilla key reserve.',
      'Brutus joins Farm Keys as a one-key early safety valve.',
      'The first three clue-earned Standard Keys share 25%, 15%, and 10% minimum chances.',
      'Standard and Chaos boss/minigame rolls now respect hard location access.',
      'The Codex now correctly explains that Vanilla area unlocks can be scattered.',
    ]);
  });

  it('preserves the prior tracker accuracy release', () => {
    const trackerAccuracy = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-23-tracker-accuracy',
    );

    expect(trackerAccuracy).toMatchObject({
      id: '2026-07-23-tracker-accuracy',
      title: 'Tracker Accuracy & Combat Powers',
      date: '2026-07-23',
    });
    expect(trackerAccuracy?.sections.added).toContain(
      "A What's New dialog now summarizes each player-facing release.",
    );
    expect(trackerAccuracy?.sections.changed).toContain(
      'Arcana is now called Combat Powers, covering spellbooks, prayers, and special combat systems such as Dwarf Cannon.',
    );
    expect(trackerAccuracy?.sections.fixed).toEqual(expect.arrayContaining([
      'Dragon Claws now list Chambers of Xeric instead of Tormented Demons.',
      'Quest and diary recommendations now respect unlocked skill-method caps as well as recorded levels.',
    ]));
  });
});
