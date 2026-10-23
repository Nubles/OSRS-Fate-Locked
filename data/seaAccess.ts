/**
 * Chunked mode's sea: which land you sail from and to, and which land needs a
 * boat. utils/chunkWalkReach.ts reads it; data/seaAccess.test.ts pins it.
 */

/**
 * Sailing ports: every land chunk where the chunk content (public/chunk-content.json,
 * from the pinned Chunk Picker export) has a Port master. Most of them touch
 * no chunk of data/oceanChunks.json, which holds only chunks that are all
 * water (Catherby, Brimhaven, Port Khazard, Rellekka and Port Sarim's
 * church chunk among them), so they are named here. With Sailing, you set
 * sail from a port or any chunk next to the sea, and land on one.
 */
export const SAILING_PORT_CHUNKS: readonly string[] = [
  '22,46', // Aldarin
  '23,46', // Sunset Coast
  '23,53', // Land's End
  '27,49', // Civitas illa Fortis
  '28,57', // Port Piscarilius
  '29,51', // Port Roberts
  '30,43', // Deepfin Point
  '33,48', // Port Tyras
  '33,52', // Prifddinas
  '33,60', // Lunar Isle
  '36,58', // Neitiznot
  '37,59', // Jatizso
  '40,44', // Corsair Cove
  '40,60', // Etceteria
  '41,41', // Void Knights' Outpost
  '41,49', // Port Khazard
  '41,57', // Rellekka
  '43,39', // Red Rock
  '43,46', // Cairn Isle
  '43,50', // Brimhaven
  '43,53', // Catherby
  '46,49', // Port Sarim
  '47,46', // The Pandemonium
  '47,49', // Port Sarim
  '49,37', // The Summer Shore
  '49,44', // Ruins of Unkah
];

/**
 * Land you can only get onto by boat or by Sailing: every chunk of these
 * map regions and named areas. Before Sailing, Chunked mode never offers one
 * of their chunks across a step the walking data has no path for, as it
 * used to through bare grid adjacency (The Pandemonium from the Ship Yard,
 * Crandor from Rimmington, Ynysdail from Eagles' Peak).
 */
export const ISLAND_REGIONS: readonly string[] = ['The Open Seas', 'Islands & Others'];
export const ISLAND_AREAS: readonly string[] = [
  'Crandor', 'Dragontooth Island', 'Entrana', 'Harmony Island', 'Jatizso', 'Lunar Isle',
  'Miscellania & Etceteria', "Mos Le'Harmless", 'Neitiznot', "Pirates' Cove",
  "Void Knights' Outpost", 'Waterbirth Island',
];
