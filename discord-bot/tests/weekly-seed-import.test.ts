import { describe, expect, it } from 'vitest';
import { weeklySeed } from '../../utils/seededRng.js';

describe('canonical weekly seed import', () => {
  it('uses the tracker helper across an ISO-year boundary', () => {
    expect(weeklySeed(new Date('2027-01-01T12:00:00Z'))).toBe('FATE-2026-W53');
  });
});
