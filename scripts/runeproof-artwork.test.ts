import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import source from '../public/runeproof/sources.json';
import { GUIDE_PACKS } from '../features/runeproof/packs';

describe('RuneProof OSRS Wiki artwork', () => {
  it('bundles genuine PNG files matching the recorded Wiki source and checksum', () => {
    expect(source.images.length).toBeGreaterThanOrEqual(17);
    expect(new Set(source.images.map(entry => entry.id)).size).toBe(source.images.length);
    for (const entry of source.images) {
      expect(entry.url).toMatch(/^https:\/\/oldschool\.runescape\.wiki\/images\//);
      const bytes = readFileSync(`public/runeproof/${entry.id}.png`);
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16)).toBe(entry.width);
      expect(bytes.readUInt32BE(20)).toBe(entry.height);
      expect(entry.width).toBeGreaterThan(1);
      expect(entry.height).toBeGreaterThan(1);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    }
  });
  it('provides the actual item artwork for every supply in the published guides', () => {
    const ids = new Set(source.images.map(entry => entry.id));
    for (const pack of GUIDE_PACKS) for (const item of pack.items) expect(ids.has(item.id), `${pack.id}: ${item.id}`).toBe(true);
    expect(readFileSync('features/runeproof/RuneProofWorkspace.tsx', 'utf8')).not.toContain('lucide-react');
  });
});
