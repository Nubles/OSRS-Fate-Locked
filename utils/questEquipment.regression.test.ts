import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { EQUIPMENT_SLOTS } from '../data/items';
import type { UnlockState } from '../types';
import { evaluateQuestEligibility } from './journalStatus';
import { questCompletionDecision } from './journalCompletion';
import { reviewedTier } from './equipmentReviewTiers';

const fresh = (equipment: Record<string, number> = {}): UnlockState => ({
  equipment, skills: {}, levels: {}, regions: [], chunks: [], mobility: [],
  arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
  guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {},
});
const ghost = QUEST_DATA['The Restless Ghost'];

describe('mandatory quest equipment readiness', () => {
  it.each([undefined, 'chunked'])('blocks the ghost with a locked necklace slot in %s mode', mode => {
    // In Chunked mode the run owns the Wizards' Tower, where the skull is.
    const result = evaluateQuestEligibility(ghost, mode === 'chunked' ? { ...fresh(), chunks: ['48,49'] } : fresh(), mode);
    expect(result).toMatchObject({
      eligible: false, machineEligible: false, confirmable: false, status: 'LOCKED_EQUIPMENT',
    });
    expect(result.blockers).toContainEqual(expect.objectContaining({
      kind: 'equipment', slot: 'Neck', tier: 1,
      label: expect.stringMatching(/Neck.*T1.*[Gg]hostspeak amulet/),
    }));
  });

  it.each([0, -1, Number.NaN])('does not treat Neck %s as unlocked', tier => {
    expect(evaluateQuestEligibility(ghost, fresh({ Neck: tier })).eligible).toBe(false);
  });

  it.each([1, 2, 9])('accepts Neck tier %s without requiring a pre-owned quest-granted amulet', tier => {
    expect(evaluateQuestEligibility(ghost, fresh({ Neck: tier }))).toMatchObject({
      eligible: true, status: 'AVAILABLE', blockers: [],
    });
  });

  it('cannot bypass a locked slot by confirming manual requirements', () => {
    expect(questCompletionDecision(ghost, fresh(), undefined, { manualConfirmed: true }))
      .toMatchObject({ ok: false, reason: expect.stringMatching(/Neck.*T1/) });
    expect(questCompletionDecision(ghost, fresh({ Neck: 1 }))).toEqual({ ok: true });
  });

  it('preserves completed quests in legacy saves', () => {
    expect(evaluateQuestEligibility(ghost, { ...fresh(), quests: [ghost.id] }))
      .toMatchObject({ status: 'COMPLETED', blockers: [] });
  });

  it('does not invent equipment requirements for ordinary inventory items', () => {
    expect(evaluateQuestEligibility(QUEST_DATA["Cook's Assistant"], fresh()).eligible).toBe(true);
  });

  it('requires the actual higher gear tier for Silverlight rather than any Weapon unlock', () => {
    const quest = QUEST_DATA['Demon Slayer'];
    expect(quest.equipmentRequirements).toContainEqual(expect.objectContaining({ slot: 'Weapon', tier: 2 }));
    expect(evaluateQuestEligibility(quest, fresh({ Weapon: 1 })).blockers)
      .toContainEqual(expect.objectContaining({ kind: 'equipment', slot: 'Weapon', tier: 2 }));
    expect(evaluateQuestEligibility(quest, fresh({ Weapon: 2 })).eligible).toBe(true);
  });

  it('requires every mandatory disguise slot', () => {
    const quest = QUEST_DATA["Black Knights' Fortress"];
    // Keep unrelated Quest Points/geography fixed while checking the disguise.
    const base = { ...fresh(), regions: ['Edgeville', 'Falador'], merchants: ['Chainbody Shops'],
      quests: Object.keys(QUEST_DATA).filter(id => id !== quest.id) };
    expect(evaluateQuestEligibility(quest, { ...base, equipment: { Head: 1 } }).blockers)
      .toContainEqual(expect.objectContaining({ kind: 'equipment', slot: 'Body', tier: 1 }));
    expect(evaluateQuestEligibility(quest, { ...base, equipment: { Head: 1, Body: 1 } }).eligible).toBe(true);
  });

  it('does not require wearing items used from inventory or worn by another character', () => {
    expect(QUEST_DATA['Waterfall Quest'].equipmentRequirements).toBeUndefined();
    expect(QUEST_DATA['Prince Ali Rescue'].equipmentRequirements).toBeUndefined();
    expect(QUEST_DATA['Ghosts Ahoy'].equipmentRequirements?.some(req => req.slot === 'Gloves')).toBe(false);
  });

  // Rechecked on the Wiki after a player found A Soul's Bane's rage room needs
  // a main-hand weapon (23 October 2026).
  it.each([
    ["Heroes' Quest", { Gloves: 1 }],
    ['Sheep Herder', { Body: 1, Legs: 1, Weapon: 1 }],
    ['Underground Pass', { Gloves: 2 }],
    ['The Fremennik Isles', { Head: 1, Body: 1, Legs: 1, Boots: 1 }],
    ['A Taste of Hope', { Weapon: 5 }],
    ['Sins of the Father', { Weapon: 5, Body: 1, Legs: 1, Boots: 1 }],
    ['Spirits of the Elid', { Body: 1, Legs: 1 }],
    ['Troll Stronghold', { Boots: 1 }],
    ['Troubled Tortugans', { Cape: 1 }],
    ['The Curse of Arrav', { Boots: 1, Weapon: 1, Ammo: 3 }],
    ['Another Slice of H.A.M.', { Weapon: 2 }],
    ['Ratcatchers', { Neck: 1 }],
    ['Shilo Village', { Neck: 1 }],
    ['Creature of Fenkenstrain', { Neck: 1 }],
    ['Tale of the Righteous', { Weapon: 1 }],
    ['Troll Romance', { Weapon: 1 }],
    ['In Aid of the Myreque', { Weapon: 1 }],
    ['A Porcine of Interest', { Head: 1 }],
  ] as const)('needs the slots %s makes you wear or wield', (id, slots) => {
    const required = Object.fromEntries((QUEST_DATA[id].equipmentRequirements ?? []).map(req => [req.slot, req.tier]));
    expect(required).toEqual(slots);
    for (const [slot, tier] of Object.entries(slots)) {
      const short = { ...slots, [slot]: tier - 1 };
      expect(evaluateQuestEligibility(QUEST_DATA[id], fresh(short)).blockers, `${id} ${slot}`)
        .toContainEqual(expect.objectContaining({ kind: 'equipment', slot, tier }));
    }
  });

  it.each([
    ['Lost City', 'Dramen staff'],
    ['Holy Grail', 'Excalibur'],
    ['Demon Slayer', 'Silverlight'],
    ['A Taste of Hope', 'Ivandis flail'],
    ['Sins of the Father', 'Blisterwood flail'],
    ['Another Slice of H.A.M.', 'Ancient mace'],
  ])("asks %s for the Weapon tier of the %s it makes you wield", (id, item) => {
    const weapon = QUEST_DATA[id].equipmentRequirements?.find(req => req.slot === 'Weapon');
    expect(weapon?.tier).toBe(reviewedTier({ name: item, slot: 'Weapon' }));
  });

  it('keeps curated equipment requirements within actual Fate slots and tiers', () => {
    for (const quest of Object.values(QUEST_DATA)) {
      const slots = new Set<string>();
      for (const requirement of quest.equipmentRequirements ?? []) {
        expect(EQUIPMENT_SLOTS, quest.id).toContain(requirement.slot);
        expect(Number.isInteger(requirement.tier), quest.id).toBe(true);
        expect(requirement.tier, quest.id).toBeGreaterThanOrEqual(1);
        expect(requirement.tier, quest.id).toBeLessThanOrEqual(9);
        expect(requirement.reason.trim().length, quest.id).toBeGreaterThan(0);
        expect(slots.has(requirement.slot), quest.id).toBe(false);
        slots.add(requirement.slot);
      }
    }
  });
});
