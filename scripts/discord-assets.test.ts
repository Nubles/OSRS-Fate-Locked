import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readText = (path: string) => readFileSync(resolve(root, path), 'utf8');
const pngSize = (path: string) => {
  const png = readFileSync(resolve(root, path));
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
};

describe('Discord brand assets', () => {
  it('uses the canonical local key files and tracker colours', () => {
    const icon = readText('docs/discord/assets/source/server-icon.html');
    const header = readText('docs/discord/assets/source/community-header.html');
    expect(icon).toContain('./crystal-key.png');
    expect(header).toContain('./crystal-key.png');
    expect(header).toContain('./enhanced-crystal-key.png');
    expect(header).toContain('./sinister-key.png');
    for (const token of ['#161616', '#2d2d2d', '#3e3e3e', '#fbbf24', '#d1d5db', '#8b5cf6']) {
      expect(`${icon}\n${header}`).toContain(token);
    }
  });

  it('renders upload-ready assets at their exact sizes', () => {
    expect(pngSize('docs/discord/assets/fate-locked-server-icon.png')).toEqual({ width: 512, height: 512 });
    expect(pngSize('docs/discord/assets/fate-locked-community-header.png')).toEqual({ width: 1920, height: 1080 });
    expect(pngSize('docs/discord/assets/fate-locked-future-server-banner.png')).toEqual({ width: 960, height: 540 });
  });
});
