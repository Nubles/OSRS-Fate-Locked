import { describe, expect, it } from 'vitest';
import { GUIDES, guideIdFor } from './SectionGuide';
import { FEATURE_GATES } from '../utils/featureGates';
import { ACHIEVEMENTS } from '../utils/achievements';

const guideText = (id: string): string => [GUIDES[id].blurb, ...GUIDES[id].bullets].join(' ');

describe('help popovers', () => {
  it('name every achievement reward the code pays: Fate, a Chaos Key for the hardest, a ritual for the biggest', () => {
    // utils/achievements.ts: every 25-Fate achievement pays a Chaos Key, and
    // the few completion ones among them (every quest, skill, area and so on)
    // also pay a free random ritual.
    const chaos = ACHIEVEMENTS.filter((a) => a.chaosKeys > 0);
    const rituals = ACHIEVEMENTS.filter((a) => a.freeRituals > 0);
    expect(chaos.length).toBe(19);
    expect(chaos.every((a) => a.fate === 25 && a.chaosKeys === 1)).toBe(true);
    expect(ACHIEVEMENTS.filter((a) => a.fate >= 25)).toEqual(chaos);
    expect(rituals.length).toBe(8);
    expect(rituals.every((a) => a.fate === 25 && a.freeRituals === 1)).toBe(true);
    expect(Math.max(...ACHIEVEMENTS.map((a) => a.fate))).toBe(25);
    expect(guideText('ACHIEVEMENTS')).toContain(
      'Each also gives Fate (1 to 5 for first steps, up to 25 for the hardest). The hardest also give a Chaos Key, and the biggest of those a free random ritual.',
    );
  });

  it('never sell History or the share card as proof for others', () => {
    // The chain is a recomputable checksum, and the card itself says
    // "Local check only; not external verification".
    for (const id of ['LOG', 'SHARE']) {
      expect(guideText(id)).not.toMatch(/verifiab|verification hash|genuine|tamper/i);
      expect(guideText(id)).toMatch(/(not|isn’t) proof for anyone else/);
    }
    expect(FEATURE_GATES.map(gate => gate.revealMessage).join(' ')).not.toMatch(/tamper/i);
  });

  it('say minigame Key stashes keep their own odds in Chunked as well as Vanilla', () => {
    expect(Object.keys(GUIDES).map(guideText).join(' ')).toContain('Vanilla and Chunked minigame stashes keep their own odds.');
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

describe('World guide in Chunked', () => {
  it('talks about owned chunks in Chunked and keeps the area guide elsewhere', () => {
    expect(guideIdFor('WORLD', 'chunked')).toBe('WORLD_CHUNKED');
    expect(guideIdFor('WORLD', 'vanilla')).toBe('WORLD');
    expect(guideIdFor('SPEND', 'chunked')).toBe('SPEND');
    expect(guideText('WORLD_CHUNKED')).toContain('See the chunks you own');
    expect(guideText('WORLD_CHUNKED')).not.toContain('the areas you’ve unlocked');
    expect(guideText('WORLD')).toContain('See the areas you’ve unlocked');
  });
});
