import { describe, expect, it } from 'vitest';
import { QUEST_ACTION_REVIEWS, reviewedQuestActionRequirements } from './questActionRequirements';
import { QUEST_DATA } from './questData';
import { questOperationalRequirements } from './questOperationalRequirements';
import { sourcedQuestItemPredicates } from './questOperationalSources';

describe('reviewed compulsory quest actions', () => {
  it.each(Object.keys(QUEST_ACTION_REVIEWS))('%s retains every supply check without a blanket action attestation', id => {
    const requirements = questOperationalRequirements(QUEST_DATA[id]);
    expect(requirements).toEqual(sourcedQuestItemPredicates(id));
    expect(requirements.some(p => p.kind === 'manual' && p.key === `quest-operations:${id}`)).toBe(false);
  });

  it('does not infer player methods from NPC services, item hand-ins or experience rewards', () => {
    for (const id of ["Cook's Assistant", "Doric's Quest", 'Romeo & Juliet', 'Sheep Shearer']) {
      expect(reviewedQuestActionRequirements(id)).toEqual([]);
    }
    // These contracts assume legal supplies, not permission to mine ore or spin wool.
    expect(sourcedQuestItemPredicates("Doric's Quest").length).toBeGreaterThan(0);
    expect(sourcedQuestItemPredicates('Sheep Shearer').length).toBeGreaterThan(0);
  });

  it('does not require the reward amulet slot or rune mining to perform dialogue-only steps', () => {
    expect(reviewedQuestActionRequirements('Imp Catcher')).toEqual([]);
    expect(reviewedQuestActionRequirements('Rune Mysteries')).toEqual([]);
  });

  it('keeps unreviewed action contracts pending and existing explicit equipment gates intact', () => {
    expect(reviewedQuestActionRequirements('Demon Slayer')).toBeUndefined();
    expect(questOperationalRequirements(QUEST_DATA['Demon Slayer'])).toContainEqual({ kind: 'equipment', slot: 'Weapon', tier: 1 });
    expect(questOperationalRequirements(QUEST_DATA['Demon Slayer'])).toContainEqual(expect.objectContaining({ kind: 'manual', key: 'quest-operations:Demon Slayer' }));
  });

  it('does not let an imported quest inherit a reviewed absence of action gates', () => {
    const imported = { ...QUEST_DATA['Rune Mysteries'], id: 'Unclassified imported quest' };
    expect(reviewedQuestActionRequirements(imported.id)).toBeUndefined();
    expect(questOperationalRequirements(imported)).toEqual([expect.objectContaining({ kind: 'unknown' })]);
  });
});
