/**
 * OSRS combat / DPS engine.
 *
 * Standard Old School RuneScape formulas: effective levels (with stance, prayer
 * and potion boosts) feed max hit and the attack/defence rolls, which give hit
 * chance, then DPS and time-to-kill. Pure + side-effect free so every piece is
 * unit-testable.
 *
 * Out of scope (v1): special attacks, item passives/scaling (Twisted bow, Salve,
 * Slayer helm, Void, crystal, Dharok's…), on-task multipliers, a per-spell magic
 * DB (a base-max-hit input is used instead), and target protection prayers.
 */

export type Style = 'melee' | 'ranged' | 'magic';
export type AttackType = 'stab' | 'slash' | 'crush' | 'ranged' | 'magic';

// ── Stances ──────────────────────────────────────────────────────────────────
export interface Stance {
  id: string;
  label: string;
  /** Bonus added to the effective attack/accuracy level. */
  atk: number;
  /** Bonus added to the effective strength level (for max hit). */
  str: number;
  /** Attack-speed change in ticks (rapid = −1, i.e. faster). */
  speedDelta: number;
}

export const STANCES: Record<Style, Stance[]> = {
  melee: [
    { id: 'accurate', label: 'Accurate', atk: 3, str: 0, speedDelta: 0 },
    { id: 'aggressive', label: 'Aggressive', atk: 0, str: 3, speedDelta: 0 },
    { id: 'controlled', label: 'Controlled', atk: 1, str: 1, speedDelta: 0 },
  ],
  ranged: [
    { id: 'accurate', label: 'Accurate', atk: 3, str: 3, speedDelta: 0 },
    { id: 'rapid', label: 'Rapid', atk: 0, str: 0, speedDelta: -1 },
  ],
  magic: [
    { id: 'standard', label: 'Standard', atk: 0, str: 0, speedDelta: 0 },
    { id: 'accurate', label: 'Accurate', atk: 3, str: 0, speedDelta: 0 },
  ],
};

// ── Prayers (multiplicative on the relevant level) ───────────────────────────
export interface Prayer { id: string; label: string; atkMult: number; strMult: number; magicDmgPct?: number }

export const PRAYERS: Record<Style, Prayer[]> = {
  melee: [
    { id: 'none', label: 'No prayer', atkMult: 1, strMult: 1 },
    { id: 'clarity', label: 'Improved Reflexes / Burst', atkMult: 1.1, strMult: 1.1 },
    { id: 'chivalry', label: 'Chivalry', atkMult: 1.15, strMult: 1.18 },
    { id: 'piety', label: 'Piety', atkMult: 1.2, strMult: 1.23 },
  ],
  ranged: [
    { id: 'none', label: 'No prayer', atkMult: 1, strMult: 1 },
    { id: 'eagle', label: 'Eagle Eye', atkMult: 1.15, strMult: 1.15 },
    { id: 'rigour', label: 'Rigour', atkMult: 1.2, strMult: 1.23 },
  ],
  magic: [
    { id: 'none', label: 'No prayer', atkMult: 1, strMult: 1 },
    { id: 'mystic', label: 'Mystic Might', atkMult: 1.15, strMult: 1, magicDmgPct: 2 },
    { id: 'augury', label: 'Augury', atkMult: 1.25, strMult: 1, magicDmgPct: 4 },
  ],
};

// ── Potions (flat + percent of base level) ───────────────────────────────────
export interface Potion { id: string; label: string; flat: number; pct: number }

export const POTIONS: Record<Style, Potion[]> = {
  melee: [
    { id: 'none', label: 'No potion', flat: 0, pct: 0 },
    { id: 'combat', label: 'Combat potion', flat: 3, pct: 0.1 },
    { id: 'super', label: 'Super combat', flat: 5, pct: 0.15 },
  ],
  ranged: [
    { id: 'none', label: 'No potion', flat: 0, pct: 0 },
    { id: 'ranging', label: 'Ranging potion', flat: 4, pct: 0.1 },
    { id: 'bastion', label: 'Bastion potion', flat: 4, pct: 0.1 },
  ],
  magic: [
    { id: 'none', label: 'No potion', flat: 0, pct: 0 },
    { id: 'magic', label: 'Magic potion', flat: 4, pct: 0 },
    { id: 'imbued', label: 'Imbued heart', flat: 1, pct: 0.1 },
  ],
};

const pick = <T extends { id: string }>(list: T[], id: string): T => list.find((x) => x.id === id) ?? list[0];

// ── Core formulas ─────────────────────────────────────────────────────────────

/** Potion boost = flat + floor(pct * base level). */
export const potionBoost = (baseLevel: number, p: Potion): number =>
  p.flat + Math.floor(p.pct * baseLevel);

/** OSRS effective level: floor((base + boost) * prayerMult) + stance + 8. */
export const effectiveLevel = (base: number, prayerMult: number, boost: number, stance: number): number =>
  Math.floor((base + boost) * prayerMult) + stance + 8;

/** Melee/ranged max hit from effective strength + gear strength bonus. */
export const maxHitFromStr = (effStr: number, strBonus: number): number =>
  Math.floor(0.5 + (effStr * (strBonus + 64)) / 640);

/** Magic max hit ≈ base spell max scaled by magic-damage %. */
export const maxHitMagic = (baseSpellMax: number, magicDmgPct: number): number =>
  Math.floor(baseSpellMax * (1 + magicDmgPct / 100));

export const attackRoll = (effAtk: number, gearAccuracy: number): number =>
  effAtk * (gearAccuracy + 64);

export const defenceRoll = (defLevel: number, defBonus: number): number =>
  (defLevel + 9) * (defBonus + 64);

/** Probability a hit lands, from the attack vs defence rolls. */
export const hitChance = (atk: number, def: number): number =>
  atk > def ? 1 - (def + 2) / (2 * (atk + 1)) : atk / (2 * (def + 1));

// ── Inputs / result ───────────────────────────────────────────────────────────
export interface DpsInput {
  style: Style;
  attackType: AttackType;
  stanceId: string;
  prayerId: string;
  potionId: string;
  baseSpellMax: number;
  levels: { attack: number; strength: number; ranged: number; magic: number };
  gear: {
    /** Accuracy bonus for the chosen attack type (stab/slash/crush/ranged/magic). */
    accuracy: number;
    meleeStr: number;
    rangedStr: number;
    magicDmgPct: number;
    /** Weapon attack speed in ticks. */
    speedTicks: number;
  };
  monster: {
    /** Defence level the relevant roll uses (magic uses the monster's magic level). */
    defLevel: number;
    /** Defensive bonus for the chosen attack type. */
    defBonus: number;
    hp: number;
  };
}

export interface DpsResult {
  maxHit: number;
  hitChance: number; // 0..1
  dps: number;
  ttk: number; // seconds
  effAtk: number;
  effStr: number;
  attackRoll: number;
  defenceRoll: number;
  attackInterval: number; // seconds
}

export const computeDps = (input: DpsInput): DpsResult => {
  const { style, levels, gear, monster } = input;
  const stance = pick(STANCES[style], input.stanceId);
  const prayer = pick(PRAYERS[style], input.prayerId);
  const potion = pick(POTIONS[style], input.potionId);

  // Base levels by style: melee uses attack+strength, ranged uses ranged for
  // both rolls, magic uses magic for the attack roll.
  const atkBase = style === 'melee' ? levels.attack : style === 'ranged' ? levels.ranged : levels.magic;
  const strBase = style === 'melee' ? levels.strength : style === 'ranged' ? levels.ranged : levels.magic;

  const effAtk = effectiveLevel(atkBase, prayer.atkMult, potionBoost(atkBase, potion), stance.atk);
  const effStr = effectiveLevel(strBase, prayer.strMult, potionBoost(strBase, potion), stance.str);

  const maxHit = style === 'magic'
    ? maxHitMagic(input.baseSpellMax, gear.magicDmgPct + (prayer.magicDmgPct ?? 0))
    : maxHitFromStr(effStr, style === 'ranged' ? gear.rangedStr : gear.meleeStr);

  const aRoll = attackRoll(effAtk, gear.accuracy);
  const dRoll = defenceRoll(monster.defLevel, monster.defBonus);
  const chance = hitChance(aRoll, dRoll);

  const speedTicks = Math.max(1, gear.speedTicks + stance.speedDelta);
  const attackInterval = speedTicks * 0.6;
  const dps = (chance * (maxHit / 2)) / attackInterval;
  const ttk = dps > 0 ? monster.hp / dps : Infinity;

  return { maxHit, hitChance: chance, dps, ttk, effAtk, effStr, attackRoll: aRoll, defenceRoll: dRoll, attackInterval };
};
