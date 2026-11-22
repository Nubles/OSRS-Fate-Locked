/**
 * Boss Kill Planner engine. Given the player's equipped gear + levels and a
 * target monster, finds the best melee/ranged setup (auto-optimising attack
 * type against the boss's weakest defence), then derives DPS, time-to-kill,
 * kills/hour, a readiness rating, a danger/supplies estimate, and a gear-gap %
 * vs a strong reference setup.
 *
 * Reuses the tested combat engine in utils/dps.ts. Pure + side-effect free.
 * (Magic is left to the DPS tab — it needs a spell choice; here the auto-best
 * covers melee + ranged, which gear fully determines.)
 */

import { GearBonuses, ZERO_BONUSES } from './gearStats';
import { computeDps, POTIONS, PRAYERS, Style, AttackType } from './dps';
import { rangedDefenceFor, type RangedDamageType } from './rangedDamage';
import { weaponCombatOptions, type WeaponCombatOption } from './weaponCombat';
import type { UnlockState } from '../types';
import { getActivityReq } from '../data/activityRequirements';
import { evaluateActivityReadiness } from './activityReadiness';
import { meetsSkillRequirement } from './journalStatus';

export interface MonsterLite {
  hp: number;
  /** null when the catalogue gives no number ("Varies", "N/A"). */
  maxHit: number | null;
  defLevel: number;
  magicLevel: number;
  def: { stab: number; slash: number; crush: number; magic: number; ranged: number };
  rangedDefence?: Record<RangedDamageType, number>;
}

export interface PlayerCombat {
  levels: { attack: number; strength: number; ranged: number; magic: number; hitpoints: number };
  gear: { bonuses: GearBonuses; speedTicks: number; category?: string; rangedDamageType?: RangedDamageType };
  /** Potions (super combat/ranging) and the prayers below applied. */
  boostsOn: boolean;
  /** Prayer id per style the player can use (see bestBoostPrayers); none when omitted. */
  prayers?: Partial<Record<PlannedStyle, string>>;
}

type PlannedStyle = 'melee' | 'ranged';

export type Readiness = 'excellent' | 'good' | 'workable' | 'slow' | 'undergeared' | 'unverified';
export type Danger = 'low' | 'medium' | 'high' | 'extreme' | 'unknown';

export interface BossPlan {
  dps: number;
  ttk: number; // seconds
  maxHit: number;
  hitChance: number; // 0..1
  style: Style;
  attackType: AttackType;
  stanceId: string;
  /** Labels of the prayer and potion assumed; null when none. */
  prayer: string | null;
  potion: string | null;
  assessmentNote?: string;
  killsPerHour: number;
  readiness: Readiness;
  danger: Danger;
  /** Rough kills before a bank trip (no protection assumed); null when the max hit is unknown. */
  killsBeforeBank: number | null;
  /** Your DPS as a % of a strong reference setup (0..100). */
  gearGapPct: number;
  /** Seconds the strong reference setup needs with the same attack; Infinity when not planned. */
  referenceTtk: number;
}

/** Boss names that map to a different monster entry than their app name. */
export const BOSS_ALIASES: Record<string, string> = {
  'The Mad Angel': 'Mad Angel',
  'Tormented Demons': 'Tormented Demon',
  'Mimic': 'The Mimic',
  'Grotesque Guardians': 'Dusk',
  'Dagannoth Kings': 'Dagannoth Rex',
  'Barrows Brothers': 'Ahrim the Blighted',
};

/** Multi-phase bosses whose opening phase is not first in the catalogue's alphabetical order. */
export const BOSS_OPENING_VERSIONS: Record<string, string> = {
  'Alchemical Hydra': 'Serpentine',
  'Zulrah': 'Serpentine',
  'Kalphite Queen': 'Crawling',
  'Phantom Muspah': 'Ranged',
  'Doom of Mokhaiotl': 'Delve 1',
};
const STANDARD_VERSIONS = ['Post-quest', 'Normal', 'Solo'];

/**
 * Bosses (by app name) that ordinary melee or ranged damage cannot plan for,
 * each checked on the boss's Wiki page. A style listed here gets no readiness.
 */
interface BossCombatLimit {
  /** The boss cannot be fought with combat at all. */
  noCombat?: string;
  /** Melee cannot hurt it, except with weapons of the `unlessCategory` categories (lower case). */
  melee?: { note: string; unlessCategory?: readonly string[] };
  ranged?: { note: string };
  /** A training boss with effectively endless hitpoints: no kill to time. */
  endless?: string;
}
export const BOSS_COMBAT_LIMITS: Readonly<Record<string, BossCombatLimit>> = {
  // Wiki "Zalcano" (rev 15358247): immune to traditional combat damage; Mining, Smithing and Runecraft instead.
  'Zalcano': { noCombat: 'Zalcano is immune to combat damage. She is fought with Mining, Smithing and Runecraft, so there is no combat plan.' },
  // Wiki "Kraken" (rev 15383981): entirely immune to melee; Ranged deals 1/7th of its normal damage; Magic is the reliable way.
  'Kraken': {
    melee: { note: 'The Kraken is immune to melee. Magic is the reliable way to fight it; choose a spell in the DPS tab.' },
    ranged: { note: 'Ranged deals only a seventh of its damage to the Kraken. Magic is the reliable way to fight it; choose a spell in the DPS tab.' },
  },
  // Wiki "Zulrah" (rev 15385964): cannot be reached with melee, with the exception of halberds (the Polearm category).
  'Zulrah': { melee: { note: 'Zulrah cannot be reached with melee, except with a halberd.', unlessCategory: ['polearm'] } },
  // Wiki "Kree'arra" (rev 15410457): cannot be attacked with Melee, except when using Halberds or Salamanders.
  "Kree'arra": { melee: { note: "Kree'arra cannot be attacked with melee, except with a halberd or a salamander.", unlessCategory: ['polearm', 'salamander'] } },
  // Wiki "Grotesque Guardians" (rev 15387555): Dusk is completely immune to magic and ranged damage. The planner times Dusk.
  'Grotesque Guardians': { ranged: { note: 'Dusk is immune to ranged and magic; only melee harms him.' } },
  // Wiki "Gemstone Crab" (rev 15404558): no defence and effectively infinite hitpoints, made for combat training.
  'Gemstone Crab': { endless: 'The Gemstone Crab is a training boss with effectively endless hitpoints, so there is no kill time to plan.' },
};

const styleBlock = (limit: BossCombatLimit | undefined, style: Style, category?: string): string | undefined => {
  if (!limit) return undefined;
  if (style === 'melee' && limit.melee && !limit.melee.unlessCategory?.includes((category ?? '').trim().toLowerCase())) return limit.melee.note;
  if (style === 'ranged' && limit.ranged) return limit.ranged.note;
  return undefined;
};

/**
 * The version the Boss Planner assumes until the player picks one: the
 * opening phase of a multi-phase fight, otherwise the post-quest, normal or
 * solo fight, otherwise the unversioned or first listed row. Harder variants
 * (Awakened, group, special modes) are only ever chosen by the player.
 */
export const defaultBossVersion = <T extends { name: string; version: string }>(
  versions: readonly T[],
): T | undefined => {
  if (versions.length <= 1) return versions[0];
  const opening = BOSS_OPENING_VERSIONS[versions[0].name];
  const leading = (entry: T) => entry.version.split(',')[0].trim();
  return versions.find(entry => opening !== undefined && entry.version === opening)
    ?? STANDARD_VERSIONS.map(label => versions.find(entry => leading(entry) === label)).find(entry => entry !== undefined)
    ?? versions.find(entry => entry.version === '')
    ?? versions[0];
};

const accuracyFor = (b: GearBonuses, t: AttackType): number =>
  t === 'stab' ? b.stab : t === 'slash' ? b.slash : t === 'crush' ? b.crush : t === 'ranged' ? b.ranged : b.magic;
const monDefFor = (m: MonsterLite, t: AttackType, rangedType: RangedDamageType): number =>
  t === 'stab' ? m.def.stab : t === 'slash' ? m.def.slash : t === 'crush' ? m.def.crush : t === 'ranged' ? rangedDefenceFor(m, rangedType) : m.def.magic;

/**
 * Offensive prayers the planner may assume, best first. Piety, Chivalry and
 * Rigour are Arcana unlocks with their own level and quest gates; the others
 * need only their Prayer level, which the skill's tier caps.
 */
const BOOST_PRAYERS: Record<PlannedStyle, ReadonlyArray<{ id: string; arcana?: string; prayerLevel?: number }>> = {
  melee: [{ id: 'piety', arcana: 'Piety' }, { id: 'chivalry', arcana: 'Chivalry' }, { id: 'clarity', prayerLevel: 16 }],
  ranged: [{ id: 'rigour', arcana: 'Rigour' }, { id: 'eagle', prayerLevel: 44 }],
};

/** The best offensive prayer per style the player can use ('none' if none). */
export const bestBoostPrayers = (unlocks: UnlockState, gameModeId?: string): Record<PlannedStyle, string> => {
  const skills = { skills: unlocks.skills ?? {}, levels: unlocks.levels ?? {} };
  // An Arcana prayer's in-game unlock (Knight Waves, a prayer scroll) can't be
  // checked, so its machine gates passing is enough to assume it.
  const usable = ({ arcana, prayerLevel }: { arcana?: string; prayerLevel?: number }) => arcana
    ? ['READY', 'NEEDS_CONFIRMATION'].includes(evaluateActivityReadiness((unlocks.arcana ?? []).includes(arcana), getActivityReq(arcana), unlocks, gameModeId).status)
    : meetsSkillRequirement(skills, 'Prayer', prayerLevel ?? 1);
  return {
    melee: BOOST_PRAYERS.melee.find(usable)?.id ?? 'none',
    ranged: BOOST_PRAYERS.ranged.find(usable)?.id ?? 'none',
  };
};

const boostsFor = (p: PlayerCombat, style: Style) => ({
  prayerId: p.boostsOn && style !== 'magic' ? p.prayers?.[style] ?? 'none' : 'none',
  potionId: p.boostsOn ? (style === 'ranged' ? 'ranging' : 'super') : 'none',
});
const boostLabel = (list: ReadonlyArray<{ id: string; label: string }>, id: string): string | null =>
  id === 'none' ? null : list.find(entry => entry.id === id)?.label ?? null;

const runCombo = (p: PlayerCombat, m: MonsterLite, { style, attackType, stanceId }: WeaponCombatOption) =>
  computeDps({
    style, attackType, stanceId,
    ...boostsFor(p, style),
    baseSpellMax: 0,
    levels: { attack: p.levels.attack, strength: p.levels.strength, ranged: p.levels.ranged, magic: p.levels.magic },
    gear: {
      accuracy: accuracyFor(p.gear.bonuses, attackType),
      meleeStr: p.gear.bonuses.meleeStr,
      rangedStr: p.gear.bonuses.rangedStr,
      magicDmgPct: p.gear.bonuses.magicStr,
      speedTicks: p.gear.speedTicks,
    },
    monster: { defLevel: style === 'magic' ? m.magicLevel : m.defLevel, defBonus: monDefFor(m, attackType, p.gear.rangedDamageType ?? 'standard'), hp: m.hp },
  });

// A generic "strong endgame" setup for the gear-gap benchmark.
const STRONG: PlayerCombat = {
  levels: { attack: 99, strength: 99, ranged: 99, magic: 99, hitpoints: 99 },
  gear: { bonuses: { ...ZERO_BONUSES, stab: 150, slash: 150, crush: 150, ranged: 140, meleeStr: 150, rangedStr: 120 }, speedTicks: 4 },
  boostsOn: true,
  prayers: { melee: 'piety', ranged: 'rigour' },
};

const KILL_OVERHEAD_S = 6; // amortised between-kills / banking

const SLOW_LIMIT_S = 180;
const READINESS_BANDS: ReadonlyArray<[number, Readiness]> = [[20, 'excellent'], [45, 'good'], [90, 'workable'], [SLOW_LIMIT_S, 'slow']];

/**
 * Time-to-kill bands. A boss the strong reference itself needs over three
 * minutes for (a group boss fought alone) is judged by the ratio to that
 * reference's time instead, so the reference reads Slow there, never
 * Undergeared. Every other boss keeps the plain time bands.
 */
const readinessOf = (ttk: number, dps: number, referenceTtk: number): Readiness => {
  if (dps <= 0.01 || !isFinite(ttk)) return 'undergeared';
  const againstReference = isFinite(referenceTtk) && referenceTtk > SLOW_LIMIT_S;
  const band = READINESS_BANDS.find(([limit]) => againstReference ? ttk / referenceTtk <= limit / SLOW_LIMIT_S : ttk <= limit);
  return band ? band[1] : 'undergeared';
};

const dangerOf = (maxHit: number | null, hp: number): Danger => {
  if (maxHit === null) return 'unknown';
  const r = maxHit / Math.max(1, hp);
  if (r < 0.15) return 'low';
  if (r < 0.3) return 'medium';
  if (r < 0.5) return 'high';
  return 'extreme';
};

/** Compute the best plan for a boss; `bossName` (the app's boss name) applies its combat limits. */
export const planBoss = (player: PlayerCombat, monster: MonsterLite, bossName?: string): BossPlan => {
  const limit = bossName !== undefined && Object.prototype.hasOwnProperty.call(BOSS_COMBAT_LIMITS, bossName) ? BOSS_COMBAT_LIMITS[bossName] : undefined;
  const options = weaponCombatOptions(player.gear.category);
  const usable = options.filter(option => option.style !== 'magic');
  const candidates = usable.filter(option => !styleBlock(limit, option.style, player.gear.category));
  const unplanned = (assessmentNote: string): BossPlan => ({
    dps: 0, ttk: Infinity, maxHit: 0, hitChance: 0, style: 'melee', attackType: 'crush', stanceId: '',
    prayer: null, potion: null, killsPerHour: 0, readiness: 'unverified', danger: dangerOf(monster.maxHit, player.levels.hitpoints),
    killsBeforeBank: 0, gearGapPct: 0, referenceTtk: Infinity, assessmentNote,
  });
  if (limit?.noCombat) return unplanned(limit.noCombat);
  if (usable.length && !candidates.length) return unplanned(styleBlock(limit, usable[0].style, player.gear.category)!);
  if (!candidates.length) return unplanned(options.length
    ? 'Choose a spell in the DPS tab to assess this magic weapon.'
    : 'Attack options for this weapon need review before a combat estimate is available.');
  let bestCombo = candidates[0];
  let best = runCombo(player, monster, bestCombo);
  for (const candidate of candidates.slice(1)) {
    const result = runCombo(player, monster, candidate);
    if (result.dps > best.dps) { best = result; bestCombo = candidate; }
  }

  const ref = runCombo({ ...STRONG, gear: { ...STRONG.gear, rangedDamageType: player.gear.rangedDamageType } }, monster, bestCombo);
  const gearGapPct = ref.dps > 0 ? Math.min(100, Math.round((best.dps / ref.dps) * 100)) : 0;

  const killsPerHour = isFinite(best.ttk) && best.ttk > 0 ? Math.floor(3600 / (best.ttk + KILL_OVERHEAD_S)) : 0;
  const killsBeforeBank = monster.maxHit === null
    ? null
    : Math.max(1, Math.floor(player.levels.hitpoints / Math.max(1, monster.maxHit * 1.5))); // rough, no protection
  const boosts = boostsFor(player, bestCombo.style);

  return {
    dps: best.dps,
    ttk: best.ttk,
    maxHit: best.maxHit,
    hitChance: best.hitChance,
    style: bestCombo.style,
    attackType: bestCombo.attackType,
    stanceId: bestCombo.stanceId,
    prayer: boostLabel(PRAYERS[bestCombo.style], boosts.prayerId),
    potion: boostLabel(POTIONS[bestCombo.style], boosts.potionId),
    killsPerHour,
    readiness: limit?.endless ? 'unverified' : readinessOf(best.ttk, best.dps, ref.ttk),
    danger: dangerOf(monster.maxHit, player.levels.hitpoints),
    killsBeforeBank,
    gearGapPct,
    referenceTtk: ref.ttk,
    ...(limit?.endless ? { assessmentNote: `${limit.endless} You deal about ${best.dps.toFixed(1)} damage per second to it.` } : {}),
  };
};
