// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTING_KEYS } from '../config/economy';
import { GAME_MODES } from '../config/gameModes';
import { OnboardingWizard } from './OnboardingWizard';
import { LATEST_CHANGELOG_ID } from '../data/changelogLatest';
import { CHANGELOG_STORAGE_KEY } from '../utils/changelogState';

const completeOnboarding = vi.fn();
let history: unknown[] = [];
vi.mock('../context/GameContext', () => ({
  useGame: () => ({ completeOnboarding, history }),
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

describe('OnboardingWizard finish', () => {
  it('marks What\'s New read up to the latest entry before completing onboarding', () => {
    localStorage.clear();
    completeOnboarding.mockImplementation(() => {
      expect(localStorage.getItem(CHANGELOG_STORAGE_KEY)).toBe(LATEST_CHANGELOG_ID);
    });
    stepTexts();
    expect(localStorage.getItem(CHANGELOG_STORAGE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CHANGELOG_STORAGE_KEY)).toBe(LATEST_CHANGELOG_ID);
  });

  it('leaves the marker alone for an old save that already has rolls', () => {
    localStorage.clear();
    localStorage.setItem(CHANGELOG_STORAGE_KEY, '2026-09-01-older');
    history = [{ id: 'roll-1' }];
    completeOnboarding.mockReset();
    try {
      stepTexts();
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    } finally {
      history = [];
    }
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CHANGELOG_STORAGE_KEY)).toBe('2026-09-01-older');
  });
});
