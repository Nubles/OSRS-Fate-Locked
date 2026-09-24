/**
 * Release-pinned OSRS Wiki DPS-calculator equipment snapshot. Updating this
 * catalogue is a reviewed source-data change, never a browser-time main fetch.
 * Source: https://github.com/weirdgloop/osrs-dps-calc/blob/main/cdn/json/equipment.json
 * Item facts and images originate from https://oldschool.runescape.wiki/.
 */
export const EQUIPMENT_CATALOGUE = {
  asset: 'equipment-catalogue.294c0a5ab539ea503cb22f0fafe1cb4521049724.json',
  sourceBlob: '294c0a5ab539ea503cb22f0fafe1cb4521049724',
  sha256: '96022a4a1764cc9d7d3d0a73f9434563e5f727e7c7f85eb1a79ab791dd4d678d',
  capturedAt: '2026-09-23',
  itemCount: 5436,
  // Change when the normalized cache shape/units change, even with the same source.
  normalizationVersion: 1,
} as const;

export const EQUIPMENT_CACHE_SOURCE = `${EQUIPMENT_CATALOGUE.sha256}:${EQUIPMENT_CATALOGUE.normalizationVersion}`;

/** Additive v4 metadata; older plugins safely ignore it and use reviewed maps. */
export interface EquipmentPermissionCoverage {
  source: string | null;
  status: 'pinned' | 'legacy-cache' | 'unavailable';
  localItemCount: number;
  reviewedItemCount: number;
  estimatedItemCount: number;
}
