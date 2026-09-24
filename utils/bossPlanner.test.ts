import { describe, it, expect } from 'vitest';
import { planBoss, PlayerCombat, MonsterLite, BOSS_ALIASES, defaultBossVersion, bestBoostPrayers } from './bossPlanner';
import { ZERO_BONUSES } from './gearStats';
import type { UnlockState } from '../types';

const monster = (over: Partial<MonsterLite> = {}): MonsterLite => ({
  hp: 150, maxHit: 30, defLevel: 100, magicLevel: 1,
  def: { stab: 50, slash: 50, crush: 50, magic: 50, ranged: 50 },
  ...over,
});

const whipPlayer = (boostsOn = false): PlayerCombat => ({
  levels: { attack: 99, strength: 99, ranged: 1, magic: 1, hitpoints: 99 },
  gear: { bonuses: { ...ZERO_BONUSES, slash: 82, meleeStr: 82 }, speedTicks: 4, category: 'Whip' },
  boostsOn,
});

describe('boss kill planner', () => {
  it('auto-picks the style the gear supports (whip → melee slash)', () => {
    const p = planBoss(whipPlayer(), monster());
    expect(p.style).toBe('melee');
    expect(p.attackType).toBe('slash');
    expect(p.dps).toBeGreaterThan(0);
    expect(p.maxHit).toBe(25); // Controlled gives 108 effective Strength, not the illegal aggressive 110.
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

  it('reports an unknown danger, not Low, when the boss max hit is unknown', () => {
    const plan = planBoss(whipPlayer(), monster({ maxHit: null }));
    expect(plan.danger).toBe('unknown');
    expect(plan.killsBeforeBank).toBeNull();
    expect(plan.dps).toBeGreaterThan(0);
    expect(planBoss(whipPlayer(), monster({ maxHit: 0 }))).toMatchObject({ danger: 'low', killsBeforeBank: 99 });
  });

  it('readiness reflects time-to-kill (fast kill on a weak target)', () => {
    const easy = planBoss(whipPlayer(true), monster({ hp: 40, defLevel: 1, def: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 } }));
    expect(['excellent', 'good']).toContain(easy.readiness);
  });

  it('gear gap: bare hands are far below a strong setup; strong gear ≈ 100%', () => {
    const bare = planBoss({ levels: { attack: 99, strength: 99, ranged: 99, magic: 99, hitpoints: 99 }, gear: { bonuses: { ...ZERO_BONUSES }, speedTicks: 4, category: 'Unarmed' }, boostsOn: false }, monster());
    expect(bare.gearGapPct).toBeLessThan(40);

    const strong: PlayerCombat = { levels: { attack: 99, strength: 99, ranged: 99, magic: 99, hitpoints: 99 }, gear: { bonuses: { ...ZERO_BONUSES, stab: 150, slash: 150, crush: 150, ranged: 140, meleeStr: 150, rangedStr: 120 }, speedTicks: 4, category: 'Slash Sword' }, boostsOn: true, prayers: { melee: 'piety', ranged: 'rigour' } };
    expect(planBoss(strong, monster()).gearGapPct).toBe(100);
  });

  it('exposes boss-name aliases', () => {
    expect(BOSS_ALIASES['Tormented Demons']).toBe('Tormented Demon');
    expect(BOSS_ALIASES['The Mad Angel']).toBe('Mad Angel');
  });
});


describe('legal weapon options', () => {
  it('never suggests stab or aggressive with a whip, even against slash resistance', () => {
    const player = whipPlayer();
    const plan = planBoss({ ...player, gear: { ...player.gear, category: 'Whip' } },
      monster({ def: { stab: 0, slash: 300, crush: 0, magic: 50, ranged: 300 } }));
    expect(plan.attackType).toBe('slash');
    expect(['accurate', 'controlled', 'defensive']).toContain(plan.stanceId);
  });

  it('never invents melee attacks for a bow with high melee stats', () => {
    const player = whipPlayer();
    const plan = planBoss({ ...player, gear: { ...player.gear, category: 'Bow' } }, monster());
    expect(plan.style).toBe('ranged');
  });

  it('does not rank a powered staff as a melee weapon', () => {
    const player = whipPlayer();
    const plan = planBoss({ ...player, gear: { ...player.gear, category: 'Powered Staff' } }, monster());
    expect(plan.readiness).toBe('unverified');
    expect(plan.assessmentNote).toMatch(/spell/i);
  });

  it('requires reviewed attack options for an unknown weapon category', () => {
    const player = whipPlayer();
    const plan = planBoss({ ...player, gear: { ...player.gear, category: undefined } }, monster());
    expect(plan.readiness).toBe('unverified');
    expect(plan.dps).toBe(0);
  });

  it('keeps spear attacks controlled or defensive', () => {
    const player = whipPlayer();
    const plan = planBoss({ ...player, gear: { ...player.gear, category: 'Spear' } }, monster());
    expect(['controlled', 'defensive']).toContain(plan.stanceId);
  });
});

describe('defaultBossVersion', () => {
  const versions = (name: string, labels: string[]) => labels.map(version => ({ name, version }));
  const pick = (name: string, labels: string[]) => defaultBossVersion(versions(name, labels))?.version;

  it('prefers the post-quest, normal or solo fight over harder variants', () => {
    expect(pick('Vardorvis', ['Awakened', 'Post-quest', 'Quest'])).toBe('Post-quest');
    expect(pick('Duke Sucellus', ['Awakened, Awake', 'Post-quest, Awake', 'Quest, Awake'])).toBe('Post-quest, Awake');
    expect(pick('Yama', ['Normal', 'Phase 3', 'Glyphic Attenuation', 'Glyphic Attenuation, Phase 3'])).toBe('Normal');
    expect(pick('Scurrius', ['Group', 'Solo'])).toBe('Solo');
    expect(pick('Vorkath', ['Dragon Slayer II', 'Post-quest'])).toBe('Post-quest');
  });

  it('starts multi-phase bosses on their opening phase, not the first alphabetically', () => {
    expect(pick('Zulrah', ['Magma', 'Serpentine', 'Tanzanite'])).toBe('Serpentine');
    expect(pick('Alchemical Hydra', ['Electric', 'Extinguished', 'Fire', 'Serpentine'])).toBe('Serpentine');
    expect(pick('Doom of Mokhaiotl', ['Deep Delve', 'Delve 1', 'Delve 2'])).toBe('Delve 1');
  });

  it('falls back to the unversioned or first listed entry', () => {
    expect(pick('Abyssal Sire', ['Phase 1', 'Phase 2'])).toBe('Phase 1');
    expect(pick('Giant Mole', [''])).toBe('');
    expect(defaultBossVersion([])).toBeUndefined();
  });
});

describe('boost prayers', () => {
  const unlocks = (over: Partial<UnlockState> = {}): UnlockState => ({
    equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [], arcana: [], housing: [],
    merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    banks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
    ...over,
  });
  const skilled = (prayer: number, defence: number, over: Partial<UnlockState> = {}) => unlocks({
    skills: { Prayer: Math.ceil(prayer / 10), Defence: Math.ceil(defence / 10) },
    levels: { Prayer: prayer, Defence: defence },
    ...over,
  });
  // General Graardor, from the pinned catalogue.
  const graardor = monster({ hp: 255, maxHit: 60, defLevel: 250, magicLevel: 80, def: { stab: 90, slash: 90, crush: 90, magic: 298, ranged: 90 } });
  const whip7070 = (prayers?: PlayerCombat['prayers']): PlayerCombat => ({
    levels: { attack: 70, strength: 70, ranged: 1, magic: 1, hitpoints: 70 },
    gear: { bonuses: { ...ZERO_BONUSES, slash: 82, meleeStr: 82 }, speedTicks: 4, category: 'Whip' },
    boostsOn: true,
    prayers,
  });

  it('assumes no prayer without the Prayer levels or Arcana unlocks', () => {
    expect(bestBoostPrayers(unlocks())).toEqual({ melee: 'none', ranged: 'none' });
    // Raw Prayer 99 is capped at 10 by tier 1.
    expect(bestBoostPrayers(unlocks({ skills: { Prayer: 1 }, levels: { Prayer: 99 } }))).toEqual({ melee: 'none', ranged: 'none' });
  });

  it('falls back to the standard prayers the tier-capped Prayer level reaches', () => {
    expect(bestBoostPrayers(skilled(43, 1))).toEqual({ melee: 'clarity', ranged: 'none' });
    expect(bestBoostPrayers(skilled(44, 1))).toEqual({ melee: 'clarity', ranged: 'eagle' });
    // Piety's levels without its Arcana unlock are not Piety.
    expect(bestBoostPrayers(skilled(99, 99, { quests: ["King's Ransom"] }))).toEqual({ melee: 'clarity', ranged: 'eagle' });
  });

  it('uses Piety, Chivalry and Rigour only with their unlock and every level and quest gate', () => {
    const knight = { arcana: ['Piety', 'Chivalry'], quests: ["King's Ransom"] };
    expect(bestBoostPrayers(skilled(70, 70, knight)).melee).toBe('piety');
    expect(bestBoostPrayers(skilled(69, 70, knight)).melee).toBe('chivalry');
    expect(bestBoostPrayers(skilled(70, 64, knight)).melee).toBe('clarity');
    expect(bestBoostPrayers(skilled(70, 70, { ...knight, quests: [] })).melee).toBe('clarity');
    // Prayer 70 capped at 60 by tier 6 reaches Chivalry, not Piety.
    expect(bestBoostPrayers(skilled(70, 70, { ...knight, skills: { Prayer: 6, Defence: 7 } })).melee).toBe('chivalry');
    expect(bestBoostPrayers(skilled(74, 70, { arcana: ['Rigour'] })).ranged).toBe('rigour');
    expect(bestBoostPrayers(skilled(73, 70, { arcana: ['Rigour'] })).ranged).toBe('eagle');
  });

  it('plans with the prayer the player has and reports the boosts it assumed', () => {
    const noPrayer = planBoss(whip7070(bestBoostPrayers(unlocks())), graardor);
    const piety = planBoss(whip7070({ melee: 'piety', ranged: 'rigour' }), graardor);
    expect(piety.maxHit).toBe(26);
    expect(noPrayer.maxHit).toBe(21);
    expect(noPrayer.dps).toBeLessThan(piety.dps);
    expect(noPrayer).toMatchObject({ prayer: null, potion: 'Super combat' });
    expect(piety).toMatchObject({ prayer: 'Piety', potion: 'Super combat' });
    expect(planBoss({ ...whip7070({ melee: 'piety' }), boostsOn: false }, graardor)).toMatchObject({ maxHit: 18, prayer: null, potion: null });
  });
});
