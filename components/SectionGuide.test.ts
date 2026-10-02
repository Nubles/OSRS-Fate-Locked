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

  it('say an Omni-Key picks any exact unlock, not only a tier', () => {
    expect(guideText('SPEND')).toContain('Omni-Keys (spent on the Dashboard) pick the exact unlock');
    expect(guideText('SKILLS')).toContain('with a Key on the Skills table (a random skill) or an Omni-Key (your choice)');
    expect(guideText('ACTIVITIES')).toContain('or pick one here with an Omni-Key');
    const all = Object.keys(GUIDES).map(guideText).join(' ');
    expect(all).not.toMatch(/Omni-keys upgrade|gacha/i);
  });

  it('tell players to tick diary tasks, which roll, not diary tiers', () => {
    expect(guideText('JOURNAL')).toContain('Tick off quests, diary tasks and Combat Achievement tasks');
    expect(guideText('JOURNAL')).not.toContain('diary tiers');
  });

  it('promise only what the Strategy Guide shows', () => {
    expect(guideText('STRATEGY')).not.toMatch(/Curated|efficient order|recommended setups/);
    expect(guideText('STRATEGY')).toContain('Closest: the ten goals nearest to reach.');
  });

  it('describe the rituals plainly, without calling them high-risk', () => {
    expect(guideText('VOID_ALTAR')).not.toMatch(/high-risk|spice|softened gamble|converters/);
    expect(guideText('VOID_ALTAR')).toContain('your next successful roll resets it to 0');
    expect(guideText('VOID_ALTAR')).toContain('Clarity rolls your next Key roll twice and keeps the better.');
  });
});
