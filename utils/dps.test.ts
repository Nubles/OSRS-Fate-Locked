import { describe, it, expect } from 'vitest';
import {
  effectiveLevel, maxHitFromStr, maxHitMagic, attackRoll, defenceRoll,
  hitChance, potionBoost, computeDps, POTIONS, DpsInput,
} from './dps';

describe('dps formulas', () => {
  it('effective level: floor((base+boost)*prayer) + stance + 8', () => {
    expect(effectiveLevel(99, 1, 0, 0)).toBe(107);          // 99 + 0 + 8
    expect(effectiveLevel(99, 1, 0, 3)).toBe(110);          // aggressive +3
    expect(effectiveLevel(99, 1.23, 0, 3)).toBe(132);       // piety str: floor(121.77)=121 +3 +8
  });

  it('boosts unequal melee stats independently', () => {
    const input = baseInput();
    const lowAttack = computeDps({ ...input, potionId: 'super', levels: { ...input.levels, attack: 1 } });
    expect(lowAttack.effAtk).toBe(14);
    expect(lowAttack.effStr).toBe(129);
    const lowStrength = computeDps({ ...input, potionId: 'super', levels: { ...input.levels, strength: 1 } });
    expect(lowStrength.effAtk).toBe(126);
    expect(lowStrength.effStr).toBe(17);
  });
  it('adds prayer magic damage to equipment damage before flooring', () => {
    const input = { ...baseInput(), style: 'magic' as const, attackType: 'magic' as const, stanceId: 'standard', baseSpellMax: 30 };
    expect(computeDps({ ...input, prayerId: 'none' }).maxHit).toBe(30);
    expect(computeDps({ ...input, prayerId: 'augury' }).maxHit).toBe(31);
    expect(computeDps({ ...input, prayerId: 'mystic', baseSpellMax: 50 }).maxHit).toBe(51);
    expect(computeDps({ ...input, prayerId: 'augury', gear: { ...input.gear, magicDmgPct: 10 } }).maxHit).toBe(34);
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
    expect(r.dps).toBeCloseTo((0.6023 * 12.5) / 2.4, 2);
    expect(r.ttk).toBeCloseTo(150 / r.dps, 4);
  });

  it('piety raises max hit and DPS', () => {
    const base = computeDps(baseInput());
    const piety = computeDps({ ...baseInput(), prayerId: 'piety' });
    expect(piety.maxHit).toBeGreaterThan(base.maxHit);
    expect(piety.dps).toBeGreaterThan(base.dps);
  });

  it('rapid stance attacks faster (higher dps, shorter interval)', () => {
    const acc = computeDps({ ...baseInput(), style: 'ranged', stanceId: 'accurate', gear: { accuracy: 70, meleeStr: 0, rangedStr: 70, magicDmgPct: 0, speedTicks: 5 } });
    const rapid = computeDps({ ...baseInput(), style: 'ranged', stanceId: 'rapid', gear: { accuracy: 70, meleeStr: 0, rangedStr: 70, magicDmgPct: 0, speedTicks: 5 } });
    expect(rapid.attackInterval).toBeLessThan(acc.attackInterval);
  });
});
