/**
 * The words the Fate Locked RuneLite plugin and this app's RuneLite guide share (Stage 3, U12).
 *
 * `npm run goldens:write` writes RUNELITE_WORDING to contracts/golden-bundles/runelite-wording.json,
 * which the plugin copies at a pinned commit with the other golden files. The plugin's build fails
 * when one of its terms, settings or sidebar cards differs from this, and runeliteWording.test.ts
 * fails when the guide does, so the guide can't drift from the release it describes.
 */

import { RUNELITE_TERMS } from './runeliteTerms';

export { RUNELITE_TERMS };

export interface AvoidedWord {
  /** Matched as a whole word or phrase, case and all. */
  readonly word: string;
  /** What to say instead. */
  readonly use: string;
}

/** Old or loose words neither the plugin nor the guide says. */
export const RUNELITE_AVOIDED_WORDS: readonly AvoidedWord[] = [
  { word: 'Guardian', use: 'Strict Mode' },
  { word: 'Special keys', use: 'Omni-Keys' },
  { word: 'Omni keys', use: 'Omni-Keys' },
  { word: 'Omni-keys', use: 'Omni-Keys' },
  { word: 'Chaos keys', use: 'Chaos Keys' },
  { word: 'fate points', use: 'Fate Points' },
  { word: 'Fate points', use: 'Fate Points' },
  { word: 'content box', use: 'the Detailed HUD' },
  { word: 'Current chunk', use: 'Here' },
];

export const RUNELITE_SETTING_SECTIONS = [
  'Tracker',
  'Strict Mode',
  'Alerts',
  'Display',
  'Custom colours',
  'Backup',
] as const;

export type RuneliteSettingSection = typeof RUNELITE_SETTING_SECTIONS[number];

export interface RuneliteSetting {
  /** The key RuneLite stores it under, in the fatelocked group. */
  readonly key: string;
  readonly section: RuneliteSettingSection;
  /** Its name in RuneLite's config panel. */
  readonly name: string;
  /**
   * Its value on a new profile, as the config panel shows it: On or Off, the choice's name,
   * "Not set" for a hotkey, or a colour as #aarrggbb.
   */
  readonly defaultValue: string;
  /** A choice's options, in the order the config panel lists them. */
  readonly options?: readonly string[];
}

/** The plugin's settings, in the order RuneLite's config panel shows them. */
export const RUNELITE_SETTINGS: readonly RuneliteSetting[] = [
  { key: 'trackerNetworkAccess', section: 'Tracker', name: 'Online sync', defaultValue: 'Off' },
  { key: 'strictMode', section: 'Strict Mode', name: 'Strict Mode', defaultValue: 'Off' },
  { key: 'pauseStrictModeHotkey', section: 'Strict Mode', name: 'Pause hotkey', defaultValue: 'Not set' },
  {
    key: 'lockedAreaAlert',
    section: 'Alerts',
    name: 'Locked-area alert',
    defaultValue: 'Chat, sound and fade',
    options: ['Off', 'Chat', 'Chat and fade', 'Chat and sound', 'Chat, sound and fade'],
  },
  { key: 'announceAreaChanges', section: 'Alerts', name: 'Announce every area change', defaultValue: 'On' },
  { key: 'ruleWarnings', section: 'Alerts', name: 'Rule warnings', defaultValue: 'On' },
  { key: 'tagLockedOptions', section: 'Alerts', name: 'Tag locked right-click options', defaultValue: 'On' },
  { key: 'rollNudges', section: 'Alerts', name: 'Roll reminders', defaultValue: 'On' },
  { key: 'useNotifier', section: 'Alerts', name: 'Also send RuneLite notifications', defaultValue: 'Off' },
  {
    key: 'hudMode',
    section: 'Display',
    name: 'HUD',
    defaultValue: 'Compact',
    options: ['Off', 'Compact', 'Detailed'],
  },
  {
    key: 'worldMapMode',
    section: 'Display',
    name: 'World map',
    defaultValue: 'Shading, tooltip and contents',
    options: ['Off', 'Shading', 'Shading and tooltip', 'Shading, tooltip and contents'],
  },
  { key: 'worldMapMarkers', section: 'Display', name: 'Pin locked areas on the world map', defaultValue: 'Off' },
  {
    key: 'chunkBorders',
    section: 'Display',
    name: 'Chunk borders in the game view',
    defaultValue: 'Locked edges',
    options: ['Off', 'Locked edges', 'All edges'],
  },
  { key: 'shadeNearbyLocked', section: 'Display', name: 'Shade locked land nearby', defaultValue: 'On' },
  { key: 'drawMinimap', section: 'Display', name: 'Minimap chunk borders', defaultValue: 'On' },
  { key: 'showInfoBoxes', section: 'Display', name: 'Infoboxes', defaultValue: 'Off' },
  {
    key: 'colourPreset',
    section: 'Display',
    name: 'Colours',
    defaultValue: 'Default',
    options: ['Default', 'Colour-blind safe', 'Custom'],
  },
  { key: 'unlockedColor', section: 'Custom colours', name: 'Unlocked', defaultValue: '#6e10b981' },
  { key: 'frontierColor', section: 'Custom colours', name: 'Frontier', defaultValue: '#64f59e0b' },
  { key: 'lockedColor', section: 'Custom colours', name: 'Locked', defaultValue: '#6eef4444' },
  { key: 'reimportHotkey', section: 'Backup', name: 'Import from clipboard hotkey', defaultValue: 'Not set' },
];

/** The sidebar's cards below its status card, top to bottom, by their titles. */
export const RUNELITE_SIDEBAR_CARDS = [
  'Here',
  'Strict Mode',
  'Run',
  'Roll inbox',
  'Connection & backup',
] as const;

/** Everything above, as runelite-wording.json holds it for the plugin. */
export const RUNELITE_WORDING = {
  version: 1,
  terms: RUNELITE_TERMS,
  avoidedWords: RUNELITE_AVOIDED_WORDS,
  settingSections: RUNELITE_SETTING_SECTIONS,
  settings: RUNELITE_SETTINGS,
  sidebarCards: RUNELITE_SIDEBAR_CARDS,
} as const;
