import { describe, expect, it } from 'vitest';
import { prefetchAllowed } from './prefetch';

describe('idle prefetch on slow or metered connections', () => {
  it('prefetches when the browser gives no hints or a fast link', () => {
    expect(prefetchAllowed(undefined)).toBe(true);
    expect(prefetchAllowed({})).toBe(true);
    expect(prefetchAllowed({ effectiveType: '4g' })).toBe(true);
    expect(prefetchAllowed({ effectiveType: '3g', saveData: false })).toBe(true);
  });

  it('skips it with Data Saver on or on a 2G-class link', () => {
    expect(prefetchAllowed({ saveData: true, effectiveType: '4g' })).toBe(false);
    expect(prefetchAllowed({ effectiveType: '2g' })).toBe(false);
    expect(prefetchAllowed({ effectiveType: 'slow-2g' })).toBe(false);
  });
});
