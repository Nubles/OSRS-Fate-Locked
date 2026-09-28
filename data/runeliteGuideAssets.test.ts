// @ts-expect-error Node types are intentionally excluded from the browser app.
import { createHash } from 'node:crypto';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readdirSync, readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUNELITE_GUIDE_FIGURES, type GuideBox, type GuideFigureSource } from './runeliteGuide';

interface PictureManifestEntry {
  readonly id: string;
  readonly filename: string;
  readonly source: GuideFigureSource;
  /** The plugin commit that drew it, for a rendered picture. */
  readonly pluginCommit?: string;
  readonly runeliteVersion?: string;
  readonly capturedAt: string;
  readonly purpose: string;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly sha256: string;
  readonly redactions: readonly string[];
  readonly annotations: readonly {
    readonly id: string;
    readonly marker: number;
    readonly box: GuideBox;
  }[];
}

interface PictureManifest {
  readonly version: number;
  readonly entries: readonly PictureManifestEntry[];
}

const root = resolve('public/guides/runelite');
const readManifest = (): PictureManifest =>
  JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));

describe('RuneLite guide pictures on disk', () => {
  it('records where every picture comes from', () => {
    const manifest = readManifest();

    expect(manifest.version).toBe(3);
    for (const entry of manifest.entries) {
      expect(['rendered', 'web-capture'], entry.id).toContain(entry.source);
      expect(entry.capturedAt, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.purpose.trim().length, entry.id).toBeGreaterThan(20);
      expect(entry.redactions.every(redaction => redaction.trim().length > 0), entry.id).toBe(true);
      if (entry.source === 'rendered') {
        expect(entry.pluginCommit, entry.id).toMatch(/^[0-9a-f]{40}$/);
        expect(entry.runeliteVersion, entry.id).toMatch(/^\d+\.\d+\.\d+$/);
        // Drawn from the golden bundles' fictional run: nothing to hide.
        expect(entry.redactions, entry.id).toEqual([]);
      } else {
        expect(entry.pluginCommit, entry.id).toBeUndefined();
      }
    }
  });

  it('matches every picture the guide shows: size, detail and notes', () => {
    const manifest = readManifest();

    expect(manifest.entries.map(entry => entry.id)).toEqual(RUNELITE_GUIDE_FIGURES.map(figure => figure.id));
    for (const figure of RUNELITE_GUIDE_FIGURES) {
      const entry = manifest.entries.find(candidate => candidate.id === figure.id)!;
      expect(entry.filename, figure.id).toBe(figure.src.split('/').at(-1));
      expect(entry.source, figure.id).toBe(figure.source);
      expect([entry.width, entry.height, entry.scale], figure.id).toEqual([figure.width, figure.height, figure.scale]);
      expect(entry.annotations, figure.id).toEqual(
        figure.callouts.map(({ id, marker, box }) => ({ id, marker, box })),
      );
    }
  });

  it('holds every picture it lists, and nothing else, each the file it records', () => {
    const manifest = readManifest();
    const pngs = readdirSync(root).filter((name: string) => name.endsWith('.png')).sort();

    expect(pngs).toEqual(manifest.entries.map(entry => entry.filename).sort());
    for (const entry of manifest.entries) {
      const png = readFileSync(resolve(root, entry.filename));
      expect([...png.subarray(1, 4)], entry.id).toEqual([80, 78, 71]);
      expect(png.readUInt32BE(16), entry.id).toBe(entry.width);
      expect(png.readUInt32BE(20), entry.id).toBe(entry.height);
      expect(createHash('sha256').update(png).digest('hex'), entry.id).toBe(entry.sha256);
    }
  });
});
