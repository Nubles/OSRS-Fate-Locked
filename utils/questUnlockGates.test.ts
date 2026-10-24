import { describe, expect, it } from 'vitest';
import {
  ARCANA_LIST, EQUIPMENT_SLOTS, GUILDS_LIST, MERCHANTS_LIST, MINIGAMES_LIST, MISTHALIN_AREAS, MOBILITY_LIST, REGIONS_LIST, SKILLS_LIST,
} from '../data/items';
import { QUEST_DATA, type QuestData } from '../data/questData';
import { questRequirementFingerprint } from '../data/questRequirementAudit';
import { DropSource, UnlockState } from '../types';
import { planForTarget } from './goalPlanner';
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

/** A run that owns everything, and has done every quest but `id`. */
const everything = (id: string, over: Partial<UnlockState> = {}): UnlockState => unlocked({
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 10])),
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: [...REGIONS_LIST, ...MISTHALIN_AREAS], mobility: [...MOBILITY_LIST], arcana: [...ARCANA_LIST],
  merchants: [...MERCHANTS_LIST], minigames: [...MINIGAMES_LIST], guilds: [...GUILDS_LIST],
  quests: Object.keys(QUEST_DATA).filter(quest => quest !== id),
  ...over,
});
const without = (list: readonly string[], ...names: string[]) => list.filter(name => !names.includes(name));

describe("the quests' shop-only items, bar drinks and fairy rings", () => {
  // Owner decisions of 2 Oct 2026: a quest item only a shop sells (Q1) and a
  // barkeeper's drink (Q5) need that merchant category; a quest that must use
  // a fairy ring needs the Fairy Rings unlock (Q4), as Diary tasks do.
  it.each([
    ['Prince Ali Rescue', ['Clothes Shops', 'Bars & Inns']],
    ['Rag and Bone Man I', ['Wine Traders']],
    ['Rag and Bone Man II', ['Wine Traders', 'Slayer Equipment']],
    ["Icthlarin's Little Helper", ['Clothes Shops']],
    ['The Feud', ['General Stores']],
    ["Daddy's Home", ['Sawmill Operators']],
    ['Garden of Tranquillity', ['Farming Shops']],
    ["Shades of Mort'ton", ['General Stores', 'Real Estate Agents']],
    ['RFD: King Awowogei', ['Food Shops']],
    ['Making Friends with My Arm', ['Sawmill Operators']],
    ["Alfred Grimhand's Barcrawl", ['Bars & Inns']],
  ])('%s needs %j', (id, merchants) => {
    const quest = QUEST_DATA[id];
    expect(quest.merchants).toEqual(merchants);
    expect(evaluateQuestEligibility(quest, everything(id), 'vanilla').machineEligible).toBe(true);
    for (const merchant of merchants) {
      const locked = evaluateQuestEligibility(quest, everything(id, { merchants: without(MERCHANTS_LIST, merchant) }), 'vanilla');
      expect(locked.status).toBe('LOCKED_MERCHANT');
      expect(locked.blockers).toEqual([{ kind: 'merchant', label: merchant }]);
    }
  });

  it.each([
    ["Pirate's Treasure", 'Wine Traders or Brimhaven + Bars & Inns', [
      [{ merchants: without(MERCHANTS_LIST, 'Bars & Inns') }, true],
      [{ merchants: without(MERCHANTS_LIST, 'Wine Traders') }, true],
      [{ merchants: without(MERCHANTS_LIST, 'Wine Traders'), regions: without(REGIONS_LIST, 'Brimhaven') }, false],
      [{ merchants: without(MERCHANTS_LIST, 'Wine Traders', 'Bars & Inns') }, false],
    ]],
    ['Tai Bwo Wannai Trio', 'Wine Traders or Bars & Inns', [
      [{ merchants: without(MERCHANTS_LIST, 'Bars & Inns') }, true],
      [{ merchants: without(MERCHANTS_LIST, 'Wine Traders') }, true],
      [{ merchants: without(MERCHANTS_LIST, 'Wine Traders', 'Bars & Inns') }, false],
    ]],
    ['The Tourist Trap', 'General Stores or Sophanem + Clothes Shops', [
      [{ merchants: without(MERCHANTS_LIST, 'Clothes Shops') }, true],
      [{ merchants: without(MERCHANTS_LIST, 'General Stores') }, true],
      [{ merchants: without(MERCHANTS_LIST, 'General Stores'), regions: without(REGIONS_LIST, 'Sophanem') }, false],
    ]],
  ] as const)('%s buys its item at %s', (id, label, cases) => {
    const quest = QUEST_DATA[id];
    expect(quest.oneOf!.map(questRequirementOptionLabel).join(' or ')).toBe(label);
    for (const [over, ready] of cases) {
      const result = evaluateQuestEligibility(quest, everything(id, over as Partial<UnlockState>), 'vanilla');
      expect(result.machineEligible, JSON.stringify(over).slice(0, 80)).toBe(ready);
      if (!ready) expect(result.blockers).toEqual([{ kind: 'region', label }]);
    }
  });

  it.each(["Hopespear's Will", 'Fairytale II - Cure a Queen'])('%s travels by fairy ring', id => {
    const quest = QUEST_DATA[id];
    expect(quest.mobility).toEqual(['Fairy Rings']);
    expect(evaluateQuestEligibility(quest, everything(id), 'vanilla').machineEligible).toBe(true);
    const locked = evaluateQuestEligibility(quest, everything(id, { mobility: without(MOBILITY_LIST, 'Fairy Rings') }), 'vanilla');
    expect(locked.status).toBe('LOCKED_MOBILITY');
    expect(locked.blockers).toEqual([{ kind: 'mobility', label: 'Fairy Rings' }]);
  });

  it('plans the unlocks the goal planner can roll for', () => {
    const shops = planForTarget('quest', 'Prince Ali Rescue', everything('Prince Ali Rescue', {
      merchants: without(MERCHANTS_LIST, 'Clothes Shops', 'Bars & Inns'),
    }), 'vanilla')!;
    expect(shops.merchantSteps.map(step => step.id)).toEqual(['Bars & Inns', 'Clothes Shops']);
    const rings = planForTarget('quest', "Hopespear's Will", everything("Hopespear's Will", {
      mobility: without(MOBILITY_LIST, 'Fairy Rings'),
    }), 'vanilla')!;
    expect(rings.mobilitySteps.map(step => step.id)).toEqual(['Fairy Rings']);
    // Inside a quest chain: Hopespear's Will needs Fairytale II first, which needs the rings too.
    const chain = planForTarget('quest', "Hopespear's Will", everything("Hopespear's Will", {
      mobility: without(MOBILITY_LIST, 'Fairy Rings'),
      quests: without(Object.keys(QUEST_DATA), "Hopespear's Will", 'Fairytale II - Cure a Queen'),
    }), 'vanilla')!;
    expect(chain.questSteps.map(step => step.id)).toEqual(['Fairytale II - Cure a Queen', "Hopespear's Will"]);
    expect(chain.mobilitySteps.map(step => step.id)).toEqual(['Fairy Rings']);
  });
});

describe("What Lies Below's ways to the Chaos Altar", () => {
  const quest = QUEST_DATA['What Lies Below'];
  const run = (over: Partial<UnlockState> = {}) => unlocked({
    quests: ['Rune Mysteries'], skills: { Runecraft: 4 }, levels: { Runecraft: 35 }, ...over,
  });

  it('needs one of the ways the wiki lists, not Mining 42 alone', () => {
    expect(evaluateQuestEligibility(quest, run(), 'vanilla').blockers).toEqual([{
      kind: 'region', label: 'Mining 42 or Chaos Temple ruins or Edgeville ditch + Enter the Abyss',
    }]);
    expect(evaluateQuestEligibility(quest, run({ skills: { Runecraft: 4, Mining: 5 }, levels: { Runecraft: 35, Mining: 42 } }), 'vanilla').eligible)
      .toBe(true);
    expect(evaluateQuestEligibility(quest, run({ regions: ["Dark Warriors' Fortress"] }), 'vanilla').eligible).toBe(true);
    expect(evaluateQuestEligibility(quest, run({ quests: ['Rune Mysteries', 'Enter the Abyss'] }), 'vanilla').eligible).toBe(true);
  });

  it('plans each way, the Abyss with its quest', () => {
    const plan = planForTarget('quest', 'What Lies Below', run(), 'vanilla')!;
    expect(plan.alternativeSteps.map(step => step.routes.map(route => route.blockers.map(blocker => blocker.id)))).toEqual([
      [['Mining'], ["Dark Warriors' Fortress"], ['Enter the Abyss']],
    ]);
  });
});
