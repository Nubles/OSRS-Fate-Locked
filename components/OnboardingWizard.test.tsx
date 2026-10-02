// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTING_KEYS } from '../config/economy';
import { OnboardingWizard } from './OnboardingWizard';

vi.mock('../context/GameContext', () => ({
  useGame: () => ({ completeOnboarding: vi.fn() }),
}));

afterEach(() => cleanup());

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
});
