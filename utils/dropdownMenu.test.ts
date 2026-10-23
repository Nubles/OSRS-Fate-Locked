import { describe, expect, it } from 'vitest';
import { MENU_EDGE_MARGIN, MENU_MIN_HEIGHT, nextMenuIndex, placeMenuBelow } from './dropdownMenu';

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
