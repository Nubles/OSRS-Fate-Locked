import { describe, expect, it } from 'vitest';
import { MISTHALIN_AREAS, REGION_GROUPS } from '../constants';
import { AREA_ALIAS_POLICIES, canonicalAreaName } from './areaMapPolicy';
import { REGION_CHUNKS } from './regionChunks';
import { RUNE_PROOF_CANONICAL_AREA_IDS } from './runeProofCanonicalAreas';
import { SUB_AREA_CHUNKS } from './subAreaChunks';

describe('RuneProof canonical named areas', () => {
  it('contains every canonical reachability name accepted by repository data', () => {
    const actual = new Set(RUNE_PROOF_CANONICAL_AREA_IDS);
    const repositoryNames = [
      'Misthalin',
      ...MISTHALIN_AREAS,
      ...Object.keys(REGION_GROUPS),
      ...Object.values(REGION_GROUPS).flat(),
      ...Object.keys(REGION_CHUNKS),
      ...Object.keys(SUB_AREA_CHUNKS),
      ...Object.values(AREA_ALIAS_POLICIES).map(policy => policy.canonical),
    ];

    for (const name of repositoryNames) {
      expect(actual.has(canonicalAreaName(name)), name).toBe(true);
    }
  });

  it('normalizes every alias to a registry member', () => {
    const actual = new Set(RUNE_PROOF_CANONICAL_AREA_IDS);
    for (const alias of Object.keys(AREA_ALIAS_POLICIES)) {
      expect(actual.has(canonicalAreaName(alias)), alias).toBe(true);
    }
  });

  it('keeps generic-pack areas that no current QuestData preflight needs', () => {
    expect(RUNE_PROOF_CANONICAL_AREA_IDS).toContain('Sunset Coast');
  });

  it('is frozen, sorted, and de-duplicated', () => {
    expect(Object.isFrozen(RUNE_PROOF_CANONICAL_AREA_IDS)).toBe(true);
    expect(RUNE_PROOF_CANONICAL_AREA_IDS).toEqual(
      [...new Set(RUNE_PROOF_CANONICAL_AREA_IDS)].sort(),
    );
  });
});
