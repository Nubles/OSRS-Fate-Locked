import sources from '../../data/sources/quest-operational-items.json';
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../../data/questData';
import { questProvidedItem } from '../../data/questProvidedItems';
import { sourcedQuestItemPredicates } from '../../data/questOperationalSources';
import { evaluatePredicate } from '../../utils/requirementPredicates';
import { buildQuestAccess } from './questAccess';
import type { UnlockState } from '../../types';
const state = (chunks: string[] = []): UnlockState => ({ equipment: {}, skills: {}, levels: {}, regions: [], chunks, mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {} });
describe('reviewed quest-provided acquisition', () => {
  it('pins supplying-step reviews to the checked source revisions', () => {
    for (const [questId, index] of [['Rune Mysteries', 0], ['Vampyre Slayer', 2]] as const) {
      const entry = sources.entries[questId];
      const review = questProvidedItem(questId, index, entry.checks[index].label);
      expect(review?.revisionId).toBe(entry.source.revisionId);
    }
  });
  it('establishes the talisman route without inventing an equipment or method action, while retaining destination checks', () => {
    const quest = QUEST_DATA['Rune Mysteries'];
    expect(buildQuestAccess(quest, state(), 'chunked').items[0].status).toBe('READY');
    const result = buildQuestAccess(quest, state(['50,50']), 'chunked');
    expect(result.items[0].status).toBe('READY');
    expect(result.items[0].questSupplier).toContain('Duke Horacio');
    expect(result.operations.some(item => item.id === 'quest-operations:Rune Mysteries')).toBe(false);
    expect(result.operations.some(item => item.id === 'quest-source-items:Rune Mysteries:0')).toBe(false);
    expect(result.eligibility.eligible).toBe(false);
    expect(buildQuestAccess(quest, state(['50,50', '48,49', '50,53']), 'chunked').eligibility.eligible).toBe(true);
  });
  it('preserves the beer condition for the guaranteed stake', () => {
    const predicate = sourcedQuestItemPredicates('Vampyre Slayer')[2];
    const context = { unlocks: state(['48,51','50,53']), gameModeId: 'chunked' };
    expect(evaluatePredicate(predicate, context).status).toBe('NEEDS_CONFIRMATION');
    expect(evaluatePredicate(predicate, { ...context, confirmations: { 'quest-source-items:Vampyre Slayer:1': true } }).status).toBe('READY');
    expect(evaluatePredicate(predicate, { ...context, unlocks: state(['48,51']) }).status).toBe('LOCKED');
  });
  it('does not promote vague availability notes or mismatched source labels', () => {
    expect(questProvidedItem('Rune Mysteries', 0, 'Air talisman')).toBeNull();
    expect(evaluatePredicate(sourcedQuestItemPredicates("Cook's Assistant")[0], { unlocks: state(), itemSources: { ready: false, itemSourceRecords: () => [] } }).status).toBe('UNKNOWN');
    expect(sourcedQuestItemPredicates('Goblin Diplomacy')[0].kind).toBe('manual');
  });
});

