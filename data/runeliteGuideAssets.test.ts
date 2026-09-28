// @ts-expect-error Node types are intentionally excluded from the browser app.
import { createHash } from 'node:crypto';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readdirSync, readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RUNELITE_GUIDE_CHAPTERS,
  RUNELITE_GUIDE_SCREENSHOTS,
  type GuideScreenshotSource,
} from './runeliteGuide';

interface ScreenshotManifestEntry {
  readonly id: string;
  readonly filename: string;
  readonly chapter: string;
  readonly source: GuideScreenshotSource;
  /** The plugin build shown, for a render or a client capture. */
  readonly pluginCommit?: string;
  readonly runeliteVersion?: string;
  readonly capturedAt: string;
  readonly purpose: string;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
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
  readonly entries: readonly ScreenshotManifestEntry[];
}

const root = resolve('public/guides/runelite');
const readManifest = (): ScreenshotManifest =>
  JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));

describe('RuneLite guide screenshot assets', () => {
  it('records where every image comes from', () => {
    const manifest = readManifest();

    expect(manifest.version).toBe(2);
    for (const entry of manifest.entries) {
      expect(['rendered', 'client-capture', 'web-capture'], entry.id).toContain(entry.source);
      expect(entry.capturedAt, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (entry.source === 'web-capture') {
        expect(entry.pluginCommit, entry.id).toBeUndefined();
      } else {
        expect(entry.pluginCommit, entry.id).toMatch(/^[0-9a-f]{40}$/);
      }
      if (entry.source === 'rendered') {
        expect(entry.runeliteVersion, entry.id).toMatch(/^\d+\.\d+\.\d+$/);
        // Rendered from the golden bundles' fictional run: nothing to hide.
        expect(entry.redactions, entry.id).toEqual([]);
      }
    }
    const sources = Object.fromEntries(manifest.entries.map(entry => [entry.id, entry.source]));
    expect(sources['plugin-hub-install']).toBe('client-capture');
    expect(sources['companion-confirmation']).toBe('web-capture');
    expect(manifest.entries.filter(entry => entry.source === 'rendered')).toHaveLength(10);
  });

  it('matches every typed screenshot, its source, chapter and annotations', () => {
    const manifest = readManifest();

    expect(manifest.entries).toHaveLength(RUNELITE_GUIDE_SCREENSHOTS.length);
    for (const screenshot of RUNELITE_GUIDE_SCREENSHOTS) {
      const entry = manifest.entries.find(candidate => candidate.id === screenshot.id);

      expect(entry, screenshot.id).toBeTruthy();
      expect(entry!.filename).toBe(screenshot.src.split('/').at(-1));
      expect(entry!.source, screenshot.id).toBe(screenshot.source);
      const chapter = RUNELITE_GUIDE_CHAPTERS.find(candidate => candidate.id === entry!.chapter);
      expect(chapter?.screenshotIds, screenshot.id).toContain(screenshot.id);
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

  it('lists every image in the folder, and each file is the image it records', () => {
    const manifest = readManifest();
    const pngs = readdirSync(root).filter((name: string) => name.endsWith('.png')).sort();

    expect(pngs).toEqual(manifest.entries.map(entry => entry.filename).sort());
    for (const entry of manifest.entries) {
      const png = readFileSync(resolve(root, entry.filename));
      expect([...png.subarray(1, 4)], entry.id).toEqual([80, 78, 71]);
      expect(png.readUInt32BE(16), entry.id).toBe(entry.width);
      expect(png.readUInt32BE(20), entry.id).toBe(entry.height);
      expect(entry.width, entry.id).toBeGreaterThan(200);
      expect(entry.height, entry.id).toBeGreaterThan(150);
      expect(createHash('sha256').update(png).digest('hex'), entry.id).toBe(entry.sha256);
    }
  });
});
