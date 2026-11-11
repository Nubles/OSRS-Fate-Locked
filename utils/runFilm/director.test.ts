import { describe, expect, it } from 'vitest';
import { CAPTION, directFilm, FULL_VIEW, SHOT, shotFor } from './director';
import { filmFramePlan, type FilmStep, type FilmTimeline } from './timeline';

const step = (added: string[], moments: FilmStep['moments'] = []): FilmStep => ({
  day: 1, unlocks: 0, rolls: 0, keysWon: 0, added, ticker: [], skills: {}, gear: {}, raised: [],
  levels: {}, totalLevel: 0, mapShare: 0, moments,
});
const timelineOf = (steps: FilmStep[]): FilmTimeline => ({
  start: [], opening: step([]), steps, days: 1, hasLevels: false, offMap: [],
  summary: { fromDay: 1, toDay: 1, wholeRun: true, unlocks: 0, rolls: 0, keysWon: 0, mapShare: 0, totalLevel: 0, luckiest: null, longestDry: 0 },
});

describe('shotFor', () => {
  it('frames a small patch of land with room round it, inside the map', () => {
    const view = shotFor(['50,50', '51,50'])!;
    expect(view.w).toBe(14);
    expect(view.h).toBeCloseTo(14 * 34 / 48);
    // Lumbridge (50,50) is column 35, row 15 of the map.
    expect(view.x).toBeLessThanOrEqual(35);
    expect(view.x + view.w).toBeGreaterThanOrEqual(37);
    expect(view.y).toBeLessThanOrEqual(15);
    expect(view.y + view.h).toBeGreaterThanOrEqual(16);
  });

  it('keeps a shot in the corner of the map inside the map', () => {
    const view = shotFor(['15,65'])!;
    expect(view).toMatchObject({ x: 0, y: 0 });
  });

  it('skips land too spread out to be worth a zoom, and land off the map', () => {
    expect(shotFor(['16,50', '60,50'])).toBeNull();
    expect(shotFor(['5,5'])).toBeNull();
  });
});

describe('directFilm', () => {
  it('eases in on new land, holds, eases back out, and spaces shots apart', () => {
    const steps = Array.from({ length: 200 }, (_, i) => step(i % 10 === 0 ? ['50,50'] : []));
    const plan = filmFramePlan(steps.length, 200, 12, 48);
    const cut = directFilm(timelineOf(steps), { camera: true, captions: false, total: plan.total, stepAt: plan.stepAt });
    expect(cut.camera(0)).toEqual(FULL_VIEW);
    // Step 0 shows from frame 12; its shot starts SHOT.lead frames before and is in close after easing in.
    const held = cut.camera(12 - SHOT.lead + SHOT.easeIn + 1);
    expect(held.w).toBe(14);
    const shotLen = SHOT.easeIn + SHOT.hold + SHOT.easeOut;
    expect(cut.camera(12 - SHOT.lead + shotLen)).toEqual(FULL_VIEW);
    // Land every 10 frames, but shots are spaced: the next one waits for the gap.
    let shots = 0;
    for (let i = 1; i < plan.total; i += 1) if (cut.camera(i).w < 48 && cut.camera(i - 1).w === 48) shots += 1;
    expect(shots).toBeGreaterThan(1);
    expect(shots).toBeLessThanOrEqual(Math.ceil(plan.total / (shotLen + SHOT.gap)));
  });

  it('stays on the whole map with the camera off', () => {
    const steps = [step(['50,50']), step([])];
    const plan = filmFramePlan(2, 40, 12, 48);
    const cut = directFilm(timelineOf(steps), { camera: false, captions: false, total: plan.total, stepAt: plan.stepAt });
    for (let i = 0; i < plan.total; i += 1) expect(cut.camera(i)).toEqual(FULL_VIEW);
  });

  it('shows a step’s biggest moment, queues close ones and drops late ones', () => {
    const m = (title: string) => ({ kind: 'unlocks' as const, title, text: '' });
    const steps = Array.from({ length: 300 }, () => step([]));
    steps[0] = step([], [{ kind: 'map', title: '10% of the map', text: 'is open' }, m('50 unlocks')]);
    steps[40] = step([], [m('100 unlocks')]); // 20 frames late: queued just after the first card
    steps[45] = step([], [m('150 unlocks')]); // would wait too long: dropped
    steps[200] = step([], [m('200 unlocks')]);
    const plan = filmFramePlan(steps.length, 300, 12, 48);
    const cut = directFilm(timelineOf(steps), { camera: false, captions: true, total: plan.total, stepAt: plan.stepAt });
    expect(cut.caption(11)).toBeNull();
    expect(cut.caption(12)?.moment.title).toBe('10% of the map');
    expect(cut.caption(12 + CAPTION.length)?.moment.title).toBe('100 unlocks');
    const titles = new Set<string>();
    for (let i = 0; i < plan.total; i += 1) { const c = cut.caption(i); if (c) titles.add(c.moment.title); }
    expect([...titles]).toEqual(['10% of the map', '100 unlocks', '200 unlocks']);
  });
});
