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
    expect(LATEST_CHANGELOG.id).toBe('2026-07-26-vanilla-key-safety-valve');
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

  it('records every approved Vanilla safety-valve balance change', () => {
    expect(LATEST_CHANGELOG.sections.balance).toEqual([
      'Bosses now provide a finite, diminishing Vanilla key reserve.',
      'Brutus joins Farm Keys as a one-key early safety valve.',
      'The first three clue-earned Standard Keys share 25%, 15%, and 10% minimum chances.',
      'Standard and Chaos boss/minigame rolls now respect hard location access.',
      'The Codex now correctly explains that Vanilla area unlocks can be scattered.',
    ]);
  });

  it('preserves the prior tracker accuracy release', () => {
    expect(CHANGELOG_RELEASES).toContainEqual({
      id: '2026-07-23-tracker-accuracy',
      title: 'Tracker Accuracy & Combat Powers',
      date: '2026-07-23',
      sections: {
        added: ["A What's New dialog now summarizes each player-facing release."],
        changed: [
          'Arcana is now called Combat Powers, covering spellbooks, prayers, and special combat systems such as Dwarf Cannon.',
        ],
        fixed: [
          'Dragon Claws now list Chambers of Xeric instead of Tormented Demons.',
          'A Porcine of Interest and Enter the Abyss now check their required access routes.',
          'Quest and diary recommendations now respect unlocked skill-method caps as well as recorded levels.',
        ],
      },
    });
  });
});
