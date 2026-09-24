/**
 * Fate equipment tiers are a custom ruleset, not OSRS equip-level bands.
 * Reviewed item families follow the Codex material ladder. Unreviewed items
 * receive an explicitly labelled estimate from the catalogue's stat anchors.
 */

import { GearBonuses } from './gearStats';
import { EQUIPMENT_TIER_MAX } from '../config/rules';

/**
 * Canonical material → tier, mirroring the Codex's "Equipment Tiers" table so
 * the two views agree (Rune = T5, Dragon = T6, Barrows = T7, …). Matches by item
 * name. Returns null for items whose material we can't recognise (uniques,
 * cosmetics, quest items) — the caller then falls back to the stat-anchor
 * estimate. Rules are ordered most-specific / highest-tier first so
 * ambiguous words resolve correctly (e.g. "Black d'hide" → T7 before plain
 * "Black" metal → T2; "Dragon hunter" → T9 before plain "Dragon" → T6).
 *
 * Codex reference (keep in sync with components/ReferenceModal.tsx):
 *   T1 Bronze/Iron/Leather  T2 Steel/Black/White/Studded  T3 Mithril/Initiate
 *   T4 Adamant/Green d'hide  T5 Rune/Blue d'hide  T6 Dragon/Red d'hide/Magic bow
 *   T7 Barrows/Black d'hide/Obsidian  T8 God Wars/Zenyte/Trident  T9 Raids/Endgame
 */
/**
 * Iconic non-material items pinned to a tier so famous gear reads correctly even
 * though its name carries no material word. Checked before the material ladder,
 * ordered most-specific first (e.g. "(i)" / "elite" variants before the base).
 */
const NAMED_TIERS: [RegExp, number][] = [
  // Reviewed quest equipment: The Restless Ghost requires wearing it.
  [/^ghostspeak amulet$/, 1],
  // Quest props, unenchanted jewellery and cosmetic rewards have no combat
  // family, even when their name contains a god, metal or high-end weapon.
  [/^(?:armadyl pendant|dark bow tie|dragon necklace|robe of elidinis \((?:top|bottom)\)|rune satchel|steel coffin|ring of 3rd age|zenyte (?:amulet|bracelet|necklace|ring))$/, 1],
  [/^(?:bronze|iron|steel|mithril|adamant|rune|dragon) (?:dragon mask|staff of collection)$/, 1],
  [/^collection log \(|^crate of (?:adamantite ore|mithril ore|steel bars|xerician fabrics)$| max hood$|^(?:demonic pacts|raging echoes|shattered relics|trailblazer(?: reloaded)?|twisted) (?:bronze|iron|steel|mithril|adamant|rune|dragon) trophy$/, 1],

  // Basic elemental staves have the same magic accuracy and no equip-level
  // requirement. Melee bonuses must not split them across combat-style anchors.
  // https://oldschool.runescape.wiki/w/Elemental_staves
  [/^(?:staff|magic staff|staff of (?:air|water|earth|fire|bob the cat))$/, 1],
  // Pin the progression instead of guessing from magic accuracy or melee hits.
  [/^battlestaff$/, 3],
  [/^(?:air|water|earth|fire|lava|mud|steam|smoke|mist|dust) battlestaff(?: \(or\))?$/, 4],
  [/^beginner wand$/, 2],
  [/^apprentice wand$/, 3],
  [/^teacher wand$/, 4],
  [/^master wand$/, 6],
  [/^kodai wand$/, 9],
  [/^(?:saradomin|guthix|zamorak) staff$/, 6],
  [/^skull sceptre(?: \(i\))?$/, 1],
  [/^warped sceptre$/, 6],
  [/^(?:(?:blood|ice|shadow|smoke) )?ancient sceptre$/, 7],
  [/^slayer's staff$/, 5],
  [/^slayer's staff \(e\)$/, 7],
  // Clue vestments share bonuses across gods. Names alone are not GWD gear.
  [/^(?:ancient|armadyl|bandos|guthix|saradomin|zamorak) crozier$/, 4],
  [/^(?:ancient|armadyl|bandos|guthix|saradomin|zamorak) (?:mitre|stole|cloak|robe top|robe legs)$/, 3],
  [/^(?:ancient|armadyl|bandos|guthix|saradomin|zamorak|brassica|seren) halo$/, 1],
  [/^damaged book \((?:ancient|armadyl|bandos|guthix|saradomin|zamorak)\)$/, 1],
  // The custom Codex groups capes of accomplishment at T6.
  [/^(?:agility|attack|construct\.|construction|cooking|crafting|defence|farming|firemaking|fishing|fletching|herblore|hitpoints|hunter|magic|mining|prayer|ranging|runecraft|runecrafting|sailing|slayer|smithing|strength|thieving|woodcutting|quest point|music|achievement diary|max) cape(?: \(t\))?$/, 6],
  // Gem-tipped bolts retain the underlying metal tier, including enchantments.
  // https://oldschool.runescape.wiki/w/Fletching#Tipped_bolts
  [/^(?:opal|jade|pearl) bolts(?: \(e\))?$/, 1],
  [/^topaz bolts(?: \(e\))?$/, 2],
  [/^(?:sapphire|emerald) bolts(?: \(e\))?$/, 3],
  [/^(?:ruby|diamond) bolts(?: \(e\))?$/, 4],
  [/^(?:dragonstone|onyx) bolts(?: \(e\))?$/, 5],
  [/^broad bolts$/, 4], // Same ranged strength as adamant bolts.
  [/^amethyst broad bolts$/, 5], // Same ranged strength as rune bolts.
  // Intermediate ammunition uses the upper neighbouring Fate material band.
  [/^(?:seeking )?broad arrows$/, 4],
  [/^(?:seeking )?amethyst (?:fire arrow|arrow|dart|javelin)$/, 6],
  // Mechanic-based ranged families need explicit Fate progression; their
  // area damage / ammunition-saving effects are absent from raw bonuses.
  [/^chinchompa$/, 5],
  [/^red chinchompa$/, 6],
  [/^black chinchompa$/, 7],
  [/^swamp lizard$/, 3],
  [/^orange salamander$/, 4],
  [/^red salamander$/, 6],
  [/^black salamander$/, 7],
  [/^tecu salamander$/, 8],
  [/^ava's attractor$/, 3],
  [/^(?:ava's accumulator|accumulator max cape)$/, 5],
  [/^(?:ava's assembler|assembler max cape|masori assembler(?: max cape)?)$/, 7],
  [/^(?:blessed )?dizana's (?:quiver|(?:max )?cape)$/, 9],
  // Cosmetic max-cape combinations inherit the original cape's bonuses.
  [/^infernal (?:max )?cape(?: \(l\))?$/, 9],
  [/^(?:saradomin|guthix|zamorak) max cape(?: \(l\))?$/, 8],
  [/^mythical max cape$/, 6],
  [/^ardougne max cape$/, 6],
  // Clue armour names often omit their underlying material entirely.
  [/^(?:ancient|armadyl|bandos|guthix|saradomin|zamorak) (?:full helm|platebody|platelegs|plateskirt|kiteshield)$/, 5],
  [/^dragonstone (?:full helm|platebody|platelegs|boots)$/, 5],
  // Blessed dragonhide retains black-d'hide progression, with a Prayer bonus.
  [/^(?:ancient|armadyl|bandos|guthix|saradomin|zamorak) (?:d'hide (?:body|boots|shield)|chaps|coif|bracers)$/, 7],
  // Gilded d'hide follows green progression (same offense, higher defence).
  [/^gilded d'hide (?:body|chaps|vambraces)$/, 4],
  [/^gilded spade$|^dragon candle dagger$/, 1],
  // Named reskins inherit their base items, including Prayer/charge variants.
  [/^amulet of eternal glory$/, 4],
  [/^strength amulet \(t\)$/, 3],
  [/^enchanted (?:hat|top|robe)$/, 4],
  [/^(?:hood|robe top|robe bottom|gloves|boots) of darkness$/, 4],
  [/^rock-shell (?:helm|plate|legs)$/, 5],
  [/^spined (?:helm|body|chaps)$/, 4],
  // Spikes do not change the underlying dragonhide vambraces' ranged tier.
  [/^green spiky vambraces$/, 4],
  [/^blue spiky vambraces$/, 5],
  [/^red spiky vambraces$/, 6],
  [/^black spiky vambraces$/, 7],
  // Colour and heraldic motifs do not make an item out of metal.
  [/^(?:black cape|fremennik black cloak|black flowers)$/, 1],
  [/^(?:blue |black )?wizard (?:hat|robe)(?: \([gt]\))?$|^black robe$/, 1],
  [/^anti-dragon shield(?: \(nz\))?$/, 1],

  // Cosmetic league variants keep the underlying equipment tier.
  [/slayer helmet \(i\)|black mask \(i\)/, 7],
  [/slayer helmet|black mask/, 6],
  [/^radiant oathplate/, 8],
  [/^cape of skulls$/, 7],
  // Castle Wars melee sets are steel / mithril / adamant equivalents. Do not
  // match the separate magic or ranged decorative sets.
  [/^decorative (?:armour \(red (?:platebody|platelegs|plateskirt)\)|(?:full helm|helm|shield|boots|sword) \(red\))$/, 2],
  [/^decorative (?:armour \(white (?:platebody|platelegs|plateskirt)\)|(?:full helm|helm|shield|boots|sword) \(white\))$/, 3],
  [/^decorative (?:armour \(gold (?:platebody|platelegs|plateskirt)\)|(?:full helm|helm|shield|boots|sword) \(gold\))$/, 4],

  // weapons whose power comes from mechanics (speed/specs), not raw bonuses
  [/abyssal tentacle|abyssal bludgeon/, 8],
  [/abyssal whip|abyssal dagger/, 7],
  [/(toxic )?blowpipe/, 8],
  [/dark bow/, 6],
  [/zamorakian (hasta|spear)/, 7],
  [/ghrazi rapier|inquisitor's mace/, 9],
  [/granite maul/, 6],
  [/(light|heavy) ballista/, 8],
  [/craw's bow|webweaver|crystal bow/, 8],
  // newer / mechanic weapons the raw-stat fallback mis-rates
  [/voidwaker|elder maul|soulreaper axe|emberlight|tonalztics of ralos/, 8],
  [/burning claws|accursed sceptre|(ursine|viggora's|thammaron's) .*(chainmace|sceptre)|keris partisan/, 7],
  [/dinh's bulwark|amulet of blood fury/, 7],
  [/amulet of rancour/, 9],
  [/tome of (fire|water|earth)/, 7],
  // modern / Colosseum / Varlamore sets whose strength is a set effect or
  // mechanic, not raw bonuses (so a set isn't scattered across tiers).
  [/elite calamity/, 9],
  [/calamity/, 8],
  [/sunfire fanatic/, 8],
  [/echo boots/, 8],
  [/oathplate/, 8],
  [/(blood|blue|eclipse) moon/, 7],
  [/eclipse atlatl/, 7],
  [/dual macuahuitl/, 7],
  [/hueycoatl hide/, 7],
  // prestige / mid items the stat fallback over-rates (high raw defence/accuracy
  // that doesn't reflect real strength), pinned to sensible tiers
  [/3rd age/, 8],
  [/staff of (light|balance)/, 7],
  [/purging staff/, 8],
  // junk Tourist Trap arrows with bogus dataset bonuses (really unusable)
  [/(barbed|blunt|bullet|field) arrow/, 1],
  // capes
  [/infernal cape/, 9],
  [/fire (max )?cape/, 8],
  [/imbued .*cape|(saradomin|guthix|zamorak) cape|god cape/, 8],
  [/(ardougne cloak|mythical cape|cape of accomplishment)/, 6],
  // hands
  [/barrows gloves/, 7],
  [/ferocious gloves/, 9],
  [/dragon gloves/, 6],
  [/rune gloves/, 5],
  // boots
  [/(primordial|pegasian|eternal) boots/, 9],
  [/guardian boots/, 8],
  [/dragon boots/, 6],
  // rings
  [/(berserker|archers?|seers|warrior|treasonous|tyrannical) ring \(i\)/, 8],
  [/(berserker|archers?|seers|warrior|treasonous|tyrannical) ring/, 7],
  // neck
  [/amulet of fury|berserker necklace/, 7],
  [/amulet of glory/, 4],
  [/amulet of (strength|power|defence)/, 3],
  // shields / off-hand
  [/avernic defender/, 9],
  [/elysian|arcane spirit/, 9],
  [/spectral spirit|dragonfire (shield|ward)/, 8],
  [/twisted buckler|crystal shield/, 8],
  [/dragon defender/, 7],
  [/blessed spirit shield|toktz-ket-xil/, 7],
  [/rune defender/, 5],
  // head / body uniques
  [/neitiznot faceguard/, 9],
  [/serpentine helm|magma helm|tanzanite helm/, 8],
  [/helm of neitiznot|fighter torso/, 7],
  [/elite void/, 8],
  [/void (knight|melee|ranger|mage|seal)/, 7],
  [/proselyte/, 5],
  [/^gilded (?:2h sword|axe|boots|chainbody|full helm|hasta|kiteshield|med helm|pickaxe|platebody|platelegs|plateskirt|scimitar|spear|sq shield)$/, 5], // Rune-equivalent pieces only
];

/** God-name / decorative prefixes used by clue-scroll cosmetics. */
const COSMETIC_PREFIX = /(armadyl|bandos|saradomin|zamorak|guthix|ancient|gilded)/;

/**
 * Tier purely from a base material word (metal / dragonhide / bow wood / robe),
 * or null. Used both for the main ladder and to re-tier god-themed clue
 * cosmetics by what they actually are (e.g. "Armadyl d'hide" → standard d'hide,
 * not God Wars). Blessed and gilded sets have explicit rules above.
 */
const materialTier = (s: string): number | null => {
  const dh = '(d.?hide|dragonhide|dragon\\s*leather)';
  const bow = '(short|long|comp(osite)?)?\\s*bow';
  // Dragonhide by colour; named blessed/gilded pieces are matched above.
  if (new RegExp(`black\\s*${dh}`).test(s)) return 7;
  if (new RegExp(`red\\s*${dh}`).test(s)) return 6;
  if (new RegExp(`blue\\s*${dh}`).test(s)) return 5;
  if (new RegExp(`green\\s*${dh}`).test(s)) return 4;
  // bows by wood
  if (new RegExp(`magic\\s*${bow}`).test(s)) return 6;
  if (new RegExp(`yew\\s*${bow}`).test(s)) return 5;
  if (new RegExp(`maple\\s*${bow}`).test(s)) return 4;
  if (new RegExp(`willow\\s*${bow}`).test(s)) return 3;
  if (new RegExp(`oak\\s*${bow}`).test(s)) return 2;
  // robes / staves
  if (/ancient staff/.test(s)) return 6;
  if (/iban/.test(s)) return 5;
  if (/mystic/.test(s)) return 4;
  if (/xerician/.test(s)) return 3;
  if (/initiate/.test(s)) return 3;
  // Heraldic motifs are decorations, not a second material.
  const heraldicMetal = /^(steel|adamant|rune) (?:heraldic helm|kiteshield) \(/.exec(s)?.[1];
  if (heraldicMetal) return { steel: 2, adamant: 4, rune: 5 }[heraldicMetal]!;
  // metals
  if (/^dragon\b|\bdragon (?:bolts|arrow)\b/.test(s)) return 6;
  if (/\brun(e|ite)\b/.test(s)) return 5;
  if (/adamant(ite)?/.test(s)) return 4;
  if (/mithril/.test(s)) return 3;
  if (/steel/.test(s)) return 2;
  if (/^(?:elite )?black (?:2h sword|axe|battleaxe|boots|brutal|cane|chainbody|claws|dagger|dart|defender|felling axe|full helm|gloves|halberd|helm|kiteshield|knife|longsword|mace|med helm|pickaxe|platebody|platelegs|plateskirt|scimitar|shield|spear|sq shield|sword|warhammer)\b/.test(s)) return 2;
  // White Knight equipment has black-equivalent stats plus Prayer. Match its
  // actual pieces, not the colour alone (white aprons/berets are not metal).
  // https://oldschool.runescape.wiki/w/White_equipment
  if (/^white (dagger(?:\s*\(p\+{0,2}\))?|mace|claws|sword|longsword|scimitar|warhammer|battleaxe|2h sword|halberd|magic staff|med helm|full helm|sq shield|kiteshield|chainbody|platebody|plateskirt|platelegs|boots|gloves)$/.test(s)) return 2;
  if (/studded/.test(s)) return 2;
  if (/bronze|\biron\b|wooden|\bleather\b|hard leather|training/.test(s)) return 1;
  return null;
};

export const canonicalTierFromName = (name: string): number | null => {
  const s = name.toLowerCase();

  // Named uniques first (so e.g. "Dragon defender" beats the generic "Dragon").
  for (const [re, tier] of NAMED_TIERS) if (re.test(s)) return tier;

  // God-themed / decorative clue-scroll cosmetics (e.g. "Armadyl rune helmet",
  // "Bandos d'hide body") reskin a base material set — tier by the material, not
  // the god, so they read as normal gear instead of God Wars (T8). Real GWD
  // armour ("Bandos chestplate") has no material word, so it falls through.
  if (COSMETIC_PREFIX.test(s)) {
    const m = materialTier(s);
    if (m != null) return m;
  }

  // T9 — raids / endgame
  if (/(ancestral|torva|masori|twisted bow|scythe of vitur|sanguinesti|tumeken|justiciar|avernic|primordial|pegasian|eternal boot|dragon hunter|inquisitor|harmonised|volatile|eldritch|nightmare staff|venator|ultor|magus|bellator|lightbearer|elidinis|osmumten|virtus|zaryte)/.test(s)) return 9;

  // T8 — God Wars / Zenyte / high-end
  if (/(bandos|armadyl|saradomin sword|saradomin's blessed|zamorakian|godsword|zenyte|amulet of anguish|necklace of anguish|amulet of torture|ring of suffering|tormented bracelet|occult|trident of (?:the seas|the swamp)|staff of the dead|toxic staff|dragonfire|dragon warhammer|dragon claws|crystal (helm|body|legs|armour|bow|shield|halberd)|faerdhinen|brimstone ring)/.test(s)) return 8;

  // T7 — Barrows / Obsidian
  if (/(ahrim|karil|dharok|guthan|torag|verac|obsidian|tzhaar|toktz|tztok)/.test(s)) return 7;

  // Everything else by base material (metal / dragonhide / bow / robe).
  return materialTier(s);
};

/** The combat style an item is built for (or 'armour' if it has no offence). */
export type GearStyle = 'melee' | 'ranged' | 'magic' | 'armour';

export const itemStyle = (b: GearBonuses): GearStyle => {
  const melee = Math.max(b.stab, b.slash, b.crush) + Math.max(b.meleeStr, 0);
  const ranged = Math.max(b.ranged, 0) + Math.max(b.rangedStr, 0);
  const magic = Math.max(b.magic, 0) + 8 * Math.max(b.magicStr, 0);
  const best = Math.max(melee, ranged, magic);
  if (best <= 0) return 'armour';
  if (best === magic) return 'magic';
  if (best === ranged) return 'ranged';
  return 'melee';
};

/** Strength of an item within its own style (offence + a defence contribution). */
export const stylePower = (b: GearBonuses, style: GearStyle = itemStyle(b)): number => {
  const defence =
    b.defStab + b.defSlash + b.defCrush + b.defMagic + b.defRanged + 2 * Math.max(b.prayer, 0);
  let off = 0;
  if (style === 'melee') off = Math.max(b.stab, b.slash, b.crush) + Math.max(b.meleeStr, 0);
  else if (style === 'ranged') off = Math.max(b.ranged, 0) + Math.max(b.rangedStr, 0);
  else if (style === 'magic') off = Math.max(b.magic, 0) + 12 * Math.max(b.magicStr, 0);
  return off + 0.5 * Math.max(0, defence);
};

export interface TierAnchor { tier: number; power: number }
export type TierAnchors = Record<GearStyle, TierAnchor[]>;

/**
 * Build, per style, a (tier → representative power) curve from the items whose
 * tier we know canonically. Unrecognised items are then placed against these
 * anchors, so the fallback is tied to the real material ladder instead of a
 * free-floating per-slot rank. The curve is forced monotonic in tier.
 */
export const buildTierAnchors = (
  known: { tier: number; bonuses: GearBonuses }[],
): TierAnchors => {
  const groups: Record<GearStyle, Record<number, number[]>> = {
    melee: {}, ranged: {}, magic: {}, armour: {},
  };
  for (const it of known) {
    const st = itemStyle(it.bonuses);
    (groups[st][it.tier] ||= []).push(stylePower(it.bonuses, st));
  }
  const out: TierAnchors = { melee: [], ranged: [], magic: [], armour: [] };
  for (const st of Object.keys(groups) as GearStyle[]) {
    const anchors = Object.entries(groups[st])
      .map(([t, arr]) => {
        // 75th percentile: spans the real strength range of each tier so strong
        // unrecognised items don't all saturate to the top tier, while staying
        // robust to a single low outlier (which max would not be).
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = Math.min(sorted.length - 1, Math.ceil(0.75 * (sorted.length - 1)));
        return { tier: Number(t), power: sorted[idx] };
      })
      .sort((a, b) => a.tier - b.tier);
    for (let i = 1; i < anchors.length; i++) {
      if (anchors[i].power < anchors[i - 1].power) anchors[i].power = anchors[i - 1].power;
    }
    out[st] = anchors;
  }
  return out;
};

/** Estimate an item's tier from its stats, anchored to the canonical ladder. */
export const anchoredTier = (
  b: GearBonuses,
  anchors: TierAnchors,
  tierMax: number = EQUIPMENT_TIER_MAX,
): number => {
  const st = itemStyle(b);
  const list = (anchors[st]?.length ? anchors[st] : anchors.melee.length ? anchors.melee : anchors.armour);
  if (!list || list.length === 0) return 1;
  const p = stylePower(b, st);
  // Below/above the known range → clamp to the end tiers.
  if (p <= list[0].power) return Math.max(1, list[0].tier);
  if (p >= list[list.length - 1].power) return Math.min(tierMax, list[list.length - 1].tier);
  // Otherwise interpolate the tier between the two surrounding anchors, so gaps
  // in the canonical ladder still produce a strength-appropriate tier.
  for (let i = 0; i < list.length - 1; i++) {
    const lo = list[i], hi = list[i + 1];
    if (p >= lo.power && p < hi.power) {
      const span = hi.power - lo.power || 1;
      const tier = Math.round(lo.tier + ((p - lo.power) / span) * (hi.tier - lo.tier));
      return Math.min(tierMax, Math.max(1, tier));
    }
  }
  return Math.min(tierMax, Math.max(1, list[list.length - 1].tier));
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
