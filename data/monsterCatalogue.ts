/** Release-pinned OSRS Wiki DPS-calculator targets; refresh as a reviewed data change. */
export const MONSTER_CATALOGUE = {
  asset: 'monster-catalogue.5eb1ea8c755d41a4ccfbf284feee30472e416463.json',
  sourceBlob: '5eb1ea8c755d41a4ccfbf284feee30472e416463',
  sourceUrl: 'https://github.com/weirdgloop/osrs-dps-calc/blob/main/cdn/json/monsters.json',
  sha256: '40b6bae96c49227fcb4ae07cc97fa62d704cdd3b160f61e335b91e8ba0485c34',
  capturedAt: '2026-11-24',
  verifiedAt: '2026-11-24',
  rowCount: 2927,
  // Increment if normalized fields, units, or selection semantics change.
  normalizationVersion: 5,
} as const;

export const MONSTER_CACHE_SOURCE = `${MONSTER_CATALOGUE.sha256}:${MONSTER_CATALOGUE.normalizationVersion}`;
