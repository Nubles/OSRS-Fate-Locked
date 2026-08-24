import { MISTHALIN_AREAS, REGION_GROUPS } from '../constants';
import { AREA_ALIAS_POLICIES, canonicalAreaName } from './areaMapPolicy';
import { REGION_CHUNKS } from './regionChunks';
import { SUB_AREA_CHUNKS } from './subAreaChunks';

const canonicalAreaIds = new Set([
  'Misthalin',
  ...MISTHALIN_AREAS,
  ...Object.keys(REGION_GROUPS),
  ...Object.values(REGION_GROUPS).flat(),
  ...Object.keys(REGION_CHUNKS),
  ...Object.keys(SUB_AREA_CHUNKS),
  ...Object.values(AREA_ALIAS_POLICIES).map(policy => policy.canonical),
].map(canonicalAreaName));

export const RUNE_PROOF_CANONICAL_AREA_IDS: readonly string[] = Object.freeze(
  [...canonicalAreaIds].sort(),
);
