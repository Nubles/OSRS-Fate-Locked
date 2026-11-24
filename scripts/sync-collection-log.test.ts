import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { assertWikiCoverage } from './sync-collection-log.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));

describe('the collection log sync refuses Wiki data that is empty or cut short', () => {
  const pages = (count: number, perPage: number) => Object.fromEntries(
    Array.from({ length: count }, (_, page) => [`Page ${page}`, Array.from({ length: perPage }, (_, item) => `Item ${page}-${item}`)]),
  );

  it('fails when the Wiki data yields no pages', () => {
    expect(() => assertWikiCoverage({}, 1944)).toThrow(/0 pages and 0 items.*1944 items in the app/);
  });

  it('fails when the Wiki data holds far fewer items than the app', () => {
    expect(() => assertWikiCoverage(pages(10, 20), 1944)).toThrow(/10 pages and 200 items.*1944 items in the app/);
  });

  it('lets a normal week through, including one where the Wiki dropped a few slots', () => {
    // 22 Nov 2026: the Wiki listed 125 pages and 1944 slots, as the app does.
    expect(() => assertWikiCoverage(pages(125, 16), 1944)).not.toThrow();
    expect(() => assertWikiCoverage(pages(120, 16), 1944)).not.toThrow();
  });

  it('checks before it prints or writes anything', () => {
    const script = readFileSync(resolve(HERE, 'sync-collection-log.mjs'), 'utf8');
    const body = script.slice(script.indexOf('const run = async'));
    const check = body.indexOf('assertWikiCoverage(wikiPages,');
    expect(check).toBeGreaterThan(0);
    for (const effect of ['console.log(', 'writeFileSync(']) expect(body.indexOf(effect)).toBeGreaterThan(check);
  });
});
