import { describe, expect, it } from 'vitest';
import { describeRollOutcome } from './rollOutcomeText';

describe('describeRollOutcome', () => {
  it('names the Key a winning roll found', () => {
    expect(describeRollOutcome({ type: 'ROLL_SUCCESS', meta: { standardKeysAwarded: 1 } }))
      .toEqual({ won: true, text: 'Key found!' });
    expect(describeRollOutcome({ type: 'ROLL_SUCCESS', meta: { standardKeysAwarded: 2 } })?.text).toBe('2 Keys found!');
    expect(describeRollOutcome({ type: 'ROLL_OMNI', meta: { standardKeysAwarded: 1 } })?.text).toBe('Key and Omni-Key found!');
    expect(describeRollOutcome({ type: 'ROLL_OMNI', meta: { standardKeysAwarded: 2 } })?.text).toBe('2 Keys and an Omni-Key found!');
  });

  it('says a miss found no Key, with the Fate gained and the way to the Pity Key', () => {
    expect(describeRollOutcome({ type: 'ROLL_FAIL', meta: { fateBefore: 8, fateAfter: 12, pityThreshold: 50 } }))
      .toEqual({ won: false, text: 'No Key: +4 Fate (12/50)' });
  });

  it('shows Fate as the header does when the mode has no pity', () => {
    expect(describeRollOutcome({ type: 'ROLL_FAIL', meta: { fateBefore: 2, fateAfter: 3, pityThreshold: null } })?.text)
      .toBe('No Key: +1 Fate (3 Fate)');
  });

  it('says a miss that left Fate unchanged or lower plainly', () => {
    expect(describeRollOutcome({ type: 'ROLL_FAIL', meta: { fateBefore: 5, fateAfter: 5, pityThreshold: 50 } })?.text)
      .toBe('No Key (5/50)');
    expect(describeRollOutcome({ type: 'ROLL_FAIL', meta: { fateBefore: 5, fateAfter: 3, pityThreshold: 50 } })?.text)
      .toBe('No Key: −2 Fate (3/50)');
  });

  it('still says No Key when the Fate fields are missing', () => {
    expect(describeRollOutcome({ type: 'ROLL_FAIL', meta: { roll: 90 } })).toEqual({ won: false, text: 'No Key' });
  });

  it('names the Pity Key and the line Fate reached', () => {
    expect(describeRollOutcome({ type: 'ROLL_PITY', meta: { fateBefore: 49, fateAfter: 0, pityThreshold: 50 } }))
      .toEqual({ won: true, text: 'Missed, but Fate reached 50: Pity Key!' });
  });

  it('ignores events that are not Key rolls', () => {
    expect(describeRollOutcome({ type: 'UNLOCK', meta: {} })).toBeNull();
    expect(describeRollOutcome(null)).toBeNull();
  });
});
