import { describe, expect, it } from 'vitest';
import { ACTIVITY_REQUIREMENTS } from './activityRequirements';
import { evaluateActivityReadiness } from '../utils/activityReadiness';
import type { UnlockState } from '../types';

const state = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], ...overrides,
});
const readiness = (id: string, overrides: Partial<UnlockState> = {}) => evaluateActivityReadiness(true, ACTIVITY_REQUIREMENTS[id], state(overrides));

describe('reviewed guild and arcana gates', () => {
  it('retains attire checks after the guild skill level is met', () => {
    expect(readiness("Cooks' Guild", { levels: { Cooking: 99 } }).status).toBe('NEEDS_CONFIRMATION');
    expect(readiness('Crafting Guild', { levels: { Crafting: 99 } }).status).toBe('NEEDS_CONFIRMATION');
  });
  it('separates Hunter amenities from quest access', () => {
    expect(readiness('Hunter Guild', { quests: ['Children of the Sun'], levels: { Hunter: 45 } }).status).toBe('NOT_READY');
    expect(readiness('Hunter Guild', { quests: ['Children of the Sun'], levels: { Hunter: 46 } }).status).toBe('READY');
  });
  it('does not turn informational entry notes into unclassified gates', () => {
    expect(readiness('Prayer Guild', { levels: { Prayer: 31 } }).status).toBe('READY');
    expect(readiness("Rogues' Den").status).toBe('READY');
    expect(readiness('Arceuus Spellbook').status).toBe('NEEDS_CONFIRMATION');
    expect(readiness("Servants' Guild").status).toBe('NEEDS_CONFIRMATION');
  });
  it('allows a proven Warrior mastery route without confirming another route', () => {
    expect(readiness("Warriors' Guild", { levels: { Attack: 99 } }).status).toBe('READY');
    expect(readiness("Warriors' Guild", { levels: { Strength: 99 } }).status).toBe('READY');
    expect(readiness("Warriors' Guild", { levels: { Attack: 65, Strength: 65 } }).status).toBe('READY');
  });
  it('keeps post-quest training and learned spells explicit', () => {
    expect(readiness('Piety', { quests: ["King's Ransom"], levels: { Prayer: 70, Defence: 70 } }).status).toBe('NEEDS_CONFIRMATION');
    expect(readiness('Bones to Peaches', { levels: { Magic: 59 } }).status).toBe('NOT_READY');
    expect(readiness('Bones to Peaches', { levels: { Magic: 60 } }).status).toBe('NEEDS_CONFIRMATION');
    expect(readiness('God Spells', { quests: ['Mage Arena I'], levels: { Magic: 60 } }).status).toBe('NEEDS_CONFIRMATION');
    expect(readiness('Mage Arena II', { levels: { Magic: 75 } }).status).toBe('NOT_READY');
    expect(readiness('Mage Arena II', { quests: ['Mage Arena II'], levels: { Magic: 75 } }).status).toBe('READY');
  });
});
