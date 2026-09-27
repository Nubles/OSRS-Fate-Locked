import { describe, expect, it } from 'vitest';
import { leastUsable, mostUsable } from './permissionStatus';

describe('mostUsable', () => {
  it('takes the alternative closest to usable', () => {
    expect(mostUsable(['LOCKED', 'ALLOWED'])).toBe('ALLOWED');
    expect(mostUsable(['NOT_READY', 'UNKNOWN', 'LOCKED'])).toBe('UNKNOWN');
    expect(mostUsable(['LOCKED', 'NOT_READY'])).toBe('NOT_READY');
    expect(mostUsable(['LOCKED', 'LOCKED'])).toBe('LOCKED');
    expect(mostUsable([])).toBeUndefined();
  });
});

describe('leastUsable', () => {
  it('takes the condition furthest from usable', () => {
    expect(leastUsable('ALLOWED', 'LOCKED')).toBe('LOCKED');
    expect(leastUsable('UNKNOWN', 'NOT_READY')).toBe('NOT_READY');
    expect(leastUsable('ALLOWED', 'UNKNOWN')).toBe('UNKNOWN');
    expect(leastUsable('ALLOWED')).toBe('ALLOWED');
    expect(leastUsable()).toBe('ALLOWED');
  });
});
