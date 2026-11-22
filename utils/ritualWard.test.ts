import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import { BANK_ACCESS_GATES } from '../data/bankAccess';
import { QUEST_DATA } from '../data/questData';
import { SKILLS_LIST } from '../data/items';
import { TableType, type UnlockState } from '../types';
import { bankChunkKey } from './activityAccess';
import { chunkSubArea } from './chunkAdjacency';
import { wardUsable } from './ritualWard';

// Everything but land: every skill and quest, so only the place and the gate decide.
const maxed = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  ...initialState.unlocks,
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  quests: Object.keys(QUEST_DATA),
  ...overrides,
});

describe("Saradomin's Ward only lands on what the run can use (audit engine-rolls 0)", () => {
  it('never lands on the Bank boat before the run can sail', () => {
    expect(wardUsable(TableType.BANKS, '8999', initialState.unlocks, 'vanilla')).toBe(false);
    expect(wardUsable(TableType.BANKS, '8999', { ...initialState.unlocks, quests: ['Pandemonium'] }, 'vanilla')).toBe(false);
    const sailing = { ...initialState.unlocks, skills: { ...initialState.unlocks.skills, Sailing: 1 }, quests: ['Pandemonium'] };
    expect(wardUsable(TableType.BANKS, '8999', sailing, 'vanilla')).toBe(true);
  });

  // A way in with nothing the tracker can check: the player confirms it by hand.
  const byHand = (option: (typeof BANK_ACCESS_GATES)[number]['accessOptions'][number]) =>
    !option.quests?.length && !option.diaries?.length && !option.skills?.length && !option.guilds?.length;
  const landOf = (id: string) => {
    const key = bankChunkKey(id)!;
    const area = chunkSubArea(key);
    return { regions: [...initialState.unlocks.regions, ...(area ? [area] : [])], chunks: [key] };
  };

  it("asks a gated bank's guild, quest or level, not only its land, in Vanilla and Chunked", () => {
    expect(BANK_ACCESS_GATES.length).toBeGreaterThan(10);
    const novice = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 1]));
    for (const { id, accessOptions } of BANK_ACCESS_GATES) {
      const land = landOf(id);
      const met = maxed({ ...land, guilds: accessOptions.flatMap(option => option.guilds ?? []) });
      expect(wardUsable(TableType.BANKS, id, met, 'vanilla'), `${id} Vanilla, gate met`).toBe(true);
      if (accessOptions.some(byHand)) continue;
      // No quest, guild or diary, and level 1 in the skills the gate names.
      const unmet = maxed({ ...land, quests: [], guilds: [], diaries: [], levels: novice });
      expect(wardUsable(TableType.BANKS, id, unmet, 'vanilla'), `${id} Vanilla, gate unmet`).toBe(false);
      expect(wardUsable(TableType.BANKS, id, unmet, 'chunked'), `${id} Chunked, gate unmet`).toBe(false);
    }
  });

  it('keeps a bank whose other way in is confirmed by hand, as it does for Peer the Seer', () => {
    // Partway through a quest is something the tracker cannot see, so the Ward does not rule these out.
    const partway = BANK_ACCESS_GATES.filter(gate => gate.accessOptions.some(byHand));
    expect(partway.map(gate => gate.id).sort()).toEqual(['11047', '12581', '12838', '7216', '8253', '8508', '9265']);
    for (const { id, accessOptions } of partway) {
      const gateQuests = accessOptions.flatMap(option => option.quests ?? []);
      // The Fortis Colosseum chest (7216) waits on Glory earned, which no quest stands for.
      if (id !== '7216') expect(gateQuests.length, `${id} names a quest`).toBeGreaterThan(0);
      const withoutQuest = maxed({ ...landOf(id), quests: Object.keys(QUEST_DATA).filter(quest => !gateQuests.includes(quest)) });
      expect(wardUsable(TableType.BANKS, id, withoutQuest, 'vanilla'), `${id} without ${gateQuests.join(', ')}`).toBe(true);
    }
  });

  it("asks a reviewed bank's own ways in before its gate", () => {
    const key = bankChunkKey('11578')!;
    const area = chunkSubArea(key);
    const land = { regions: [...initialState.unlocks.regions, ...(area ? [area] : [])], chunks: [key] };
    const noDoor = maxed({ ...land, quests: Object.keys(QUEST_DATA).filter(quest => quest !== 'The Frozen Door') });
    for (const mode of ['vanilla', 'chunked']) {
      expect(wardUsable(TableType.BANKS, '11578', noDoor, mode), `${mode} without The Frozen Door`).toBe(false);
      expect(wardUsable(TableType.BANKS, '11578', maxed(land), mode), `${mode} with The Frozen Door`).toBe(true);
    }
    // Peer the Seer has a way in to confirm by hand, so his deposit box stays usable without the diary.
    const peer = bankChunkKey('10553')!;
    const peerArea = chunkSubArea(peer);
    const peerLand = maxed({ regions: [...initialState.unlocks.regions, ...(peerArea ? [peerArea] : [])], chunks: [peer], diaries: [] });
    expect(wardUsable(TableType.BANKS, '10553', peerLand, 'vanilla')).toBe(true);
  });

  it('keeps the Guardians of the Rift bank for runs that have done Temple of the Eye', () => {
    const key = bankChunkKey('12337')!;
    const area = chunkSubArea(key);
    const land = { regions: [...initialState.unlocks.regions, ...(area ? [area] : [])], chunks: [key] };
    const noTemple = maxed({ ...land, quests: Object.keys(QUEST_DATA).filter(quest => quest !== 'Temple of the Eye') });
    for (const mode of ['vanilla', 'chunked']) {
      expect(wardUsable(TableType.BANKS, '12337', noTemple, mode), `${mode} without Temple of the Eye`).toBe(false);
      expect(wardUsable(TableType.BANKS, '12337', maxed(land), mode), `${mode} with Temple of the Eye`).toBe(true);
    }
  });

  it('asks the area a bank is named for in Vanilla, as the Activities tab does', () => {
    expect(wardUsable(TableType.BANKS, '12849', maxed(), 'vanilla')).toBe(false);
    const zanaris = maxed({ regions: [...initialState.unlocks.regions, 'Zanaris'] });
    expect(wardUsable(TableType.BANKS, '12849', zanaris, 'vanilla')).toBe(true);
  });

  it("asks a guild's own area in Vanilla, as the Activities tab does", () => {
    expect(wardUsable(TableType.GUILDS, 'Crafting Guild', maxed(), 'vanilla')).toBe(false);
    const withArea = maxed({ regions: [...initialState.unlocks.regions, 'Crafting Guild'] });
    expect(wardUsable(TableType.GUILDS, 'Crafting Guild', withArea, 'vanilla')).toBe(true);
  });
});
