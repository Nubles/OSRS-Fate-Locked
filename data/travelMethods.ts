/**
 * Travel methods that RuneLite can recognise by id: spells by spellbook and
 * name, and items, objects and NPCs by their ids. Each lists its menu
 * options and where they go, so the app can decide each option for a run
 * (utils/travelDecisions.ts) and the plugin only looks the decision up.
 *
 * Reviewed by hand. Every row cites its source; destinations are chunk keys
 * of land, ocean or interiors ("cx,cy").
 */

export type SpellBook = 'standard' | 'ancient' | 'lunar' | 'arceuus';

/** How the plugin recognises a method: exactly one of these. */
export type TravelMatch =
  | { spell: { book: SpellBook; name: string } }
  | { items: readonly number[] }
  | { objects: readonly number[] }
  | { npcs: readonly number[] };

export interface TravelOption {
  /** Where the option can take the player; one chunk means the destination is certain. */
  to: readonly string[];
}

export interface TravelMethod {
  /** Stable id, such as "spell:lumbridge-teleport". */
  id: string;
  label: string;
  /** Unlock ids from MOBILITY_LIST, ARCANA_LIST or POH_LIST; all of them are needed. */
  unlocks: readonly string[];
  match: TravelMatch;
  /** Keyed by the menu option's exact text. */
  options: Readonly<Record<string, TravelOption>>;
  /** Tag-only: never blocked, whatever the decision. */
  advisory?: boolean;
  /** Fairy ring codes and where they go. */
  codes?: Readonly<Record<string, TravelOption>>;
  source: string;
}

/** Menu options that are never travel; a travel row must not name one. */
export const NON_TRAVEL_OPTIONS: readonly string[] = [
  'Walk here', 'Attack', 'Talk-to', 'Trade', 'Bank', 'Collect', 'Deposit', 'Wear', 'Wield', 'Equip', 'Remove',
  'Use', 'Drop', 'Examine', 'Check', 'Configure', 'Inspect', 'Pickpocket', 'Follow', 'Cancel',
];

const CHUNK_PICKER_MAGIC = 'Chunk Picker export, challenges.Magic (data/sources/chunkpicker-chunkinfo-export.json.gz)';

export const TRAVEL_METHODS: readonly TravelMethod[] = [
  {
    id: 'spell:lumbridge-teleport',
    label: 'Lumbridge Teleport',
    unlocks: [],
    match: { spell: { book: 'standard', name: 'Lumbridge Teleport' } },
    options: { Cast: { to: ['50,50'] } },
    source: `${CHUNK_PICKER_MAGIC}: "Cast ~|lumbridge teleport|~", chunk 12850`,
  },
  {
    id: 'spell:falador-teleport',
    label: 'Falador Teleport',
    unlocks: [],
    match: { spell: { book: 'standard', name: 'Falador Teleport' } },
    options: { Cast: { to: ['46,52'] } },
    source: `${CHUNK_PICKER_MAGIC}: "Cast ~|falador teleport|~", chunk 11828`,
  },
  {
    id: 'spell:senntisten-teleport',
    label: 'Senntisten Teleport',
    unlocks: ['Ancient Magicks'],
    match: { spell: { book: 'ancient', name: 'Senntisten Teleport' } },
    options: { Cast: { to: ['52,52'] } },
    source: `${CHUNK_PICKER_MAGIC}: "Cast ~|senntisten teleport|~", chunk 13364`,
  },
];
