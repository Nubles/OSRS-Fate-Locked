import { describe, expect, it } from 'vitest';
import type { QuestData } from '../data/questData';
import { questRequirementFingerprint } from '../data/questRequirementAudit';
import { DropSource, UnlockState } from '../types';
import { evaluateQuestEligibility, questRequirementOptionLabel, questRequirementOptionMet } from './journalStatus';

const unlocked = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {},
  regions: [], mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...over,
});

const quest = (over: Partial<QuestData> = {}): QuestData => ({
  id: 'Test Quest', name: 'Test Quest', kind: 'quest', accessPolicy: 'regions',
  regions: [], skills: {}, prereqs: [], points: 1, difficulty: DropSource.QUEST_NOVICE,
  ...over,
});

describe('quest shop and travel unlocks', () => {
  it('needs each merchant category, as a Diary task does', () => {
    const shop = quest({ merchants: ['Clothes Shops', 'Bars & Inns'] });
    const locked = evaluateQuestEligibility(shop, unlocked({ merchants: ['Clothes Shops'] }), 'vanilla');
    expect(locked.status).toBe('LOCKED_MERCHANT');
    expect(locked.eligible).toBe(false);
    expect(locked.blockers).toEqual([{ kind: 'merchant', label: 'Bars & Inns' }]);
    expect(locked.evidence).toContain('Clothes Shops');

    const ready = evaluateQuestEligibility(shop, unlocked({ merchants: ['Clothes Shops', 'Bars & Inns'] }), 'vanilla');
    expect(ready.status).toBe('AVAILABLE');
    expect(ready.eligible).toBe(true);
  });

  it('needs each travel network, as a Diary task does', () => {
    const rings = quest({ mobility: ['Fairy Rings'] });
    const locked = evaluateQuestEligibility(rings, unlocked(), 'vanilla');
    expect(locked.status).toBe('LOCKED_MOBILITY');
    expect(locked.blockers).toEqual([{ kind: 'mobility', label: 'Fairy Rings' }]);
    expect(evaluateQuestEligibility(rings, unlocked({ mobility: ['Fairy Rings'] }), 'vanilla').eligible).toBe(true);
  });

  it('ranks the new locks between equipment and prerequisite quests, as Diary tiers do', () => {
    const both = quest({ mobility: ['Fairy Rings'], merchants: ['Clothes Shops'], prereqs: ['Lost City'] });
    expect(evaluateQuestEligibility(both, unlocked(), 'vanilla').status).toBe('LOCKED_MOBILITY');
    expect(evaluateQuestEligibility(both, unlocked({ mobility: ['Fairy Rings'] }), 'vanilla').status).toBe('LOCKED_MERCHANT');
    expect(evaluateQuestEligibility(both, unlocked({ mobility: ['Fairy Rings'], merchants: ['Clothes Shops'] }), 'vanilla').status)
      .toBe('LOCKED_QUEST');
    const equipped = quest({ merchants: ['Clothes Shops'], equipmentRequirements: [{ slot: 'Head', tier: 1, reason: 'Wear a hat' }] });
    expect(evaluateQuestEligibility(equipped, unlocked(), 'vanilla').status).toBe('LOCKED_EQUIPMENT');
  });

  it('fingerprints the merchant and mobility gates for the requirement audit', () => {
    const plain = quest();
    expect(questRequirementFingerprint(quest({ merchants: ['Wine Traders'] }))).not.toBe(questRequirementFingerprint(plain));
    expect(questRequirementFingerprint(quest({ mobility: ['Fairy Rings'] }))).not.toBe(questRequirementFingerprint(plain));
    expect(questRequirementFingerprint(quest({ merchants: undefined, mobility: undefined }))).toBe(questRequirementFingerprint(plain));
  });
});

describe('quest route options', () => {
  it('takes a route only once its quest is done, such as the Abyss after Enter the Abyss', () => {
    const abyss = { regions: ['Edgeville'], quests: ['Enter the Abyss'] };
    expect(questRequirementOptionMet(abyss, unlocked(), 'vanilla')).toBe(false);
    expect(questRequirementOptionMet(abyss, unlocked({ quests: ['Enter the Abyss'] }), 'vanilla')).toBe(true);
    expect(questRequirementOptionLabel(abyss)).toBe('Edgeville + Enter the Abyss');
  });

  it('buys from a route\'s own shop type', () => {
    const bar = { regions: ['Brimhaven'], merchants: ['Bars & Inns'] };
    expect(questRequirementOptionMet(bar, unlocked({ regions: ['Brimhaven'] }), 'vanilla')).toBe(false);
    expect(questRequirementOptionMet(bar, unlocked({ regions: ['Brimhaven'], merchants: ['Bars & Inns'] }), 'vanilla')).toBe(true);
    expect(questRequirementOptionLabel(bar)).toBe('Brimhaven + Bars & Inns');
  });

  it('accepts any one of a route\'s places', () => {
    const bats = { regions: ['Shilo Village'], anyOfRegions: ['Catherby', 'Yanille'] };
    expect(questRequirementOptionMet(bats, unlocked({ regions: ['Shilo Village'] }), 'vanilla')).toBe(false);
    expect(questRequirementOptionMet(bats, unlocked({ regions: ['Shilo Village', 'Yanille'] }), 'vanilla')).toBe(true);
    expect(questRequirementOptionLabel(bats)).toBe('Shilo Village + any of Catherby, Yanille');
  });

  it('blocks a quest whose every route misses one of these', () => {
    const rum = quest({ oneOf: [{ merchants: ['Wine Traders'] }, { regions: ['Brimhaven'], merchants: ['Bars & Inns'] }] });
    const locked = evaluateQuestEligibility(rum, unlocked({ merchants: ['Bars & Inns'] }), 'vanilla');
    expect(locked.status).toBe('LOCKED_REGION');
    expect(locked.blockers).toEqual([{ kind: 'region', label: 'Wine Traders or Brimhaven + Bars & Inns' }]);
    expect(evaluateQuestEligibility(rum, unlocked({ merchants: ['Bars & Inns'], regions: ['Brimhaven'] }), 'vanilla').eligible)
      .toBe(true);
  });
});
