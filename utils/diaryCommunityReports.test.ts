import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { TableType, type UnlockState, type GameState } from '../types';
import { diaryTaskCompletionDecision } from './journalCompletion';
import { countDoableTasks, evaluateDiaryTaskEligibility, getDiaryStatus } from './journalStatus';
import { planForTarget } from './goalPlanner';
import { buildGoalRoute } from './goalRoute';
import { diaryUnmet } from './journalProgress';

const account = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
  housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
  farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...overrides,
});
const task = (id: string) => ALL_DIARY_TASKS.find(row => row.id === id)!;

describe('community diary reports in Vanilla', () => {
  it('requires the Agility unlock even when the rooftop course starts at level 1', () => {
    const lap = task('lum_easy_1');
    const locked = account({ levels: { Agility: 99 } });
    expect(evaluateDiaryTaskEligibility(lap, locked, 'vanilla').blockers)
      .toContainEqual(expect.objectContaining({ kind: 'skill', label: 'Agility 1' }));
    expect(countDoableTasks([lap], locked, 'vanilla')).toBe(0);
    expect(diaryTaskCompletionDecision(lap, locked, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
    const ready = account({ skills: { Agility: 1 }, levels: { Agility: 1 } });
    expect(evaluateDiaryTaskEligibility(lap, ready, 'vanilla').eligible).toBe(true);
    expect(diaryTaskCompletionDecision(lap, ready, 'vanilla').ok).toBe(true);
  });

  it('requires Clothes Shops specifically to browse Thessalia, across diary surfaces', () => {
    const browse = task('var_easy_1');
    const locked = account({
      merchants: ['General Stores'],
      completedTasks: ALL_DIARY_TASKS.filter(row => row.tierId === 'Varrock Easy' && row.id !== browse.id).map(row => row.id),
    });
    expect(evaluateDiaryTaskEligibility(browse, locked, 'vanilla').blockers)
      .toContainEqual({ kind: 'merchant', label: 'Clothes Shops' });
    expect(countDoableTasks([browse], locked, 'vanilla')).toBe(0);
    expect(diaryTaskCompletionDecision(browse, locked, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
    expect(getDiaryStatus(DIARY_DATA['Varrock Easy'], locked, 'vanilla')).toBe('LOCKED_MERCHANT');
    expect(diaryUnmet(DIARY_DATA['Varrock Easy'], locked, 'vanilla'))
      .toContainEqual({ kind: 'merchant', label: 'Clothes Shops' });
    expect(planForTarget('diary', 'Varrock Easy', locked, 'vanilla')?.steps)
      .toContainEqual(expect.objectContaining({ kind: 'merchant', id: 'Clothes Shops', unlockTable: TableType.MERCHANTS }));
    const route = buildGoalRoute('Varrock Easy', { unlocks: locked, gameModeId: 'vanilla' } as GameState)!;
    expect(route.merchants).toContainEqual(expect.objectContaining({ name: 'Clothes Shops', met: false }));
    expect(route.tables).toContainEqual(expect.objectContaining({ table: TableType.MERCHANTS, needed: ['Clothes Shops'] }));
    const ready = { ...locked, merchants: ['Clothes Shops'] };
    expect(evaluateDiaryTaskEligibility(browse, ready, 'vanilla').eligible).toBe(true);
    expect(getDiaryStatus(DIARY_DATA['Varrock Easy'], ready, 'vanilla')).toBe('AVAILABLE');
    expect(diaryTaskCompletionDecision(browse, ready, 'vanilla').ok).toBe(true);
  });

  it('uses the Port Piscarilius entrance for the Warrens shop', () => {
    const row = task('kou_easy_5');
    expect(row.regions).toEqual(['Piscarilius']);
    const wrongArea = account({ regions: ['Kourend Castle'], merchants: ['General Stores'] });
    expect(evaluateDiaryTaskEligibility(row, wrongArea, 'vanilla').blockers)
      .toContainEqual({ kind: 'region', label: 'Piscarilius' });
    expect(evaluateDiaryTaskEligibility(row, { ...wrongArea, regions: ['Piscarilius'] }, 'vanilla').eligible).toBe(true);
  });

  it.each([
    ['fal_easy_3', 'Farming Shops'], ['frem_easy_5', 'Stonemasons'],
    ['kou_easy_5', 'General Stores'], ['kan_easy_2', 'Candle Shops'],
    ['kan_easy_9', 'Bars & Inns'],
  ])('requires the matching shop category for %s', (id, category) => {
    const row = task(id);
    const unlocked = account({ regions: row.regions, quests: row.questProgress?.map(progress => progress.quest) ?? [] });
    expect(evaluateDiaryTaskEligibility(row, unlocked, 'vanilla').blockers)
      .toContainEqual({ kind: 'merchant', label: category });
    expect(evaluateDiaryTaskEligibility(row, { ...unlocked, merchants: [category] }, 'vanilla').eligible).toBe(true);
  });
});
