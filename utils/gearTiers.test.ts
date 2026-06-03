import { describe, it, expect } from 'vitest';
import { EQUIPMENT_TIER_MAX } from '../constants';
import { powerScore, assignTiersForSlot, canonicalTierFromName } from './gearTiers';
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

  it('returns null for unrecognised items (caller falls back to power score)', () => {
    expect(canonicalTierFromName('Abyssal whip')).toBeNull();
    expect(canonicalTierFromName('Fire cape')).toBeNull();
    expect(canonicalTierFromName('Amulet of glory')).toBeNull();
  });

  it('handles empty and tiny slots without crashing', () => {
    expect(assignTiersForSlot([]).size).toBe(0);
    const tiny = assignTiersForSlot([{ id: 1, score: 5 }, { id: 2, score: 50 }]);
    expect(tiny.get(1)).toBe(1);
    expect(tiny.get(2)!).toBeGreaterThanOrEqual(1);
    expect(tiny.get(2)!).toBeLessThanOrEqual(EQUIPMENT_TIER_MAX);
  });
});
