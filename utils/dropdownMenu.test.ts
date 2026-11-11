import { describe, expect, it } from 'vitest';
import { MENU_EDGE_MARGIN, MENU_MIN_HEIGHT, nextMenuIndex, placeMenuBelow, slideMenuInside } from './dropdownMenu';

describe('placeMenuBelow', () => {
  const viewport = { width: 1440, height: 900 };
  const gear = { top: 48, bottom: 80, left: 1252, right: 1284 };

  it('opens just below the button, right-aligned to it', () => {
    expect(placeMenuBelow(gear, viewport, 224)).toEqual({ top: 84, left: 1060, maxHeight: 808 });
  });

  it('stays inside a phone window when the button sits near the left edge', () => {
    const phoneGear = { top: 120, bottom: 152, left: 20, right: 52 };
    expect(placeMenuBelow(phoneGear, { width: 390, height: 844 }, 224).left).toBe(MENU_EDGE_MARGIN);
  });

  it('stays inside the window when the button sits past the right edge', () => {
    const offRight = { top: 10, bottom: 42, left: 380, right: 412 };
    const { left } = placeMenuBelow(offRight, { width: 390, height: 844 }, 224);
    expect(left + 224).toBe(390 - MENU_EDGE_MARGIN);
  });

  it('never shrinks below a usable height on a short window', () => {
    expect(placeMenuBelow({ top: 300, bottom: 332, left: 0, right: 300 }, { width: 800, height: 400 }, 224).maxHeight)
      .toBe(MENU_MIN_HEIGHT);
  });
});

describe('slideMenuInside', () => {
  // The Journal panel on a 390px phone, and the 224px menu under a chip.
  const panel = { left: 13, right: 377 };

  it('leaves a menu that fits where it is', () => {
    expect(slideMenuInside({ left: 33, right: 257 }, panel)).toBe(0);
    expect(slideMenuInside({ left: 145, right: 369 }, panel)).toBe(0);
  });

  it('moves a menu left by what would be cut off, keeping the margin', () => {
    // Under the second chip of a row: 224px from 179 runs to 403, past the panel's 377.
    const slide = slideMenuInside({ left: 179, right: 403 }, panel);
    expect(slide).toBe(-34);
    expect(403 + slide).toBe(panel.right - MENU_EDGE_MARGIN);
  });

  it('never moves a menu past the left edge of a box narrower than the menu', () => {
    const narrow = { left: 13, right: 200 };
    const slide = slideMenuInside({ left: 60, right: 284 }, narrow);
    expect(60 + slide).toBe(narrow.left + MENU_EDGE_MARGIN);
    expect(slideMenuInside({ left: 13, right: 237 }, narrow)).toBe(0);
  });

  it('gives a plain zero before anything has a size', () => {
    expect(Object.is(slideMenuInside({ left: 0, right: 0 }, { left: 0, right: 0 }), 0)).toBe(true);
  });
});

describe('nextMenuIndex', () => {
  it('steps and wraps with the arrow keys', () => {
    expect(nextMenuIndex(0, 3, 'ArrowDown')).toBe(1);
    expect(nextMenuIndex(2, 3, 'ArrowDown')).toBe(0);
    expect(nextMenuIndex(0, 3, 'ArrowUp')).toBe(2);
  });

  it('starts at the matching end when focus is not on an item', () => {
    expect(nextMenuIndex(-1, 3, 'ArrowDown')).toBe(0);
    expect(nextMenuIndex(-1, 3, 'ArrowUp')).toBe(2);
  });

  it('jumps with Home and End, and ignores other keys or an empty menu', () => {
    expect(nextMenuIndex(1, 4, 'Home')).toBe(0);
    expect(nextMenuIndex(1, 4, 'End')).toBe(3);
    expect(nextMenuIndex(1, 4, 'a')).toBeNull();
    expect(nextMenuIndex(-1, 0, 'ArrowDown')).toBeNull();
  });
});
