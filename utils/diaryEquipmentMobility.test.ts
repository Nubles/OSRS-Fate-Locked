import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';
import { ARCANA_LIST, EQUIPMENT_SLOTS, MERCHANTS_LIST, MINIGAMES_LIST, MOBILITY_LIST, REGION_GROUPS, SKILLS_LIST } from '../data/items';
import { TableType, type GameState, type UnlockState } from '../types';
import { countDoableTasks, evaluateDiaryTaskEligibility, getDiaryStatus } from './journalStatus';
import { diaryTaskCompletionDecision } from './journalCompletion';
import { planForTarget } from './goalPlanner';
import { buildGoalRoute } from './goalRoute';
import { computeUnlockImpact } from './unlockImpact';

const account = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
  housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
  farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...overrides,
});
const task = (id: string) => ALL_DIARY_TASKS.find(row => row.id === id)!;
const exceptTask = (id: string) => ALL_DIARY_TASKS
  .filter(row => row.tierId === task(id).tierId && row.id !== id).map(row => row.id);
const skilledAccount = (overrides: Partial<UnlockState> = {}) => account({
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 9])),
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: [...Object.keys(REGION_GROUPS), ...Object.values(REGION_GROUPS).flat()],
  arcana: [...ARCANA_LIST], quests: Object.keys(QUEST_DATA), mobility: [...MOBILITY_LIST], merchants: [...MERCHANTS_LIST],
  minigames: [...MINIGAMES_LIST],
  ...overrides,
});

describe('diary equipment and mobility permissions in Vanilla', () => {
  it('blocks wearing a team cape until Cape T1, including completion and plans', () => {
    const row = task('wild_easy_8');
    const locked = account({ regions: ['Ferox Enclave'], completedTasks: exceptTask(row.id) });
    expect(evaluateDiaryTaskEligibility(row, locked, 'vanilla').eligible).toBe(false);
    expect(countDoableTasks([row], locked, 'vanilla')).toBe(0);
    expect(diaryTaskCompletionDecision(row, locked, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], locked, 'vanilla')).toBe('LOCKED_EQUIPMENT');
    expect(planForTarget('diary', row.tierId, locked, 'vanilla')?.equipmentSteps)
      .toContainEqual(expect.objectContaining({ id: 'Cape', requiredTier: 1, unlockTable: TableType.EQUIPMENT }));
    const readyForCheck = { ...locked, equipment: { Cape: 1 } };
    expect(evaluateDiaryTaskEligibility(row, readyForCheck, 'vanilla').confirmable).toBe(true);
    expect(diaryTaskCompletionDecision(row, readyForCheck, 'vanilla', { manualConfirmed: true }).ok).toBe(true);
  });

  it('requires every desert outfit slot, without requiring the shop that supplied it', () => {
    const row = task('des_easy_4');
    const locked = account({ regions: ['Al Kharid'], equipment: { Body: 1, Legs: 1 } });
    expect(evaluateDiaryTaskEligibility(row, locked, 'vanilla').blockers)
      .toContainEqual(expect.objectContaining({ kind: 'equipment', slot: 'Boots', tier: 1 }));
    expect(evaluateDiaryTaskEligibility(row, { ...locked, equipment: { ...locked.equipment, Boots: 1 } }, 'vanilla').confirmable).toBe(true);
  });

  it('does not mistake quest completion for the Fairy Rings unlock', () => {
    const row = task('ard_med_1');
    const locked = account({ regions: ['East Ardougne'], quests: ['Fairytale II - Cure a Queen'], equipment: { Weapon: 2 }, completedTasks: exceptTask(row.id) });
    expect(evaluateDiaryTaskEligibility(row, locked, 'vanilla').blockers)
      .toContainEqual({ kind: 'mobility', label: 'Fairy Rings' });
    expect(diaryTaskCompletionDecision(row, locked, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], locked, 'vanilla')).toBe('LOCKED_MOBILITY');
    const plan = planForTarget('diary', row.tierId, locked, 'vanilla')!;
    expect(plan.steps).toContainEqual(expect.objectContaining({ kind: 'mobility', id: 'Fairy Rings', unlockTable: TableType.MOBILITY }));
    const route = buildGoalRoute(row.tierId, { unlocks: locked, gameModeId: 'vanilla' } as GameState)!;
    expect(route.tables).toContainEqual(expect.objectContaining({ table: TableType.MOBILITY, needed: ['Fairy Rings'] }));
    expect(evaluateDiaryTaskEligibility(row, { ...locked, mobility: ['Fairy Rings'] }, 'vanilla').confirmable).toBe(true);
  });

  it('honours the Lumbridge Elite staff exemption but still requires Fairy Rings', () => {
    const u = skilledAccount({ equipment: {}, diaries: ['Lumbridge Elite'] });
    expect(evaluateDiaryTaskEligibility(task('ard_med_1'), u, 'vanilla').eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(task('ard_med_1'), { ...u, mobility: [] }, 'vanilla').blockers)
      .toContainEqual({ kind: 'mobility', label: 'Fairy Rings' });
  });

  it('keeps an unreviewed named item at a minimum slot gate plus confirmation', () => {
    const row = task('kan_hard_9');
    const u = skilledAccount({ equipment: { Body: 1 } });
    const result = evaluateDiaryTaskEligibility(row, u, 'vanilla');
    expect(result.machineEligible).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.manualChecks).toContainEqual(expect.stringContaining('Granite body'));
    expect(diaryTaskCompletionDecision(row, u, 'vanilla').ok).toBe(false);
    expect(diaryTaskCompletionDecision(row, u, 'vanilla', { manualConfirmed: true }).ok).toBe(true);
  });

  it.each(ALL_DIARY_TASKS.filter(row => row.equipmentRequirements?.length))(
    'enforces every mandatory equipment slot in $id even with completion attestation', row => {
      for (const requirement of row.equipmentRequirements!) {
        const u = skilledAccount();
        u.equipment[requirement.slot] = requirement.tier - 1;
        expect(evaluateDiaryTaskEligibility(row, u, 'vanilla').blockers)
          .toContainEqual(expect.objectContaining({ kind: 'equipment', slot: requirement.slot, tier: requirement.tier }));
        expect(diaryTaskCompletionDecision(row, u, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
      }
    },
  );

  it.each(ALL_DIARY_TASKS.filter(row => row.mobility?.length))(
    'enforces explicit transport in $id independently of destination and quests', row => {
      const u = skilledAccount({ mobility: [] });
      expect(evaluateDiaryTaskEligibility(row, u, 'vanilla').blockers)
        .toContainEqual({ kind: 'mobility', label: row.mobility![0] });
      expect(diaryTaskCompletionDecision(row, u, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
    },
  );

  it('keeps full Initiate, Proselyte, Barrows and Void sets at their reviewed tiers', () => {
    for (const [id, tier, slots] of [
      ['fal_med_9', 3, ['Head', 'Body', 'Legs']],
      ['fal_hard_9', 5, ['Head', 'Body', 'Legs']],
      ['mor_elite_6', 7, ['Head', 'Body', 'Legs', 'Weapon']],
      ['west_elite_5', 7, ['Head', 'Body', 'Legs', 'Gloves']],
    ] as const) {
      expect(task(id).equipmentRequirements?.map(r => [r.slot, r.tier])).toEqual(slots.map(slot => [slot, tier]));
      expect(evaluateDiaryTaskEligibility(task(id), skilledAccount(), 'vanilla').eligible).toBe(true);
    }
  });

  it('allows upgrading Iban staff without wielding it, after confirming supplies', () => {
    const result = evaluateDiaryTaskEligibility(task('ard_med_11'), skilledAccount({ equipment: {} }), 'vanilla');
    expect(result.confirmable).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.manualChecks).toContainEqual(expect.stringContaining('200,000 coins'));
  });

  it('does not claim a net catch is doable with Weapon locked, but allows bare hands at 52 Hunter', () => {
    const u = skilledAccount({ equipment: {}, skills: { Hunter: 6 }, levels: { Hunter: 42 } });
    expect(evaluateDiaryTaskEligibility(task('lum_med_11'), u, 'vanilla').machineEligible).toBe(false);
    expect(evaluateDiaryTaskEligibility(task('lum_med_11'), { ...u, levels: { Hunter: 52 } }, 'vanilla')).toMatchObject({
      machineEligible: true,
      manualChecks: ['Impling jar'],
    });
  });

  it('requires actual wearable Raiments slots for a lower-level route, preserving the no-outfit route', () => {
    const u = skilledAccount({ skills: { Runecraft: 10 }, levels: { Runecraft: 42 }, equipment: { Head: 1, Body: 1 } });
    expect(evaluateDiaryTaskEligibility(task('fal_hard_1'), u, 'vanilla').machineEligible).toBe(false);
    expect(evaluateDiaryTaskEligibility(task('fal_hard_1'), { ...u, equipment: { ...u.equipment, Legs: 1 } }, 'vanilla').confirmable).toBe(true);
    expect(evaluateDiaryTaskEligibility(task('fal_hard_1'), { ...u, equipment: {}, levels: { Runecraft: 56 } }, 'vanilla').eligible).toBe(true);
  });

  it.each(['des_easy_2', 'des_easy_10', 'frem_hard_2', 'kar_med_14', 'west_med_3', 'lum_hard_9', 'var_hard_5'])(
    'does not turn inventory-only tools into equipment locks for %s', id => {
      const row = task(id);
      expect(row.equipmentRequirements).toBeUndefined();
      expect(evaluateDiaryTaskEligibility(row, skilledAccount({ equipment: {} }), 'vanilla').blockers)
        .not.toContainEqual(expect.objectContaining({ kind: 'equipment' }));
    },
  );

  it('does not advertise a diary unlock while a specific item still needs confirmation', () => {
    const row = task('kan_hard_9');
    const before = skilledAccount({ equipment: { Body: 1 }, regions: [], completedTasks: exceptTask(row.id) });
    const after = { ...before, regions: ['Barbarian Outpost'] };
    const result = computeUnlockImpact(before, after, 'vanilla', { diaryIds: [row.tierId] });
    expect(result.directDiaryIds).not.toContain(row.tierId);
    expect(result.cascadeDiaryIds).not.toContain(row.tierId);
  });

  it('requires worn ghostspeak gear for Dragontooth and preserves owned reward-leg alternatives', () => {
    const row = task('mor_med_4');
    const u = skilledAccount({ equipment: {} });
    expect(diaryTaskCompletionDecision(row, u, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
    expect(evaluateDiaryTaskEligibility(row, { ...u, equipment: { Neck: 1 } }, 'vanilla').confirmable).toBe(true);
    const legRoute = evaluateDiaryTaskEligibility(row, { ...u, equipment: { Legs: 1 } }, 'vanilla');
    expect(legRoute.confirmable).toBe(true);
    expect(legRoute.eligible).toBe(false);
    expect(legRoute.manualChecks).toContainEqual(expect.stringContaining('Have Morytania legs 2'));
    expect(evaluateDiaryTaskEligibility(row, { ...u, diaries: ['Morytania Hard'] }, 'vanilla').machineEligible).toBe(false);
  });

  it.each([['lum_hard_7', 'Cooking Shops'], ['fal_elite_2', 'Platebody Shops']])(
    'requires the actual purchase shop for %s, without requiring permission to wear the purchase', (id, shop) => {
      const row = task(id);
      const u = skilledAccount({ merchants: [], equipment: {} });
      expect(evaluateDiaryTaskEligibility(row, u, 'vanilla').blockers).toContainEqual({ kind: 'merchant', label: shop });
      expect(diaryTaskCompletionDecision(row, u, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
      expect(evaluateDiaryTaskEligibility(row, { ...u, merchants: [shop] }, 'vanilla').machineEligible).toBe(true);
    },
  );

  it.each(ALL_DIARY_TASKS.filter(row => row.arcana?.length))(
    'requires the actual Arcana permission for $id despite sufficient Magic and completed quests', row => {
      const u = skilledAccount({ arcana: [], completedTasks: exceptTask(row.id) });
      expect(evaluateDiaryTaskEligibility(row, u, 'vanilla').blockers).toContainEqual({ kind: 'arcana', label: row.arcana![0] });
      expect(diaryTaskCompletionDecision(row, u, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
      expect(getDiaryStatus(DIARY_DATA[row.tierId], u, 'vanilla')).toBe('LOCKED_ARCANA');
      expect(planForTarget('diary', row.tierId, u, 'vanilla')?.arcanaSteps)
        .toContainEqual(expect.objectContaining({ id: row.arcana![0], unlockTable: TableType.ARCANA }));
      expect(buildGoalRoute(row.tierId, { unlocks: u, gameModeId: 'vanilla' } as GameState)?.tables)
        .toContainEqual(expect.objectContaining({ table: TableType.ARCANA, needed: [row.arcana![0]] }));
      expect(evaluateDiaryTaskEligibility(row, { ...u, arcana: [row.arcana![0]] }, 'vanilla').machineEligible).toBe(true);
    },
  );
});
