
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';
import { Lock, Unlock, ZoomIn, ZoomOut, Move, Loader2, Download, Grid3x3, Paintbrush, Eye, EyeOff, ClipboardCopy, Trash2, FileDown, FileUp, Radio } from 'lucide-react';
import { RegionProgressPanel } from './RegionProgressPanel';
import {
  MAP_IMAGE,
  MAP_BOUNDS,
  CHUNK_TILES,
  TileCoord,
  ChunkCoord,
  tileToPixel,
  pixelToTile,
  tileToChunk,
} from '../utils/mapCoords';

const REGION_COORDS: Record<string, { x: number; y: number }> = {
  'Misthalin': { x: 73.41, y: 41.69 },
  'Asgarnia': { x: 65.97, y: 37.47 },
  'Kandarin': { x: 52.67, y: 39.47 },
  'Karamja': { x: 61.7, y: 53.5 },
  'Kharidian Desert': { x: 76.55, y: 59.68 },
  'Morytania': { x: 84.39, y: 36.65 },
  'Fremennik': { x: 55.96, y: 26.73 },
  'Tirannwn': { x: 41.69, y: 44.33 },
  'Wilderness': { x: 71.13, y: 20.58 },
  'Kourend & Kebos': { x: 20.77, y: 24.23 },
  'Varlamore': { x: 17.91, y: 47.45 },
  'Islands & Others': { x: 78, y: 25 },
  'The Open Seas': { x: 61.81, y: 74.35 }
};

// Baseline chunk assignments. The authoring tool starts from this and stores
// its working copy in localStorage — hit Export in the toolbar to dump the
// draft back here as a pasteable literal.
// ROUGH SCAFFOLD: approximate rectangular region blocks (real game-tile chunk
// coords, post-calibration) so the map isn't blank. These are deliberately
// coarse — they bleed across borders and over some ocean, and the scattered
// regions (Islands & Others, The Open Seas) are intentionally left empty.
// Refine with the authoring tool, then Export to overwrite this literal.
const REGION_CHUNKS: Record<string, ChunkCoord[]> = {
  'Asgarnia': [
    { cx: 44, cy: 49 }, { cx: 45, cy: 49 }, { cx: 46, cy: 49 }, { cx: 47, cy: 49 }, { cx: 44, cy: 50 }, { cx: 45, cy: 50 },
    { cx: 46, cy: 50 }, { cx: 47, cy: 50 }, { cx: 44, cy: 51 }, { cx: 45, cy: 51 }, { cx: 46, cy: 51 }, { cx: 47, cy: 51 },
    { cx: 44, cy: 52 }, { cx: 45, cy: 52 }, { cx: 46, cy: 52 }, { cx: 47, cy: 52 }, { cx: 44, cy: 53 }, { cx: 45, cy: 53 },
    { cx: 46, cy: 53 }, { cx: 47, cy: 53 }, { cx: 44, cy: 54 }, { cx: 45, cy: 54 }, { cx: 46, cy: 54 }, { cx: 47, cy: 54 },
    { cx: 44, cy: 55 }, { cx: 45, cy: 55 },
  ],
  'Fremennik': [
    { cx: 39, cy: 56 }, { cx: 40, cy: 56 }, { cx: 41, cy: 56 }, { cx: 42, cy: 56 }, { cx: 43, cy: 56 }, { cx: 39, cy: 57 },
    { cx: 40, cy: 57 }, { cx: 41, cy: 57 }, { cx: 42, cy: 57 }, { cx: 43, cy: 57 }, { cx: 39, cy: 58 }, { cx: 40, cy: 58 },
    { cx: 41, cy: 58 }, { cx: 42, cy: 58 }, { cx: 43, cy: 58 }, { cx: 39, cy: 59 }, { cx: 40, cy: 59 }, { cx: 41, cy: 59 },
    { cx: 42, cy: 59 }, { cx: 43, cy: 59 }, { cx: 39, cy: 60 }, { cx: 40, cy: 60 }, { cx: 41, cy: 60 }, { cx: 42, cy: 60 },
    { cx: 43, cy: 60 },
  ],
  'Kandarin': [
    { cx: 38, cy: 47 }, { cx: 39, cy: 47 }, { cx: 40, cy: 47 }, { cx: 41, cy: 47 }, { cx: 38, cy: 48 }, { cx: 39, cy: 48 },
    { cx: 40, cy: 48 }, { cx: 41, cy: 48 }, { cx: 38, cy: 49 }, { cx: 39, cy: 49 }, { cx: 40, cy: 49 }, { cx: 41, cy: 49 },
    { cx: 42, cy: 49 }, { cx: 43, cy: 49 }, { cx: 38, cy: 50 }, { cx: 39, cy: 50 }, { cx: 40, cy: 50 }, { cx: 41, cy: 50 },
    { cx: 42, cy: 50 }, { cx: 43, cy: 50 }, { cx: 38, cy: 51 }, { cx: 39, cy: 51 }, { cx: 40, cy: 51 }, { cx: 41, cy: 51 },
    { cx: 42, cy: 51 }, { cx: 43, cy: 51 }, { cx: 38, cy: 52 }, { cx: 39, cy: 52 }, { cx: 40, cy: 52 }, { cx: 41, cy: 52 },
    { cx: 42, cy: 52 }, { cx: 43, cy: 52 }, { cx: 38, cy: 53 }, { cx: 39, cy: 53 }, { cx: 40, cy: 53 }, { cx: 41, cy: 53 },
    { cx: 42, cy: 53 }, { cx: 43, cy: 53 }, { cx: 37, cy: 54 }, { cx: 38, cy: 54 }, { cx: 39, cy: 54 }, { cx: 40, cy: 54 },
    { cx: 41, cy: 54 }, { cx: 42, cy: 54 }, { cx: 43, cy: 54 }, { cx: 37, cy: 55 }, { cx: 38, cy: 55 }, { cx: 39, cy: 55 },
    { cx: 40, cy: 55 }, { cx: 41, cy: 55 }, { cx: 42, cy: 55 }, { cx: 43, cy: 55 },
  ],
  'Karamja': [
    { cx: 42, cy: 44 }, { cx: 43, cy: 44 }, { cx: 44, cy: 44 }, { cx: 45, cy: 44 }, { cx: 46, cy: 44 }, { cx: 42, cy: 45 },
    { cx: 43, cy: 45 }, { cx: 44, cy: 45 }, { cx: 45, cy: 45 }, { cx: 46, cy: 45 }, { cx: 42, cy: 46 }, { cx: 43, cy: 46 },
    { cx: 44, cy: 46 }, { cx: 45, cy: 46 }, { cx: 46, cy: 46 }, { cx: 42, cy: 47 }, { cx: 43, cy: 47 }, { cx: 44, cy: 47 },
    { cx: 45, cy: 47 }, { cx: 46, cy: 47 }, { cx: 42, cy: 48 }, { cx: 43, cy: 48 }, { cx: 44, cy: 48 }, { cx: 45, cy: 48 },
    { cx: 46, cy: 48 },
  ],
  'Kharidian Desert': [
    { cx: 49, cy: 42 }, { cx: 50, cy: 42 }, { cx: 51, cy: 42 }, { cx: 52, cy: 42 }, { cx: 53, cy: 42 }, { cx: 54, cy: 42 },
    { cx: 55, cy: 42 }, { cx: 56, cy: 42 }, { cx: 49, cy: 43 }, { cx: 50, cy: 43 }, { cx: 51, cy: 43 }, { cx: 52, cy: 43 },
    { cx: 53, cy: 43 }, { cx: 54, cy: 43 }, { cx: 55, cy: 43 }, { cx: 56, cy: 43 }, { cx: 49, cy: 44 }, { cx: 50, cy: 44 },
    { cx: 51, cy: 44 }, { cx: 52, cy: 44 }, { cx: 53, cy: 44 }, { cx: 54, cy: 44 }, { cx: 55, cy: 44 }, { cx: 56, cy: 44 },
    { cx: 49, cy: 45 }, { cx: 50, cy: 45 }, { cx: 51, cy: 45 }, { cx: 52, cy: 45 }, { cx: 53, cy: 45 }, { cx: 54, cy: 45 },
    { cx: 55, cy: 45 }, { cx: 56, cy: 45 }, { cx: 49, cy: 46 }, { cx: 50, cy: 46 }, { cx: 51, cy: 46 }, { cx: 52, cy: 46 },
    { cx: 53, cy: 46 }, { cx: 54, cy: 46 }, { cx: 55, cy: 46 }, { cx: 56, cy: 46 }, { cx: 49, cy: 47 }, { cx: 50, cy: 47 },
    { cx: 51, cy: 47 }, { cx: 52, cy: 47 }, { cx: 53, cy: 47 }, { cx: 54, cy: 47 }, { cx: 55, cy: 47 }, { cx: 56, cy: 47 },
    { cx: 49, cy: 48 }, { cx: 50, cy: 48 }, { cx: 51, cy: 48 }, { cx: 52, cy: 48 }, { cx: 53, cy: 48 }, { cx: 54, cy: 48 },
    { cx: 55, cy: 48 }, { cx: 56, cy: 48 },
  ],
  'Kourend & Kebos': [
    { cx: 17, cy: 52 }, { cx: 18, cy: 52 }, { cx: 19, cy: 52 }, { cx: 20, cy: 52 }, { cx: 21, cy: 52 }, { cx: 22, cy: 52 },
    { cx: 23, cy: 52 }, { cx: 24, cy: 52 }, { cx: 25, cy: 52 }, { cx: 26, cy: 52 }, { cx: 27, cy: 52 }, { cx: 28, cy: 52 },
    { cx: 17, cy: 53 }, { cx: 18, cy: 53 }, { cx: 19, cy: 53 }, { cx: 20, cy: 53 }, { cx: 21, cy: 53 }, { cx: 22, cy: 53 },
    { cx: 23, cy: 53 }, { cx: 24, cy: 53 }, { cx: 25, cy: 53 }, { cx: 26, cy: 53 }, { cx: 27, cy: 53 }, { cx: 28, cy: 53 },
    { cx: 17, cy: 54 }, { cx: 18, cy: 54 }, { cx: 19, cy: 54 }, { cx: 20, cy: 54 }, { cx: 21, cy: 54 }, { cx: 22, cy: 54 },
    { cx: 23, cy: 54 }, { cx: 24, cy: 54 }, { cx: 25, cy: 54 }, { cx: 26, cy: 54 }, { cx: 27, cy: 54 }, { cx: 28, cy: 54 },
    { cx: 17, cy: 55 }, { cx: 18, cy: 55 }, { cx: 19, cy: 55 }, { cx: 20, cy: 55 }, { cx: 21, cy: 55 }, { cx: 22, cy: 55 },
    { cx: 23, cy: 55 }, { cx: 24, cy: 55 }, { cx: 25, cy: 55 }, { cx: 26, cy: 55 }, { cx: 27, cy: 55 }, { cx: 28, cy: 55 },
    { cx: 17, cy: 56 }, { cx: 18, cy: 56 }, { cx: 19, cy: 56 }, { cx: 20, cy: 56 }, { cx: 21, cy: 56 }, { cx: 22, cy: 56 },
    { cx: 23, cy: 56 }, { cx: 24, cy: 56 }, { cx: 25, cy: 56 }, { cx: 26, cy: 56 }, { cx: 27, cy: 56 }, { cx: 28, cy: 56 },
    { cx: 17, cy: 57 }, { cx: 18, cy: 57 }, { cx: 19, cy: 57 }, { cx: 20, cy: 57 }, { cx: 21, cy: 57 }, { cx: 22, cy: 57 },
    { cx: 23, cy: 57 }, { cx: 24, cy: 57 }, { cx: 25, cy: 57 }, { cx: 26, cy: 57 }, { cx: 27, cy: 57 }, { cx: 28, cy: 57 },
    { cx: 17, cy: 58 }, { cx: 18, cy: 58 }, { cx: 19, cy: 58 }, { cx: 20, cy: 58 }, { cx: 21, cy: 58 }, { cx: 22, cy: 58 },
    { cx: 23, cy: 58 }, { cx: 24, cy: 58 }, { cx: 25, cy: 58 }, { cx: 26, cy: 58 }, { cx: 27, cy: 58 }, { cx: 28, cy: 58 },
  ],
  'Misthalin': [
    { cx: 48, cy: 49 }, { cx: 49, cy: 49 }, { cx: 50, cy: 49 }, { cx: 51, cy: 49 }, { cx: 52, cy: 49 }, { cx: 48, cy: 50 },
    { cx: 49, cy: 50 }, { cx: 50, cy: 50 }, { cx: 51, cy: 50 }, { cx: 52, cy: 50 }, { cx: 48, cy: 51 }, { cx: 49, cy: 51 },
    { cx: 50, cy: 51 }, { cx: 51, cy: 51 }, { cx: 52, cy: 51 }, { cx: 48, cy: 52 }, { cx: 49, cy: 52 }, { cx: 50, cy: 52 },
    { cx: 51, cy: 52 }, { cx: 52, cy: 52 }, { cx: 48, cy: 53 }, { cx: 49, cy: 53 }, { cx: 50, cy: 53 }, { cx: 51, cy: 53 },
    { cx: 52, cy: 53 }, { cx: 48, cy: 54 }, { cx: 49, cy: 54 }, { cx: 50, cy: 54 }, { cx: 51, cy: 54 }, { cx: 52, cy: 54 },
  ],
  'Morytania': [
    { cx: 53, cy: 49 }, { cx: 54, cy: 49 }, { cx: 55, cy: 49 }, { cx: 56, cy: 49 }, { cx: 57, cy: 49 }, { cx: 58, cy: 49 },
    { cx: 59, cy: 49 }, { cx: 60, cy: 49 }, { cx: 53, cy: 50 }, { cx: 54, cy: 50 }, { cx: 55, cy: 50 }, { cx: 56, cy: 50 },
    { cx: 57, cy: 50 }, { cx: 58, cy: 50 }, { cx: 59, cy: 50 }, { cx: 60, cy: 50 }, { cx: 53, cy: 51 }, { cx: 54, cy: 51 },
    { cx: 55, cy: 51 }, { cx: 56, cy: 51 }, { cx: 57, cy: 51 }, { cx: 58, cy: 51 }, { cx: 59, cy: 51 }, { cx: 60, cy: 51 },
    { cx: 53, cy: 52 }, { cx: 54, cy: 52 }, { cx: 55, cy: 52 }, { cx: 56, cy: 52 }, { cx: 57, cy: 52 }, { cx: 58, cy: 52 },
    { cx: 59, cy: 52 }, { cx: 60, cy: 52 }, { cx: 53, cy: 53 }, { cx: 54, cy: 53 }, { cx: 55, cy: 53 }, { cx: 56, cy: 53 },
    { cx: 57, cy: 53 }, { cx: 58, cy: 53 }, { cx: 59, cy: 53 }, { cx: 60, cy: 53 }, { cx: 53, cy: 54 }, { cx: 54, cy: 54 },
    { cx: 55, cy: 54 }, { cx: 56, cy: 54 }, { cx: 57, cy: 54 }, { cx: 58, cy: 54 }, { cx: 59, cy: 54 }, { cx: 60, cy: 54 },
    { cx: 54, cy: 55 }, { cx: 55, cy: 55 }, { cx: 56, cy: 55 }, { cx: 57, cy: 55 }, { cx: 58, cy: 55 }, { cx: 59, cy: 55 },
    { cx: 60, cy: 55 }, { cx: 54, cy: 56 }, { cx: 55, cy: 56 }, { cx: 56, cy: 56 }, { cx: 57, cy: 56 }, { cx: 58, cy: 56 },
    { cx: 59, cy: 56 }, { cx: 60, cy: 56 },
  ],
  'Tirannwn': [
    { cx: 33, cy: 47 }, { cx: 34, cy: 47 }, { cx: 35, cy: 47 }, { cx: 36, cy: 47 }, { cx: 37, cy: 47 }, { cx: 33, cy: 48 },
    { cx: 34, cy: 48 }, { cx: 35, cy: 48 }, { cx: 36, cy: 48 }, { cx: 37, cy: 48 }, { cx: 33, cy: 49 }, { cx: 34, cy: 49 },
    { cx: 35, cy: 49 }, { cx: 36, cy: 49 }, { cx: 37, cy: 49 }, { cx: 33, cy: 50 }, { cx: 34, cy: 50 }, { cx: 35, cy: 50 },
    { cx: 36, cy: 50 }, { cx: 37, cy: 50 }, { cx: 33, cy: 51 }, { cx: 34, cy: 51 }, { cx: 35, cy: 51 }, { cx: 36, cy: 51 },
    { cx: 37, cy: 51 }, { cx: 33, cy: 52 }, { cx: 34, cy: 52 }, { cx: 35, cy: 52 }, { cx: 36, cy: 52 }, { cx: 37, cy: 52 },
    { cx: 33, cy: 53 }, { cx: 34, cy: 53 }, { cx: 35, cy: 53 }, { cx: 36, cy: 53 }, { cx: 37, cy: 53 },
  ],
  'Varlamore': [
    { cx: 22, cy: 44 }, { cx: 23, cy: 44 }, { cx: 24, cy: 44 }, { cx: 25, cy: 44 }, { cx: 26, cy: 44 }, { cx: 27, cy: 44 },
    { cx: 28, cy: 44 }, { cx: 29, cy: 44 }, { cx: 30, cy: 44 }, { cx: 22, cy: 45 }, { cx: 23, cy: 45 }, { cx: 24, cy: 45 },
    { cx: 25, cy: 45 }, { cx: 26, cy: 45 }, { cx: 27, cy: 45 }, { cx: 28, cy: 45 }, { cx: 29, cy: 45 }, { cx: 30, cy: 45 },
    { cx: 22, cy: 46 }, { cx: 23, cy: 46 }, { cx: 24, cy: 46 }, { cx: 25, cy: 46 }, { cx: 26, cy: 46 }, { cx: 27, cy: 46 },
    { cx: 28, cy: 46 }, { cx: 29, cy: 46 }, { cx: 30, cy: 46 }, { cx: 22, cy: 47 }, { cx: 23, cy: 47 }, { cx: 24, cy: 47 },
    { cx: 25, cy: 47 }, { cx: 26, cy: 47 }, { cx: 27, cy: 47 }, { cx: 28, cy: 47 }, { cx: 29, cy: 47 }, { cx: 30, cy: 47 },
    { cx: 22, cy: 48 }, { cx: 23, cy: 48 }, { cx: 24, cy: 48 }, { cx: 25, cy: 48 }, { cx: 26, cy: 48 }, { cx: 27, cy: 48 },
    { cx: 28, cy: 48 }, { cx: 29, cy: 48 }, { cx: 30, cy: 48 }, { cx: 22, cy: 49 }, { cx: 23, cy: 49 }, { cx: 24, cy: 49 },
    { cx: 25, cy: 49 }, { cx: 26, cy: 49 }, { cx: 27, cy: 49 }, { cx: 28, cy: 49 }, { cx: 29, cy: 49 }, { cx: 30, cy: 49 },
    { cx: 22, cy: 50 }, { cx: 23, cy: 50 }, { cx: 24, cy: 50 }, { cx: 25, cy: 50 }, { cx: 26, cy: 50 }, { cx: 27, cy: 50 },
    { cx: 28, cy: 50 }, { cx: 29, cy: 50 }, { cx: 30, cy: 50 }, { cx: 22, cy: 51 }, { cx: 23, cy: 51 }, { cx: 24, cy: 51 },
    { cx: 25, cy: 51 }, { cx: 26, cy: 51 }, { cx: 27, cy: 51 }, { cx: 28, cy: 51 }, { cx: 29, cy: 51 }, { cx: 30, cy: 51 },
  ],
  'Wilderness': [
    { cx: 46, cy: 55 }, { cx: 47, cy: 55 }, { cx: 48, cy: 55 }, { cx: 49, cy: 55 }, { cx: 50, cy: 55 }, { cx: 51, cy: 55 },
    { cx: 52, cy: 55 }, { cx: 53, cy: 55 }, { cx: 46, cy: 56 }, { cx: 47, cy: 56 }, { cx: 48, cy: 56 }, { cx: 49, cy: 56 },
    { cx: 50, cy: 56 }, { cx: 51, cy: 56 }, { cx: 52, cy: 56 }, { cx: 53, cy: 56 }, { cx: 46, cy: 57 }, { cx: 47, cy: 57 },
    { cx: 48, cy: 57 }, { cx: 49, cy: 57 }, { cx: 50, cy: 57 }, { cx: 51, cy: 57 }, { cx: 52, cy: 57 }, { cx: 53, cy: 57 },
    { cx: 46, cy: 58 }, { cx: 47, cy: 58 }, { cx: 48, cy: 58 }, { cx: 49, cy: 58 }, { cx: 50, cy: 58 }, { cx: 51, cy: 58 },
    { cx: 52, cy: 58 }, { cx: 53, cy: 58 }, { cx: 46, cy: 59 }, { cx: 47, cy: 59 }, { cx: 48, cy: 59 }, { cx: 49, cy: 59 },
    { cx: 50, cy: 59 }, { cx: 51, cy: 59 }, { cx: 52, cy: 59 }, { cx: 53, cy: 59 }, { cx: 46, cy: 60 }, { cx: 47, cy: 60 },
    { cx: 48, cy: 60 }, { cx: 49, cy: 60 }, { cx: 50, cy: 60 }, { cx: 51, cy: 60 }, { cx: 52, cy: 60 }, { cx: 53, cy: 60 },
    { cx: 46, cy: 61 }, { cx: 47, cy: 61 }, { cx: 48, cy: 61 }, { cx: 49, cy: 61 }, { cx: 50, cy: 61 }, { cx: 51, cy: 61 },
    { cx: 52, cy: 61 }, { cx: 53, cy: 61 },
  ],
};

const ALWAYS_UNLOCKED_REGIONS = new Set<string>(['Misthalin']);

// Maps a leaf/sub-region back to its continent, derived once from
// REGION_GROUPS + MISTHALIN_AREAS. Used by isRegionUnlocked to walk
// the hierarchy.
const PARENT_CONTINENT: Record<string, string> = (() => {
  const parents: Record<string, string> = {};
  for (const [continent, subs] of Object.entries(REGION_GROUPS)) {
    for (const sub of subs) parents[sub] = continent;
  }
  for (const area of MISTHALIN_AREAS) parents[area] = 'Misthalin';
  return parents;
})();

// A chunk's region is unlocked if:
//  1. it's in ALWAYS_UNLOCKED_REGIONS, or
//  2. it appears directly in unlocks.regions, or
//  3. its parent continent is unlocked, or
//  4. its parent continent is "complete" (every sibling sub-region is unlocked),
//  5. or — if the region IS a continent — every one of its sub-regions is unlocked.
// Rule (4) is the "continent turns fully green once all sub-areas are done"
// rule and covers chunks tagged at the continent level too.
const isRegionUnlocked = (region: string, unlocks: string[]): boolean => {
  if (ALWAYS_UNLOCKED_REGIONS.has(region)) return true;
  if (unlocks.includes(region)) return true;
  const continent = PARENT_CONTINENT[region];
  if (continent) {
    if (ALWAYS_UNLOCKED_REGIONS.has(continent)) return true;
    if (unlocks.includes(continent)) return true;
    const siblings = continent === 'Misthalin' ? MISTHALIN_AREAS : (REGION_GROUPS[continent] ?? []);
    if (siblings.length > 0 && siblings.every(s => unlocks.includes(s) || ALWAYS_UNLOCKED_REGIONS.has(s))) return true;
  }
  const children = region === 'Misthalin' ? MISTHALIN_AREAS : REGION_GROUPS[region];
  if (children && children.length > 0 && children.every(s => unlocks.includes(s) || ALWAYS_UNLOCKED_REGIONS.has(s))) return true;
  return false;
};

// Every unlockable/assignable region name, deduped + alphabetised. Pulled
// from the existing unlock data so the authoring dropdown can't introduce
// typos that would fail to match unlocks.regions at runtime.
const ALL_REGION_NAMES: string[] = (() => {
  const names = new Set<string>(['Misthalin']);
  for (const g of Object.keys(REGION_GROUPS)) names.add(g);
  for (const arr of Object.values(REGION_GROUPS)) arr.forEach(n => names.add(n));
  for (const n of MISTHALIN_AREAS) names.add(n);
  return [...names].sort();
})();

const AUTHORING_STORAGE_KEY = 'fate-region-chunks-draft-v1';
// Rolling backup that only advances when the draft is MORE substantial than
// what it currently holds. Protects against accidental seed-overwrites if
// the primary key is wiped or reset — load falls through to this.
const AUTHORING_BACKUP_KEY = 'fate-region-chunks-backup-v1';

const countChunks = (d: Record<string, ChunkCoord[]>) =>
  Object.values(d).reduce((a, arr) => a + (Array.isArray(arr) ? arr.length : 0), 0);

const loadInitialDraft = (): Record<string, ChunkCoord[]> => {
  try {
    const primaryRaw = localStorage.getItem(AUTHORING_STORAGE_KEY);
    const backupRaw = localStorage.getItem(AUTHORING_BACKUP_KEY);
    const primary = primaryRaw ? JSON.parse(primaryRaw) : null;
    const backup = backupRaw ? JSON.parse(backupRaw) : null;
    // If backup is strictly larger than primary, the primary was probably
    // clobbered (e.g. seed overwrite). Prefer the backup.
    if (primary && backup && countChunks(backup) > countChunks(primary)) return backup;
    if (primary) return primary;
    if (backup) return backup;
  } catch { /* fall through */ }
  return REGION_CHUNKS;
};

const GRID_LINE_COLOR = 'rgba(255,255,255,0.12)';
const UNLOCKED_FILL = 'rgba(16, 185, 129, 0.35)';
const LOCKED_FILL = 'rgba(239, 68, 68, 0.30)';
const ACTIVE_STROKE = 'rgba(250, 204, 21, 0.9)';

const chunkKey = (c: ChunkCoord) => `${c.cx},${c.cy}`;

const serializeDraft = (data: Record<string, ChunkCoord[]>) => {
  const entries = Object.entries(data)
    .filter(([, list]) => list.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
      const body = sorted.map(c => `    { cx: ${c.cx}, cy: ${c.cy} },`).join('\n');
      return `  '${name.replace(/'/g, "\\'")}': [\n${body}\n  ],`;
    });
  return `const REGION_CHUNKS: Record<string, ChunkCoord[]> = {\n${entries.join('\n')}\n};`;
};

// Chunk-space offset between the web app's map coordinates and canonical OSRS
// runescript coordinates (what RuneLite reports as `WorldPoint.getX() >> 6`).
// Derived empirically against 6 landmarks (Lumbridge, Varrock, Falador,
// Ardougne, Port Sarim, Canifis) — all agreed exactly on +1 chunk east,
// +7 chunks north. Encoded in RuneLite bundles so the plugin never guesses.
const RUNELITE_CHUNK_OFFSET = { cx: 1, cy: 7 } as const;

const MapContent = React.memo(({ regionUnlocks }: { regionUnlocks: string[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContentRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: -470, y: -288, scale: 0.2 });
  const [isExporting, setIsExporting] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [hoverTile, setHoverTile] = useState<TileCoord | null>(null);

  const [authoring, setAuthoring] = useState(false);
  const [activeRegion, setActiveRegion] = useState<string>(ALL_REGION_NAMES[0] ?? '');
  const [soloView, setSoloView] = useState(false);
  const [draftChunks, setDraftChunks] = useState<Record<string, ChunkCoord[]>>(loadInitialDraft);
  const [toast, setToast] = useState<string | null>(null);

  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const paintMode = useRef<'add' | 'remove' | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(draftChunks);
      localStorage.setItem(AUTHORING_STORAGE_KEY, serialized);
      // Only advance the backup when current state is at least as big as
      // whatever the backup holds. A shrinking draft (wipe, clear, refresh
      // race, etc.) never overwrites the backup — worst case the user can
      // recover the previous "high-water" state on next load.
      const backupRaw = localStorage.getItem(AUTHORING_BACKUP_KEY);
      const backupCount = backupRaw ? countChunks(JSON.parse(backupRaw)) : 0;
      if (countChunks(draftChunks) >= backupCount) {
        localStorage.setItem(AUTHORING_BACKUP_KEY, serialized);
      }
    } catch { /* quota or parse error — ignore */ }
  }, [draftChunks]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setTransform(prev => {
        const factor = Math.exp(-e.deltaY * 0.001);
        const newScale = Math.min(Math.max(0.2, prev.scale * factor), 5);
        const newX = mouseX - (mouseX - prev.x) * (newScale / prev.scale);
        const newY = mouseY - (mouseY - prev.y) * (newScale / prev.scale);
        return { x: newX, y: newY, scale: newScale };
      });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 1600);
  };

  const chunkAtEvent = (clientX: number, clientY: number): ChunkCoord | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const localX = (clientX - rect.left - transform.x) / transform.scale;
    const localY = (clientY - rect.top - transform.y) / transform.scale;
    if (localX < 0 || localY < 0 || localX > MAP_IMAGE.width || localY > MAP_IMAGE.height) return null;
    return tileToChunk(pixelToTile({ px: localX, py: localY }));
  };

  const addChunkToActive = (chunk: ChunkCoord) => {
    if (!activeRegion) return;
    setDraftChunks(prev => {
      const next: Record<string, ChunkCoord[]> = {};
      // Single-assignment: remove this chunk from any other region first.
      for (const [name, list] of Object.entries(prev)) {
        const filtered = list.filter(c => c.cx !== chunk.cx || c.cy !== chunk.cy);
        if (filtered.length) next[name] = filtered;
      }
      next[activeRegion] = [...(next[activeRegion] ?? []), chunk];
      return next;
    });
  };

  const removeChunk = (chunk: ChunkCoord) => {
    setDraftChunks(prev => {
      const next: Record<string, ChunkCoord[]> = {};
      for (const [name, list] of Object.entries(prev)) {
        const filtered = list.filter(c => c.cx !== chunk.cx || c.cy !== chunk.cy);
        if (filtered.length) next[name] = filtered;
      }
      return next;
    });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.button !== 0 && e.button !== 2) return;
    didDrag.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    if (authoring && e.shiftKey) {
      paintMode.current = e.button === 2 ? 'remove' : 'add';
      const chunk = chunkAtEvent(e.clientX, e.clientY);
      if (chunk) {
        paintMode.current === 'add' ? addChunkToActive(chunk) : removeChunk(chunk);
      }
      return;
    }
    if (e.button === 0) isDragging.current = true;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (paintMode.current) {
      const chunk = chunkAtEvent(e.clientX, e.clientY);
      if (chunk) {
        paintMode.current === 'add' ? addChunkToActive(chunk) : removeChunk(chunk);
      }
    } else if (isDragging.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) didDrag.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = (e.clientX - rect.left - transform.x) / transform.scale;
    const localY = (e.clientY - rect.top - transform.y) / transform.scale;
    if (localX < 0 || localY < 0 || localX > MAP_IMAGE.width || localY > MAP_IMAGE.height) {
      setHoverTile(null);
    } else {
      setHoverTile(pixelToTile({ px: localX, py: localY }));
    }
  };

  const onMouseUp = () => {
    isDragging.current = false;
    // Defer clearing paintMode so onClick (which fires after mouseup) can still bail.
    window.setTimeout(() => { paintMode.current = null; }, 0);
  };

  const onClick = (e: React.MouseEvent) => {
    if (didDrag.current || paintMode.current) return;
    const chunk = chunkAtEvent(e.clientX, e.clientY);
    if (!chunk) return;
    if (authoring) {
      addChunkToActive(chunk);
    } else {
      const text = `{ cx: ${chunk.cx}, cy: ${chunk.cy} },`;
      navigator.clipboard?.writeText(text).catch(() => {});
      showToast(`copied { cx: ${chunk.cx}, cy: ${chunk.cy} }`);
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (!authoring) return;
    e.preventDefault();
    if (e.shiftKey) return; // shift+right-click handled by mousedown as paint-erase
    const chunk = chunkAtEvent(e.clientX, e.clientY);
    if (chunk) removeChunk(chunk);
  };

  const handleExport = async () => {
    if (!mapContentRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(mapContentRef.current, {
        useCORS: true,
        allowTaint: true,
        width: MAP_IMAGE.width,
        height: MAP_IMAGE.height,
        scale: 1,
        logging: false,
        backgroundColor: '#0b0d10',
        onclone: (doc) => {
          const el = doc.getElementById('map-content-inner');
          if (el) {
            el.style.transform = 'none';
            el.style.top = '0';
            el.style.left = '0';
          }
        }
      });
      const link = document.createElement('a');
      link.download = `fate-locked-map-${Date.now()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.8);
      link.click();
    } catch (err) {
      console.error("Map export failed:", err);
      alert("Failed to export map image.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportDraftToClipboard = async () => {
    const code = serializeDraft(draftChunks);
    try {
      await navigator.clipboard.writeText(code);
      showToast('REGION_CHUNKS copied to clipboard');
    } catch {
      window.prompt('Copy this into REGION_CHUNKS:', code);
    }
  };

  const exportRuneLiteBundle = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      chunkOffset: RUNELITE_CHUNK_OFFSET,
      chunks: draftChunks,
      unlockedRegions: regionUnlocks,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fate-locked-bundle-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`RuneLite bundle · ${regionUnlocks.length} unlocked regions`);
  };

  const exportDraftJson = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      chunks: draftChunks,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fate-region-chunks-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const regionCount = Object.values(draftChunks).filter(arr => arr.length > 0).length;
    showToast(`exported ${regionCount} regions as JSON`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const raw = parsed && typeof parsed === 'object' && 'chunks' in parsed ? parsed.chunks : parsed;
      if (!raw || typeof raw !== 'object') throw new Error('missing chunks object');
      const cleaned: Record<string, ChunkCoord[]> = {};
      for (const [region, list] of Object.entries(raw)) {
        if (!Array.isArray(list)) throw new Error(`"${region}" is not an array`);
        const coords: ChunkCoord[] = [];
        for (const c of list) {
          if (!c || typeof c !== 'object' || typeof (c as any).cx !== 'number' || typeof (c as any).cy !== 'number') {
            throw new Error(`bad chunk in "${region}"`);
          }
          coords.push({ cx: (c as any).cx, cy: (c as any).cy });
        }
        cleaned[region] = coords;
      }
      const regionCount = Object.values(cleaned).filter(arr => arr.length > 0).length;
      const chunkCount = Object.values(cleaned).reduce((a, arr) => a + arr.length, 0);
      if (!window.confirm(`Replace current draft with ${regionCount} regions / ${chunkCount} chunks from "${file.name}"?`)) return;
      setDraftChunks(cleaned);
      showToast(`imported ${regionCount} regions`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Import failed: ${msg}`);
    }
  };

  const clearDraft = () => {
    if (!window.confirm('Clear ALL draft chunks for every region?\n\nThis wipes the primary draft AND the safety backup — gone for good.')) return;
    setDraftChunks({});
    try { localStorage.removeItem(AUTHORING_BACKUP_KEY); } catch { /* ignore */ }
    showToast('draft + backup cleared');
  };

  const clearActiveRegion = () => {
    if (!activeRegion) return;
    if (!window.confirm(`Clear all chunks for "${activeRegion}"?`)) return;
    setDraftChunks(prev => {
      const next = { ...prev };
      delete next[activeRegion];
      return next;
    });
    showToast(`cleared "${activeRegion}"`);
  };

  const gridLines = useMemo(() => {
    const verticals: { x: number; y1: number; y2: number }[] = [];
    const horizontals: { y: number; x1: number; x2: number }[] = [];
    const firstCx = Math.ceil(MAP_BOUNDS.tileMinX / CHUNK_TILES);
    const lastCx = Math.floor(MAP_BOUNDS.tileMaxX / CHUNK_TILES);
    const firstCy = Math.ceil(MAP_BOUNDS.tileMinY / CHUNK_TILES);
    const lastCy = Math.floor(MAP_BOUNDS.tileMaxY / CHUNK_TILES);
    for (let cx = firstCx; cx <= lastCx; cx++) {
      const { px } = tileToPixel({ tx: cx * CHUNK_TILES, ty: MAP_BOUNDS.tileMinY });
      verticals.push({ x: px, y1: 0, y2: MAP_IMAGE.height });
    }
    for (let cy = firstCy; cy <= lastCy; cy++) {
      const { py } = tileToPixel({ tx: MAP_BOUNDS.tileMinX, ty: cy * CHUNK_TILES });
      horizontals.push({ y: py, x1: 0, x2: MAP_IMAGE.width });
    }
    return { verticals, horizontals };
  }, []);

  const chunkRects = useMemo(() => {
    const chunkPx = CHUNK_TILES * (MAP_IMAGE.width / (MAP_BOUNDS.tileMaxX - MAP_BOUNDS.tileMinX));
    const chunkPy = CHUNK_TILES * (MAP_IMAGE.height / (MAP_BOUNDS.tileMaxY - MAP_BOUNDS.tileMinY));
    const rects: { key: string; region: string; x: number; y: number; w: number; h: number; fill: string; isActive: boolean }[] = [];
    for (const [region, chunks] of Object.entries(draftChunks)) {
      const isActive = authoring && region === activeRegion;
      if (soloView && authoring && !isActive) continue;
      const unlocked = isRegionUnlocked(region, regionUnlocks);
      const fill = unlocked ? UNLOCKED_FILL : LOCKED_FILL;
      for (const { cx, cy } of chunks) {
        const { px, py } = tileToPixel({ tx: cx * CHUNK_TILES, ty: (cy + 1) * CHUNK_TILES });
        rects.push({ key: `${region}:${cx},${cy}`, region, x: px, y: py, w: chunkPx, h: chunkPy, fill, isActive });
      }
    }
    return rects;
  }, [draftChunks, regionUnlocks, authoring, activeRegion, soloView]);

  const activeChunkCount = draftChunks[activeRegion]?.length ?? 0;
  const totalRegionsWithChunks = Object.values(draftChunks).filter(arr => arr.length > 0).length;
  const hoverChunk = hoverTile ? tileToChunk(hoverTile) : null;

  return (
    <div className="h-[600px] w-full bg-[#0b0d10] rounded-lg border border-white/10 relative overflow-hidden group select-none shadow-inner">
      <div
        ref={containerRef}
        className={`w-full h-full ${authoring ? 'cursor-crosshair' : 'cursor-move'}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseLeave={() => { onMouseUp(); setHoverTile(null); }}
      >
        <div
          ref={mapContentRef}
          id="map-content-inner"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            width: `${MAP_IMAGE.width}px`,
            height: `${MAP_IMAGE.height}px`,
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          <img
            src={MAP_IMAGE.src}
            alt="OSRS World Map"
            className="w-full h-full object-fill pointer-events-none opacity-60 grayscale-[0.2]"
            draggable={false}
          />

          <svg
            className="absolute inset-0 pointer-events-none"
            width={MAP_IMAGE.width}
            height={MAP_IMAGE.height}
            viewBox={`0 0 ${MAP_IMAGE.width} ${MAP_IMAGE.height}`}
          >
            <g>
              {chunkRects.map(r => (
                <rect
                  key={r.key}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={r.fill}
                  stroke={r.isActive ? ACTIVE_STROKE : 'none'}
                  strokeWidth={r.isActive ? 2 : 0}
                />
              ))}
            </g>

            {showGrid && (
              <g stroke={GRID_LINE_COLOR} strokeWidth={1}>
                {gridLines.verticals.map(v => (
                  <line key={`v${v.x}`} x1={v.x} x2={v.x} y1={v.y1} y2={v.y2} />
                ))}
                {gridLines.horizontals.map(h => (
                  <line key={`h${h.y}`} x1={h.x1} x2={h.x2} y1={h.y} y2={h.y} />
                ))}
              </g>
            )}
          </svg>

          {Object.entries(REGION_COORDS).map(([region, coords]) => {
            const isMisthalin = region === 'Misthalin';
            const isUnlocked = isMisthalin || regionUnlocks.includes(region);
            const subRegions = isMisthalin ? MISTHALIN_AREAS : REGION_GROUPS[region] || [];
            return (
              <div
                key={region}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group/marker z-10"
                style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
              >
                <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 shadow-[0_0_15px_black] flex items-center justify-center transition-all duration-300 ${isUnlocked ? 'bg-emerald-900/90 border-emerald-400 text-emerald-400 hover:scale-125 hover:bg-emerald-800' : 'bg-red-900/90 border-red-500 text-red-500 hover:scale-110 grayscale-[0.5]'}`}>
                  {isUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-black/95 border border-white/20 rounded p-3 opacity-0 group-hover/marker:opacity-100 transition-opacity pointer-events-none z-50 flex flex-col gap-2 scale-90 group-hover/marker:scale-100 origin-bottom duration-200">
                  <h4 className={`font-bold text-sm border-b pb-1 ${isUnlocked ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>{region}</h4>
                  <div className="flex flex-wrap gap-1">
                    {subRegions.slice(0, 8).map(area => (
                      <span key={area} className={`text-[9px] px-1.5 py-0.5 rounded text-gray-300 ${regionUnlocks.includes(area) ? 'bg-emerald-900/40 text-emerald-300' : 'bg-white/10'}`}>{area}</span>
                    ))}
                    {subRegions.length > 8 && <span className="text-[9px] text-gray-500">+{subRegions.length - 8} more...</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Authoring toolbar (top-right) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
        <button
          onClick={() => setAuthoring(a => !a)}
          className={`px-3 py-1.5 rounded border text-xs font-semibold shadow-lg flex items-center gap-1.5 transition-colors ${authoring ? 'bg-amber-500/90 border-amber-300 text-black' : 'bg-black/80 border-white/20 text-white hover:bg-white/10'}`}
          title="Toggle chunk authoring mode"
        >
          <Paintbrush size={14} />
          {authoring ? 'Authoring ON' : 'Authoring OFF'}
        </button>

        {authoring && (
          <div className="bg-black/90 border border-white/20 rounded-md shadow-lg p-3 flex flex-col gap-2 w-[260px]">
            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Active Region</label>
            <select
              value={activeRegion}
              onChange={e => setActiveRegion(e.target.value)}
              className="bg-[#0b0d10] border border-white/20 rounded px-2 py-1 text-xs text-white"
            >
              {ALL_REGION_NAMES.map(name => {
                const count = draftChunks[name]?.length ?? 0;
                return (
                  <option key={name} value={name}>
                    {name}{count ? ` (${count})` : ''}
                  </option>
                );
              })}
            </select>

            <div className="text-[10px] text-gray-400 leading-relaxed mt-1">
              click = add · right-click = remove · shift+drag = paint · shift+right-drag = erase
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setSoloView(s => !s)}
                className={`flex-1 px-2 py-1 rounded text-[11px] border flex items-center justify-center gap-1 ${soloView ? 'bg-emerald-900/80 border-emerald-500/60 text-emerald-200' : 'bg-black/60 border-white/20 text-gray-300 hover:bg-white/10'}`}
                title="Show only the active region"
              >
                {soloView ? <Eye size={12} /> : <EyeOff size={12} />}
                Solo
              </button>
              <button
                onClick={clearActiveRegion}
                disabled={activeChunkCount === 0}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-black/60 border-white/20 text-gray-300 hover:bg-red-900/40 hover:text-red-200 disabled:opacity-40 disabled:hover:bg-black/60 flex items-center justify-center gap-1"
                title="Remove all chunks for the active region"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={exportDraftToClipboard}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-emerald-900/70 border-emerald-500/50 text-emerald-100 hover:bg-emerald-800/80 flex items-center justify-center gap-1"
                title="Copy REGION_CHUNKS as TS literal"
              >
                <ClipboardCopy size={12} />
                TS
              </button>
              <button
                onClick={exportDraftJson}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-sky-900/70 border-sky-500/50 text-sky-100 hover:bg-sky-800/80 flex items-center justify-center gap-1"
                title="Download draft as JSON file"
              >
                <FileDown size={12} />
                JSON
              </button>
              <button
                onClick={exportRuneLiteBundle}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-amber-900/70 border-amber-500/50 text-amber-100 hover:bg-amber-800/80 flex items-center justify-center gap-1"
                title="Export bundle for RuneLite plugin (chunks + unlocks + offset)"
              >
                <Radio size={12} />
                RL
              </button>
              <button
                onClick={() => importFileRef.current?.click()}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-indigo-900/70 border-indigo-500/50 text-indigo-100 hover:bg-indigo-800/80 flex items-center justify-center gap-1"
                title="Import draft from JSON file"
              >
                <FileUp size={12} />
                Load
              </button>
              <button
                onClick={clearDraft}
                className="px-2 py-1 rounded text-[11px] border bg-black/60 border-white/20 text-gray-400 hover:bg-red-900/40 hover:text-red-200"
                title="Wipe ALL draft chunks"
              >
                Wipe
              </button>
            </div>
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFile}
            />

            <div className="text-[10px] text-gray-500 pt-1 border-t border-white/10">
              {activeChunkCount} chunks in "{activeRegion}" · {totalRegionsWithChunks} regions total
            </div>
          </div>
        )}
      </div>

      {/* Navigation controls (bottom-right) */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="p-2 bg-black/80 border border-white/20 rounded hover:bg-white/10 text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export Map Image"
        >
          {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
        </button>
        <button
          onClick={() => setShowGrid(g => !g)}
          className={`p-2 border rounded text-white shadow-lg active:scale-95 transition-transform ${showGrid ? 'bg-emerald-900/80 border-emerald-500/60' : 'bg-black/80 border-white/20 hover:bg-white/10'}`}
          title="Toggle chunk grid (64-tile)"
        >
          <Grid3x3 size={20} />
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.5, 5) }))}
          className="p-2 bg-black/80 border border-white/20 rounded hover:bg-white/10 text-white shadow-lg active:scale-95 transition-transform"
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.5, 0.2) }))}
          className="p-2 bg-black/80 border border-white/20 rounded hover:bg-white/10 text-white shadow-lg active:scale-95 transition-transform"
        >
          <ZoomOut size={20} />
        </button>
      </div>

      {/* Status / hover readout (top-left) */}
      <div className="absolute top-4 left-4 pointer-events-none z-20 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-black/80 px-3 py-1.5 rounded-full border border-white/10 text-xs text-gray-300 shadow-lg backdrop-blur-sm">
          <Move size={14} />
          <span>Drag to Pan • Scroll to Zoom</span>
        </div>
        {hoverTile && hoverChunk && (
          <div className="bg-black/80 px-3 py-1.5 rounded border border-white/10 text-[11px] font-mono text-emerald-300 shadow-lg backdrop-blur-sm">
            tile ({Math.round(hoverTile.tx)}, {Math.round(hoverTile.ty)}) · chunk ({hoverChunk.cx}, {hoverChunk.cy})
          </div>
        )}
        {toast && (
          <div className="bg-emerald-900/90 border border-emerald-500/60 px-3 py-1.5 rounded text-[11px] font-mono text-emerald-200 shadow-lg">
            {toast}
          </div>
        )}
      </div>

      {/* Region progress panel (left, below status) — positioned independently so
          the hover-coords readout appearing/disappearing doesn't shove it around. */}
      <div className="absolute top-20 left-4 z-20">
        <RegionProgressPanel regionUnlocks={regionUnlocks} />
      </div>
    </div>
  );
}, (prev, next) => prev.regionUnlocks === next.regionUnlocks);

export const RegionMap: React.FC = () => {
  const { unlocks } = useGame();
  return <MapContent regionUnlocks={unlocks.regions} />;
};
