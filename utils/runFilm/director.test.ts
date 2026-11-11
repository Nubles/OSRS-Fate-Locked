import { describe, expect, it } from 'vitest';
import { CAPTION, directFilm } from './director';
import { filmFramePlan, type FilmStep, type FilmTimeline } from './timeline';

const step = (added: string[], moments: FilmStep['moments'] = []): FilmStep => ({
  day: 1, unlocks: 0, rolls: 0, keysWon: 0, added, ticker: [], skills: {}, gear: {}, raised: [],
  levels: {}, totalLevel: 0, mapShare: 0, moments,
});
const timelineOf = (steps: FilmStep[]): FilmTimeline => ({
  start: [], opening: step([]), steps, days: 1, hasLevels: false, offMap: [],
  summary: { fromDay: 1, toDay: 1, wholeRun: true, unlocks: 0, rolls: 0, keysWon: 0, mapShare: 0, totalLevel: 0, luckiest: null, longestDry: 0 },
});

describe('directFilm', () => {
  it('shows a step’s biggest moment, queues close ones and drops late ones', () => {
    const m = (title: string) => ({ kind: 'unlocks' as const, title, text: '' });
    const steps = Array.from({ length: 300 }, () => step([]));
    steps[0] = step([], [{ kind: 'map', title: '10% of the map', text: 'is open' }, m('50 unlocks')]);
    steps[40] = step([], [m('100 unlocks')]); // 20 frames late: queued just after the first card
    steps[45] = step([], [m('150 unlocks')]); // would wait too long: dropped
    steps[200] = step([], [m('200 unlocks')]);
    const plan = filmFramePlan(steps.length, 300, 12, 48);
    const cut = directFilm(timelineOf(steps), { captions: true, total: plan.total, stepAt: plan.stepAt });
    expect(cut.caption(11)).toBeNull();
    expect(cut.caption(12)?.moment.title).toBe('10% of the map');
    expect(cut.caption(12 + CAPTION.length)?.moment.title).toBe('100 unlocks');
    const titles = new Set<string>();
    for (let i = 0; i < plan.total; i += 1) { const c = cut.caption(i); if (c) titles.add(c.moment.title); }
    expect([...titles]).toEqual(['10% of the map', '100 unlocks', '200 unlocks']);
  });

  it('shows no cards with captions off', () => {
    const steps = [step([], [{ kind: 'boss', title: 'First boss', text: 'Obor' }])];
    const plan = filmFramePlan(1, 40, 12, 48);
    const cut = directFilm(timelineOf(steps), { captions: false, total: plan.total, stepAt: plan.stepAt });
    for (let i = 0; i < plan.total; i += 1) expect(cut.caption(i)).toBeNull();
  });
});
