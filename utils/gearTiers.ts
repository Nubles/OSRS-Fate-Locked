/**
 * Derives an "estimated tier" (1..EQUIPMENT_TIER_MAX) for every real item, per
 * slot, so real gear can be gated by the fate-lock tier the player has unlocked.
 *
 * There's no canonical item→tier map in OSRS, so we compute a transparent power
 * score from each item's bonuses and split each slot's items into equal-sized
 * quantile buckets. This is automatic (no manual data), monotonic (a stronger
 * item never lands in a lower tier than a weaker one in the same slot), and the
 * weights live here so the mapping can be retuned without touching the UI.
 *
 * Pure + tested.
 */

import { GearBonuses } from './gearStats';
import { EQUIPMENT_TIER_MAX } from '../config/rules';

/**
 * Canonical material → tier, mirroring the Codex's "Equipment Tiers" table so
 * the two views agree (Rune = T5, Dragon = T6, Barrows = T7, …). Matches by item
 * name. Returns null for items whose material we can't recognise (uniques,
 * cosmetics, quest items) — the caller then falls back to the power-score
 * quantile estimate. Rules are ordered most-specific / highest-tier first so
 * ambiguous words resolve correctly (e.g. "Black d'hide" → T7 before plain
 * "Black" metal → T2; "Dragon hunter" → T9 before plain "Dragon" → T6).
 *
 * Codex reference (keep in sync with components/ReferenceModal.tsx):
 *   T1 Bronze/Iron/Leather  T2 Steel/Black/Studded  T3 Mithril/Initiate
 *   T4 Adamant/Green d'hide  T5 Rune/Blue d'hide  T6 Dragon/Red d'hide/Magic bow
 *   T7 Barrows/Black d'hide/Obsidian  T8 God Wars/Zenyte/Trident  T9 Raids/Endgame
 */
export const canonicalTierFromName = (name: string): number | null => {
  const s = name.toLowerCase();
  const dhide = '(d.?hide|dragonhide|dragon\\s*leather)';
  const bow = '(short|long|comp(osite)?)?\\s*bow';

  // T9 — raids / endgame
  if (/(ancestral|torva|masori|twisted bow|scythe of vitur|sanguinesti|tumeken|justiciar|avernic|primordial|pegasian|eternal boot|dragon hunter|inquisitor|harmonised|volatile|eldritch|nightmare staff|venator|ultor|magus|bellator|lightbearer|elidinis|osmumten|virtus|zaryte)/.test(s)) return 9;

  // T8 — God Wars / Zenyte / high-end
  if (/(bandos|armadyl|saradomin sword|saradomin's blessed|zamorakian|godsword|zenyte|amulet of anguish|necklace of anguish|amulet of torture|ring of suffering|tormented bracelet|occult|trident|staff of the dead|toxic staff|serpentine|magma helm|tanzanite helm|dragonfire|dragon warhammer|dragon claws|crystal (helm|body|legs|armour|bow|shield|halberd)|faerdhinen|elysian|spectral|arcane spirit|ferocious gloves|brimstone ring|infernal cape)/.test(s)) return 8;

  // T7 — Barrows / Black d'hide / Obsidian
  if (/(ahrim|karil|dharok|guthan|torag|verac|obsidian|tzhaar|toktz|tztok|void knight|elite void|fighter torso|amulet of fury|berserker necklace)/.test(s)) return 7;
  if (new RegExp(`black\\s*${dhide}`).test(s)) return 7;

  // T6 — Dragon (metal) / Red d'hide / Magic bow / Ancient staff
  if (new RegExp(`red\\s*${dhide}`).test(s)) return 6;
  if (new RegExp(`magic\\s*${bow}`).test(s)) return 6;
  if (/ancient staff/.test(s)) return 6;
  if (/\bdragon\b/.test(s)) return 6;

  // T5 — Rune / Blue d'hide / Yew bow / Iban
  if (new RegExp(`blue\\s*${dhide}`).test(s)) return 5;
  if (/\brun(e|ite)\b/.test(s)) return 5;
  if (new RegExp(`yew\\s*${bow}`).test(s)) return 5;
  if (/iban/.test(s)) return 5;

  // T4 — Adamant / Green d'hide / Maple bow / Mystic
  if (new RegExp(`green\\s*${dhide}`).test(s)) return 4;
  if (/adamant(ite)?/.test(s)) return 4;
  if (new RegExp(`maple\\s*${bow}`).test(s)) return 4;
  if (/mystic/.test(s)) return 4;

  // T3 — Mithril / Initiate / Willow bow / Xerician
  if (/mithril/.test(s)) return 3;
  if (/initiate/.test(s)) return 3;
  if (new RegExp(`willow\\s*${bow}`).test(s)) return 3;
  if (/xerician/.test(s)) return 3;

  // T2 — Steel / Black (metal) / Studded / Oak bow
  if (/steel/.test(s)) return 2;
  if (/\bblack\b/.test(s)) return 2;
  if (/studded/.test(s)) return 2;
  if (new RegExp(`oak\\s*${bow}`).test(s)) return 2;

  // T1 — Bronze / Iron / Leather / Wooden
  if (/bronze|\biron\b|wooden|\bleather\b|hard leather|training/.test(s)) return 1;

  return null;
};

/** Single scalar "power" for an item, from its bonuses. Higher = stronger. */
export const powerScore = (b: GearBonuses): number => {
  const offence =
    Math.max(b.stab, b.slash, b.crush, b.ranged, b.magic) +
    Math.max(b.meleeStr, 0) +
    Math.max(b.rangedStr, 0) +
    8 * Math.max(b.magicStr, 0);
  const defence =
    b.defStab + b.defSlash + b.defCrush + b.defMagic + b.defRanged +
    2 * Math.max(b.prayer, 0);
  return offence + 0.6 * Math.max(0, defence);
};

/**
 * Assign tiers 1..EQUIPMENT_TIER_MAX to a slot's items by quantile of score.
 * Returns a Map of item id → tier. Ties are broken by sorted position, so the
 * result is always monotonic in score. With fewer items than tiers the upper
 * tiers simply go unused.
 */
export const assignTiersForSlot = (
  items: { id: number; score: number }[],
  tierMax: number = EQUIPMENT_TIER_MAX,
): Map<number, number> => {
  const out = new Map<number, number>();
  const n = items.length;
  if (n === 0) return out;
  const sorted = [...items].sort((a, b) => a.score - b.score);
  sorted.forEach((item, i) => {
    // rank fraction in [0,1) → tier in 1..tierMax
    const tier = Math.min(tierMax, Math.floor((i / n) * tierMax) + 1);
    out.set(item.id, tier);
  });
  return out;
};
