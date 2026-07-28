// @ts-expect-error Node types are intentionally excluded from the browser app.
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RUNELITE_GUIDE_CHAPTER_IDS,
  RUNELITE_GUIDE_SCREENSHOTS,
} from './runeliteGuide';

const required = [
  'plugin-hub-install',
  'panel-disconnected',
  'companion-confirmation',
  'panel-connected',
  'unified-panel',
  'current-chunk',
  'guardian',
  'roll-inbox',
  'run-keys',
  'bundle-recovery',
  'warnings',
  'rendering',
  'world-map-tooltip',
  'scene-minimap-hud',
] as const;

interface ScreenshotManifestEntry {
  readonly id: string;
  readonly filename: string;
  readonly chapter: string;
  readonly purpose: string;
  readonly width: number;
  readonly height: number;
  readonly redactions: readonly string[];
  readonly annotations: readonly {
    readonly id: string;
    readonly marker: number;
    readonly x: number;
    readonly y: number;
  }[];
}

interface ScreenshotManifest {
  readonly version: number;
  readonly pluginCommit: string;
  readonly capturedAt: string;
  readonly runeliteVersion: string;
  readonly entries: readonly ScreenshotManifestEntry[];
}

const root = resolve('public/guides/runelite');
const readManifest = (): ScreenshotManifest =>
  JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));

describe('RuneLite guide screenshot assets', () => {
  it('records the exact live Plugin Hub source and every required capture', () => {
    const manifest = readManifest();

    expect(manifest.version).toBe(1);
    expect(manifest.pluginCommit)
      .toBe('1e118ec73f5a0fad17fc7b0704461a602d169041');
    expect(manifest.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(manifest.runeliteVersion).toBe('Not visible in source captures');
    expect(manifest.entries.map(entry => entry.id))
      .toEqual(expect.arrayContaining([...required]));
  });

  it('matches every typed screenshot, chapter, and normalized annotation', () => {
    const manifest = readManifest();

    expect(manifest.entries).toHaveLength(RUNELITE_GUIDE_SCREENSHOTS.length);
    for (const screenshot of RUNELITE_GUIDE_SCREENSHOTS) {
      const entry = manifest.entries.find(candidate => candidate.id === screenshot.id);

      expect(entry, screenshot.id).toBeTruthy();
      expect(entry!.filename).toBe(screenshot.src.split('/').at(-1));
      expect(RUNELITE_GUIDE_CHAPTER_IDS).toContain(entry!.chapter);
      expect(entry!.purpose.trim().length).toBeGreaterThan(20);
      expect(entry!.redactions.every(redaction => redaction.trim().length > 0)).toBe(true);
      expect(entry!.annotations).toEqual(
        screenshot.callouts.map(({ id, marker, x, y }) => ({ id, marker, x, y })),
      );
      for (const annotation of entry!.annotations) {
        expect(annotation.x).toBeGreaterThanOrEqual(0);
        expect(annotation.x).toBeLessThanOrEqual(1);
        expect(annotation.y).toBeGreaterThanOrEqual(0);
        expect(annotation.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it.each(required)('%s is a real non-empty PNG with recorded dimensions', (id) => {
    const entry = readManifest().entries.find(candidate => candidate.id === id);

    expect(entry).toBeTruthy();
    const path = resolve(root, entry!.filename);
    expect(existsSync(path)).toBe(true);
    const png = readFileSync(path);
    expect([...png.subarray(1, 4)]).toEqual([80, 78, 71]);
    expect(png.readUInt32BE(16)).toBe(entry!.width);
    expect(png.readUInt32BE(20)).toBe(entry!.height);
    expect(entry!.width).toBeGreaterThan(200);
    expect(entry!.height).toBeGreaterThan(150);
  });
});
