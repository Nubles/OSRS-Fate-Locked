// Key reserve for every entry in MINIGAMES_LIST (Vanilla only).
//
// In Vanilla each unlocked minigame pays a few Standard Keys and then stops,
// the same way bosses do. The numbers come from the minigame research
// (October 2026): how long one run takes and how big its Collection Log page is.
//
// - Every minigame is worth about 3 Keys. Each new Collection Log slot already
//   rolls for a Key at 8%, so the reserve tops the log up to about 3: 3 Keys
//   with no log page, fewer for a big one, never less than 1.
// - The first Key's chance per run is minutes per run ÷ 60, capped at 50%, so
//   it takes about an hour of play. Each Key won halves the next one's chance.
//   Chances are whole percents, never below 1%, so the shortest minigames sit
//   at 1% for every Key.
// - Mage Arena (a one-off) pays one guaranteed Key. Tears of Guthix (weekly)
//   holds one Key at 50% a visit.
//
// A consistency test asserts every MINIGAMES_LIST entry is listed here.

export interface MinigameReserveSpec {
  /** How long one finished run takes an experienced player, in minutes. */
  minutes: number;
  /** Slots on its Collection Log page (0 when it has none). */
  clogSlots: number;
  /** A single Key at this chance instead of the usual reserve. */
  singleKeyRate?: number;
}

export const MINIGAME_KEY_RESERVES: Record<string, MinigameReserveSpec> = {
  'Archery Competition': { minutes: 0.6, clogSlots: 0 },
  'Barbarian Assault': { minutes: 25, clogSlots: 11 },
  'Barracuda Trials': { minutes: 5, clogSlots: 9 },
  'Blast Furnace': { minutes: 0.5, clogSlots: 0 },
  'Bounty Hunter': { minutes: 8, clogSlots: 0 },
  'Brimhaven Agility Arena': { minutes: 1, clogSlots: 9 },
  'Burthorpe Games Room': { minutes: 8, clogSlots: 0 },
  'Castle Wars': { minutes: 25, clogSlots: 39 },
  'Clan Wars': { minutes: 15, clogSlots: 0 },
  "Emir's Arena": { minutes: 4, clogSlots: 0 },
  'Fishing Trawler': { minutes: 6.5, clogSlots: 4 },
  'Forestry': { minutes: 2, clogSlots: 23 },
  "Giants' Foundry": { minutes: 4, clogSlots: 9 },
  'Gnome Ball': { minutes: 2, clogSlots: 0 },
  'Gnome Restaurant': { minutes: 4, clogSlots: 4 },
  'Guardians of the Rift': { minutes: 10, clogSlots: 17 },
  'Hallowed Sepulchre': { minutes: 8.5, clogSlots: 16 },
  'Impetuous Impulses': { minutes: 2, clogSlots: 0 },
  'Intelligence Gathering': { minutes: 5, clogSlots: 0 },
  'Last Man Standing': { minutes: 10, clogSlots: 32 },
  'Mage Arena': { minutes: 60, clogSlots: 0, singleKeyRate: 100 },
  'Mage Training Arena': { minutes: 0.75, clogSlots: 11 },
  'Mahogany Homes': { minutes: 2, clogSlots: 8 },
  'Mastering Mixology': { minutes: 0.5, clogSlots: 7 },
  'Mess': { minutes: 2.5, clogSlots: 0 },
  'Nightmare Zone': { minutes: 180, clogSlots: 0 },
  'Pest Control': { minutes: 5, clogSlots: 10 },
  'Pyramid Plunder': { minutes: 5, clogSlots: 0 },
  "Rogues' Den": { minutes: 3, clogSlots: 5 },
  "Shades of Mort'ton": { minutes: 15, clogSlots: 14 },
  'Shooting Stars': { minutes: 50, clogSlots: 2 },
  "Sorceress's Garden": { minutes: 0.75, clogSlots: 0 },
  'Soul Wars': { minutes: 18, clogSlots: 3 },
  'Stealing Artefacts': { minutes: 1.25, clogSlots: 0 },
  'Tai Bwo Wannai Cleanup': { minutes: 20, clogSlots: 0 },
  'Tears of Guthix': { minutes: 5, clogSlots: 0, singleKeyRate: 50 },
  'Temple Trekking': { minutes: 2.4, clogSlots: 4 },
  'Tithe Farm': { minutes: 19, clogSlots: 7 },
  'Trouble Brewing': { minutes: 23, clogSlots: 30 },
  'TzHaar Fight Pit': { minutes: 6, clogSlots: 0 },
  'Vale Totems': { minutes: 4, clogSlots: 4 },
  'Volcanic Mine': { minutes: 11, clogSlots: 8 },
  "Warriors' Guild": { minutes: 10, clogSlots: 8 },
};

/** What a whole minigame aims to be worth, Collection Log rolls included. */
export const MINIGAME_KEY_VALUE_TARGET = 3;
/** What one Collection Log slot is worth in Keys: its one 8% roll. */
export const CLOG_SLOT_KEY_VALUE = 0.08;
/** The first Key's chance never goes above this. */
export const MINIGAME_FIRST_KEY_MAX_RATE = 50;
/** No Key's chance goes below this. */
export const MINIGAME_KEY_MIN_RATE = 1;

const wholeRate = (rate: number): number => Math.max(MINIGAME_KEY_MIN_RATE, Math.round(rate));

/** The Keys a minigame's reserve holds, after its Collection Log's share. */
export const minigameReserveSize = (spec: MinigameReserveSpec): number => {
  if (spec.singleKeyRate !== undefined) return 1;
  return Math.max(1, Math.round(MINIGAME_KEY_VALUE_TARGET - spec.clogSlots * CLOG_SLOT_KEY_VALUE));
};

/** Its chance per run for each Key in order: about an hour of play for the first, then halving. */
export const minigameReserveRates = (spec: MinigameReserveSpec): number[] => {
  const size = minigameReserveSize(spec);
  if (spec.singleKeyRate !== undefined) return [spec.singleKeyRate];
  const first = wholeRate(Math.min(MINIGAME_FIRST_KEY_MAX_RATE, (spec.minutes / 60) * 100));
  return Array.from({ length: size }, (_, index) => wholeRate(first / 2 ** index));
};
