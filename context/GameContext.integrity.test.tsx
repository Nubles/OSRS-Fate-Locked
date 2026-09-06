// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { initialState, gameReducerForTest, prepareDetectedEventAcceptanceAction, prepareKeyRollAction } from './GameContext';
import { auditHistory, hashEntry, replayInvariants, verifyChain } from '../utils/integrity';
import { resolveModeRules } from '../config/gameModes';
import type { LogEntry } from '../types';

describe.each([1, 0.5])('recorded ritual effects at multiplier %s', multiplier => {
  it.each([
    { type: 'RITUAL_LUCK' as const },
    { type: 'RITUAL_GREED' as const },
    { type: 'RITUAL_CHAOS' as const },
    { type: 'RITUAL_TRANSMUTE' as const },
    { type: 'RITUAL_GAMBIT' as const, payload: { won: true, stake: 40, keysWon: 2 } },
    { type: 'RITUAL_GAMBIT' as const, payload: { won: false, stake: 40, keysWon: 0 } },
    { type: 'RITUAL_CARTOGRAPHER' as const, payload: { chunkKey: '50,50', label: 'Test frontier' } },
  ])('replays actual reducer balances for $type', action => {
    let previous = 'GENESIS';
    const history: LogEntry[] = Array.from({ length: 40 }, (_, i) => {
      const entry: LogEntry = { id: String(i), timestamp: i, type: 'ROLL_FAIL', message: 'No Key.', meta: { fatePointsEarned: 1 } };
      const linked = { ...entry, prevHash: previous, hash: hashEntry(entry, previous) };
      previous = linked.hash;
      return linked;
    });
    const state = { ...initialState, keys: 10, fatePoints: 40, history, lastEvent: null, gameModeId: 'custom', customMode: { ...resolveModeRules('vanilla'), ritualCostMultiplier: multiplier } };
    const next = gameReducerForTest(state, action);
    const replay = replayInvariants(next.history, 10, resolveModeRules(next.gameModeId, next.customMode));
    expect(verifyChain(next.history).ok).toBe(true);
    expect(replay.uncertainAt).toEqual([]);
    expect(replay.violations).toEqual([]);
    expect(replay.final.keys).toBe(next.keys);
    expect(replay.final.specialKeys).toBe(next.specialKeys);
    expect(replay.final.chaosKeys).toBe(next.chaosKeys);
    expect(replay.final.fatePoints).toBe(next.fatePoints);
  });
});


describe('replacement history preserves imported evidence', () => {
  it.each([0, 1, 3])('does not hash a legacy import against a previous history of length %s', previousLength => {
    const legacy: LogEntry = { id: 'imported', timestamp: 1, type: 'ROLL_FAIL', message: 'No Key.' };
    const state = { ...initialState, history: Array.from({ length: previousLength }, (_, i) => ({ ...legacy, id: String(i) })), lastEvent: null };
    const imported = { ...initialState, history: [legacy], runRevision: 7 };
    const next = gameReducerForTest(state, { type: 'LOAD_SAVE', payload: imported });
    expect(next.history).toBe(imported.history);
    expect(next.history[0].hash).toBeUndefined();
    expect(next.runRevision).toBe(7);
    expect(auditHistory(next.history).verdict).toBe('warning');
  });
  it('preserves a mixed imported chain rather than filling in absent links', () => {
    const legacy: LogEntry = { id: 'mixed', timestamp: 1, type: 'ROLL_FAIL', message: 'No Key.' };
    const imported = { ...initialState, history: [{ ...legacy, prevHash: 'GENESIS', hash: hashEntry(legacy, 'GENESIS') }, { ...legacy, id: 'missing' }] };
    const next = gameReducerForTest({ ...initialState, lastEvent: null }, { type: 'LOAD_SAVE', payload: imported });
    expect(next.history).toBe(imported.history);
    expect(auditHistory(next.history).verdict).toBe('tampered');
  });
});


describe('consistent detected and manual progression', () => {
 it.each([['chunked',25],['xtreme',50]] as const)('grants and records starter keys once in %s', (mode, interval) => {
  const levels=Object.fromEntries(Object.keys(initialState.unlocks.levels).map(k=>[k,1]));
  const target=interval-(Object.keys(levels).length-1); levels.Attack=target-1;
  const state={...structuredClone(initialState),gameModeId:mode,runId:'test',runRevision:1,linkedAccount:'Tester',history:[],lastEvent:null,unlocks:{...structuredClone(initialState.unlocks),levels,regions:[],chunks:[]}};
  const manual=gameReducerForTest(state,{type:'LEVEL_UP',payload:{skill:'Attack',chaosRoll:1}});
  const prepare=(s: typeof state | ReturnType<typeof gameReducerForTest>)=>prepareDetectedEventAcceptanceAction(s,{kind:'SKILL_LEVEL',skill:'Attack',level:target},{source:'Attack Level '+target,target:'Attack',threshold:1,failureFate:1},(_p,_i,max=100)=>max,{fateEventId:'x',detectorId:'skill-level-v1',detectorVersion:1},{runId:s.runId,runRevision:s.runRevision,account:'Tester'});
  const detected=gameReducerForTest(state,prepare(state));
  expect(detected.keys).toBe(manual.keys); expect(detected.keys).toBe(state.keys+1);
  expect(replayInvariants(detected.history).final.keys).toBe(detected.keys);
  expect(verifyChain(detected.history).ok).toBe(true);
  expect(gameReducerForTest(detected,prepare(detected))).toBe(detected);
  expect(gameReducerForTest(manual,prepare(manual))).toBe(manual);
 });
 it('resolves Pity using the Greed refund and records the full award',()=>{
  let state: ReturnType<typeof gameReducerForTest> = {...structuredClone(initialState),gameModeId:'custom',customMode:{...resolveModeRules('vanilla'),pityThreshold:10,ritualCostMultiplier:0.25},fatePoints:0,lastEvent:null};
  for (let i = 0; i < 9; i++) state = gameReducerForTest(state, prepareKeyRollAction(state,'Training',1,1,(_p,_i,max=100)=>max));
  const buffed=gameReducerForTest(state,{type:'RITUAL_GREED'});
  const next=gameReducerForTest(buffed,prepareKeyRollAction(buffed,'Quest (Grandmaster)',1,3,(_p,_i,max=100)=>max));
  expect(next.fatePoints).toBe(0); expect(next.keys).toBe(state.keys+1);
  expect(next.history.at(-1)).toMatchObject({type:'PITY',meta:{fatePointsEarned:5,pityThreshold:10}});
  const replay = replayInvariants(next.history, 3, next.customMode);
  expect(replay.violations).toEqual([]); expect(replay.final.fatePoints).toBe(next.fatePoints); expect(replay.final.keys).toBe(next.keys);
  expect(verifyChain(next.history).ok).toBe(true);
 });
});
