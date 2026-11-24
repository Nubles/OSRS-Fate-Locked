import { describe, it, expect } from 'vitest';
import {
  effectiveLevel, maxHitFromStr, maxHitMagic, attackRoll, defenceRoll,
  hitChance, potionBoost, computeDps, POTIONS, DpsInput, formatTimeToKill,
} from './dps';

describe('formatTimeToKill', () => {
  it('rounds before splitting minutes from seconds', () => {
    expect(formatTimeToKill(119.6)).toBe('2m 0s');
    expect(formatTimeToKill(179.5)).toBe('3m 0s');
    expect(formatTimeToKill(59.96)).toBe('1m 0s');
    expect(formatTimeToKill(65)).toBe('1m 5s');
  });

  it('keeps tenths under a minute and a dash when there is no kill', () => {
    expect(formatTimeToKill(59.94)).toBe('59.9s');
    expect(formatTimeToKill(4.25)).toBe('4.3s');
    expect(formatTimeToKill(Infinity)).toBe('—');
    expect(formatTimeToKill(0)).toBe('—');
  });
});

describe('dps formulas', () => {
  it('effective level: floor((base+boost)*prayer) + stance + 8', () => {
    expect(effectiveLevel(99, 1, 0, 0)).toBe(107);          // 99 + 0 + 8
    expect(effectiveLevel(99, 1, 0, 3)).toBe(110);          // aggressive +3
    expect(effectiveLevel(99, 1.23, 0, 3)).toBe(132);       // piety str: floor(121.77)=121 +3 +8
  });

  it('potion boost = flat + floor(pct*level)', () => {
    const superCombat = POTIONS.melee.find((p) => p.id === 'super')!;
    expect(potionBoost(99, superCombat)).toBe(19);          // 5 + floor(0.15*99)=14
  });

  it('melee max hit matches the OSRS strength formula', () => {
    // 99 str, aggressive (+3), whip strength +82 -> max 25
    expect(maxHitFromStr(110, 82)).toBe(25);
    // with piety str (effStr 132) -> 30
    expect(maxHitFromStr(132, 82)).toBe(30);
  });

  it('magic max scales a base spell max by magic damage %', () => {
    expect(maxHitMagic(24, 0)).toBe(24);
    expect(maxHitMagic(24, 20)).toBe(28);   // floor(24*1.2)=28
  });

  it('attack/defence rolls', () => {
    expect(attackRoll(107, 82)).toBe(15622);     // 107*(82+64)
    expect(defenceRoll(100, 50)).toBe(12426);    // (100+9)*(50+64)
  });

  it('hit chance is piecewise around the rolls', () => {
    expect(hitChance(15622, 12426)).toBeCloseTo(0.6023, 3);
    expect(hitChance(100, 200)).toBeCloseTo(100 / 402, 5);   // atk <= def branch
    expect(hitChance(200, 100)).toBeCloseTo(1 - 102 / 402, 5);
  });

  it('keeps hit chance a probability when a roll goes negative', () => {
    // Level-1 melee vs a -100 defence bonus: (1+9) * (-100+64) = -360.
    expect(hitChance(attackRoll(9, 0), defenceRoll(1, -100))).toBe(1);
    // Casting in armour with -65 magic accuracy: 107 * (-65+64) = -107.
    expect(hitChance(attackRoll(107, -65), defenceRoll(100, 0))).toBe(0);
  });

  it('rounds prayer and magic-damage multipliers exactly', () => {
    expect(effectiveLevel(100, 1.15, 0, 0)).toBe(123);       // 100*1.15 = 115, not 114
    expect(maxHitMagic(25, 16)).toBe(29);                     // 25*1.16 = 29, not 28
    expect(maxHitMagic(50, 16)).toBe(58);
    expect(maxHitMagic(45, 40)).toBe(63);
    expect(maxHitMagic(25, 2.5)).toBe(25);                    // 25.625
  });

  const baseInput = (): DpsInput => ({
    style: 'melee', attackType: 'slash', stanceId: 'aggressive', prayerId: 'none', potionId: 'none',
    baseSpellMax: 0,
    levels: { attack: 99, strength: 99, ranged: 99, magic: 99 },
    gear: { accuracy: 82, meleeStr: 82, rangedStr: 0, magicDmgPct: 0, speedTicks: 4 },
    monster: { defLevel: 100, defBonus: 50, hp: 150 },
  });

  it('computeDps ties it together (max-str whip vs def-100 monster)', () => {
    const r = computeDps(baseInput());
    expect(r.effAtk).toBe(107);
    expect(r.effStr).toBe(110);
    expect(r.maxHit).toBe(25);
    expect(r.attackRoll).toBe(15622);
    expect(r.defenceRoll).toBe(12426);
    expect(r.hitChance).toBeCloseTo(0.6023, 3);
    expect(r.attackInterval).toBeCloseTo(2.4, 5);
    // Wiki, Damage per second/Melee step eight: Hit Chance * (Max/2 + 1/(Max+1)).
    expect(r.dps).toBeCloseTo((r.hitChance * (12.5 + 1 / 26)) / 2.4, 9);
    expect(r.ttk).toBeCloseTo(150 / r.dps, 4);
  });

  // The Wiki's step eight (Melee, Ranged and Magic pages alike): a successful
  // hit that rolls 0 is changed to a 1, so an average hit is Max/2 + 1/(Max+1).
  it('counts a successful 0 as a 1, as the Wiki does', () => {
    const fresh: DpsInput = {
      ...baseInput(), stanceId: 'accurate',
      levels: { attack: 1, strength: 1, ranged: 1, magic: 1 },
      gear: { accuracy: 0, meleeStr: 0, rangedStr: 0, magicDmgPct: 0, speedTicks: 4 },
      monster: { defLevel: 1, defBonus: 0, hp: 2 },
    };
    // Max hit 1: every hit lands 1 damage, so an attack averages its hit chance.
    const one = computeDps(fresh);
    expect(one.maxHit).toBe(1);
    expect(one.dps).toBeCloseTo((one.hitChance * 1) / 2.4, 9);
    expect(one.ttk).toBeCloseTo(2 / ((one.hitChance * 1) / 2.4), 6);
    // Max hit 2: hits of 1, 1 and 2 average 4/3.
    const two = computeDps({ ...fresh, levels: { ...fresh.levels, strength: 10 } });
    expect(two.maxHit).toBe(2);
    expect(two.dps).toBeCloseTo((two.hitChance * (4 / 3)) / 2.4, 9);
    // Ranged and Magic use the same step: a 30 max hit averages 15 + 1/31.
    const magic = computeDps({ ...baseInput(), style: 'magic', attackType: 'magic', stanceId: 'accurate', baseSpellMax: 30 });
    expect(magic.maxHit).toBe(30);
    expect(magic.dps).toBeCloseTo((magic.hitChance * (15 + 1 / 31)) / magic.attackInterval, 9);
    // No max hit, no damage.
    expect(computeDps({ ...baseInput(), style: 'magic', attackType: 'magic', stanceId: 'accurate', baseSpellMax: 0 }).dps).toBe(0);
  });

  it('piety raises max hit and DPS', () => {
    const base = computeDps(baseInput());
    const piety = computeDps({ ...baseInput(), prayerId: 'piety' });
    expect(piety.maxHit).toBeGreaterThan(base.maxHit);
    expect(piety.dps).toBeGreaterThan(base.dps);
  });

  it('boosts Attack and Strength independently at unequal base levels', () => {
    const input = { ...baseInput(), potionId: 'super' };
    const lowAttack = computeDps({ ...input, levels: { ...input.levels, attack: 50 } });
    expect(lowAttack.effAtk).toBe(70); // 50 + (5 + floor(50 * .15)) + 8
    expect(lowAttack.effStr).toBe(129);
    const lowStrength = computeDps({ ...input, levels: { ...input.levels, strength: 50 } });
    expect(lowStrength.effAtk).toBe(126);
    expect(lowStrength.effStr).toBe(73);
  });

  it('takes monster flat armour off successful melee and ranged hits, never below 0', () => {
    // Wiki "Flat armour" (rev 15382660): subtracted from the final damage roll of
    // successful melee and ranged attacks; negative values add damage; misses stay 0;
    // player magic ignores it. The Wiki DPS calculator floors the result at 0.
    const perHit = (r: { dps: number; hitChance: number; attackInterval: number }) => (r.dps * r.attackInterval) / r.hitChance;
    const melee = (flatArmour: number, meleeStr = 82) => computeDps({
      ...baseInput(), gear: { ...baseInput().gear, meleeStr }, monster: { ...baseInput().monster, flatArmour },
    });
    const plain = melee(0);
    expect(computeDps(baseInput()).dps).toBe(plain.dps); // No flat armour: unchanged.
    const max = plain.maxHit;
    expect(perHit(plain)).toBeCloseTo(max / 2 + 1 / (max + 1), 10);
    // Veiled kraken, 15: rolls 0..max, a 0 becomes 1, then 15 comes off each.
    let sum = 0;
    for (let d = 0; d <= max; d++) sum += Math.max(0, Math.max(1, d) - 15);
    const kraken = melee(15);
    expect(perHit(kraken)).toBeCloseTo(sum / (max + 1), 10);
    expect(kraken.hitChance).toBe(plain.hitChance); // Accuracy is untouched.
    // A max hit below the armour deals nothing.
    const weak = melee(15, -60);
    expect(weak.maxHit).toBeLessThanOrEqual(15);
    expect(weak.dps).toBe(0);
    expect(weak.ttk).toBe(Infinity);
    // Blue Moon, -5: five more damage on every successful hit.
    expect(perHit(melee(-5))).toBeCloseTo(max / 2 + 1 / (max + 1) + 5, 10);
    // Ranged is reduced too.
    const ranged = (flatArmour: number) => computeDps({
      ...baseInput(), style: 'ranged', attackType: 'ranged', stanceId: 'accurate',
      gear: { ...baseInput().gear, rangedStr: 60 }, monster: { ...baseInput().monster, flatArmour },
    });
    expect(ranged(4).dps).toBeLessThan(ranged(0).dps);
    // Player magic ignores both positive and negative flat armour.
    const magic = (flatArmour: number) => computeDps({
      ...baseInput(), style: 'magic', attackType: 'magic', stanceId: 'standard', baseSpellMax: 30,
      monster: { ...baseInput().monster, flatArmour },
    }).dps;
    expect(magic(15)).toBe(magic(0));
    expect(magic(-5)).toBe(magic(0));
  });

  it('adds magic prayer damage to equipment damage before rounding the max hit', () => {
    const input: DpsInput = { ...baseInput(), style: 'magic', attackType: 'magic', stanceId: 'standard', baseSpellMax: 50 };
    expect(computeDps({ ...input, prayerId: 'mystic' }).maxHit).toBe(51);
    expect(computeDps({ ...input, baseSpellMax: 30, prayerId: 'augury' }).maxHit).toBe(31);
    expect(computeDps({ ...input, prayerId: 'augury', gear: { ...input.gear, magicDmgPct: 20 } }).maxHit).toBe(62);
  });

  it('adds 9, not 8, to the effective Magic level for accuracy', () => {
    // Wiki DPS calculator, PlayerVsNPCCalc.getPlayerMaxMagicAttackRoll: level × prayer + 9.
    const magic = (over: Partial<DpsInput> = {}) => computeDps({
      ...baseInput(), style: 'magic', attackType: 'magic', stanceId: 'standard', baseSpellMax: 30, ...over,
    });
    expect(magic().effAtk).toBe(108); // 99 + 9
    expect(magic().attackRoll).toBe(108 * (82 + 64));
    expect(magic({ prayerId: 'augury' }).effAtk).toBe(132); // floor(99 × 1.25) + 9
    // Melee and ranged keep + 8.
    expect(computeDps({ ...baseInput(), stanceId: 'defensive' }).effAtk).toBe(107);
    expect(computeDps({ ...baseInput(), style: 'ranged', attackType: 'ranged', stanceId: 'rapid' }).effAtk).toBe(107);
  });

  it('gives Magic +2 accuracy on Accurate and none on Longrange', () => {
    // Wiki DPS calculator, getPlayerMaxMagicAttackRoll: only Accurate adds 2.
    const magic = (stanceId: string) => computeDps({
      ...baseInput(), style: 'magic', attackType: 'magic', stanceId, baseSpellMax: 30,
    }).effAtk;
    expect(magic('accurate')).toBe(110); // 99 + 2 + 9
    expect(magic('longrange')).toBe(108);
    expect(magic('defensive')).toBe(108);
  });

  it('rapid stance attacks faster (higher dps, shorter interval)', () => {
    const acc = computeDps({ ...baseInput(), style: 'ranged', stanceId: 'accurate', gear: { accuracy: 70, meleeStr: 0, rangedStr: 70, magicDmgPct: 0, speedTicks: 5 } });
    const rapid = computeDps({ ...baseInput(), style: 'ranged', stanceId: 'rapid', gear: { accuracy: 70, meleeStr: 0, rangedStr: 70, magicDmgPct: 0, speedTicks: 5 } });
    expect(rapid.attackInterval).toBeLessThan(acc.attackInterval);
  });

  it('takes the atlatl\'s max hit from Strength and melee strength, its accuracy from Ranged', () => {
    // Wiki "Eclipse atlatl": max hit from the melee strength bonus and visible Strength boosts,
    // accuracy from the ranged bonus; ranged prayers boost both.
    const atlatl = (over: Partial<DpsInput> = {}, meleeStr = 40): DpsInput => ({
      ...baseInput(), style: 'ranged', attackType: 'ranged', stanceId: 'rapid', weaponName: 'Eclipse atlatl',
      levels: { attack: 1, strength: 99, ranged: 99, magic: 1 },
      gear: { accuracy: 87, meleeStr, rangedStr: 0, magicDmgPct: 0, speedTicks: 5 }, ...over,
    });
    expect(computeDps(atlatl()).maxHit).toBe(17);                   // floor(0.5 + 107 * 104 / 640)
    expect(computeDps(atlatl({}, 50)).maxHit).toBe(19);             // + amulet of strength (+10)
    expect(computeDps(atlatl({ prayerId: 'rigour' })).maxHit).toBe(21); // floor(99 * 1.23) + 8 = 129
    expect(computeDps(atlatl({ stanceId: 'accurate' })).effStr).toBe(110);
    // A Ranging potion boosts Ranged (accuracy) but not Strength (damage).
    const potion = computeDps(atlatl({ potionId: 'ranging' }));
    expect(potion.maxHit).toBe(17);
    expect(potion.effAtk).toBe(99 + 4 + 9 + 8);
    // Ranged level and ranged strength no longer move the max hit; Strength does.
    expect(computeDps(atlatl({ levels: { attack: 1, strength: 99, ranged: 75, magic: 1 } })).maxHit).toBe(17);
    expect(computeDps(atlatl({ levels: { attack: 1, strength: 70, ranged: 99, magic: 1 } })).maxHit).toBe(13);
    // Any other ranged weapon still uses Ranged and ranged strength.
    expect(computeDps(atlatl({ weaponName: 'Magic shortbow' })).maxHit).toBe(11);
  });
});
