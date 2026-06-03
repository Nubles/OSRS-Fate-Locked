import { describe, it, expect } from 'vitest';
import { EQUIPMENT_TIER_MAX } from '../constants';
import {
  powerScore, assignTiersForSlot, canonicalTierFromName,
  itemStyle, buildTierAnchors, anchoredTier,
} from './gearTiers';
import { ZERO_BONUSES, GearBonuses } from './gearStats';

const b = (over: Partial<GearBonuses>): GearBonuses => ({ ...ZERO_BONUSES, ...over });

describe('gear tiers', () => {
  it('powerScore is zero for no bonuses and rises with offence', () => {
    expect(powerScore(ZERO_BONUSES)).toBe(0);
    expect(powerScore(b({ slash: 80 }))).toBeGreaterThan(powerScore(b({ slash: 10 })));
    expect(powerScore(b({ slash: 80, meleeStr: 80 }))).toBeGreaterThan(powerScore(b({ slash: 80 })));
  });

  it('counts defence (weighted) and prayer', () => {
    expect(powerScore(b({ defStab: 100 }))).toBeGreaterThan(0);
    expect(powerScore(b({ prayer: 10 }))).toBeGreaterThan(0);
  });

  it('buckets a large slot across the full tier range, monotonically', () => {
    const items = Array.from({ length: 90 }, (_, i) => ({ id: i, score: i }));
    const tiers = assignTiersForSlot(items);
    const values = [...tiers.values()];
    expect(Math.min(...values)).toBe(1);
    expect(Math.max(...values)).toBe(EQUIPMENT_TIER_MAX);
    // Stronger item never lands below a weaker one.
    for (let i = 1; i < items.length; i++) {
      expect(tiers.get(items[i].id)!).toBeGreaterThanOrEqual(tiers.get(items[i - 1].id)!);
    }
  });

  it('canonical tiers match the Codex material table', () => {
    // The reported bug: rune helm must be T5, not T7.
    expect(canonicalTierFromName('Rune full helm')).toBe(5);
    expect(canonicalTierFromName('Rune platebody')).toBe(5);
    expect(canonicalTierFromName('Bronze med helm')).toBe(1);
    expect(canonicalTierFromName('Steel scimitar')).toBe(2);
    expect(canonicalTierFromName('Mithril chainbody')).toBe(3);
    expect(canonicalTierFromName('Adamant kiteshield')).toBe(4);
    expect(canonicalTierFromName('Dragon scimitar')).toBe(6);
    expect(canonicalTierFromName("Ahrim's robetop")).toBe(7);
    expect(canonicalTierFromName('Bandos chestplate')).toBe(8);
    expect(canonicalTierFromName('Torva platebody')).toBe(9);
  });

  it('resolves ambiguous material words by specificity', () => {
    expect(canonicalTierFromName("Black d'hide body")).toBe(7); // not Black metal (T2)
    expect(canonicalTierFromName('Black platebody')).toBe(2);
    expect(canonicalTierFromName("Green d'hide chaps")).toBe(4);
    expect(canonicalTierFromName("Blue d'hide vambraces")).toBe(5);
    expect(canonicalTierFromName('Dragon hunter crossbow')).toBe(9); // not plain Dragon (T6)
    expect(canonicalTierFromName('Magic shortbow')).toBe(6);
    expect(canonicalTierFromName('Yew longbow')).toBe(5);
  });

  it('pins iconic non-material items to sensible tiers', () => {
    expect(canonicalTierFromName('Fire cape')).toBe(8);
    expect(canonicalTierFromName('Infernal cape')).toBe(9);
    expect(canonicalTierFromName('Barrows gloves')).toBe(7);
    expect(canonicalTierFromName('Helm of neitiznot')).toBe(7);
    expect(canonicalTierFromName('Dragon boots')).toBe(6);
    expect(canonicalTierFromName('Amulet of glory')).toBe(4);
    expect(canonicalTierFromName('Dragon defender')).toBe(7); // beats generic "Dragon" (T6)
    expect(canonicalTierFromName('Rune defender')).toBe(5);
    expect(canonicalTierFromName('Berserker ring (i)')).toBe(8);
    expect(canonicalTierFromName('Berserker ring')).toBe(7);
    expect(canonicalTierFromName('Void knight top')).toBe(7);
    expect(canonicalTierFromName('Elite void top')).toBe(8);
    // weapons whose strength is mechanical, not in their raw bonuses
    expect(canonicalTierFromName('Abyssal whip')).toBe(7);
    expect(canonicalTierFromName('Toxic blowpipe')).toBe(8);
    expect(canonicalTierFromName('Abyssal tentacle')).toBe(8);
    // modern sets are pinned so a set reads consistently (raw bonuses scatter it)
    expect(canonicalTierFromName('Calamity chest')).toBe(8);
    expect(canonicalTierFromName('Elite calamity breeches')).toBe(9);
    expect(canonicalTierFromName('Eclipse moon helm')).toBe(7);
    expect(canonicalTierFromName('Blood moon tassets')).toBe(7);
    expect(canonicalTierFromName('Sunfire fanatic helm')).toBe(8);
    // over-rated by the stat fallback → pinned down
    expect(canonicalTierFromName('3rd age platebody')).toBe(8);
    expect(canonicalTierFromName('3rd age range top')).toBe(8);
    expect(canonicalTierFromName('Staff of light')).toBe(7);
    expect(canonicalTierFromName('Barbed arrow')).toBe(1); // bogus dataset stats
  });

  it('tiers god-themed clue cosmetics by their base material, not the god', () => {
    // The reported bug: cosmetic god armour was reading as God Wars (T8).
    expect(canonicalTierFromName('Armadyl rune helmet')).toBe(5);
    expect(canonicalTierFromName('Bandos rune platebody')).toBe(5);
    expect(canonicalTierFromName('Guthix adamant kiteshield')).toBe(4);
    // god blessed dragonhide → standard d'hide tier (uncoloured = T5), and all
    // gods agree with each other instead of being scattered.
    expect(canonicalTierFromName("Armadyl d'hide body")).toBe(5);
    expect(canonicalTierFromName("Ancient d'hide body")).toBe(5);
    expect(canonicalTierFromName("Saradomin d'hide body")).toBe(5);
    expect(canonicalTierFromName('Gilded platebody')).toBe(5);
    // ...but the real God Wars armour (no material word) is still T8.
    expect(canonicalTierFromName('Bandos chestplate')).toBe(8);
    expect(canonicalTierFromName('Armadyl helmet')).toBe(8);
    expect(canonicalTierFromName('Armadyl godsword')).toBe(8);
  });

  it('returns null only for genuinely unclassifiable items', () => {
    expect(canonicalTierFromName('Cabbage')).toBeNull();
    expect(canonicalTierFromName('Spinning plate')).toBeNull();
  });

  it('detects an item\'s combat style', () => {
    expect(itemStyle(b({ slash: 80, meleeStr: 80 }))).toBe('melee');
    expect(itemStyle(b({ ranged: 60, rangedStr: 30 }))).toBe('ranged');
    expect(itemStyle(b({ magic: 30, magicStr: 15 }))).toBe('magic');
    expect(itemStyle(b({ defStab: 100 }))).toBe('armour');
  });

  it('anchored fallback places unknown gear against the canonical ladder, per style', () => {
    // Canonical melee anchors: a weak T2 and a strong T8.
    const known = [
      { tier: 2, bonuses: b({ slash: 20, meleeStr: 20 }) },
      { tier: 8, bonuses: b({ slash: 120, meleeStr: 120 }) },
    ];
    const anchors = buildTierAnchors(known);
    // A whip-like melee item (strong) lands at/above the strong anchor.
    expect(anchoredTier(b({ slash: 110, meleeStr: 100 }), anchors)).toBeGreaterThanOrEqual(7);
    // A weak melee item lands at the low anchor.
    expect(anchoredTier(b({ slash: 25, meleeStr: 15 }), anchors)).toBeLessThanOrEqual(3);
    // Stronger never tiers below weaker.
    expect(anchoredTier(b({ slash: 120, meleeStr: 120 }), anchors))
      .toBeGreaterThanOrEqual(anchoredTier(b({ slash: 40, meleeStr: 40 }), anchors));
  });

  it('handles empty and tiny slots without crashing', () => {
    expect(assignTiersForSlot([]).size).toBe(0);
    const tiny = assignTiersForSlot([{ id: 1, score: 5 }, { id: 2, score: 50 }]);
    expect(tiny.get(1)).toBe(1);
    expect(tiny.get(2)!).toBeGreaterThanOrEqual(1);
    expect(tiny.get(2)!).toBeLessThanOrEqual(EQUIPMENT_TIER_MAX);
  });
});
