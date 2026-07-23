import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import diarySource from '../data/sources/achievement-diary-tasks.json';
import legacyDiaryIds from '../data/sources/achievement-diary-legacy-ids.json';
import {
  DIARY_TASK_ID_MIGRATIONS, migrateCompletedTaskIds,
} from './taskIdMigrations';

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
  it('does not resolve unknown ids through Object.prototype', () => {
    expect(migrateCompletedTaskIds([
      'toString',
      'constructor',
      'toString',
      'retired_x',
    ], {})).toEqual(['toString', 'constructor', 'retired_x']);
  });

  it('contains only source-supported aliases to current generated ids', () => {
    const currentIds = new Set(ALL_DIARY_TASKS.map(task => task.id));
    const expected = diarySource.tasks.flatMap(task =>
      task.aliases.map(alias => [alias, task.id] as const));
    const actual = Object.entries(DIARY_TASK_ID_MIGRATIONS);

    expect(actual.sort()).toEqual(expected.sort());
    expect(actual.filter(([, target]) => !currentIds.has(target))).toEqual([]);
    expect(actual.filter(([source]) => currentIds.has(source))).toEqual([]);
  });

  it('classifies the frozen historical id set as preserved, aliased, or retired', () => {
    const classified = [
      ...diarySource.tasks
        .filter(task => task.classification === 'preserved-exact'
          || task.classification === 'preserved-semantic')
        .map(task => task.id),
      ...diarySource.tasks
        .filter(task => task.classification === 'renamed-or-replaced')
        .flatMap(task => task.aliases),
      ...diarySource.retired.map(task => task.id),
    ];

    expect(classified).toHaveLength(legacyDiaryIds.source.rowCount);
    expect(new Set(classified).size).toBe(legacyDiaryIds.source.rowCount);
    expect([...classified].sort()).toEqual([...legacyDiaryIds.ids].sort());
  });
});
