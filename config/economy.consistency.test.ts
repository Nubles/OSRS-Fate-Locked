import { describe, it, expect } from 'vitest';
import { DROP_RATES, EQUIPMENT_TIER_MAX } from './rules';
import { DropSource } from '../types';
import {
  EARN_METHODS, KEY_TYPES, SPEND_TABLES, RITUALS,
  SKILLS_TIER_CAP, LEVEL_ROLL_MAX, earnRange,
} from './economy';

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
    expect(LEVEL_ROLL_MAX).toBe(Math.ceil(99 / 5));
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

  it('keeps tier caps aligned with the engine', () => {
    expect(SKILLS_TIER_CAP).toBe(10); // reducer bumpTier(..., 10)
    const equip = SPEND_TABLES.find(t => t.label === 'Equipment');
    expect(equip?.tiers).toBe(EQUIPMENT_TIER_MAX);
  });

  it('defines all four Void Altar rituals with a cost', () => {
    expect(RITUALS.map(r => r.id).sort()).toEqual(['CHAOS', 'GREED', 'LUCK', 'TRANSMUTE']);
    for (const r of RITUALS) expect((r.fateCost ?? 0) + (r.keyCost ?? 0)).toBeGreaterThan(0);
  });
});
