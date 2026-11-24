/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../utils/achievements';
import { fateDue, rewardLabel, smallFate } from '../utils/achievementRewards';
import { AchievementReveal } from './AchievementReveal';

const byId = (id: string) => {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`no achievement ${id}`);
  return a;
};

let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  host.id = 'reveal-top';
  document.body.appendChild(host);
});
afterEach(() => {
  cleanup();
  host.remove();
});

const shown = (ids: string[], runId: string) => {
  render(<AchievementReveal data={ids.map(byId)} onDismiss={() => {}} onView={() => {}} gameModeId="vanilla" runId={runId} />);
  return host.textContent ?? '';
};

describe('AchievementReveal', () => {
  it("shows the Fate this run pays for an achievement with no set Fate, not the 1 to 5 range", () => {
    const first = byId('quests-1');
    expect(first.fate).toBe(0);
    for (const runId of ['run-a', 'run-b', 'run-c']) {
      cleanup();
      const text = shown(['quests-1'], runId);
      expect(text).toContain(`+${smallFate(runId, 'quests-1')} Fate`);
      expect(text).not.toContain('1 to 5 Fate');
    }
  });

  it('shows the same reward line as the Achievements window', () => {
    const ids = ['quests-1', 'skill-tiers-240'];
    const text = shown(ids, 'run-a');
    for (const id of ids) {
      const a = byId(id);
      expect(text).toContain(rewardLabel({ ...a, fate: fateDue(a, 'run-a') }, 'vanilla')!);
    }
    expect(text).toContain('+25 Fate');
    expect(text).toContain('a Chaos Key');
  });
});
