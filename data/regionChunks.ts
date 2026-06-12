import type { ChunkCoord } from '../utils/mapCoords';

// Per-region chunk assignments used to colour the world map.
// Source of truth: the One Chunk Man "Chunk Picker" (source-chunk/chunk-picker-v2,
// gh-pages — chunkpicker-chunkinfo-export.json). Each canonical OSRS region ID is
// converted to our chunk coords (cx = id >> 8, cy = id & 255 — i.e. regionX,
// regionY), so they line up 1:1 with our calibrated map (see utils/mapCoords.ts).
//  - Mainlands: the picker's `rollingChunks` kingdom grouping (border chunks
//    shared by two kingdoms assigned once, by a fixed priority). Islands the
//    picker counts as part of a kingdom (Lunar Isle -> Fremennik, Crandor ->
//    Karamja, Mos Le'Harmless -> Morytania, Void Knights' Outpost -> Asgarnia,
//    Feldip Hills -> Kandarin, ...) are included.
//  - Islands & Others: Fossil Island + Ape Atoll, which the picker buckets into a
//    mainland by access route -> moved here to match our region model.
//  - The Open Seas: Sailing islands, found by matching each island name against
//    the picker's per-chunk content and keeping only offshore chunks.
// A few access-only anomalies (e.g. the Isle of Souls block the picker files under
// Misthalin) are dropped. Refine any of this with the authoring tool, then Export.
// Exported for utils/chunkLocations (entity location lookups app-wide).
export const REGION_CHUNKS: Record<string, ChunkCoord[]> = {
  'Asgarnia': [
    { cx: 41, cy: 40 }, { cx: 41, cy: 41 }, { cx: 46, cy: 48 }, { cx: 47, cy: 49 }, { cx: 45, cy: 50 }, { cx: 46, cy: 50 }, { cx: 45, cy: 51 }, { cx: 46, cy: 51 },
    { cx: 43, cy: 52 }, { cx: 44, cy: 52 }, { cx: 45, cy: 52 }, { cx: 46, cy: 52 }, { cx: 44, cy: 53 }, { cx: 45, cy: 53 }, { cx: 46, cy: 53 }, { cx: 43, cy: 54 },
    { cx: 44, cy: 54 }, { cx: 45, cy: 54 }, { cx: 46, cy: 54 }, { cx: 43, cy: 55 }, { cx: 44, cy: 55 }, { cx: 45, cy: 55 }, { cx: 46, cy: 55 }, { cx: 44, cy: 56 },
    { cx: 45, cy: 56 }, { cx: 44, cy: 57 }, { cx: 45, cy: 57 }, { cx: 45, cy: 58 },
  ],
  'Fremennik': [
    { cx: 40, cy: 56 }, { cx: 40, cy: 57 }, { cx: 41, cy: 57 }, { cx: 42, cy: 57 }, { cx: 43, cy: 57 }, { cx: 39, cy: 58 }, { cx: 41, cy: 58 }, { cx: 42, cy: 58 },
    { cx: 43, cy: 58 }, { cx: 44, cy: 58 }, { cx: 34, cy: 59 }, { cx: 36, cy: 59 }, { cx: 37, cy: 59 }, { cx: 39, cy: 59 }, { cx: 42, cy: 59 }, { cx: 43, cy: 59 },
    { cx: 44, cy: 59 }, { cx: 45, cy: 59 }, { cx: 32, cy: 60 }, { cx: 33, cy: 60 }, { cx: 36, cy: 60 }, { cx: 37, cy: 60 }, { cx: 39, cy: 60 }, { cx: 40, cy: 60 },
    { cx: 41, cy: 60 }, { cx: 43, cy: 60 }, { cx: 44, cy: 60 }, { cx: 32, cy: 61 }, { cx: 33, cy: 61 }, { cx: 44, cy: 61 }, { cx: 45, cy: 61 }, { cx: 38, cy: 62 },
    { cx: 41, cy: 62 }, { cx: 44, cy: 62 }, { cx: 35, cy: 63 }, { cx: 41, cy: 63 },
    { cx: 36, cy: 58 },
  ],
  'Kandarin': [
    { cx: 38, cy: 44 }, { cx: 39, cy: 44 }, { cx: 40, cy: 44 }, { cx: 38, cy: 45 }, { cx: 39, cy: 45 }, { cx: 40, cy: 45 }, { cx: 38, cy: 46 }, { cx: 39, cy: 46 },
    { cx: 40, cy: 46 }, { cx: 41, cy: 46 }, { cx: 36, cy: 47 }, { cx: 37, cy: 47 }, { cx: 38, cy: 47 }, { cx: 39, cy: 47 }, { cx: 40, cy: 47 }, { cx: 41, cy: 47 },
    { cx: 36, cy: 48 }, { cx: 37, cy: 48 }, { cx: 38, cy: 48 }, { cx: 39, cy: 48 }, { cx: 40, cy: 48 }, { cx: 41, cy: 48 }, { cx: 37, cy: 49 }, { cx: 38, cy: 49 },
    { cx: 39, cy: 49 }, { cx: 40, cy: 49 }, { cx: 41, cy: 49 }, { cx: 38, cy: 50 }, { cx: 39, cy: 50 }, { cx: 40, cy: 50 }, { cx: 41, cy: 50 }, { cx: 38, cy: 51 },
    { cx: 39, cy: 51 }, { cx: 40, cy: 51 }, { cx: 41, cy: 51 }, { cx: 42, cy: 51 }, { cx: 36, cy: 52 }, { cx: 37, cy: 52 }, { cx: 38, cy: 52 }, { cx: 39, cy: 52 },
    { cx: 40, cy: 52 }, { cx: 41, cy: 52 }, { cx: 42, cy: 52 }, { cx: 36, cy: 53 }, { cx: 37, cy: 53 }, { cx: 38, cy: 53 }, { cx: 39, cy: 53 }, { cx: 40, cy: 53 },
    { cx: 41, cy: 53 }, { cx: 42, cy: 53 }, { cx: 43, cy: 53 }, { cx: 35, cy: 54 }, { cx: 36, cy: 54 }, { cx: 37, cy: 54 }, { cx: 38, cy: 54 }, { cx: 39, cy: 54 },
    { cx: 40, cy: 54 }, { cx: 41, cy: 54 }, { cx: 42, cy: 54 }, { cx: 35, cy: 55 }, { cx: 36, cy: 55 }, { cx: 37, cy: 55 }, { cx: 38, cy: 55 }, { cx: 39, cy: 55 },
    { cx: 41, cy: 55 }, { cx: 42, cy: 55 }, { cx: 35, cy: 56 }, { cx: 36, cy: 56 }, { cx: 37, cy: 56 }, { cx: 39, cy: 56 }, { cx: 41, cy: 56 }, { cx: 42, cy: 56 },
    { cx: 43, cy: 56 }, { cx: 36, cy: 57 },
  ],
  'Karamja': [
    { cx: 43, cy: 45 }, { cx: 44, cy: 45 }, { cx: 45, cy: 45 }, { cx: 46, cy: 45 }, { cx: 43, cy: 46 }, { cx: 44, cy: 46 }, { cx: 45, cy: 46 }, { cx: 46, cy: 46 },
    { cx: 43, cy: 47 }, { cx: 44, cy: 47 }, { cx: 45, cy: 47 }, { cx: 46, cy: 47 }, { cx: 43, cy: 48 }, { cx: 44, cy: 48 }, { cx: 45, cy: 48 }, { cx: 42, cy: 49 },
    { cx: 43, cy: 49 }, { cx: 44, cy: 49 }, { cx: 45, cy: 49 }, { cx: 46, cy: 49 }, { cx: 42, cy: 50 }, { cx: 43, cy: 50 }, { cx: 44, cy: 50 }, { cx: 43, cy: 51 },
    { cx: 44, cy: 51 },
    { cx: 42, cy: 46 },
  ],
  'Kharidian Desert': [
    { cx: 51, cy: 42 }, { cx: 52, cy: 42 }, { cx: 49, cy: 43 }, { cx: 50, cy: 43 }, { cx: 51, cy: 43 }, { cx: 52, cy: 43 }, { cx: 53, cy: 43 }, { cx: 47, cy: 44 },
    { cx: 48, cy: 44 }, { cx: 49, cy: 44 }, { cx: 50, cy: 44 }, { cx: 51, cy: 44 }, { cx: 52, cy: 44 }, { cx: 53, cy: 44 }, { cx: 49, cy: 45 }, { cx: 50, cy: 45 },
    { cx: 51, cy: 45 }, { cx: 52, cy: 45 }, { cx: 53, cy: 45 }, { cx: 54, cy: 45 }, { cx: 49, cy: 46 }, { cx: 50, cy: 46 }, { cx: 51, cy: 46 }, { cx: 52, cy: 46 },
    { cx: 53, cy: 46 }, { cx: 54, cy: 46 }, { cx: 49, cy: 47 }, { cx: 50, cy: 47 }, { cx: 51, cy: 47 }, { cx: 52, cy: 47 }, { cx: 53, cy: 47 }, { cx: 54, cy: 47 },
    { cx: 50, cy: 48 }, { cx: 51, cy: 48 }, { cx: 52, cy: 48 }, { cx: 53, cy: 48 }, { cx: 54, cy: 48 }, { cx: 51, cy: 49 }, { cx: 52, cy: 49 }, { cx: 53, cy: 49 },
    { cx: 54, cy: 49 }, { cx: 52, cy: 50 }, { cx: 53, cy: 50 }, { cx: 52, cy: 51 }, { cx: 53, cy: 51 },
  ],
  'Kourend & Kebos': [
    { cx: 17, cy: 51 }, { cx: 18, cy: 51 }, { cx: 17, cy: 52 }, { cx: 18, cy: 52 }, { cx: 19, cy: 52 }, { cx: 17, cy: 53 }, { cx: 18, cy: 53 }, { cx: 19, cy: 53 },
    { cx: 23, cy: 53 }, { cx: 24, cy: 53 }, { cx: 25, cy: 53 }, { cx: 27, cy: 53 }, { cx: 28, cy: 53 }, { cx: 18, cy: 54 }, { cx: 19, cy: 54 }, { cx: 20, cy: 54 },
    { cx: 21, cy: 54 }, { cx: 22, cy: 54 }, { cx: 23, cy: 54 }, { cx: 24, cy: 54 }, { cx: 25, cy: 54 }, { cx: 26, cy: 54 }, { cx: 27, cy: 54 }, { cx: 28, cy: 54 },
    { cx: 29, cy: 54 }, { cx: 18, cy: 55 }, { cx: 19, cy: 55 }, { cx: 20, cy: 55 }, { cx: 21, cy: 55 }, { cx: 22, cy: 55 }, { cx: 23, cy: 55 }, { cx: 24, cy: 55 },
    { cx: 25, cy: 55 }, { cx: 26, cy: 55 }, { cx: 27, cy: 55 }, { cx: 28, cy: 55 }, { cx: 29, cy: 55 }, { cx: 18, cy: 56 }, { cx: 19, cy: 56 }, { cx: 20, cy: 56 },
    { cx: 21, cy: 56 }, { cx: 22, cy: 56 }, { cx: 23, cy: 56 }, { cx: 24, cy: 56 }, { cx: 25, cy: 56 }, { cx: 26, cy: 56 }, { cx: 27, cy: 56 }, { cx: 28, cy: 56 },
    { cx: 18, cy: 57 }, { cx: 19, cy: 57 }, { cx: 20, cy: 57 }, { cx: 21, cy: 57 }, { cx: 22, cy: 57 }, { cx: 23, cy: 57 }, { cx: 24, cy: 57 }, { cx: 25, cy: 57 },
    { cx: 26, cy: 57 }, { cx: 27, cy: 57 }, { cx: 28, cy: 57 }, { cx: 18, cy: 58 }, { cx: 19, cy: 58 }, { cx: 20, cy: 58 }, { cx: 21, cy: 58 }, { cx: 22, cy: 58 },
    { cx: 23, cy: 58 }, { cx: 24, cy: 58 }, { cx: 25, cy: 58 }, { cx: 26, cy: 58 }, { cx: 27, cy: 58 }, { cx: 28, cy: 58 }, { cx: 18, cy: 59 }, { cx: 19, cy: 59 },
    { cx: 20, cy: 59 }, { cx: 21, cy: 59 }, { cx: 22, cy: 59 }, { cx: 23, cy: 59 }, { cx: 24, cy: 59 }, { cx: 25, cy: 59 }, { cx: 26, cy: 59 }, { cx: 27, cy: 59 },
    { cx: 28, cy: 59 }, { cx: 20, cy: 60 }, { cx: 22, cy: 60 }, { cx: 23, cy: 60 }, { cx: 24, cy: 60 }, { cx: 25, cy: 60 }, { cx: 26, cy: 60 }, { cx: 27, cy: 60 },
    { cx: 28, cy: 60 }, { cx: 23, cy: 61 }, { cx: 24, cy: 61 }, { cx: 25, cy: 61 }, { cx: 26, cy: 61 }, { cx: 27, cy: 61 }, { cx: 25, cy: 62 },
    { cx: 26, cy: 53 },
  ],
  'Misthalin': [
    { cx: 48, cy: 49 }, { cx: 49, cy: 49 }, { cx: 50, cy: 49 }, { cx: 47, cy: 50 }, { cx: 48, cy: 50 }, { cx: 49, cy: 50 }, { cx: 50, cy: 50 }, { cx: 51, cy: 50 },
    { cx: 47, cy: 51 }, { cx: 48, cy: 51 }, { cx: 49, cy: 51 }, { cx: 50, cy: 51 }, { cx: 51, cy: 51 }, { cx: 47, cy: 52 }, { cx: 48, cy: 52 }, { cx: 49, cy: 52 },
    { cx: 50, cy: 52 }, { cx: 51, cy: 52 }, { cx: 52, cy: 52 }, { cx: 53, cy: 52 }, { cx: 47, cy: 53 }, { cx: 48, cy: 53 }, { cx: 49, cy: 53 }, { cx: 50, cy: 53 },
    { cx: 51, cy: 53 }, { cx: 52, cy: 53 }, { cx: 53, cy: 53 }, { cx: 47, cy: 54 }, { cx: 48, cy: 54 }, { cx: 49, cy: 54 }, { cx: 50, cy: 54 }, { cx: 51, cy: 54 },
    { cx: 52, cy: 54 }, { cx: 53, cy: 54 }, { cx: 47, cy: 55 }, { cx: 48, cy: 55 }, { cx: 49, cy: 55 }, { cx: 50, cy: 55 }, { cx: 51, cy: 55 }, { cx: 52, cy: 55 },
  ],
  'Morytania': [
    { cx: 59, cy: 44 }, { cx: 57, cy: 45 }, { cx: 57, cy: 46 }, { cx: 58, cy: 46 }, { cx: 59, cy: 46 }, { cx: 60, cy: 46 }, { cx: 57, cy: 47 }, { cx: 58, cy: 47 },
    { cx: 59, cy: 47 }, { cx: 60, cy: 47 }, { cx: 55, cy: 49 }, { cx: 56, cy: 49 }, { cx: 57, cy: 49 }, { cx: 54, cy: 50 }, { cx: 55, cy: 50 }, { cx: 56, cy: 50 },
    { cx: 57, cy: 50 }, { cx: 58, cy: 50 }, { cx: 54, cy: 51 }, { cx: 55, cy: 51 }, { cx: 56, cy: 51 }, { cx: 57, cy: 51 }, { cx: 58, cy: 51 }, { cx: 54, cy: 52 },
    { cx: 55, cy: 52 }, { cx: 56, cy: 52 }, { cx: 57, cy: 52 }, { cx: 58, cy: 52 }, { cx: 54, cy: 53 }, { cx: 55, cy: 53 }, { cx: 56, cy: 53 }, { cx: 57, cy: 53 },
    { cx: 58, cy: 53 }, { cx: 54, cy: 54 }, { cx: 55, cy: 54 }, { cx: 56, cy: 54 }, { cx: 57, cy: 54 }, { cx: 58, cy: 54 }, { cx: 53, cy: 55 }, { cx: 54, cy: 55 },
    { cx: 55, cy: 55 }, { cx: 56, cy: 55 }, { cx: 57, cy: 55 }, { cx: 59, cy: 55 },
  ],
  'Tirannwn': [
    { cx: 33, cy: 47 }, { cx: 34, cy: 47 }, { cx: 35, cy: 47 }, { cx: 33, cy: 48 }, { cx: 34, cy: 48 }, { cx: 35, cy: 48 }, { cx: 33, cy: 49 }, { cx: 34, cy: 49 },
    { cx: 35, cy: 49 }, { cx: 36, cy: 49 }, { cx: 33, cy: 50 }, { cx: 34, cy: 50 }, { cx: 35, cy: 50 }, { cx: 36, cy: 50 }, { cx: 33, cy: 51 }, { cx: 34, cy: 51 },
    { cx: 35, cy: 51 }, { cx: 36, cy: 51 }, { cx: 37, cy: 51 }, { cx: 33, cy: 52 }, { cx: 34, cy: 52 }, { cx: 35, cy: 52 }, { cx: 33, cy: 53 }, { cx: 34, cy: 53 },
    { cx: 35, cy: 53 },
  ],
  'Varlamore': [
    { cx: 21, cy: 44 }, { cx: 22, cy: 44 }, { cx: 20, cy: 45 }, { cx: 21, cy: 45 }, { cx: 22, cy: 45 }, { cx: 23, cy: 45 }, { cx: 24, cy: 45 }, { cx: 25, cy: 45 },
    { cx: 26, cy: 45 }, { cx: 27, cy: 45 }, { cx: 19, cy: 46 }, { cx: 20, cy: 46 }, { cx: 21, cy: 46 }, { cx: 22, cy: 46 }, { cx: 23, cy: 46 }, { cx: 24, cy: 46 },
    { cx: 25, cy: 46 }, { cx: 26, cy: 46 }, { cx: 27, cy: 46 }, { cx: 19, cy: 47 }, { cx: 20, cy: 47 }, { cx: 21, cy: 47 }, { cx: 22, cy: 47 }, { cx: 23, cy: 47 },
    { cx: 24, cy: 47 }, { cx: 25, cy: 47 }, { cx: 26, cy: 47 }, { cx: 27, cy: 47 }, { cx: 28, cy: 47 }, { cx: 18, cy: 48 }, { cx: 19, cy: 48 }, { cx: 20, cy: 48 },
    { cx: 21, cy: 48 }, { cx: 22, cy: 48 }, { cx: 23, cy: 48 }, { cx: 24, cy: 48 }, { cx: 25, cy: 48 }, { cx: 26, cy: 48 }, { cx: 27, cy: 48 }, { cx: 28, cy: 48 },
    { cx: 29, cy: 48 }, { cx: 19, cy: 49 }, { cx: 20, cy: 49 }, { cx: 21, cy: 49 }, { cx: 22, cy: 49 }, { cx: 23, cy: 49 }, { cx: 24, cy: 49 }, { cx: 25, cy: 49 },
    { cx: 26, cy: 49 }, { cx: 27, cy: 49 }, { cx: 28, cy: 49 }, { cx: 21, cy: 50 }, { cx: 22, cy: 50 }, { cx: 23, cy: 50 }, { cx: 24, cy: 50 }, { cx: 25, cy: 50 },
    { cx: 26, cy: 50 }, { cx: 19, cy: 51 }, { cx: 20, cy: 51 }, { cx: 21, cy: 51 }, { cx: 22, cy: 51 }, { cx: 23, cy: 51 }, { cx: 24, cy: 51 }, { cx: 25, cy: 51 },
    { cx: 26, cy: 51 }, { cx: 20, cy: 52 }, { cx: 21, cy: 52 }, { cx: 22, cy: 52 }, { cx: 23, cy: 52 }, { cx: 24, cy: 52 }, { cx: 20, cy: 53 }, { cx: 21, cy: 53 },
  ],
  'Wilderness': [
    { cx: 46, cy: 56 }, { cx: 47, cy: 56 }, { cx: 48, cy: 56 }, { cx: 49, cy: 56 }, { cx: 50, cy: 56 }, { cx: 51, cy: 56 }, { cx: 52, cy: 56 }, { cx: 46, cy: 57 },
    { cx: 47, cy: 57 }, { cx: 48, cy: 57 }, { cx: 49, cy: 57 }, { cx: 50, cy: 57 }, { cx: 51, cy: 57 }, { cx: 52, cy: 57 }, { cx: 46, cy: 58 }, { cx: 47, cy: 58 },
    { cx: 48, cy: 58 }, { cx: 49, cy: 58 }, { cx: 50, cy: 58 }, { cx: 51, cy: 58 }, { cx: 52, cy: 58 }, { cx: 46, cy: 59 }, { cx: 47, cy: 59 }, { cx: 48, cy: 59 },
    { cx: 49, cy: 59 }, { cx: 50, cy: 59 }, { cx: 51, cy: 59 }, { cx: 52, cy: 59 }, { cx: 46, cy: 60 }, { cx: 47, cy: 60 }, { cx: 48, cy: 60 }, { cx: 49, cy: 60 },
    { cx: 50, cy: 60 }, { cx: 51, cy: 60 }, { cx: 52, cy: 60 }, { cx: 46, cy: 61 }, { cx: 47, cy: 61 }, { cx: 48, cy: 61 }, { cx: 49, cy: 61 }, { cx: 50, cy: 61 },
    { cx: 51, cy: 61 }, { cx: 52, cy: 61 }, { cx: 52, cy: 62 }, { cx: 53, cy: 62 }, { cx: 54, cy: 62 }, { cx: 52, cy: 63 }, { cx: 53, cy: 63 }, { cx: 54, cy: 63 },
    { cx: 52, cy: 64 }, { cx: 53, cy: 64 }, { cx: 54, cy: 64 },
  ],
  'Islands & Others': [
    { cx: 42, cy: 42 }, { cx: 43, cy: 42 }, { cx: 45, cy: 42 }, { cx: 42, cy: 43 }, { cx: 43, cy: 43 }, { cx: 57, cy: 57 }, { cx: 57, cy: 58 }, { cx: 58, cy: 58 },
    { cx: 59, cy: 58 }, { cx: 57, cy: 59 }, { cx: 58, cy: 59 }, { cx: 59, cy: 59 }, { cx: 57, cy: 60 }, { cx: 58, cy: 60 }, { cx: 59, cy: 60 },
    { cx: 32, cy: 42 }, { cx: 32, cy: 44 }, { cx: 32, cy: 45 }, { cx: 32, cy: 46 }, { cx: 33, cy: 43 }, { cx: 33, cy: 44 }, { cx: 33, cy: 45 }, { cx: 33, cy: 46 }, { cx: 34, cy: 43 }, { cx: 34, cy: 44 }, { cx: 34, cy: 45 }, { cx: 34, cy: 46 }, { cx: 35, cy: 43 }, { cx: 35, cy: 44 }, { cx: 35, cy: 45 }, { cx: 35, cy: 46 }, { cx: 36, cy: 44 }, { cx: 36, cy: 45 }, { cx: 36, cy: 46 }, { cx: 55, cy: 62 }, { cx: 56, cy: 62 },
  ],
  'The Open Seas': [
    { cx: 52, cy: 34 }, { cx: 36, cy: 35 }, { cx: 46, cy: 35 }, { cx: 34, cy: 36 }, { cx: 41, cy: 37 }, { cx: 50, cy: 37 }, { cx: 51, cy: 37 }, { cx: 48, cy: 38 },
    { cx: 49, cy: 38 }, { cx: 39, cy: 39 }, { cx: 49, cy: 39 }, { cx: 50, cy: 39 }, { cx: 32, cy: 40 }, { cx: 46, cy: 40 }, { cx: 27, cy: 41 }, { cx: 47, cy: 41 },
    { cx: 18, cy: 42 }, { cx: 38, cy: 42 }, { cx: 17, cy: 43 }, { cx: 18, cy: 43 }, { cx: 19, cy: 43 }, { cx: 24, cy: 43 }, { cx: 30, cy: 43 }, { cx: 36, cy: 43 },
    { cx: 29, cy: 46 }, { cx: 47, cy: 46 }, { cx: 30, cy: 48 }, { cx: 32, cy: 49 }, { cx: 29, cy: 51 }, { cx: 29, cy: 53 }, { cx: 34, cy: 54 }, { cx: 33, cy: 55 },
    { cx: 32, cy: 57 }, { cx: 30, cy: 63 }, { cx: 45, cy: 63 },
    { cx: 43, cy: 39 }, { cx: 44, cy: 36 }, { cx: 48, cy: 37 }, { cx: 49, cy: 37 }, { cx: 49, cy: 36 }, { cx: 50, cy: 36 }, { cx: 51, cy: 36 }, { cx: 50, cy: 38 }, { cx: 48, cy: 39 }, { cx: 51, cy: 38 }, { cx: 45, cy: 44 },
  ],
};
