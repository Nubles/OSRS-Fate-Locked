/**
 * Progressive disclosure — which app surfaces a run has "earned" yet.
 *
 * A fresh run shows only the core loop (Farm → Spend, Character tab). Every
 * other surface reveals itself when the run hits a milestone that makes it
 * relevant (first roll → History, first Fate Point → Altar, …). Because the
 * gates derive purely from game state, mature runs and imported saves
 * auto-graduate: they instantly see everything, no migration needed.
 *
 * Every milestone also carries a history-length fallback so nothing can stay
 * hidden forever on an unusual run.
 *
 * Consumers read through useFeatureGates (hooks/useFeatureGates.ts); the
 * FeatureRevealDriver component watches the set and celebrates additions.
 * `revealAllFeatures` (settings toggle) and the command palette are the
 * escape hatches — the palette can always jump anywhere.
 */
import type { GameState, UnlockState } from '../types';

export type FeatureId =
  | 'ctrl:LOG'        // History tab in the control panel
  | 'dash:AUTOROLL'   // Sync & Roll dashboard tab
  | 'dash:WORLD'      // World dashboard tab
  | 'dash:ACTIVITIES' // Activities & Utility dashboard tab
  | 'dash:JOURNAL'    // Journal dashboard tab
  | 'dash:COLLECTION' // Collection Log dashboard tab
  | 'tool:altar'      // Void Altar header button
  | 'tool:stats'      // Stats modal header button
  | 'tool:strategy'   // Strategy Guide header button
  | 'tool:supply';    // Resource Engine header button

/** The slice of GameState the gates read — keeps tests tiny. */
export type GateInput = Pick<GameState, 'history' | 'unlocks' | 'fatePoints' | 'revealAllFeatures'>;

const countActivityUnlocks = (u: UnlockState): number =>
  (u.bosses?.length ?? 0) + (u.minigames?.length ?? 0) + (u.guilds?.length ?? 0) +
  (u.farming?.length ?? 0) + (u.mobility?.length ?? 0) + (u.arcana?.length ?? 0) +
  (u.housing?.length ?? 0) + (u.merchants?.length ?? 0) + (u.storage?.length ?? 0) +
  (u.slayerUnlocks?.length ?? 0) + (u.banks?.length ?? 0);

interface GateDef {
  id: FeatureId;
  /** Milestone that reveals the feature. */
  when: (s: GateInput) => boolean;
  /** History-length fallback so nothing hides forever. */
  fallbackHistory: number;
  /** Toast copy on reveal. */
  revealMessage: string;
  /** CSS selector to pulse on reveal (see utils/flash). */
  flashSelector?: string;
}

const DASH_TABS_SELECTOR = '[data-tour="dashtabs"]';

export const FEATURE_GATES: GateDef[] = [
  {
    id: 'ctrl:LOG',
    when: (s) => s.history.length >= 1,
    fallbackHistory: 1,
    revealMessage: 'History unlocked — every roll is recorded (and tamper-evident)',
  },
  {
    id: 'dash:JOURNAL',
    when: (s) => s.history.length >= 1,
    fallbackHistory: 1,
    revealMessage: 'Journal unlocked — quests, diaries & CAs are how you farm Keys',
    flashSelector: DASH_TABS_SELECTOR,
  },
  {
    id: 'dash:AUTOROLL',
    when: (s) => s.history.length >= 2,
    fallbackHistory: 2,
    revealMessage: 'Sync & Roll unlocked — connect RuneLite or the hiscores',
    flashSelector: DASH_TABS_SELECTOR,
  },
  {
    id: 'dash:WORLD',
    when: (s) => (s.unlocks.regions.length + (s.unlocks.chunks?.length ?? 0)) >= 1,
    fallbackHistory: 3,
    revealMessage: 'World unlocked — see your territory on the map',
    flashSelector: DASH_TABS_SELECTOR,
  },
  {
    id: 'tool:strategy',
    when: (s) => s.history.length >= 3,
    fallbackHistory: 3,
    revealMessage: 'Strategy Guide unlocked — goals and route ideas for your run',
    flashSelector: '[data-reveal="tools"]',
  },
  {
    id: 'tool:altar',
    when: (s) => s.fatePoints > 0 || s.history.some((h) => h.type === 'ALTAR' || h.type === 'PITY'),
    fallbackHistory: 6,
    revealMessage: 'The Void Altar stirs — spend Fate Points on rituals',
    flashSelector: '[data-tour="altar"]',
  },
  {
    id: 'tool:stats',
    when: (s) => s.history.length >= 5,
    fallbackHistory: 5,
    revealMessage: 'Stats unlocked — charts of your luck and progress',
    flashSelector: '[data-reveal="tools"]',
  },
  {
    id: 'dash:ACTIVITIES',
    when: (s) => countActivityUnlocks(s.unlocks) >= 1,
    fallbackHistory: 8,
    revealMessage: 'Activities & Utility unlocked — bosses, minigames, guilds and more',
    flashSelector: DASH_TABS_SELECTOR,
  },
  {
    id: 'tool:supply',
    when: (s) =>
      Object.keys(s.unlocks.skills ?? {}).length >= 1 || s.unlocks.regions.length >= 1,
    fallbackHistory: 6,
    revealMessage: 'Resource Engine unlocked — what can you actually craft & gather?',
    flashSelector: '[data-reveal="tools"]',
  },
  {
    id: 'dash:COLLECTION',
    when: (s) => (s.unlocks.bosses?.length ?? 0) + (s.unlocks.minigames?.length ?? 0) >= 1,
    fallbackHistory: 12,
    revealMessage: 'Collection Log unlocked — track your obtainable drops',
    flashSelector: DASH_TABS_SELECTOR,
  },
];

export const ALL_FEATURE_IDS: FeatureId[] = FEATURE_GATES.map((g) => g.id);

const gateOpen = (g: GateDef, s: GateInput): boolean =>
  g.when(s) || s.history.length >= g.fallbackHistory;

/** The set of features this run has revealed. */
export function visibleFeatures(s: GateInput): Set<FeatureId> {
  if (s.revealAllFeatures) return new Set(ALL_FEATURE_IDS);
  return new Set(FEATURE_GATES.filter((g) => gateOpen(g, s)).map((g) => g.id));
}

export const isFeatureVisible = (id: FeatureId, s: GateInput): boolean =>
  visibleFeatures(s).has(id);

export const gateMeta = (id: FeatureId): GateDef | undefined =>
  FEATURE_GATES.find((g) => g.id === id);
