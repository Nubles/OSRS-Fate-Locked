import { describe, expect, it } from 'vitest';
import { gameReducer, initialState, prepareGameTransition, prepareKeyRollAction } from './GameContext';
import { DropSource } from '../types';
import { DROP_RATES } from '../config/rules';
import { validateAndMigrateSave } from '../utils/saveSchema';

const base = () => ({ ...initialState, gameModeId: 'vanilla', runId: 'test-run', runRevision: 0, lastEvent: null });
// Every die lands on the given 0-1 point of its range.
const diceAt = (at: number) => (_purpose: string, _index = 0, max = 100) => Math.max(1, Math.round(max * at));

describe('Vanilla Slayer fatigue', () => {
  it('lowers a tired run’s Slayer chance and notes it in the log', () => {
    const tired = { ...base(), slayerFatigue: 20 };
    const action = prepareKeyRollAction(tired, DropSource.SLAYER_KRYSTILIA, DROP_RATES[DropSource.SLAYER_KRYSTILIA], 2, diceAt(0.5));
    expect(action.payload.baseThreshold).toBe(65);
    expect(action.payload.threshold).toBe(45);
    expect(action.payload.success).toBe(false);
    const after = prepareGameTransition(tired, action).state;
    expect(after.history.at(-1)?.details).toContain('Slayer fatigue −20%.');
  });

  it('a Slayer Key tires Slayer, and other rolls rest it', () => {
    const won = prepareGameTransition(base(), prepareKeyRollAction(base(), DropSource.SLAYER_DURADEL, 70, 2, diceAt(0.1))).state;
    expect(won.slayerFatigue).toBe(10);
    const quest = prepareGameTransition(won, prepareKeyRollAction(won, DropSource.QUEST_NOVICE, 25, 1, diceAt(0.9))).state;
    expect(quest.slayerFatigue).toBe(5);
    const rested = prepareGameTransition(quest, prepareKeyRollAction(quest, DropSource.QUEST_NOVICE, 25, 1, diceAt(0.9))).state;
    expect(rested.slayerFatigue).toBeUndefined();
  });

  it('does not touch Chunked runs', () => {
    const chunked = { ...base(), gameModeId: 'chunked', slayerFatigue: 20 };
    const action = prepareKeyRollAction(chunked, DropSource.SLAYER_KRYSTILIA, 65, 2, diceAt(0.5));
    expect(action.payload.threshold).toBe(65);
    expect(gameReducer(chunked, action).slayerFatigue).toBeUndefined();
  });

  it('survives a save round trip and rejects out-of-range values', () => {
    const saved = JSON.stringify({ ...initialState, slayerFatigue: 30 });
    const loaded = validateAndMigrateSave(JSON.parse(saved), initialState);
    expect(loaded.ok && loaded.state.slayerFatigue).toBe(30);
    const bad = validateAndMigrateSave(JSON.parse(JSON.stringify({ ...initialState, slayerFatigue: 99 })), initialState);
    expect(bad.ok).toBe(false);
  });
});
