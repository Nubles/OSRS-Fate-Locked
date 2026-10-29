import { describe, expect, it } from 'vitest';
import { gameReducerForTest, initialState } from './GameContext';
import { TableType } from '../types';

type S = Parameters<typeof gameReducerForTest>[0];
const base = (over: Partial<S> = {}): S => ({ ...structuredClone(initialState), lastEvent: null, ...over });

describe('hope list in the reducer', () => {
  it('stars and unstars, keeps the newest 50 and drops the list when empty', () => {
    let s = gameReducerForTest(base(), { type: 'TOGGLE_HOPE', payload: 'Bosses|Vorkath' });
    expect(s.hopes).toEqual(['Bosses|Vorkath']);
    s = gameReducerForTest(s, { type: 'TOGGLE_HOPE', payload: 'Bosses|Vorkath' });
    expect(s.hopes).toBeUndefined();
    let many = base();
    for (let i = 0; i < 55; i++) many = gameReducerForTest(many, { type: 'TOGGLE_HOPE', payload: `Bosses|B${i}` });
    expect(many.hopes).toHaveLength(50);
    expect(many.hopes![0]).toBe('Bosses|B5');
  });

  it('takes a hope off the list once it lands', () => {
    const pendingUnlock = { id: 'p1', table: TableType.BOSSES, item: 'Vorkath', costType: 'key' as const, cost: 1 };
    const s = gameReducerForTest(base({ pendingUnlock, hopes: ['Bosses|Vorkath', 'Bosses|Zulrah'] }), { type: 'ACKNOWLEDGE_UNLOCK', payload: 'p1' });
    expect(s.hopes).toEqual(['Bosses|Zulrah']);
    expect(s.pendingUnlock).toBeUndefined();
    const last = gameReducerForTest(base({ pendingUnlock, hopes: ['Bosses|Vorkath'] }), { type: 'ACKNOWLEDGE_UNLOCK', payload: 'p1' });
    expect(last.hopes).toBeUndefined();
  });
});

describe('kill baseline in the reducer', () => {
  it('records a reading only for the linked name', () => {
    const linked = base({ linkedAccount: 'Whim' });
    const s = gameReducerForTest(linked, { type: 'RECORD_SYNC_SCORES', payload: { account: 'whim', scores: { vorkath: 10 } } });
    expect(s.syncScores).toMatchObject({ account: 'Whim', scores: { vorkath: 10 } });
    expect(typeof s.syncScores!.takenAt).toBe('number');
    expect(gameReducerForTest(linked, { type: 'RECORD_SYNC_SCORES', payload: { account: 'Other', scores: { vorkath: 1 } } }).syncScores).toBeUndefined();
    expect(gameReducerForTest(base(), { type: 'RECORD_SYNC_SCORES', payload: { account: 'Whim', scores: { vorkath: 1 } } }).syncScores).toBeUndefined();
  });
});
