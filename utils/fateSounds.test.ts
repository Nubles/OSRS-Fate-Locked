import { describe, expect, it } from 'vitest';
import { soundForEvent } from './fateSounds';

describe('soundForEvent', () => {
  it('thunks on a miss, chimes on any Key and plays the fanfare on an unlock', () => {
    expect(soundForEvent('ROLL_FAIL')).toBe('miss');
    expect(['ROLL_SUCCESS', 'ROLL_OMNI', 'ROLL_PITY'].map(soundForEvent)).toEqual(['key', 'key', 'key']);
    expect(soundForEvent('UNLOCK')).toBe('unlock');
    expect(soundForEvent('RITUAL')).toBeNull();
  });
});
