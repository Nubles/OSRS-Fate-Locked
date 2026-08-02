import { describe, it, expect } from 'vitest';
import { TableType } from '../types';
import { eventRarity, categoryRarity, categoryColor, rarityColor, rarityRank, RARITY_COLOR } from './rarity';

describe('rarity system', () => {
  it('maps roll outcomes to beam rarities (fail = no beam)', () => {
    expect(eventRarity('ROLL_FAIL')).toBeNull();
    expect(eventRarity('ROLL_SUCCESS')).toBe('common');
    expect(eventRarity('ROLL_PITY')).toBe('uncommon');
    expect(eventRarity('ROLL_OMNI')).toBe('legendary');
  });

  it('level-up only beams when a chaos key dropped', () => {
    expect(eventRarity('LEVEL_UP', { chaosKeysAwarded: 0, chaosKeyAwarded: false })).toBeNull();
    expect(eventRarity('LEVEL_UP', { chaosKeysAwarded: 1, chaosKeyAwarded: true })).toBe('epic');
    expect(eventRarity('LEVEL_UP', { chaosKeysAwarded: 2, chaosKeyAwarded: true })).toBe('epic');
  });

  it('unlock rarity scales with category significance', () => {
    expect(eventRarity('UNLOCK', { category: TableType.BOSSES })).toBe('legendary');
    expect(eventRarity('UNLOCK', { category: TableType.REGIONS })).toBe('epic');
    expect(eventRarity('UNLOCK', { category: TableType.MERCHANTS })).toBe('common');
    expect(eventRarity('UNLOCK', { category: 'Unknown' })).toBe('rare'); // sensible default
  });

  it('every rarity resolves to a hex colour, ordered by rank', () => {
    for (const r of Object.keys(RARITY_COLOR) as Array<keyof typeof RARITY_COLOR>) {
      expect(rarityColor(r)).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(rarityRank('legendary')).toBeGreaterThan(rarityRank('common'));
  });

  it('known categories have a colour; unknown falls back', () => {
    expect(categoryColor(TableType.BOSSES)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(categoryColor('Quests')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(categoryColor(undefined)).toBe('#94a3b8');
  });

  it('categoryRarity defaults to rare for unknowns', () => {
    expect(categoryRarity(TableType.BOSSES)).toBe('legendary');
    expect(categoryRarity('???')).toBe('rare');
  });
});
