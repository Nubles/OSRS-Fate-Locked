import { describe, expect, it } from 'vitest';
import { onboardingCanGoBack, onboardingCanSkip, onboardingStepAfter } from './onboardingSteps';

const TOTAL = 5;

describe('onboardingStepAfter', () => {
  it('walks forward one step at a time and finishes from the last step', () => {
    expect(onboardingStepAfter(0, TOTAL, 'next')).toBe(1);
    expect(onboardingStepAfter(3, TOTAL, 'next')).toBe(4);
    expect(onboardingStepAfter(4, TOTAL, 'next')).toBe('finish');
  });

  it('skips from any step to the same exit as Start, which leads to the mode choice', () => {
    for (let step = 0; step < TOTAL; step++) {
      expect(onboardingStepAfter(step, TOTAL, 'skip')).toBe('finish');
      expect(onboardingStepAfter(step, TOTAL, 'skip')).toBe(onboardingStepAfter(TOTAL - 1, TOTAL, 'next'));
    }
  });

  it('steps back, and Escape only ever steps back and never closes the intro', () => {
    expect(onboardingStepAfter(3, TOTAL, 'back')).toBe(2);
    expect(onboardingStepAfter(0, TOTAL, 'back')).toBe(0);
    for (let step = 0; step < TOTAL; step++) {
      const after = onboardingStepAfter(step, TOTAL, 'escape');
      expect(after).not.toBe('finish');
      expect(after).toBe(Math.max(0, step - 1));
    }
  });

  it('clamps an out-of-range step instead of skipping past the end', () => {
    expect(onboardingStepAfter(9, TOTAL, 'back')).toBe(3);
    expect(onboardingStepAfter(-2, TOTAL, 'next')).toBe(1);
  });
});

describe('which buttons show', () => {
  it('shows Back from the second step on', () => {
    expect(onboardingCanGoBack(0)).toBe(false);
    expect(onboardingCanGoBack(1)).toBe(true);
    expect(onboardingCanGoBack(4)).toBe(true);
  });

  it('shows Skip on every step but the last, where Start does the same', () => {
    expect(onboardingCanSkip(0, TOTAL)).toBe(true);
    expect(onboardingCanSkip(3, TOTAL)).toBe(true);
    expect(onboardingCanSkip(4, TOTAL)).toBe(false);
  });
});
