import { describe, expect, it } from 'vitest';
import {
  RUNELITE_GUIDE_CHAPTERS,
  RUNELITE_GUIDE_CHAPTER_IDS,
  RUNELITE_GUIDE_SCREENSHOTS,
} from './runeliteGuide';
import { RUNELITE_SETTING_SECTIONS, RUNELITE_TERMS } from './runeliteWording';

describe('RuneLite player guide authored content', () => {
  it('has its 16 chapters, numbered in order and following the sidebar', () => {
    expect(RUNELITE_GUIDE_CHAPTER_IDS).toEqual([
      'what-it-does',
      'install-plugin-hub',
      'connect-tracker',
      'connection-privacy',
      'sidebar',
      'here',
      'strict-mode',
      'roll-inbox',
      'run-and-keys',
      'connection-and-backup',
      'settings',
      'alerts',
      'in-game-display',
      'recommended-configurations',
      'troubleshooting',
      'glossary',
    ]);
    expect(RUNELITE_GUIDE_CHAPTERS.map(chapter => chapter.id)).toEqual([...RUNELITE_GUIDE_CHAPTER_IDS]);
    expect(RUNELITE_GUIDE_CHAPTERS.map(chapter => chapter.number))
      .toEqual(RUNELITE_GUIDE_CHAPTERS.map((_, index) => index + 1));
  });

  it('lists each settings section in exactly one chapter', () => {
    const listed = RUNELITE_GUIDE_CHAPTERS.flatMap(chapter => chapter.settingsSections ?? []);
    expect([...listed].sort()).toEqual([...RUNELITE_SETTING_SECTIONS].sort());
  });

  it('names the three Keys and Fate Points as the plugin does', () => {
    const guide = JSON.stringify(RUNELITE_GUIDE_CHAPTERS);
    for (const term of [RUNELITE_TERMS.KEYS, RUNELITE_TERMS.OMNI_KEYS, RUNELITE_TERMS.CHAOS_KEYS,
      RUNELITE_TERMS.FATE_POINTS]) {
      expect(guide).toContain(term);
    }
  });

  it('keeps the privacy and Strict Mode truth in player copy', () => {
    const guide = JSON.stringify(RUNELITE_GUIDE_CHAPTERS);
    expect(guide).toContain('does not upload gameplay data');
    expect(guide).toContain('IP address');
    expect(guide).toContain('off by default');
    expect(guide).toContain('fails open');
    expect(guide).toContain('60 seconds');
  });

  it('references only real screenshot ids', () => {
    const ids = new Set(RUNELITE_GUIDE_SCREENSHOTS.map(image => image.id));
    for (const chapter of RUNELITE_GUIDE_CHAPTERS) {
      for (const id of chapter.screenshotIds) expect(ids.has(id)).toBe(true);
    }
  });
});
