// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTING_KEYS } from '../config/economy';
import { GAME_MODES } from '../config/gameModes';
import { OnboardingWizard } from './OnboardingWizard';

vi.mock('../context/GameContext', () => ({
  useGame: () => ({ completeOnboarding: vi.fn() }),
}));

afterEach(() => cleanup());

const stepTexts = (): string[] => {
  render(<OnboardingWizard />);
  const texts = [document.body.textContent ?? ''];
  while (screen.queryByRole('button', { name: 'Next' })) {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    texts.push(document.body.textContent ?? '');
  }
  return texts;
};

describe('OnboardingWizard copy', () => {
  it('opens with the Keys and the land a new run starts with', () => {
    render(<OnboardingWizard />);
    const text = document.body.textContent ?? '';
    expect(text).toContain(`You start with ${STARTING_KEYS} Keys and nearly everything locked`);
    expect(text).toContain('no skills except Hitpoints');
    expect(text).toContain('In Vanilla you can go anywhere in Misthalin from the start.');
    expect(text).toContain('In Chunked you start in one chunk of Lumbridge.');
    expect(text).not.toContain('You begin with nothing');
  });

  it('names the one pity threshold every mode a player can pick uses', () => {
    const threshold = GAME_MODES[0].rules.pityThreshold;
    for (const mode of GAME_MODES) expect(mode.rules.pityThreshold, mode.id).toBe(threshold);

    const fate = stepTexts().find(text => text.includes('The pity system'))!;
    expect(fate).toContain(`When a failed roll takes you to ${threshold} Fate Points, you get a guaranteed Pity Key instead`);
    expect(fate).not.toContain('depends on the game mode');
  });

  it('describes the rituals plainly and points at the Rules page', () => {
    const texts = stepTexts();
    const altar = texts[texts.length - 1];
    expect(altar).toContain('roll twice and keep the better, try to double your next Key, or buy a Chaos Key');
    expect(altar).toContain('Every rate, Key and ritual is on the Rules page: the ? in the top bar.');
    expect(texts.join(' ')).not.toMatch(/Advantage|Codex|Enter The Void|Cruel Fate|Bending Luck|Fate Decides All|hard-earned/);
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  });
});
