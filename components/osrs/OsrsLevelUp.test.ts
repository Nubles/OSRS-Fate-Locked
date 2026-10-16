import { describe, expect, it } from 'vitest';
import { TableType, type LogEntry, type UnlockState } from '../../types';
import { levelUpMessage, unlockCostType } from './OsrsLevelUp';

const unlocks = { skills: { Woodcutting: 5 }, equipment: { Legs: 3 } } as unknown as UnlockState;

describe('OSRS level-up message', () => {
  it('names the new skill tier, its level cap and its gem', () => {
    const m = levelUpMessage({ id: '1', table: TableType.SKILLS, item: 'Woodcutting' }, unlocks);
    expect(m.line1).toBe('Congratulations, you’ve unlocked a new Woodcutting tier.');
    expect(m.line2).toBe('Woodcutting is now Tier V: methods up to level 50.');
    expect(m.icon.src).toMatch(/osrs-ui\/skills\/woodcutting\.png$/);
    expect(m.gem?.src).toMatch(/gems\/emerald\.png$/);
  });

  it('names an equipment tier and an area', () => {
    expect(levelUpMessage({ id: '2', table: TableType.EQUIPMENT, item: 'Legs' }, unlocks).line2).toBe('Legs is now Tier III.');
    const area = levelUpMessage({ id: '3', table: TableType.REGIONS, item: 'Fossil Island', costType: 'chaosKey' }, unlocks);
    expect(area.line1).toBe('Congratulations, you’ve unlocked a new area.');
    expect(area.line2).toBe('Fossil Island is now part of your world.');
    expect(area.icon.src).toMatch(/chaos_key\.png$/);
    expect(area.gem).toBeUndefined();
  });

  it('reads how the newest unlock of an item was paid for', () => {
    const history = [
      { id: 'a', timestamp: 1, type: 'UNLOCK', message: 'Unlocked Legs', meta: { item: 'Legs', costType: 'key' } },
      { id: 'b', timestamp: 2, type: 'UNLOCK', message: 'Unlocked Legs', meta: { item: 'Legs', costType: 'specialKey' } },
    ] as LogEntry[];
    expect(unlockCostType(history, 'Legs')).toBe('specialKey');
    expect(unlockCostType(history, 'Head')).toBeUndefined();
  });
});
