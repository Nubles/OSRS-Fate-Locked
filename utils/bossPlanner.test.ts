// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { planBoss, PlayerCombat, MonsterLite, BOSS_ALIASES, BOSS_COMBAT_LIMITS, BOSS_OPENING_VERSIONS, defaultBossVersion, bestBoostPrayers, type BossPlan, type Readiness } from './bossPlanner';
import { BOSSES_LIST, RETIRED_BOSSES } from '../data/items';
import { MONSTER_CATALOGUE } from '../data/monsterCatalogue';
import type { MonsterStats } from '../services/MonsterService';
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


// The planner fed exactly as the Boss Kill Planner feeds it: the real monster
// catalogue through MonsterService, each boss on its default version.
describe('planner against the real catalogue', () => {
  let planned: { boss: string; monster: MonsterStats }[] = [];
  beforeAll(async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } });
    const rows = JSON.parse(readFileSync(new URL(`../public/${MONSTER_CATALOGUE.asset}`, import.meta.url), 'utf8'));
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => rows }));
    vi.resetModules();
    const { monsterService } = await import('../services/MonsterService');
    await monsterService.init();
    planned = BOSSES_LIST.flatMap(boss => {
      const monster = defaultBossVersion(monsterService.versionsOf(BOSS_ALIASES[boss] ?? boss));
      return monster ? [{ boss, monster }] : [];
    });
  });
  afterAll(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  const setup = (level: number, category: string, bonus: number, boostsOn = true): PlayerCombat => ({
    levels: { attack: level, strength: level, ranged: level, magic: level, hitpoints: level },
    gear: { bonuses: { ...ZERO_BONUSES, stab: bonus, slash: bonus, crush: bonus, ranged: bonus, meleeStr: bonus, rangedStr: Math.round(bonus * 0.8) }, speedTicks: 4, category },
    boostsOn, prayers: boostsOn ? { melee: 'piety', ranged: 'rigour' } : undefined,
  });
  // The planner's own strong reference (99s, +150 melee, +140 ranged, +120 ranged strength), plus weaker setups.
  const STRONG_MELEE: PlayerCombat = { ...setup(99, 'Multi-melee', 150), gear: { bonuses: { ...ZERO_BONUSES, stab: 150, slash: 150, crush: 150, ranged: 140, meleeStr: 150, rangedStr: 120 }, speedTicks: 4, category: 'Multi-melee' } };
  const STRONG_RANGED: PlayerCombat = { ...STRONG_MELEE, gear: { ...STRONG_MELEE.gear, category: 'Bow' } };
  const SETUPS: Record<string, PlayerCombat> = {
    'strong melee': STRONG_MELEE, 'strong ranged': STRONG_RANGED,
    'mid melee': setup(80, 'Whip', 82), 'mid ranged': setup(80, 'Crossbow', 90),
    'low melee': setup(60, 'Slash Sword', 40, false), 'low ranged': setup(60, 'Bow', 40, false),
  };
  const ORDER: Readiness[] = ['excellent', 'good', 'workable', 'slow', 'undergeared', 'unverified'];
  // The readiness bands as they were before reference-relative readiness (time to kill alone).
  const before = (plan: BossPlan): Readiness => {
    if (plan.dps <= 0.01 || !isFinite(plan.ttk)) return 'undergeared';
    if (plan.ttk <= 20) return 'excellent';
    if (plan.ttk <= 45) return 'good';
    if (plan.ttk <= 90) return 'workable';
    if (plan.ttk <= 180) return 'slow';
    return 'undergeared';
  };

  it('keeps every verdict where the reference is under three minutes, and only improves the rest', () => {
    expect(planned.length).toBeGreaterThan(50);
    const changes: string[] = [];
    for (const { boss, monster } of planned) {
      if (BOSS_COMBAT_LIMITS[boss]) continue;
      for (const [name, player] of Object.entries(SETUPS)) {
        const plan = planBoss(player, monster, boss);
        const old = before(planBoss(player, monster));
        if (!(plan.referenceTtk > 180)) expect({ boss, name, readiness: plan.readiness }).toEqual({ boss, name, readiness: old });
        else {
          expect(ORDER.indexOf(plan.readiness)).toBeLessThanOrEqual(ORDER.indexOf(old));
          if (plan.readiness !== old) changes.push(`${boss} (${name}): ${old} -> ${plan.readiness}`);
        }
      }
    }
    expect(changes).toEqual(EXPECTED_CHANGES);
  });

  it('never calls the strong reference Undergeared on a boss the planner can plan', () => {
    for (const { boss, monster } of planned) for (const player of [STRONG_MELEE, STRONG_RANGED]) {
      const plan = planBoss(player, monster, boss);
      if (plan.assessmentNote) continue;
      expect({ boss, readiness: plan.readiness }).not.toEqual({ boss, readiness: 'undergeared' });
    }
  });

  it('gives no combat readiness for Zalcano, a skilling fight', () => {
    const { monster } = planned.find(entry => entry.boss === 'Zalcano')!;
    for (const player of Object.values(SETUPS)) {
      expect(planBoss(player, monster, 'Zalcano')).toMatchObject({ readiness: 'unverified', dps: 0, assessmentNote: expect.stringContaining('immune to combat damage') });
    }
  });

  it('gives no melee or ranged readiness for the Kraken', () => {
    const { monster } = planned.find(entry => entry.boss === 'Kraken')!;
    expect(planBoss(STRONG_MELEE, monster, 'Kraken')).toMatchObject({ readiness: 'unverified', assessmentNote: expect.stringContaining('immune to melee') });
    expect(planBoss(STRONG_RANGED, monster, 'Kraken')).toMatchObject({ readiness: 'unverified', assessmentNote: expect.stringContaining('a seventh') });
    expect(planBoss({ ...STRONG_MELEE, gear: { ...STRONG_MELEE.gear, category: 'Polearm' } }, monster, 'Kraken').readiness).toBe('unverified');
    // Without the boss name the plan is the plain combat estimate, as before.
    expect(planBoss(STRONG_MELEE, monster).readiness).toBe('good');
  });

  it('plans melee on Zulrah only with a halberd', () => {
    const { monster } = planned.find(entry => entry.boss === 'Zulrah')!;
    expect(monster.version).toBe('Serpentine');
    expect(planBoss(STRONG_MELEE, monster, 'Zulrah')).toMatchObject({ readiness: 'unverified', assessmentNote: expect.stringContaining('except with a halberd') });
    const halberd = planBoss({ ...STRONG_MELEE, gear: { ...STRONG_MELEE.gear, category: 'Polearm' } }, monster, 'Zulrah');
    expect(halberd.assessmentNote).toBeUndefined();
    expect(halberd.style).toBe('melee');
    const salamander = planBoss({ ...STRONG_MELEE, gear: { ...STRONG_MELEE.gear, category: 'Salamander' } }, monster, 'Zulrah');
    expect(salamander).toMatchObject({ style: 'ranged' });
    expect(planBoss(STRONG_RANGED, monster, 'Zulrah').assessmentNote).toBeUndefined();
  });

  it("plans melee on Kree'arra only with a halberd or a salamander", () => {
    const { monster } = planned.find(entry => entry.boss === "Kree'arra")!;
    const withCategory = (category: string) => planBoss({ ...STRONG_MELEE, gear: { ...STRONG_MELEE.gear, category } }, monster, "Kree'arra");
    for (const category of ['Multi-melee', 'Whip', 'Slash Sword']) {
      expect(withCategory(category)).toMatchObject({ readiness: 'unverified', dps: 0, assessmentNote: "Kree'arra cannot be attacked with melee, except with a halberd or a salamander." });
    }
    const halberd = withCategory('Polearm');
    expect(halberd.assessmentNote).toBeUndefined();
    expect(halberd).toMatchObject({ style: 'melee' });
    expect(halberd.readiness).not.toBe('unverified');
    const salamander = withCategory('Salamander');
    expect(salamander.assessmentNote).toBeUndefined();
    expect(salamander.readiness).not.toBe('unverified');
    const bow = planBoss(STRONG_RANGED, monster, "Kree'arra");
    expect(bow.assessmentNote).toBeUndefined();
    expect(bow).toMatchObject({ style: 'ranged' });
  });

  it('gives no ranged readiness for the Grotesque Guardians (Dusk)', () => {
    const { monster } = planned.find(entry => entry.boss === 'Grotesque Guardians')!;
    expect(monster.name).toBe('Dusk');
    for (const category of ['Bow', 'Crossbow']) {
      expect(planBoss({ ...STRONG_MELEE, gear: { ...STRONG_MELEE.gear, category } }, monster, 'Grotesque Guardians'))
        .toMatchObject({ readiness: 'unverified', dps: 0, assessmentNote: 'Dusk is immune to ranged and magic; only melee harms him.' });
    }
    const melee = planBoss(STRONG_MELEE, monster, 'Grotesque Guardians');
    expect(melee.assessmentNote).toBeUndefined();
    expect(melee).toMatchObject({ style: 'melee' });
    expect(melee.readiness).not.toBe('unverified');
  });

  it('never calls the Gemstone Crab Undergeared', () => {
    const { monster } = planned.find(entry => entry.boss === 'Gemstone Crab')!;
    for (const player of Object.values(SETUPS)) {
      const plan = planBoss(player, monster, 'Gemstone Crab');
      expect(plan.readiness).toBe('unverified');
      expect(plan.dps).toBeGreaterThan(0);
      expect(plan.assessmentNote).toMatch(/^The Gemstone Crab is a training boss with effectively endless hitpoints, so there is no kill time to plan\. You deal about \d+\.\d damage per second to it\.$/);
    }
  });

  it('lists combat limits and opening versions only for bosses the planner plans', () => {
    for (const boss of Object.keys(BOSS_COMBAT_LIMITS)) expect(planned.map(entry => entry.boss)).toContain(boss);
    for (const name of Object.keys(BOSS_OPENING_VERSIONS)) {
      expect(RETIRED_BOSSES).not.toContain(name);
      expect(planned.some(entry => (BOSS_ALIASES[entry.boss] ?? entry.boss) === name && entry.monster.version === BOSS_OPENING_VERSIONS[name])).toBe(true);
    }
    expect(BOSS_OPENING_VERSIONS).not.toHaveProperty('Galvek');
  });
});

// Every verdict that reference-relative readiness changes for the setups above:
// only the strong reference itself, on bosses it needs over three minutes for.
const EXPECTED_CHANGES: string[] = [
  'The Nightmare (strong melee): undergeared -> slow',
  'The Nightmare (strong ranged): undergeared -> slow',
  "Phosani's Nightmare (strong melee): undergeared -> slow",
  "Phosani's Nightmare (strong ranged): undergeared -> slow",
  'Nex (strong melee): undergeared -> slow',
  'Nex (strong ranged): undergeared -> slow',
  'Corporeal Beast (strong melee): undergeared -> slow',
  'Corporeal Beast (strong ranged): undergeared -> slow',
  'Thermonuclear Smoke Devil (strong ranged): undergeared -> slow',
  'Araxxor (strong ranged): undergeared -> slow',
  'Callisto (strong melee): undergeared -> slow',
  'Venenatis (strong ranged): undergeared -> slow',
  "Vet'ion (strong ranged): undergeared -> slow",
  'The Hueycoatl (strong melee): undergeared -> slow',
  'The Hueycoatl (strong ranged): undergeared -> slow',
  'Duke Sucellus (strong ranged): undergeared -> slow',
  'The Leviathan (strong melee): undergeared -> slow',
  'The Whisperer (strong melee): undergeared -> slow',
  'The Whisperer (strong ranged): undergeared -> slow',
  // Vardorvis is planned at his Wiki Defence (215) since the catalogue override.
  'Vardorvis (strong ranged): undergeared -> slow',
  'Phantom Muspah (strong melee): undergeared -> slow',
  'Yama (strong melee): undergeared -> slow',
  'Yama (strong ranged): undergeared -> slow',
  'Maggot King (strong melee): undergeared -> slow',
  'Maggot King (strong ranged): undergeared -> slow',
  'The Mad Angel (strong ranged): undergeared -> slow',
];
