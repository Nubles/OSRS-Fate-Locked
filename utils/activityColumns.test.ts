import { describe, expect, it } from 'vitest';
import { ACTIVITY_NAME_MIN_PX, activityNameColumns } from './activityColumns';

describe('activityNameColumns', () => {
  it('keeps the drawn-for number on a computer', () => {
    // The list's measured width in the OSRS layout on 1024px, 1180px and 1366px wide windows.
    for (const width of [406, 562, 654]) expect(activityNameColumns(width, 3)).toBe(3);
    // The Banks table (125 names) is drawn for four.
    expect(activityNameColumns(654, 4)).toBe(4);
    expect(activityNameColumns(562, 4)).toBe(4);
    // More room never adds a column.
    expect(activityNameColumns(2000, 3)).toBe(3);
    expect(activityNameColumns(2000, 4)).toBe(4);
  });

  it('shows fewer on a narrow window, where the columns cut every name short', () => {
    // 768px wide (a tablet held upright): the list is 158px. Three columns were 45px each.
    expect(activityNameColumns(158, 3)).toBe(1);
    expect(activityNameColumns(158, 4)).toBe(1);
    // 900px wide: 282px.
    expect(activityNameColumns(282, 3)).toBe(2);
    // 1024px wide: four columns of the Banks table were 94px each and cut 56 of 125 names.
    expect(activityNameColumns(406, 4)).toBe(3);
  });

  it('never gives a column less than the minimum while one still fits', () => {
    for (const preferred of [3, 4]) {
      for (let width = ACTIVITY_NAME_MIN_PX; width <= 900; width++) {
        expect(width / activityNameColumns(width, preferred)).toBeGreaterThanOrEqual(ACTIVITY_NAME_MIN_PX);
      }
    }
  });

  it('never drops below one', () => {
    expect(activityNameColumns(110, 3)).toBe(1);
    expect(activityNameColumns(1, 4)).toBe(1);
  });

  it('stays at the drawn-for number before the list has been measured', () => {
    expect(activityNameColumns(0, 3)).toBe(3);
    expect(activityNameColumns(0, 4)).toBe(4);
  });
});
