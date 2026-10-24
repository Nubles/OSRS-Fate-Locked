import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeRgbaPng, deepenChannel, deepenModelColours, encodeRgbaPng, isDeepened, modelFiles } from './model-colours.mjs';

const PNG_URI = 'data:image/png;base64,';

describe('model colours', () => {
  it('moves each channel from the brightest setting to the darker one, keeping black and white', () => {
    expect(deepenChannel(0)).toBe(0);
    expect(deepenChannel(255)).toBe(255);
    expect(deepenChannel(139)).toBe(114);
  });

  it('re-grades a palette once, and only its colours', () => {
    const pixels = Buffer.from([139, 29, 17, 255, 251, 220, 32, 128]);
    const gltf = JSON.stringify({ images: [{ uri: PNG_URI + encodeRgbaPng({ width: 2, height: 1, pixels }).toString('base64') }], asset: { version: '2.0' } });
    const once = deepenModelColours(gltf);
    expect(isDeepened(once)).toBe(true);
    expect(deepenModelColours(once)).toBe(once);
    const png = decodeRgbaPng(Buffer.from(JSON.parse(once).images[0].uri.slice(PNG_URI.length), 'base64'));
    expect([...png.pixels]).toEqual([...[139, 29, 17].map(deepenChannel), 255, ...[251, 220, 32].map(deepenChannel), 128]);
    expect(JSON.parse(once).asset.version).toBe('2.0');
  });

  it('every model in public/models has its deepened colours', () => {
    const stale = modelFiles().filter((f) => !isDeepened(readFileSync(f, 'utf8')));
    expect(stale.map((f) => path.basename(f)), 'run: node scripts/model-colours.mjs').toEqual([]);
  });
});
