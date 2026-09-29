import { describe, expect, it } from 'vitest';
import type { FateEventEnvelope } from '../services/fateEventProtocol';
import { pasteSummary } from './runelitePaste';

const pasted = (events: number, tooOld = 0, unreadable = 0) => ({
  events: Array.from({ length: events }, () => ({}) as FateEventEnvelope),
  tooOld,
  unreadable,
});

describe('pasteSummary', () => {
  it('says what a paste added and what it left out', () => {
    expect(pasteSummary(pasted(8, 1), 5)).toBe('Added 5. 3 were already here. 1 was too old.');
    expect(pasteSummary(pasted(2, 2, 1), 1)).toBe('Added 1. 1 was already here. 2 were too old. 1 couldn’t be read.');
    expect(pasteSummary(pasted(0, 0, 3), 0)).toBe('Added 0. 3 couldn’t be read.');
  });

  it('names whose events they were', () => {
    expect(pasteSummary(pasted(1), 1, ['Zezima'])).toBe('Added 1 from Zezima.');
    expect(pasteSummary(pasted(2), 2, ['Zezima', 'Nubles'])).toBe('Added 2 from Zezima and Nubles.');
    expect(pasteSummary(pasted(3), 3, ['Zezima', 'Nubles', 'Lynx Titan']))
      .toBe('Added 3 from Zezima, Nubles and Lynx Titan.');
  });
});
