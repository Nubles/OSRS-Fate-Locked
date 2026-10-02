import { describe, expect, it } from 'vitest';
import { GUIDES } from './SectionGuide';
import { FEATURE_GATES } from '../utils/featureGates';

const guideText = (id: string): string => [GUIDES[id].blurb, ...GUIDES[id].bullets].join(' ');

describe('help popovers', () => {
  it('never sell History or the share card as proof for others', () => {
    // The chain is a recomputable checksum, and the card itself says
    // "Local check only; not external verification".
    for (const id of ['LOG', 'SHARE']) {
      expect(guideText(id)).not.toMatch(/verifiab|verification hash|genuine|tamper/i);
      expect(guideText(id)).toMatch(/(not|isn’t) proof for anyone else/);
    }
    expect(FEATURE_GATES.map(gate => gate.revealMessage).join(' ')).not.toMatch(/tamper/i);
  });
});
