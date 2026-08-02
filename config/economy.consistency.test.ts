import { describe, it, expect } from 'vitest';
import { DROP_RATES, EQUIPMENT_TIER_MAX } from './rules';
import { DropSource, TableType } from '../types';
import {
  EARN_METHODS, KEY_TYPES, SPEND_TABLES, RITUALS,
  SKILLS_TIER_CAP, LEVEL_ROLL_MAX, earnRange,
  VANILLA_BOSS_KEY_RATES, VANILLA_BOSS_STANDARD_KEY_TOTAL, vanillaBossKeySchedule,
  FAILURE_FATE_BY_SOURCE, SKILL_CHAOS_MILESTONES,
  failureFateForSkillLevel, failureFateForSource, isSkillChaosMilestone,
} from './economy';
import { BRUTUS_BOSS_NAME } from './vanillaKeyEconomy';
import { VANILLA_RANDOM_ACCESS_POLICY, type VanillaRandomAccessPolicy } from '../data/activityAccess';
import { BOSSES_LIST } from '../data/items';
import { describeVanillaRandomAccessPolicy, formatVanillaBossSchedule } from '../components/ReferenceModal';
import { skillLevelKeyChance } from '../utils/keyRoll';

/**
 * This is the anti-drift guarantee: the Codex / onboarding render from
 * config/economy.ts, and these assertions pin its earn rates to the engine's
 * DROP_RATES. If someone tunes a rate in one place and not the other, this
 * fails loudly.
 */
describe('economy ↔ engine consistency', () => {
  const fixedTiers = EARN_METHODS.flatMap(m => m.tiers.filter(t => t.source));

  it('every fixed earn rate equals DROP_RATES exactly', () => {
    for (const t of fixedTiers) {
      expect(DROP_RATES[t.source!], `rate for ${t.source}`).toBe(t.rate);
    }
  });

  it('documents every DropSource the engine can roll (except internal CUSTOM / dynamic LEVEL_UP)', () => {
    const documented = new Set(fixedTiers.map(t => t.source));
    const expected = (Object.values(DropSource) as DropSource[]).filter(
      s => s !== DropSource.CUSTOM && s !== DropSource.LEVEL_UP,
    );
    for (const s of expected) {
      expect(documented.has(s), `missing earn entry for "${s}"`).toBe(true);
    }
  });

  it('never documents the same DropSource twice', () => {
    const sources = fixedTiers.map(t => t.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('represents Level Ups as the dynamic Level ÷ 5 curve', () => {
    const lvl = EARN_METHODS.find(m => m.category === 'Level Ups');
    expect(lvl?.dynamic).toBe(true);
    expect(LEVEL_ROLL_MAX).toBe(19.8);
    expect(LEVEL_ROLL_MAX).toBe(skillLevelKeyChance(99));
    expect(lvl?.tiers[0].rateLabel).toBe('Level ÷ 5 (up to 19.8% at level 99)');
  });

  it('awards failure Fate by the approved skill-level bands', () => {
    expect([
      failureFateForSkillLevel(2),
      failureFateForSkillLevel(19),
      failureFateForSkillLevel(20),
      failureFateForSkillLevel(79),
      failureFateForSkillLevel(80),
      failureFateForSkillLevel(99),
    ]).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('awards failure Fate for every fixed source and defaults dynamic or custom sources conservatively', () => {
    const expected: ReadonlyArray<readonly [DropSource, 1 | 2 | 3]> = [
      [DropSource.QUEST_NOVICE, 1], [DropSource.QUEST_INTERMEDIATE, 1], [DropSource.QUEST_EXPERIENCED, 2], [DropSource.QUEST_MASTER, 3], [DropSource.QUEST_GRANDMASTER, 1],
      [DropSource.DIARY_EASY, 1], [DropSource.DIARY_MEDIUM, 1], [DropSource.DIARY_HARD, 2], [DropSource.DIARY_ELITE, 3],
      [DropSource.CA_EASY, 1], [DropSource.CA_MEDIUM, 1], [DropSource.CA_HARD, 2], [DropSource.CA_ELITE, 2], [DropSource.CA_MASTER, 3], [DropSource.CA_GRANDMASTER, 3],
      [DropSource.CLUE_BEGINNER, 1], [DropSource.CLUE_EASY, 1], [DropSource.CLUE_MEDIUM, 1], [DropSource.CLUE_HARD, 2], [DropSource.CLUE_ELITE, 2], [DropSource.CLUE_MASTER, 3],
      [DropSource.SLAYER_BEGINNER, 1], [DropSource.SLAYER_MAZCHNA, 1], [DropSource.SLAYER_VANNAKA, 1], [DropSource.SLAYER_CHAELDAR, 1], [DropSource.SLAYER_KONAR, 2], [DropSource.SLAYER_NIEVE, 2], [DropSource.SLAYER_KRYSTILIA, 2], [DropSource.SLAYER_DURADEL, 2], [DropSource.SLAYER_BOSS, 3],
      [DropSource.BOSS_LOW, 1], [DropSource.BOSS_MID, 2], [DropSource.BOSS_HIGH, 2], [DropSource.RAID, 3], [DropSource.ACTIVITY_MINIGAME, 1], [DropSource.PET, 1], [DropSource.COLLECTION_LOG, 1],
    ];

    for (const [source, award] of expected) {
      expect(failureFateForSource(source), `failure Fate for ${source}`).toBe(award);
    }
    expect(failureFateForSource(DropSource.LEVEL_UP)).toBe(1);
    expect(failureFateForSource(DropSource.CUSTOM)).toBe(1);
  });

  it('maps every non-guaranteed documented source explicitly and displays its failure Fate', () => {
    for (const tier of fixedTiers) {
      if (tier.rate !== 100) {
        expect(Object.hasOwn(FAILURE_FATE_BY_SOURCE, tier.source!), `missing explicit failure Fate for ${tier.source}`).toBe(true);
      }
      expect(tier.fateOnFailure).toBe(failureFateForSource(tier.source!));
    }
  });

  it('defines Chaos milestones exactly and recognizes only milestone levels', () => {
    expect(SKILL_CHAOS_MILESTONES).toEqual([30, 40, 50, 60, 70, 80, 90, 99]);
    expect(isSkillChaosMilestone(70)).toBe(true);
    expect(isSkillChaosMilestone(79)).toBe(false);
  });

  it('earnRange returns the min/max of a method’s fixed tiers', () => {
    const slayer = EARN_METHODS.find(m => m.category === 'Slayer Tasks')!;
    const [lo, hi] = earnRange(slayer);
    expect(lo).toBe(DROP_RATES[DropSource.SLAYER_BEGINNER]); // 5
    expect(hi).toBe(DROP_RATES[DropSource.SLAYER_BOSS]);     // 80 — the number the old Codex got wrong
  });

  it('exposes exactly the three key types', () => {
    expect(KEY_TYPES.map(k => k.id).sort()).toEqual(['chaos', 'omni', 'standard']);
  });

  it('lists every spend table with a non-empty pool', () => {
    expect(SPEND_TABLES.length).toBeGreaterThanOrEqual(12);
    for (const t of SPEND_TABLES) expect(t.count, t.label).toBeGreaterThan(0);
  });

  it('presents Arcana as Combat Powers without changing its type', () => {
    const table = SPEND_TABLES.find(t => t.type === TableType.ARCANA);
    expect(TableType.ARCANA).toBe('Arcana');
    expect(table).toMatchObject({
      label: 'Combat Powers',
      blurb: 'Spellbooks, prayers, and special combat systems.',
    });
  });

  it('keeps tier caps aligned with the engine', () => {
    expect(SKILLS_TIER_CAP).toBe(10); // reducer bumpTier(..., 10)
    const equip = SPEND_TABLES.find(t => t.label === 'Equipment');
    expect(equip?.tiers).toBe(EQUIPMENT_TIER_MAX);
  });

  it('defines all six Void Altar rituals with a cost', () => {
    expect(RITUALS.map(r => r.id).sort()).toEqual(['CARTOGRAPHER', 'CHAOS', 'GAMBIT', 'GREED', 'LUCK', 'TRANSMUTE']);
    for (const r of RITUALS) expect((r.fateCost ?? 0) + (r.keyCost ?? 0)).toBeGreaterThan(0);
  });

  it('keeps the finite Vanilla boss reserve and every boss schedule aligned', () => {
    expect(VANILLA_BOSS_STANDARD_KEY_TOTAL).toBe(116);
    expect(BOSSES_LIST).not.toContain(BRUTUS_BOSS_NAME);
    for (const boss of BOSSES_LIST) expect(vanillaBossKeySchedule(boss).length).toBeGreaterThan(0);
  });

  it('formats Codex policy directly from the shared Vanilla configuration', () => {
    expect(formatVanillaBossSchedule('Raid', VANILLA_BOSS_KEY_RATES.raid)).toBe('Raid: 65% → 32.5% → 16.25% (3 keys)');
    expect(describeVanillaRandomAccessPolicy(VANILLA_RANDOM_ACCESS_POLICY)).toContain('Standard and Chaos random unlocks respect hard location access');
  });

  it('derives each Codex safety-valve sentence from policy decisions', () => {
    const policy: VanillaRandomAccessPolicy = VANILLA_RANDOM_ACCESS_POLICY;
    const formatted = describeVanillaRandomAccessPolicy(policy);
    expect(formatted).toContain('Standard and Chaos random unlocks respect hard location access');
    expect(formatted).toContain('empty eligible pool means no unlock occurs');
    expect(formatted).toContain('no key is spent');
    expect(formatted).toContain('no RNG progression');
    expect(formatted).toContain('bypass that filter with a warning');

    const standardOnly: VanillaRandomAccessPolicy = { ...policy, randomCosts: ['key'] };
    expect(describeVanillaRandomAccessPolicy(standardOnly)).toContain('Standard random unlocks respect hard location access');
    expect(describeVanillaRandomAccessPolicy(standardOnly)).not.toContain('Standard and Chaos');

    const noGeography: VanillaRandomAccessPolicy = { ...policy, requiresTrackedHardGeography: false };
    expect(describeVanillaRandomAccessPolicy(noGeography)).not.toContain('hard location access');
    expect(describeVanillaRandomAccessPolicy(noGeography)).toContain('Omni-Key direct unlocks can be selected even without location access.');
    expect(describeVanillaRandomAccessPolicy(noGeography)).not.toContain('with a warning');
    expect(describeVanillaRandomAccessPolicy(noGeography)).not.toContain('that filter');

    const noFilteredTables: VanillaRandomAccessPolicy = { ...policy, filteredTables: [] };
    expect(describeVanillaRandomAccessPolicy(noFilteredTables)).not.toContain('random unlocks respect hard location access');
    expect(describeVanillaRandomAccessPolicy(noFilteredTables)).toContain('Omni-Key direct unlocks can be selected even without location access');

    const minigamesOnly: VanillaRandomAccessPolicy = { ...policy, filteredTables: [TableType.MINIGAMES] };
    expect(describeVanillaRandomAccessPolicy(minigamesOnly)).toContain('hard location access for Minigames');
    expect(describeVanillaRandomAccessPolicy(minigamesOnly)).not.toContain('Bosses and Minigames');

    const noEmptyPoolGuard: VanillaRandomAccessPolicy = {
      ...policy,
      emptyEligiblePool: { noUnlock: false, retainsKey: true, preservesRngProgression: true },
    };
    expect(describeVanillaRandomAccessPolicy(noEmptyPoolGuard)).not.toContain('empty eligible pool');

    const consumingEmptyPool: VanillaRandomAccessPolicy = {
      ...policy,
      emptyEligiblePool: { noUnlock: true, retainsKey: false, preservesRngProgression: true },
    };
    expect(describeVanillaRandomAccessPolicy(consumingEmptyPool)).not.toContain('no key is spent');

    const advancingEmptyPool: VanillaRandomAccessPolicy = {
      ...policy,
      emptyEligiblePool: { noUnlock: true, retainsKey: true, preservesRngProgression: false },
    };
    expect(describeVanillaRandomAccessPolicy(advancingEmptyPool)).not.toContain('no RNG progression');

    const silentOmni: VanillaRandomAccessPolicy = {
      ...policy,
      omniDirect: { allowsLocationIneligible: true, warnsPlayer: false },
    };
    expect(describeVanillaRandomAccessPolicy(silentOmni)).not.toContain('with a warning');

    const restrictedOmni: VanillaRandomAccessPolicy = {
      ...policy,
      omniDirect: { allowsLocationIneligible: false, warnsPlayer: true },
    };
    expect(describeVanillaRandomAccessPolicy(restrictedOmni)).not.toContain('bypass that filter');
    expect(describeVanillaRandomAccessPolicy(restrictedOmni)).not.toContain('with a warning');
  });
});
