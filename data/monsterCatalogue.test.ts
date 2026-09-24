// @ts-expect-error Node types are intentionally excluded from the browser app.
import { createHash } from 'node:crypto';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MONSTER_CATALOGUE } from './monsterCatalogue';

describe('release-pinned monster source', () => {
  it('ships every upstream row with matching SHA-256 and Git blob identity', () => {
    const bytes = readFileSync(new URL(`../public/${MONSTER_CATALOGUE.asset}`, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(MONSTER_CATALOGUE.sha256);
    expect(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')).toBe(MONSTER_CATALOGUE.sourceBlob);
    const monsters = JSON.parse(bytes.toString('utf8')) as { id: number; name: string; skills: { hp: number }; defensive: { light: number; standard: number; heavy: number } }[];
    expect(monsters).toHaveLength(MONSTER_CATALOGUE.rowCount);
    const graardor = monsters.find(m => m.id === 2215)!;
    expect(graardor.skills.hp).toBe(255);
    expect([graardor.defensive.light, graardor.defensive.standard, graardor.defensive.heavy]).toEqual([90, 90, 90]);
  });
});
