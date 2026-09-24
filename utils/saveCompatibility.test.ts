import { describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { getGameMode, resolveModeRules } from '../config/gameModes';
import { getRivalImage } from '../data/wikiRivalIcons';
import { TableType } from '../types';
import { validateAndMigrateSave } from './saveSchema';

describe('saved identifiers that collide with Object.prototype', () => {
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'resolves an imported %s mode id to Vanilla rules instead of crashing',
    modeId => {
      const state = createFreshState();
      state.gameModeId = modeId;
      const result = validateAndMigrateSave(state, createFreshState());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(getGameMode(result.state.gameModeId).id).toBe('vanilla');
      expect(resolveModeRules(result.state.gameModeId).startArea).toBeUndefined();
      expect(resolveModeRules(result.state.gameModeId).pityThreshold).toBe(50);
    },
  );

  it('keeps rival artwork on a known persona for an unknown persona id', () => {
    expect(getRivalImage('sim', 'constructor')).toBe('Rune_full_helm.png');
  });
});

describe('retired unlocks in older saves', () => {
  it('loads a save that was mid-way through revealing a paid Aquarium unlock', () => {
    const state = createFreshState();
    state.keys = 2;
    state.pendingUnlock = { id: 'reveal-aquarium', table: TableType.POH, item: 'Aquarium', costType: 'key', cost: 1 };

    const result = validateAndMigrateSave(state, createFreshState());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingUnlock).toEqual(state.pendingUnlock);
  });

  it('still rejects a pending reveal for an item outside the table', () => {
    const state = createFreshState();
    state.pendingUnlock = { id: 'reveal-bogus', table: TableType.POH, item: 'Not a housing unlock', costType: 'key', cost: 1 };

    expect(validateAndMigrateSave(state, createFreshState())).toMatchObject({ ok: false });
  });
});
