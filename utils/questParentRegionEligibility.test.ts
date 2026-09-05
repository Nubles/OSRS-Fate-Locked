import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MISTHALIN_AREAS, REGION_GROUPS } from '../constants';
import { QUEST_DATA } from '../data/questData';
import type { UnlockState } from '../types';
import { setStartArea } from './freeAreas';
import { evaluateQuestEligibility } from './journalStatus';

const unlocked = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [],
  arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
  guilds: [], farming: [], slayerUnlocks: [], banks: [], quests: [], diaries: [],
  cas: [], completedTasks: [], collectionLog: {},
  ...overrides,
});

const parentRegions = new Set(['Misthalin', ...Object.keys(REGION_GROUPS)]);

describe('quest parent-region eligibility', () => {
  beforeEach(() => setStartArea('none'));
  afterEach(() => setStartArea(undefined));

  it('contains no machine-enforced parent-region gate in the entire catalogue', () => {
    const offenders = Object.values(QUEST_DATA).flatMap(quest => {
      const baseRegions = quest.accessPolicy === 'locations' ? [] : quest.regions;
      const alternativeRegions = quest.oneOf?.flatMap(option => option.regions ?? []) ?? [];
      const parents = [...baseRegions, ...alternativeRegions]
        .filter(region => parentRegions.has(region));
      return parents.length ? [`${quest.id}: ${parents.join(', ')}`] : [];
    });

    expect(MISTHALIN_AREAS.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it.each([
    ['Clock Tower', {}],
    ['Hazeel Cult', {}],
    ['Sheep Herder', {}],
    ['Tower of Life', { skills: { Construction: 1 }, levels: { Construction: 10 } }],
  ])('allows %s with East Ardougne instead of all Kandarin', (questId, extras) => {
    const quest = QUEST_DATA[questId];
    expect(quest.regions).toEqual(['East Ardougne']);

    const result = evaluateQuestEligibility(quest, unlocked({
      regions: ['East Ardougne'],
      ...extras,
    }), 'vanilla');

    expect(result.status).toBe('NEEDS_CONFIRMATION');
    expect(result.machineEligible).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});
