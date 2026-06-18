// Per-encounter key-roll tier for every entry in BOSSES_LIST.
//
// Replaces the old vague "Low/Mid/High boss" buttons: the Farm Keys UI now lists
// every boss by name with its own rate, grouped by these tiers, so it's obvious
// which encounter sits where. Raids live here too (CoX/ToB/ToA), so they're no
// longer three identical buttons.
//
// Tiers are a difficulty judgement (entry → endgame) and are intentionally easy
// to tweak in one place. A consistency test asserts every BOSSES_LIST entry is
// classified here.

import { DropSource } from '../types';

export type BossTier = 'low' | 'mid' | 'high' | 'raid';

export const BOSS_TIERS: Record<string, BossTier> = {
  // ── Raids ──────────────────────────────────────────────────────────────────
  'Chambers of Xeric': 'raid',
  'Theatre of Blood': 'raid',
  'Tombs of Amascut': 'raid',

  // ── High (endgame solo/duo, DT2, Inferno, wave survival) ────────────────────
  'The Gauntlet': 'high',
  'The Nightmare': 'high',
  "Phosani's Nightmare": 'high',
  'Nex': 'high',
  'Corporeal Beast': 'high',
  'Araxxor': 'high',
  'Fortis Colosseum': 'high',
  'Duke Sucellus': 'high',
  'The Leviathan': 'high',
  'The Whisperer': 'high',
  'Vardorvis': 'high',
  'Inferno': 'high',
  'Yama': 'high',
  'Doom of Mokhaiotl': 'high',

  // ── Mid (god wars, mid-game slayer/wildy bosses, Zulrah/Vorkath…) ───────────
  'General Graardor': 'mid',
  'Commander Zilyana': 'mid',
  "Kree'arra": 'mid',
  "K'ril Tsutsaroth": 'mid',
  'Abyssal Sire': 'mid',
  'Alchemical Hydra': 'mid',
  'Cerberus': 'mid',
  'Grotesque Guardians': 'mid',
  'Kraken': 'mid',
  'Skotizo': 'mid',
  'Thermonuclear Smoke Devil': 'mid',
  'Artio': 'mid',
  'Callisto': 'mid',
  "Calvar'ion": 'mid',
  'Chaos Elemental': 'mid',
  'Spindel': 'mid',
  'Venenatis': 'mid',
  "Vet'ion": 'mid',
  'Vorkath': 'mid',
  'Galvek': 'mid',
  'The Hueycoatl': 'mid',
  'Kalphite Queen': 'mid',
  'Phantom Muspah': 'mid',
  'Zulrah': 'mid',
  'TzHaar Fight Cave': 'mid',
  "TzHaar-Ket-Rak's Challenges": 'mid',
  'Tormented Demons': 'mid',

  // ── Low (entry bosses, skilling bosses, low wildy, mini-encounters) ─────────
  'Chaos Fanatic': 'low',
  'Crazy Archaeologist': 'low',
  'Scorpia': 'low',
  'Moons of Peril': 'low',
  'Barrows Brothers': 'low',
  'Bryophyta': 'low',
  'Dagannoth Kings': 'low',
  'Deranged Archaeologist': 'low',
  'Giant Mole': 'low',
  'Hespori': 'low',
  'King Black Dragon': 'low',
  'Mimic': 'low',
  'Obor': 'low',
  'Sarachnis': 'low',
  'Scurrius': 'low',
  'Wintertodt': 'low',
  'Tempoross': 'low',
  'Zalcano': 'low',
  'Amoxliatl': 'low',
  'The Royal Titans': 'low',
  'Gemstone Crab': 'low',
  'Shellbane Gryphon': 'low',
};

export const TIER_SOURCE: Record<BossTier, DropSource> = {
  low: DropSource.BOSS_LOW,
  mid: DropSource.BOSS_MID,
  high: DropSource.BOSS_HIGH,
  raid: DropSource.RAID,
};

export const TIER_LABEL: Record<BossTier, string> = { low: 'Low', mid: 'Mid', high: 'High', raid: 'Raid' };

/** Display order of tiers (best rate first). */
export const TIER_ORDER: BossTier[] = ['raid', 'high', 'mid', 'low'];

export const bossTier = (name: string): BossTier => BOSS_TIERS[name] ?? 'mid';
