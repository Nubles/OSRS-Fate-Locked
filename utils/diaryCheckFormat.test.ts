import { describe, expect, it } from 'vitest';
import { formatDiaryChecks } from './diaryCheckFormat';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';

const tier = (item: string) => `Have ${item} and confirm that the specific item is permitted by your equipment tier`;

describe('formatDiaryChecks', () => {
  it('folds equipment checks into one Wear line when the task wears them', () => {
    expect(formatDiaryChecks(
      [tier('Desert shirt'), tier('Desert robe'), tier('Desert boots')],
      'Enter the Desert with a set of Desert robes equipped.',
    )).toEqual(['Wear: Desert shirt, Desert robe, Desert boots (tier-checked)']);
  });

  it('says Have when the task does not wear the item', () => {
    expect(formatDiaryChecks([tier('Karamjan monkey greegree')], "Have a zookeeper put you in Ardougne Zoo's monkey cage."))
      .toEqual(['Have: Karamjan monkey greegree (tier-checked)']);
  });

  it('shortens quest progress to the quest name', () => {
    expect(formatDiaryChecks([
      "Reached the required progress in Icthlarin's Little Helper for: Sell some artefacts to Simon Templeton.",
    ])).toEqual(["Progress in Icthlarin's Little Helper"]);
  });

  it('keeps other checks, in order, and drops repeats', () => {
    expect(formatDiaryChecks([
      'Reached the required progress in Monkey Madness I for: Have a zookeeper put you in the cage.',
      tier('Karamjan monkey greegree'),
      'The equipped salve amulet was imbued at Nightmare Zone',
      tier('Karamjan monkey greegree'),
    ], 'Have a zookeeper put you in the cage.')).toEqual([
      'Progress in Monkey Madness I',
      'Have: Karamjan monkey greegree (tier-checked)',
      'confirm The equipped salve amulet was imbued at Nightmare Zone',
    ]);
  });

  it('is empty without checks', () => {
    expect(formatDiaryChecks([])).toEqual([]);
  });

  it('recognises every equipment and quest-progress check the diary data writes', () => {
    for (const task of ALL_DIARY_TASKS) {
      const reqs = [task, ...(task.oneOf ?? [])];
      const checks = reqs.flatMap(r => [
        ...((r as any).equipmentRequirements ?? []).map((e: any) => e.manualCheck).filter(Boolean),
        ...((r as any).questProgress ?? []).map((q: any) => q.label)
          .filter((label: string) => label.startsWith('Reached the required progress')),
      ]) as string[];
      for (const line of formatDiaryChecks(checks, task.description)) {
        expect(line.startsWith('confirm '), `${task.id}: ${line}`).toBe(false);
      }
    }
  });
});
