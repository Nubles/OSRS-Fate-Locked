import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountTitle, readGroupIronTitle, saveGroupIronTitle } from './accountTitle';

// An in-memory store: Node's own localStorage isn't usable in every environment the tests run in.
const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('accountTitle', () => {
  it('names each type Wise Old Man reports, with its in-game badge', () => {
    expect(accountTitle('ultimate', null)).toEqual({ label: 'Ultimate Ironman', badge: 'Ultimate_ironman_chat_badge.png', tone: 'ultimate' });
    expect(accountTitle('hardcore', null)).toEqual({ label: 'Hardcore Ironman', badge: 'Hardcore_ironman_chat_badge.png', tone: 'hardcore' });
    expect(accountTitle('ironman', null)).toEqual({ label: 'Ironman', badge: 'Ironman_chat_badge.png', tone: 'ironman' });
    expect(accountTitle('regular', null)).toEqual({ label: 'Regular', badge: null, tone: 'regular' });
    expect(accountTitle('unknown', null)).toEqual({ label: 'Unknown', badge: null, tone: 'regular' });
    expect(accountTitle('something-new', null).label).toBe('Unknown');
  });

  it("gives a group iron the title they chose, where Wise Old Man says regular", () => {
    expect(accountTitle('regular', 'group')).toEqual({ label: 'Group Ironman', badge: 'Group_ironman_chat_badge.png', tone: 'group' });
    expect(accountTitle('regular', 'hardcore-group'))
      .toEqual({ label: 'Hardcore Group Ironman', badge: 'Hardcore_group_ironman_chat_badge.png', tone: 'hardcore' });
    expect(accountTitle('regular', 'unranked-group'))
      .toEqual({ label: 'Unranked Group Ironman', badge: 'Unranked_group_ironman_chat_badge.png', tone: 'unranked' });
  });

  it('never lets a chosen title override what the hiscores know', () => {
    expect(accountTitle('ironman', 'group').label).toBe('Ironman');
    expect(accountTitle('ultimate', 'hardcore-group').label).toBe('Ultimate Ironman');
  });
});

describe('the remembered group title', () => {
  it('is kept per character, however the name is typed', () => {
    saveGroupIronTitle('Group Example', 'hardcore-group');
    expect(readGroupIronTitle('  group   example ')).toBe('hardcore-group');
    expect(readGroupIronTitle('Someone Else')).toBeNull();
    saveGroupIronTitle('GROUP EXAMPLE', null);
    expect(readGroupIronTitle('Group Example')).toBeNull();
  });

  it('ignores anything that is not a group title', () => {
    localStorage.setItem('fate_group_iron_title:group example', 'ultimate');
    expect(readGroupIronTitle('Group Example')).toBeNull();
  });

  it('shrugs off storage that fails', () => {
    const fail = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: fail, setItem: fail, removeItem: fail });
    expect(() => saveGroupIronTitle('Group Example', 'group')).not.toThrow();
    expect(() => saveGroupIronTitle('Group Example', null)).not.toThrow();
    expect(readGroupIronTitle('Group Example')).toBeNull();
  });
});
