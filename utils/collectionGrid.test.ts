import { describe, expect, it } from 'vitest';
import { COLLECTION_CELL_MIN_PX, collectionGridColumns } from './collectionGrid';

describe('collectionGridColumns', () => {
  it('keeps four in a row on every screen wider than a phone', () => {
    // The grid's measured width in the classic log on a 768px tablet, a 1366px laptop and a 1440px desktop.
    for (const width of [465, 553, 586]) expect(collectionGridColumns(width)).toBe(4);
    expect(collectionGridColumns(COLLECTION_CELL_MIN_PX * 4)).toBe(4);
    // More room never adds a fifth: the row is four, as it always was.
    expect(collectionGridColumns(2000)).toBe(4);
  });

  it('shows fewer in a row on a phone, where four cells are narrower than the item picture', () => {
    // The grid's measured width on 390px, 360px and 320px wide phones.
    expect(collectionGridColumns(200)).toBe(3);
    expect(collectionGridColumns(170)).toBe(2);
    expect(collectionGridColumns(149)).toBe(2);
    expect(collectionGridColumns(COLLECTION_CELL_MIN_PX * 4 - 1)).toBe(3);
  });

  it('never gives a cell less than the minimum while two still fit', () => {
    for (let width = COLLECTION_CELL_MIN_PX * 2; width <= 700; width++) {
      expect(width / collectionGridColumns(width)).toBeGreaterThanOrEqual(COLLECTION_CELL_MIN_PX);
    }
  });

  it('never drops below two in a row', () => {
    expect(collectionGridColumns(100)).toBe(2);
    expect(collectionGridColumns(1)).toBe(2);
  });

  it('stays at four before the grid has been measured', () => {
    expect(collectionGridColumns(0)).toBe(4);
  });
});
