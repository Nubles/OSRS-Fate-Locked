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
import { computeDps, Style, AttackType } from './dps';

export interface MonsterLite {
  hp: number;
  maxHit: number;
  defLevel: number;
  magicLevel: number;
  def: { stab: number; slash: number; crush: number; magic: number; ranged: number };
}

export interface PlayerCombat {
  levels: { attack: number; strength: number; ranged: number; magic: number; hitpoints: number };
  gear: { bonuses: GearBonuses; speedTicks: number };
  /** Prayers (Piety/Rigour) + potions (super/ranging) applied. */
  boostsOn: boolean;
}

export type Readiness = 'excellent' | 'good' | 'workable' | 'slow' | 'undergeared';
export type Danger = 'low' | 'medium' | 'high' | 'extreme';

export interface BossPlan {
  dps: number;
  ttk: number; // seconds
  maxHit: number;
  hitChance: number; // 0..1
  style: Style;
  attackType: AttackType;
  killsPerHour: number;
  readiness: Readiness;
  danger: Danger;
  /** Rough kills before a bank trip (no protection assumed). */
  killsBeforeBank: number;
  /** Your DPS as a % of a strong reference setup (0..100). */
  gearGapPct: number;
}

/** Boss names that map to a different monster entry than their app name. */
export const BOSS_ALIASES: Record<string, string> = {
  'Tormented Demons': 'Tormented Demon',
  'Mimic': 'The Mimic',
  'Grotesque Guardians': 'Dusk',
  'Dagannoth Kings': 'Dagannoth Rex',
  'Barrows Brothers': 'Ahrim the Blighted',
};

const COMBOS: { style: Style; attackType: AttackType }[] = [
  { style: 'melee', attackType: 'stab' },
  { style: 'melee', attackType: 'slash' },
  { style: 'melee', attackType: 'crush' },
  { style: 'ranged', attackType: 'ranged' },
];

const accuracyFor = (b: GearBonuses, t: AttackType): number =>
  t === 'stab' ? b.stab : t === 'slash' ? b.slash : t === 'crush' ? b.crush : t === 'ranged' ? b.ranged : b.magic;
const monDefFor = (m: MonsterLite, t: AttackType): number =>
  t === 'stab' ? m.def.stab : t === 'slash' ? m.def.slash : t === 'crush' ? m.def.crush : t === 'ranged' ? m.def.ranged : m.def.magic;

const runCombo = (p: PlayerCombat, m: MonsterLite, style: Style, attackType: AttackType) =>
  computeDps({
    style, attackType,
    stanceId: style === 'ranged' ? 'rapid' : 'aggressive',
    prayerId: p.boostsOn ? (style === 'ranged' ? 'rigour' : 'piety') : 'none',
    potionId: p.boostsOn ? (style === 'ranged' ? 'ranging' : 'super') : 'none',
    baseSpellMax: 0,
    levels: { attack: p.levels.attack, strength: p.levels.strength, ranged: p.levels.ranged, magic: p.levels.magic },
    gear: {
      accuracy: accuracyFor(p.gear.bonuses, attackType),
      meleeStr: p.gear.bonuses.meleeStr,
      rangedStr: p.gear.bonuses.rangedStr,
      magicDmgPct: p.gear.bonuses.magicStr,
      speedTicks: p.gear.speedTicks,
    },
    monster: { defLevel: style === 'magic' ? m.magicLevel : m.defLevel, defBonus: monDefFor(m, attackType), hp: m.hp },
  });

// A generic "strong endgame" setup for the gear-gap benchmark.
const STRONG: PlayerCombat = {
  levels: { attack: 99, strength: 99, ranged: 99, magic: 99, hitpoints: 99 },
  gear: { bonuses: { ...ZERO_BONUSES, stab: 150, slash: 150, crush: 150, ranged: 140, meleeStr: 150, rangedStr: 120 }, speedTicks: 4 },
  boostsOn: true,
};

const KILL_OVERHEAD_S = 6; // amortised between-kills / banking

const readinessOf = (ttk: number, dps: number): Readiness => {
  if (dps <= 0.01 || !isFinite(ttk)) return 'undergeared';
  if (ttk <= 20) return 'excellent';
  if (ttk <= 45) return 'good';
  if (ttk <= 90) return 'workable';
  if (ttk <= 180) return 'slow';
  return 'undergeared';
};

const dangerOf = (maxHit: number, hp: number): Danger => {
  const r = maxHit / Math.max(1, hp);
  if (r < 0.15) return 'low';
  if (r < 0.3) return 'medium';
  if (r < 0.5) return 'high';
  return 'extreme';
};

/** Compute the best plan for a boss. */
export const planBoss = (player: PlayerCombat, monster: MonsterLite): BossPlan => {
  let best = runCombo(player, monster, COMBOS[0].style, COMBOS[0].attackType);
  let bestCombo = COMBOS[0];
  for (const c of COMBOS.slice(1)) {
    const r = runCombo(player, monster, c.style, c.attackType);
    if (r.dps > best.dps) { best = r; bestCombo = c; }
  }

  const ref = runCombo(STRONG, monster, bestCombo.style, bestCombo.attackType);
  const gearGapPct = ref.dps > 0 ? Math.min(100, Math.round((best.dps / ref.dps) * 100)) : 0;

  const killsPerHour = isFinite(best.ttk) && best.ttk > 0 ? Math.floor(3600 / (best.ttk + KILL_OVERHEAD_S)) : 0;
  const dmgPerKill = Math.max(1, monster.maxHit * 1.5); // rough, no protection
  const killsBeforeBank = Math.max(1, Math.floor(player.levels.hitpoints / dmgPerKill));

  return {
    dps: best.dps,
    ttk: best.ttk,
    maxHit: best.maxHit,
    hitChance: best.hitChance,
    style: bestCombo.style,
    attackType: bestCombo.attackType,
    killsPerHour,
    readiness: readinessOf(best.ttk, best.dps),
    danger: dangerOf(monster.maxHit, player.levels.hitpoints),
    killsBeforeBank,
    gearGapPct,
  };
};
