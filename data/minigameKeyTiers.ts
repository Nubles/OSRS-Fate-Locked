// Key reserve tier for every entry in MINIGAMES_LIST (Vanilla only).
//
// In Vanilla each unlocked minigame pays a few Standard Keys at falling odds,
// then stops, the same way bosses do (config/vanillaKeyEconomy.ts holds the
// rates). Tiers are a judgement of how long one finished run takes, so a
// 30-second Rat Pits fight no longer pays like a full Barbarian Assault run.
// Moving a minigame is a one-line change here. A consistency test asserts every
// MINIGAMES_LIST entry is classified.

export type MinigameTier = 'quick' | 'standard' | 'long';

export const MINIGAME_TIERS: Record<string, MinigameTier> = {
  // ── Long (a full run is a big sitting) ─────────────────────────────────────
  'Barbarian Assault': 'long',
  'Hallowed Sepulchre': 'long',
  'Trouble Brewing': 'long',
  'Volcanic Mine': 'long',

  // ── Standard (one game or session of ordinary length) ──────────────────────
  'Barracuda Trials': 'standard',
  'Blast Furnace': 'standard',
  'Castle Wars': 'standard',
  'Fishing Trawler': 'standard',
  "Giants' Foundry": 'standard',
  'Guardians of the Rift': 'standard',
  'Intelligence Gathering': 'standard',
  'Last Man Standing': 'standard',
  'Mage Training Arena': 'standard',
  'Mastering Mixology': 'standard',
  'Nightmare Zone': 'standard',
  'Pest Control': 'standard',
  'Soul Wars': 'standard',
  'Temple Trekking': 'standard',
  'Tithe Farm': 'standard',
  'TzHaar Fight Pit': 'standard',
  'Vale Totems': 'standard',

  // ── Quick (short loops, single events, weekly visits) ──────────────────────
  'Archery Competition': 'quick',
  'Bounty Hunter': 'quick',
  'Brimhaven Agility Arena': 'quick',
  'Burthorpe Games Room': 'quick',
  'Clan Wars': 'quick',
  "Emir's Arena": 'quick',
  'Forestry': 'quick',
  'Gnome Ball': 'quick',
  'Gnome Restaurant': 'quick',
  'Impetuous Impulses': 'quick',
  'Mage Arena': 'quick',
  'Mahogany Homes': 'quick',
  'Mess': 'quick',
  'Pyramid Plunder': 'quick',
  'Rat Pits': 'quick',
  "Rogues' Den": 'quick',
  "Shades of Mort'ton": 'quick',
  'Shooting Stars': 'quick',
  "Sorceress's Garden": 'quick',
  'Stealing Artefacts': 'quick',
  'Tai Bwo Wannai Cleanup': 'quick',
  'Tears of Guthix': 'quick',
  "Warriors' Guild": 'quick',
};

export const MINIGAME_TIER_LABEL: Record<MinigameTier, string> = { quick: 'Quick', standard: 'Standard', long: 'Long' };

/** Display order of tiers (best rate first). */
export const MINIGAME_TIER_ORDER: MinigameTier[] = ['long', 'standard', 'quick'];

export const minigameTier = (name: string): MinigameTier => MINIGAME_TIERS[name] ?? 'standard';
