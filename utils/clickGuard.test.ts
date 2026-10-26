import { afterEach, describe, expect, it } from 'vitest';
import { MOVED_GUARD_MS, movedJustNow, noteLayoutMoved, resetClickGuard } from './clickGuard';

afterEach(resetClickGuard);

describe('the spend click guard', () => {
  it('holds clicks for a moment after the layout moves, then lets them through', () => {
    expect(movedJustNow()).toBe(false);
    noteLayoutMoved();
    const at = performance.now();
    expect(movedJustNow(at + 100)).toBe(true);
    expect(movedJustNow(at + MOVED_GUARD_MS + 1)).toBe(false);
  });
});
