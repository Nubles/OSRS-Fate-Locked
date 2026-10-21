import { describe, it, expect } from 'vitest';
import {
  CURATED_RESOURCE_SOURCES,
  RESOURCE_MAP,
  enrichResourceSource,
  findCuratedSource,
  type ResourceSource,
} from './resourceData';
import { ENRICHED_SOURCES } from './resourceEnrichment';

// The lookup enrichResourceSource used before the index: a linear scan of the
// curated sources, first match wins.
const linearFind = (source: Pick<ResourceSource, 'name' | 'type'>) =>
  CURATED_RESOURCE_SOURCES.find(s => s.name.toLowerCase() === source.name.toLowerCase() && s.type === source.type && !s.inputs);

const flipCase = (name: string) =>
  [...name].map(ch => (ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase())).join('');

describe('curated source index', () => {
  it('matches the linear find for every curated source, in any letter case', () => {
    expect(CURATED_RESOURCE_SOURCES.length).toBeGreaterThan(1000);
    for (const source of CURATED_RESOURCE_SOURCES) {
      for (const name of [source.name, source.name.toUpperCase(), flipCase(source.name)]) {
        const probe = { name, type: source.type };
        // Same object, not just equal, so a spread copies the same fields.
        expect(findCuratedSource(probe)).toBe(linearFind(probe));
      }
    }
  });

  it('matches the linear find for every wiki source', () => {
    const wiki = Object.values(ENRICHED_SOURCES).flat();
    expect(wiki.length).toBeGreaterThan(1000);
    let matched = 0;
    for (const source of wiki) {
      const known = linearFind(source);
      if (known) matched++;
      expect(findCuratedSource(source)).toBe(known);
    }
    // The index is only worth pinning if it actually finds curated routes.
    expect(matched).toBeGreaterThan(0);
  });

  it('skips curated sources that need inputs and misses unknown names', () => {
    const withInputs = CURATED_RESOURCE_SOURCES.find(s => s.inputs && !linearFind(s));
    expect(withInputs).toBeDefined();
    expect(findCuratedSource(withInputs!)).toBeUndefined();
    expect(findCuratedSource({ name: 'No such source anywhere', type: 'DROP' })).toBeUndefined();
  });

  it('leaves RESOURCE_MAP exactly as the linear merge built it', () => {
    for (const [item, extra] of Object.entries(ENRICHED_SOURCES)) {
      const target = RESOURCE_MAP[item];
      if (!target) continue;
      const expected = extra.map(source => {
        const known = linearFind(source);
        return known ? { ...source, ...known, rarity: source.rarity, requirementsUnverified: true }
          : { ...source, requirementsUnverified: true };
      });
      expect(target.slice(target.length - extra.length)).toEqual(expected);
      expect(extra.map(enrichResourceSource)).toEqual(expected);
    }
  });
});
