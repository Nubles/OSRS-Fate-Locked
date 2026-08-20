import { describe, expect, it } from 'vitest';
import { canRenderQuestWalkthrough, runeProofAvailability } from './featureFlag';

describe('runeProofAvailability', () => {
  it('is off unless the exact preview flag is supplied', () => {
    expect(runeProofAvailability({})).toBe('OFF');
    expect(runeProofAvailability({ VITE_RUNEPROOF_PREVIEW: true })).toBe('OFF');
    expect(runeProofAvailability({ VITE_RUNEPROOF_PUBLIC: '1' })).toBe('OFF');
  });

  it('enables only the explicit private preview', () => {
    expect(runeProofAvailability({ VITE_RUNEPROOF_PREVIEW: '1' })).toBe('PREVIEW');
  });
});

it('renders reviewed walkthroughs only in preview', () => {
  expect(canRenderQuestWalkthrough('PREVIEW', 'PREVIEW_ONLY')).toBe(true);
  expect(canRenderQuestWalkthrough('PREVIEW', 'APPROVED')).toBe(true);
  expect(canRenderQuestWalkthrough('OFF', 'APPROVED')).toBe(false);
});
