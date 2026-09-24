/** Release-pinned OSRS Wiki DPS-calculator targets; refresh as a reviewed data change. */
export const MONSTER_CATALOGUE = {
  asset: 'monster-catalogue.c9f6dafdb70c20751d171fbc4f5b5d1701117c47.json',
  sourceBlob: 'c9f6dafdb70c20751d171fbc4f5b5d1701117c47',
  sourceUrl: 'https://github.com/weirdgloop/osrs-dps-calc/blob/main/cdn/json/monsters.json',
  sha256: 'ec38284c4651cf76a568b5e95cd11cc942e2077d901d20041f770e56460dbca2',
  capturedAt: '2026-09-22',
  verifiedAt: '2026-09-24',
  rowCount: 2860,
  // Increment if normalized fields, units, or selection semantics change.
  normalizationVersion: 2,
} as const;

export const MONSTER_CACHE_SOURCE = `${MONSTER_CATALOGUE.sha256}:${MONSTER_CATALOGUE.normalizationVersion}`;
