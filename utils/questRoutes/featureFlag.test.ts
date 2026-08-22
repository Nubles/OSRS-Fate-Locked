import { describe, expect, it } from 'vitest';
import { canRenderQuestWalkthrough, runeProofAvailability } from './featureFlag';

describe('runeProofAvailability', () => {
  it('makes the independently authored public pack available by default', () => {
    expect(runeProofAvailability({})).toBe('PUBLIC');
    expect(runeProofAvailability({ VITE_RUNEPROOF_PREVIEW: true })).toBe('PUBLIC');
    expect(runeProofAvailability({ VITE_RUNEPROOF_PUBLIC: '1' })).toBe('PUBLIC');
  });

  it('enables only the explicit private preview', () => {
    expect(runeProofAvailability({ MODE: 'runeproof-preview', VITE_RUNEPROOF_PREVIEW: '1' })).toBe('PREVIEW');
    expect(runeProofAvailability({ MODE: 'production', VITE_RUNEPROOF_PREVIEW: '1' })).toBe('PUBLIC');
  });
});

it('renders only approved walkthroughs in public RuneProof', () => {
  expect(canRenderQuestWalkthrough('PUBLIC', 'APPROVED')).toBe(true);
  expect(canRenderQuestWalkthrough('PUBLIC', 'PREVIEW_ONLY')).toBe(false);
  expect(canRenderQuestWalkthrough('PREVIEW', 'PREVIEW_ONLY')).toBe(true);
  expect(canRenderQuestWalkthrough('PREVIEW', 'APPROVED')).toBe(true);
  expect(canRenderQuestWalkthrough('OFF', 'APPROVED')).toBe(false);
});
