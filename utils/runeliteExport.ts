/**
 * One-call "export my run for the RuneLite plugin": builds the v3 bundle (with
 * item tiers + slayer index when the datasets are loaded), copies it to the
 * clipboard, and downloads it. Shared by the map's RL button and the header's
 * dedicated RuneLite button so both behave identically.
 */
import { buildRuneliteBundle } from './runeliteBundle';
import { gearService } from '../services/GearService';
import { chunkContentService } from '../services/ChunkContentService';
import { showToast } from './toast';
import { UnlockState } from '../types';

export interface RuneliteRunInput {
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  fatePoints: number;
  activeBuff: string;
  pinnedGoals?: string[];
  linkedAccount?: string;
}

export async function exportRuneliteBundle(unlocks: UnlockState, run: RuneliteRunInput): Promise<void> {
  let itemTiers: Record<string, number> | undefined;
  try {
    await gearService.init();           // cached after first load
    if (gearService.ready) itemTiers = gearService.tierExport();
  } catch { /* offline / load failed — ship without tiers, plugin degrades */ }

  let slayerChunks: Record<string, { cx: number; cy: number }[]> | undefined;
  try {
    await chunkContentService.init();
    if (chunkContentService.ready) slayerChunks = chunkContentService.slayerReachIndex();
  } catch { /* no chunk data — plugin falls back to its capped monster index */ }

  const state = {
    keys: run.keys,
    specialKeys: run.specialKeys,
    chaosKeys: run.chaosKeys,
    fatePoints: run.fatePoints,
    activeBuff: run.activeBuff,
    pinnedGoals: run.pinnedGoals ?? [],
    linkedAccount: run.linkedAccount,
    equipment: unlocks.equipment,
  };
  const payload = buildRuneliteBundle(unlocks.regions, state, itemTiers, slayerChunks);
  const json = JSON.stringify(payload); // compact — the plugin parses it

  // Clipboard (paste straight into the plugin's panel)…
  navigator.clipboard?.writeText(json).catch(() => { /* non-secure origin / no focus */ });
  // …and a file download for the watch-this-path / Downloads auto-detect flow.
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fate-locked-bundle-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('RuneLite bundle copied + downloaded');
}
