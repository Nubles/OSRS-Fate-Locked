// @ts-expect-error Node types are intentionally excluded from the browser app.
import { createHash } from 'node:crypto';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EQUIPMENT_CATALOGUE } from './equipmentCatalogue';

describe('release-pinned equipment source', () => {
  it('ships the complete, fingerprinted upstream snapshot', () => {
    const bytes = readFileSync(new URL(`../public/${EQUIPMENT_CATALOGUE.asset}`, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(EQUIPMENT_CATALOGUE.sha256);
    const items = JSON.parse(bytes.toString('utf8')) as { id: number; category: string }[];
    expect(items).toHaveLength(EQUIPMENT_CATALOGUE.itemCount);
    expect(new Set(items.map(item => item.id)).size).toBe(EQUIPMENT_CATALOGUE.itemCount);
    expect(items.find(item => item.id === 4151)?.category).toBe('Whip');
  });
});
