import { describe, expect, it } from 'vitest';
import { migrateCompletedTaskIds } from './taskIdMigrations';

describe('Diary task id migrations', () => {
  it('migrates aliases once and preserves unknown historical ids', () => {
    const aliases = { old_a: 'current_a' };
    expect(migrateCompletedTaskIds(
      ['old_a', 'old_a', 'current_b', 'retired_x'],
      aliases,
    )).toEqual(['current_a', 'current_b', 'retired_x']);
    expect(migrateCompletedTaskIds(
      migrateCompletedTaskIds(['old_a'], aliases),
      aliases,
    )).toEqual(['current_a']);
  });
});
