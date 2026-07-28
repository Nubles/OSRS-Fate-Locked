// @ts-expect-error Node types are intentionally excluded from the browser app.
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
  readonly width: number;
  readonly height: number;
}

interface ScreenshotManifest {
  readonly version: number;
  readonly pluginCommit: string;
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
    expect(manifest.entries.map(entry => entry.id))
      .toEqual(expect.arrayContaining([...required]));
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
