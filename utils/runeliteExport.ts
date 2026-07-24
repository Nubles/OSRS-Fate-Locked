/**
 * One-call "export my run for the RuneLite plugin": builds the v3 bundle (with
 * item tiers + slayer index when the datasets are loaded), copies it to the
 * clipboard, and downloads it. Shared by the map's RL button and the header's
 * dedicated RuneLite button so both behave identically.
 */
import {
  buildRuneliteBundle,
  CONTENT_VERSION,
  DETECTOR_CONTRACT_VERSION,
  RULES_VERSION,
} from './runeliteBundle';
import { gearService } from '../services/GearService';
import { chunkContentService } from '../services/ChunkContentService';
import { showToast } from './toast';
import { UnlockState } from '../types';
import { bankLocksActive } from './reachability';
import type { GameModeRules } from '../config/gameModes';

/**
 * gzip+base64 a string for the clipboard, prefixed "FLGZ:" so the plugin knows
 * to inflate it. Returns the plain string unchanged if CompressionStream is
 * unavailable (older browser) — the plugin accepts both forms.
 */
async function compressForClipboard(json: string): Promise<string> {
  const CS: any = (globalThis as any).CompressionStream;
  if (!CS) return json;
  try {
    const stream = new Blob([json]).stream().pipeThrough(new CS('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return 'FLGZ:' + btoa(bin);
  } catch {
    return json; // any failure → plain JSON still works
  }
}

export interface RuneliteRunInput {
  runId: string;
  runRevision: number;
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  fatePoints: number;
  activeBuff: string;
  pinnedGoals?: string[];
  linkedAccount?: string;
  /** The run's game mode — needed so the plugin can tell a genuinely-empty
   *  Chunked run (0 chunks unlocked) apart from a non-Chunked bundle; an
   *  empty unlockedChunks array alone is ambiguous between the two. */
  gameModeId: string;
  rulesVersion?: string;
  contentVersion?: number;
  detectorContractVersion?: number;
}

/**
 * Build the v3 bundle for the current run and return it both as plain JSON (for
 * the readable file download) and as the compressed FLGZ form (clipboard / relay).
 * Shared by the clipboard/file export and the online relay push.
 */
export async function buildBundlePayload(
  unlocks: UnlockState,
  run: RuneliteRunInput,
): Promise<{ json: string; compressed: string }> {
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
  const banksLocked = bankLocksActive(run.gameModeId);
  const payload = await buildRuneliteBundle(
    unlocks.regions, state, itemTiers, slayerChunks,
    run.gameModeId === 'chunked' ? (unlocks.chunks ?? []) : undefined,
    banksLocked ? (unlocks.banks ?? []) : undefined,
    banksLocked,
    {
      runId: run.runId,
      runRevision: run.runRevision,
      gameModeId: run.gameModeId,
      rulesVersion: run.rulesVersion ?? RULES_VERSION,
      contentVersion: run.contentVersion ?? CONTENT_VERSION,
      detectorContractVersion: run.detectorContractVersion ?? DETECTOR_CONTRACT_VERSION,
    },
  );
  const json = JSON.stringify(payload);
  const compressed = await compressForClipboard(json);
  return { json, compressed };
}

export async function exportRuneliteBundle(unlocks: UnlockState, run: RuneliteRunInput): Promise<void> {
  // Clipboard gets the compressed (gzip+base64 "FLGZ:") form so we don't dump
  // ~115 KB onto the clipboard; the file download stays plain readable JSON.
  const { json, compressed: clip } = await buildBundlePayload(unlocks, run);
  navigator.clipboard?.writeText(clip).catch(() => { /* non-secure origin / no focus */ });
  // …and a file download kept as PLAIN, readable JSON (openable/inspectable, and
  // what the plugin's Downloads auto-detect / file-watch path reads).
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
