import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  renderCombatAchievementTasks,
  validateCombatAchievementSnapshot,
} from './sync-combat-achievements.mjs';

const loadSnapshot = () => JSON.parse(readFileSync(
  new URL('../data/sources/combat-achievement-tasks.json', import.meta.url),
  'utf8',
));

describe('Combat Achievement offline generator', () => {
  it('pins official source revisions and the exact current tier distribution', () => {
    const snapshot = loadSnapshot();
    const validated = validateCombatAchievementSnapshot(snapshot);

    expect(snapshot.source.url).toBe(
      'https://oldschool.runescape.wiki/w/Combat_Achievements',
    );
    expect(snapshot.source.revision).toBe(15272408);
    expect(snapshot.verifiedAt).toBe('2026-07-23');
    expect(snapshot.source.retrievedAt).toMatch(/^2026-07-23T/);
    expect(snapshot.source.authoritativeGlobals.thresholds).toEqual([
      41, 161, 419, 1075, 1945, 2671,
    ]);
    expect(snapshot.source.discrepancy).toMatch(/overview.*637.*live.*646/i);
    expect(validated.counts).toEqual({
      Easy: 41,
      Medium: 60,
      Hard: 86,
      Elite: 164,
      Master: 174,
      Grandmaster: 121,
    });
    expect(validated.tasks).toHaveLength(646);
  });

  it('renders byte-identically from the same committed snapshot', () => {
    const snapshot = loadSnapshot();

    expect(renderCombatAchievementTasks(structuredClone(snapshot)))
      .toBe(renderCombatAchievementTasks(snapshot));
  });

  it('rejects duplicate ids and count drift before rendering', () => {
    const duplicate = loadSnapshot();
    duplicate.tasks[1].id = duplicate.tasks[0].id;
    expect(() => renderCombatAchievementTasks(duplicate)).toThrow(/duplicate/i);

    const short = loadSnapshot();
    short.tasks.pop();
    expect(() => renderCombatAchievementTasks(short)).toThrow(/count|646/i);
  });
});
