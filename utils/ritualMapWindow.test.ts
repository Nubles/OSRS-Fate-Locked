import { describe, expect, it } from 'vitest';
import { ritualMapWindow } from './ritualMapWindow';

describe('ritualMapWindow', () => {
  it('shows the chosen chunk left of centre with the trail starting at the nearest owned chunk', () => {
    const w = ritualMapWindow('48,51', ['49,50', '50,50', '49,51', '50,51', '48,51']);
    expect(w.cx0).toBe(47);
    expect(w.cyTop).toBe(52);
    expect(w.chosen).toEqual({ col: 1, row: 1 });
    expect(w.from).toEqual({ col: 2, row: 1 });
    expect(w.cells).toHaveLength(20);
    // The chosen chunk is never counted as owned land, even though the run now owns it.
    expect(w.cells.find(c => c.chosen)).toMatchObject({ key: '48,51', owned: false });
    expect(w.cells.filter(c => c.owned).map(c => c.key).sort()).toEqual(['49,50', '49,51', '50,50', '50,51']);
  });

  it('stays on the map image at its west and north edges', () => {
    const w = ritualMapWindow('15,65', []);
    expect(w.cx0).toBe(15);
    expect(w.cyTop).toBe(65);
    expect(w.chosen).toEqual({ col: 0, row: 0 });
    expect(w.from).toBeNull();
  });

  it('stays on the map image at its east and south edges', () => {
    const w = ritualMapWindow('62,32', ['61,32']);
    expect(w.cx0).toBe(58);
    expect(w.cyTop).toBe(35);
    expect(w.chosen).toEqual({ col: 4, row: 3 });
    expect(w.from).toEqual({ col: 3, row: 3 });
  });
});
