import { describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { QUEST_DATA } from '../data/questData';
import { EQUIPMENT_SLOTS, GUILDS_LIST, MERCHANTS_LIST, MOBILITY_LIST, POH_LIST, SKILLS_LIST } from '../data/items';
import { evaluateQuestEligibility } from './journalStatus';
import type { UnlockState } from '../types';

// A "Started X" gate is quest progress: completing X proves it, so the
// journal must stop asking for it once X is done (data/questProgress.ts).
const all = Object.values(QUEST_DATA);
const regions = [...new Set(all.flatMap(quest => [
  ...quest.regions,
  ...(quest.locations ?? []).flatMap(location => location.standardAreas),
  ...(quest.oneOf ?? []).flatMap(option => [
    ...(option.regions ?? []),
    ...(option.anyOfRegions ?? []),
    ...(option.locations ?? []).flatMap(location => location.standardAreas),
  ]),
]))];
const everythingBut = (...excluded: string[]): UnlockState => ({
  ...createFreshState().unlocks,
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 9])),
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions,
  merchants: [...MERCHANTS_LIST],
  guilds: [...GUILDS_LIST],
  mobility: [...MOBILITY_LIST],
  poh: [...POH_LIST],
  quests: all.map(quest => quest.id).filter(id => !excluded.includes(id)),
} as UnlockState);

const STARTED_GATES: Array<[string, string[], string[]]> = [
  ['Creature of Fenkenstrain', ['The Restless Ghost'], ['Started The Restless Ghost']],
  ["Hopespear's Will", ['The Restless Ghost'], ['Started The Restless Ghost']],
  ['Curse of the Empty Lord', ['Desert Treasure I', 'The Restless Ghost'], ['Started Desert Treasure I', 'Started The Restless Ghost']],
  ['Ratcatchers', ['The Giant Dwarf'], ['Started The Giant Dwarf to access Keldagrim']],
  ['Dragon Slayer II', ['Barbarian Training'], ['Started the pyre ship portion of Barbarian Training']],
];

describe('started-quest gates', () => {
  it.each(STARTED_GATES)('%s is ready once its started quest is complete', (id, _started, _labels) => {
    const result = evaluateQuestEligibility(QUEST_DATA[id], everythingBut(id), 'vanilla');
    expect(result.blockers).toEqual([]);
    expect(result.manualChecks).toEqual([]);
    expect(result.eligible).toBe(true);
  });

  it.each(STARTED_GATES)('%s still asks for the started quest while it is not complete', (id, started, labels) => {
    const result = evaluateQuestEligibility(QUEST_DATA[id], everythingBut(id, ...started), 'vanilla');
    expect(result.manualChecks).toEqual(labels);
    expect(result.eligible).toBe(false);
  });

  it('keeps no tracked quest in a "Started" manual requirement', () => {
    const offenders = all.flatMap(quest => (quest.manualRequirements ?? [])
      .filter(label => /^Started\b/.test(label) && all.some(other => label.includes(other.id)))
      .map(label => quest.id + ': ' + label));
    expect(offenders).toEqual([]);
  });
});
