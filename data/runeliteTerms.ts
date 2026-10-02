/**
 * The plugin's words, shared with this app's RuneLite guide and its Roll Inbox (Stage 3, U12; Stage 4).
 * A module of its own, so a screen that says one of them doesn't bring the guide's wording
 * (runeliteWording.ts, which re-exports these) into the entry chunk.
 */

/** The plugin's words for statuses, features and currencies, by the name of its constant. */
export const RUNELITE_TERMS = {
  UNLOCKED: 'Unlocked',
  CAN_DO: 'Can do',
  NOT_READY: 'Not ready',
  LOCKED: 'Locked',
  NEEDS_CHECKING: 'Needs checking',
  UNCHARTED: 'Uncharted',
  FRONTIER: 'Frontier',
  STRICT_MODE: 'Strict Mode',
  KEYS: 'Keys',
  OMNI_KEYS: 'Omni-Keys',
  CHAOS_KEYS: 'Chaos Keys',
  FATE_POINTS: 'Fate Points',
  DIFFERENT_CHARACTER: 'Different character',
  /** The Roll inbox card's button that copies what RuneLite noticed (Stage 4). */
  COPY_FOR_TRACKER: 'Copy for tracker',
  /** The Roll Inbox's button that brings in what was copied in RuneLite. */
  PASTE_FROM_RUNELITE: 'Paste from RuneLite',
  /** An event in the Roll inbox card that hasn't been copied yet. */
  NEW: 'New',
  /** An event in the Roll inbox card that has been copied for the tracker. */
  COPIED: 'Copied',
  /** What the plugin adds to a right-click option the rules lock. */
  LOCKED_TAG: ' (Locked)',
} as const;
