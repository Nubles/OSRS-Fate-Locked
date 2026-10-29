/**
 * Chunked's map display options, all on by default: fog over land the run
 * doesn't hold, fate's spin on chunk draws, fate's omens, and Fated sites and
 * region seals on the map. Per-viewer preferences in
 * localStorage, outside GameState (like utils/uiStyle.ts), so they never
 * travel with saves, sync codes or exports. With storage blocked a choice
 * lasts this page only. The reveal reads them eagerly, so this file stays
 * small; the setter and the hook live in utils/fateMapPrefsHook.ts.
 */
export type FateMapPref = 'fog' | 'spin' | 'marks' | 'sites';

export const FATE_MAP_PREF_KEYS: Record<FateMapPref, string> = {
  fog: 'fate_chunked_fog_v1',
  spin: 'fate_chunked_spin_v1',
  marks: 'fate_chunked_marks_v1',
  sites: 'fate_chunked_sites_v1',
};
/** This page's choices, for when storage is blocked. */
export const fateMapPrefMemory: Partial<Record<FateMapPref, boolean>> = {};

export const readFateMapPref = (pref: FateMapPref): boolean => {
  try {
    const raw = localStorage.getItem(FATE_MAP_PREF_KEYS[pref]);
    if (raw === 'off') return false;
    if (raw === 'on') return true;
  } catch { /* storage blocked: this page's choice, else the default */ }
  return fateMapPrefMemory[pref] ?? true;
};
