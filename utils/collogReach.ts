/**
 * Reachable Collection Log %.
 *
 * The raw collected % tells you how much of the log you've filled. This tells
 * you how much is even *obtainable right now* given your unlocks — every log
 * slot lives on a page named after its source (a boss / minigame / activity),
 * so a slot is obtainable when its source is unlocked.
 *
 * Coverage: the Bosses, Raids and Minigames tabs map their pages cleanly to
 * BOSSES_LIST / MINIGAMES_LIST unlock state (the same mapping the consistency
 * tests enforce). Clues and Other have no single gating source, so they're
 * counted as a baseline-available bucket and flagged as approximate.
 */

import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import { BOSSES_LIST, MINIGAMES_LIST } from '../data/items';
import { UnlockState } from '../types';

// A few Collection Log boss pages display differently from the unlock table or
// bundle several bosses; map each page to the BOSSES_LIST entry/entries it needs.
const BOSS_PAGE_ALIASES: Record<string, string[]> = {
  'Barrows Chests': ['Barrows Brothers'],
  'Fight Caves': ['TzHaar Fight Cave'],
  'The Inferno': ['Inferno'],
  'Royal Titans': ['The Royal Titans'],
  'Venenatis and Spindel': ['Venenatis', 'Spindel'],
  "Vet'ion and Calvar'ion": ["Vet'ion", "Calvar'ion"],
};
// Joke/novelty pages with no real unlock gate — treated as baseline-available.
const BASELINE_BOSS_PAGES = new Set<string>(['Brutus']);

/** Tabs whose pages gate on an unlock; the rest are baseline-available. */
const GATED_TABS = new Set(['Bosses', 'Raids', 'Minigames']);

export interface CollogTabReach {
  tab: string;
  obtainable: number;
  total: number;
  /** True when this tab's slots gate on unlocks (Bosses/Raids/Minigames). */
  gated: boolean;
}

export interface CollogUnlockSuggestion {
  page: string;
  tab: string;
  items: number;
  /** The unlock that would make this page obtainable. */
  unlock: string;
  kind: 'boss' | 'minigame';
}

export interface CollogReach {
  obtainable: number;
  total: number;
  pct: number;
  /** Slots gated by unlocks (Bosses/Raids/Minigames) — the meaningful portion. */
  gatedObtainable: number;
  gatedTotal: number;
  tabs: CollogTabReach[];
  /** Locked pages ranked by how many slots they'd add, top first. */
  suggestions: CollogUnlockSuggestion[];
  /** True when Clues/Other are counted as baseline — headline % is approximate. */
  baselineFlagged: boolean;
}

/** Resolve whether a Bosses/Raids page's source is unlocked. */
const bossPageObtainable = (page: string, bossSet: Set<string>, unlocked: Set<string>):
  { obtainable: boolean; gated: boolean; missing?: string } => {
  if (BASELINE_BOSS_PAGES.has(page)) return { obtainable: true, gated: false };
  const targets = bossSet.has(page) ? [page] : BOSS_PAGE_ALIASES[page];
  if (!targets) return { obtainable: true, gated: false }; // unknown source → don't penalise
  const obtainable = targets.some(t => unlocked.has(t));
  return { obtainable, gated: true, missing: obtainable ? undefined : page };
};

export function collogReachability(unlocks: UnlockState): CollogReach {
  const bossSet = new Set(BOSSES_LIST);
  const miniSet = new Set(MINIGAMES_LIST);
  const unlockedBosses = new Set(unlocks.bosses ?? []);
  const unlockedMinis = new Set(unlocks.minigames ?? []);

  const tabs: CollogTabReach[] = [];
  const suggestions: CollogUnlockSuggestion[] = [];
  let obtainable = 0, total = 0, gatedObtainable = 0, gatedTotal = 0;

  for (const [tabName, tab] of Object.entries(COLLECTION_LOG_DATA)) {
    const gated = GATED_TABS.has(tabName);
    let tabObtainable = 0, tabTotal = 0;

    for (const page of Object.values(tab.pages)) {
      const n = page.items.length;
      tabTotal += n;

      if (!gated) { tabObtainable += n; continue; } // Clues / Other → baseline

      if (tabName === 'Minigames') {
        const ok = !miniSet.has(page.name) || unlockedMinis.has(page.name);
        if (ok) tabObtainable += n;
        else suggestions.push({ page: page.name, tab: tabName, items: n, unlock: page.name, kind: 'minigame' });
        if (miniSet.has(page.name)) gatedTotal += n;
        if (miniSet.has(page.name) && ok) gatedObtainable += n;
      } else {
        const r = bossPageObtainable(page.name, bossSet, unlockedBosses);
        if (r.obtainable) tabObtainable += n;
        else suggestions.push({ page: page.name, tab: tabName, items: n, unlock: r.missing ?? page.name, kind: 'boss' });
        if (r.gated) { gatedTotal += n; if (r.obtainable) gatedObtainable += n; }
      }
    }

    tabs.push({ tab: tabName, obtainable: tabObtainable, total: tabTotal, gated });
    obtainable += tabObtainable;
    total += tabTotal;
  }

  suggestions.sort((a, b) => b.items - a.items || a.page.localeCompare(b.page));

  return {
    obtainable,
    total,
    pct: total ? Math.round((obtainable / total) * 100) : 0,
    gatedObtainable,
    gatedTotal,
    tabs,
    suggestions,
    baselineFlagged: true,
  };
}
