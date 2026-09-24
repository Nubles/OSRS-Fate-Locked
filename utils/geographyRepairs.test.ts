import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../types';
import { REGIONS_LIST, SKILLS_LIST } from '../data/items';
import { AREA_ALIAS_POLICIES, AREA_REFERENCES } from '../data/areaMapPolicy';
import { QUEST_DATA } from '../data/questData';
import { ALL_CHUNK_KEYS, chunkKey } from './chunkAdjacency';
import { isAreaReachable } from './reachability';
import { chunkUnlocked, placeOf } from './chunkLocations';
import { evaluateQuestEligibility } from './journalStatus';

const account = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: Object.fromEntries(SKILLS_LIST.map(s => [s, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(s => [s, 99])),
  regions: [], chunks: [], mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {}, ...over,
});

describe('reviewed geography and physical ownership', () => {
  it('every rollable area is reachable with every land chunk owned', () => {
    const full = account({ chunks: [...ALL_CHUNK_KEYS] });
    expect(REGIONS_LIST.filter(name => !isAreaReachable(name, full, 'chunked'))).toEqual([]);
  });

  it.each(Object.keys(AREA_REFERENCES))('%s uses a specific reviewed entrance, not a completed-quest shortcut', name => {
    const chunks = AREA_REFERENCES[name as keyof typeof AREA_REFERENCES].chunks;
    expect(isAreaReachable(name, account(), 'chunked')).toBe(false);
    for (const chunk of chunks) {
      expect(isAreaReachable(name, account({ chunks: [chunkKey(chunk)] }), 'chunked')).toBe(true);
    }
  });

  it.each(["The Knight's Sword", 'Lost City', 'Between a Rock...', 'The Giant Dwarf',
    'Forgettable Tale...', 'Rum Deal', 'Ratcatchers', 'Fairytale I - Growing Pains', 'RFD: Sir Amik Varze'])
  ('%s no longer has an impossible area blocker with all land owned', id => {
    const result = evaluateQuestEligibility(QUEST_DATA[id], account({
      chunks: [...ALL_CHUNK_KEYS], quests: Object.keys(QUEST_DATA).filter(other => other !== id),
    }), 'chunked');
    expect(result.blockers.filter(blocker => blocker.kind === 'region')).toEqual([]);
  });

  it('every surface alias is physically owned by its canonical paid area', () => {
    for (const [name, policy] of Object.entries(AREA_ALIAS_POLICIES)) {
      if (policy.kind !== 'surface-overlap') continue;
      for (const c of policy.chunks) {
        expect(placeOf(c.cx, c.cy).subArea, name).toBe(policy.canonical);
        expect(chunkUnlocked(c.cx, c.cy, account({ regions: [policy.canonical] })), name).toBe(true);
        expect(isAreaReachable(policy.canonical, account({ chunks: [chunkKey(c)] }), 'chunked'), name).toBe(true);
      }
    }
  });

  it('Aldarin owns its existing central alchemical and winery facilities', () => {
    expect(placeOf(21, 45).subArea).toBe('Aldarin');
    expect(chunkUnlocked(21, 45, account({ regions: ['Aldarin'] }))).toBe(true);
    expect(chunkUnlocked(21, 45, account())).toBe(false);
  });

  it('Family Crest needs a mine entrance and the separate Chronozon visit', () => {
    const quest = QUEST_DATA['Family Crest'];
    const routeWithoutMine = ['51,53', '42,51', '44,53', '48,54', '51,50', '51,51', '51,54'];
    expect(evaluateQuestEligibility(quest, account({ chunks: routeWithoutMine }), 'chunked').eligible).toBe(false);
    for (const mine of ['47,52', '47,53']) {
      const chunks = [...routeWithoutMine, mine];
      expect(evaluateQuestEligibility(quest, account({ chunks }), 'chunked').eligible).toBe(true);
      expect(evaluateQuestEligibility(quest, account({ chunks: chunks.filter(c => c !== '48,54') }), 'chunked').eligible).toBe(false);
    }
  });
});
