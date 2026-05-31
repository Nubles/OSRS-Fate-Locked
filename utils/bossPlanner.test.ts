import { describe, it, expect } from 'vitest';
import { planBoss, PlayerCombat, MonsterLite, BOSS_ALIASES } from './bossPlanner';
import { ZERO_BONUSES } from './gearStats';

const monster = (over: Partial<MonsterLite> = {}): MonsterLite => ({
  hp: 150, maxHit: 30, defLevel: 100, magicLevel: 1,
  def: { stab: 50, slash: 50, crush: 50, magic: 50, ranged: 50 },
  ...over,
});

const whipPlayer = (boostsOn = false): PlayerCombat => ({
  levels: { attack: 99, strength: 99, ranged: 1, magic: 1, hitpoints: 99 },
  gear: { bonuses: { ...ZERO_BONUSES, slash: 82, meleeStr: 82 }, speedTicks: 4 },
  boostsOn,
});

describe('boss kill planner', () => {
  it('auto-picks the style the gear supports (whip → melee slash)', () => {
    const p = planBoss(whipPlayer(), monster());
    expect(p.style).toBe('melee');
    expect(p.attackType).toBe('slash');
    expect(p.dps).toBeGreaterThan(0);
    expect(p.maxHit).toBe(25); // 99 str aggressive, whip str 82
  });

  it('boosts raise DPS and kills/hour', () => {
    const base = planBoss(whipPlayer(false), monster());
    const boosted = planBoss(whipPlayer(true), monster());
    expect(boosted.dps).toBeGreaterThan(base.dps);
    expect(boosted.killsPerHour).toBeGreaterThanOrEqual(base.killsPerHour);
  });

  it('danger scales with the boss max hit relative to HP', () => {
    expect(planBoss(whipPlayer(), monster({ maxHit: 5 })).danger).toBe('low');
    expect(planBoss(whipPlayer(), monster({ maxHit: 25 })).danger).toBe('medium');
    expect(planBoss(whipPlayer(), monster({ maxHit: 40 })).danger).toBe('high');
    expect(planBoss(whipPlayer(), monster({ maxHit: 70 })).danger).toBe('extreme');
  });

  it('readiness reflects time-to-kill (fast kill on a weak target)', () => {
    const easy = planBoss(whipPlayer(true), monster({ hp: 40, defLevel: 1, def: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 } }));
    expect(['excellent', 'good']).toContain(easy.readiness);
  });

  it('gear gap: bare hands are far below a strong setup; strong gear ≈ 100%', () => {
    const bare = planBoss({ levels: { attack: 99, strength: 99, ranged: 99, magic: 99, hitpoints: 99 }, gear: { bonuses: { ...ZERO_BONUSES }, speedTicks: 4 }, boostsOn: false }, monster());
    expect(bare.gearGapPct).toBeLessThan(40);

    const strong: PlayerCombat = { levels: { attack: 99, strength: 99, ranged: 99, magic: 99, hitpoints: 99 }, gear: { bonuses: { ...ZERO_BONUSES, stab: 150, slash: 150, crush: 150, ranged: 140, meleeStr: 150, rangedStr: 120 }, speedTicks: 4 }, boostsOn: true };
    expect(planBoss(strong, monster()).gearGapPct).toBe(100);
  });

  it('exposes boss-name aliases', () => {
    expect(BOSS_ALIASES['Tormented Demons']).toBe('Tormented Demon');
  });
});
