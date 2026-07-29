import { describe, expect, it } from 'vitest';
import {
  RUNELITE_GUIDE_CHAPTERS,
  RUNELITE_GUIDE_SETTINGS,
  RUNELITE_GUIDE_SCREENSHOTS,
  RUNELITE_PANEL_SECTIONS,
} from './runeliteGuide';

describe('RuneLite player guide authored content', () => {
  it('contains the approved 16 chapters and seven real panel sections', () => {
    expect(RUNELITE_GUIDE_CHAPTERS.map(chapter => chapter.id)).toEqual([
      'what-it-does',
      'install-plugin-hub',
      'connect-tracker',
      'connection-privacy',
      'unified-panel',
      'current-chunk',
      'guardian',
      'roll-inbox',
      'run-and-keys',
      'bundle-recovery',
      'warnings',
      'rendering',
      'in-game-overlays',
      'recommended-configurations',
      'troubleshooting',
      'glossary',
    ]);
    expect(RUNELITE_PANEL_SECTIONS).toEqual([
      'Current chunk',
      'Guardian',
      'Roll inbox',
      'Run',
      'Bundle',
      'Warnings',
      'Rendering',
    ]);
  });

  it('documents all 30 settings once and labels all three Keys exactly', () => {
    expect(RUNELITE_GUIDE_SETTINGS).toHaveLength(30);
    expect(new Set(RUNELITE_GUIDE_SETTINGS.map(setting => setting.key)).size).toBe(30);
    const guide = JSON.stringify(RUNELITE_GUIDE_CHAPTERS);
    expect(guide).toContain('Keys');
    expect(guide).toContain('Omni Keys');
    expect(guide).toContain('Chaos Keys');
  });

  it('keeps the privacy and Strict Mode truth in player copy', () => {
    const guide = JSON.stringify(RUNELITE_GUIDE_CHAPTERS);
    expect(guide).toContain('does not upload gameplay data');
    expect(guide).toContain('IP address');
    expect(guide).toContain('off by default');
    expect(guide).toContain('fails open');
    expect(guide).toContain('60 seconds');
  });

  it('references only authentic screenshot IDs', () => {
    const ids = new Set(RUNELITE_GUIDE_SCREENSHOTS.map(image => image.id));
    for (const chapter of RUNELITE_GUIDE_CHAPTERS) {
      for (const id of chapter.screenshotIds) expect(ids.has(id)).toBe(true);
    }
  });
});
