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
    expect(LATEST_CHANGELOG.id).toBe('2026-07-29-runeproof');
  });
  it('announces RuneProof without promising future planning or possession tracking', () => {
    const runeProof = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-29-runeproof',
    );
    const wording = Object.values(runeProof?.sections ?? {})
      .flatMap(lines => lines ?? [])
      .map(note => typeof note === 'string' ? note : note.text)
      .join(' ');

    expect(runeProof).toMatchObject({
      title: 'RuneProof Current-Chunk Goal Engine',
      date: '2026-07-29',
    });
    expect(wording).toMatch(/exactly reachable chunks/i);
    expect(wording).toMatch(/without recommending future unlocks/i);
    expect(wording).not.toMatch(/inventory|bank contents|owns|automate gameplay/i);
  });

  it('announces the native RuneLite guide visual refresh', () => {
    const nativeTheme = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-runelite-guide-native-theme',
    );
    expect(nativeTheme).toMatchObject({
      id: '2026-07-28-runelite-guide-native-theme',
      title: 'RuneLite Guide Visual Refresh',
      date: '2026-07-28',
    });
    expect(nativeTheme?.sections.changed).toContain(
      'The RuneLite Plugin Guide now uses the same compact panels, navigation, typography, and amber control styling as the Fate Locked companion while preserving every chapter, setting, and authentic screenshot.',
    );
  });

  it('announces the complete player-facing RuneLite guide', () => {
    const completeGuide = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-runelite-guide',
    );
    expect(completeGuide).toMatchObject({
      id: '2026-07-28-runelite-guide',
      title: 'RuneLite Plugin Guide',
      date: '2026-07-28',
    });
    expect(completeGuide?.sections.added).toContain(
      'A complete RuneLite Plugin Guide now covers installation, connection, every panel section and setting, overlays, privacy, recommended configurations, and troubleshooting with annotated screenshots from the live plugin.',
    );
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

  it('announces the quest location display fix in player language', () => {
    const questChunkAudit = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-quest-chunk-audit',
    );

    expect(questChunkAudit?.sections.fixed).toContain(
      'Quest cards now show exact required chunks once and separate incomplete Chunk Picker evidence under Known steps.',
    );
  });

  it('describes the complete RuneLite companion update in player language', () => {
    const runeliteCompanion = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-runelite-companion-update',
    );
    expect(runeliteCompanion).toMatchObject({
      id: '2026-07-28-runelite-companion-update',
      title: 'RuneLite Companion Update',
      date: '2026-07-28',
    });
    expect(runeliteCompanion?.sections.added).toContain(
      'Connect the companion to RuneLite with one guided, copyable pairing command.',
    );
    expect(runeliteCompanion?.sections.changed).toEqual(expect.arrayContaining([
      'RuneLite reads your app-authored run rules while detected gameplay events remain local to RuneLite.',
      'The complete RuneLite experience now lives in one panel with collapsible sections.',
    ]));
    expect(runeliteCompanion?.sections.changed).toContainEqual({
      text: 'The RuneLite Plugin Hub update has been approved and is now live. View the merged',
      link: {
        label: 'Plugin Hub PR #14395',
        href: 'https://github.com/runelite/plugin-hub/pull/14395',
      },
    });
    expect(runeliteCompanion?.sections.fixed).toEqual(expect.arrayContaining([
      'RuneLite controls no longer appear clipped or overlap adjacent colour settings.',
      'Run balances are now labelled Keys, Omni Keys, and Chaos Keys.',
    ]));
  });

  it('describes the Tirannwn area migration in player language', () => {
    const tirannwnAccuracy = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-tirannwn-area-accuracy',
    );

    expect(tirannwnAccuracy).toMatchObject({
      id: '2026-07-28-tirannwn-area-accuracy',
      title: 'Tirannwn Area Accuracy',
      date: '2026-07-28',
    });
    expect(tirannwnAccuracy?.sections.changed).toContain(
      'Elf Camp is now treated as Iorwerth Camp everywhere and no longer appears in new area rolls.',
    );
    expect(tirannwnAccuracy?.sections.fixed).toEqual(expect.arrayContaining([
      'Existing saves with both camp names now keep one unlock and receive one regular Key refund.',
      'Tirannwn completion totals and RuneLite exports now use the canonical Iorwerth Camp unlock.',
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
