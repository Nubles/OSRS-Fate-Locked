/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const setSkillLevel = vi.hoisted(() => vi.fn());
const game = vi.hoisted(() => ({ skills: { Attack: 3 } as Record<string, number>, levels: { Attack: 18 } as Record<string, number>, gameModeId: 'vanilla' }));

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: { skills: game.skills, levels: game.levels },
    gameModeId: game.gameModeId,
    setSkillLevel,
  }),
}));

import { SetLevelControl } from './SetLevelControl';

afterEach(() => {
  cleanup();
  setSkillLevel.mockReset();
  game.skills = { Attack: 3 };
  game.levels = { Attack: 18 };
  game.gameModeId = 'vanilla';
});

describe('Set level in the skill detail', () => {
  for (const variant of ['classic', 'osrs'] as const) {
    it(`rolls the levels typed and shows one summary (${variant})`, () => {
      setSkillLevel.mockReturnValue({ skill: 'Attack', from: 18, to: 30, levels: 12, keys: 2, omniKeys: 0, chaosKeys: 1, fate: 40, noRoll: 0 });
      render(<SetLevelControl skill="Attack" variant={variant} />);
      const input = screen.getByLabelText('Set level');
      const button = screen.getByRole('button', { name: 'Roll levels' });
      expect((button as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(input, { target: { value: '30' } });
      expect(screen.getByText('Levels 19 to 30 each roll for a Key.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Roll 12 levels' }));

      expect(setSkillLevel).toHaveBeenCalledTimes(1);
      expect(setSkillLevel).toHaveBeenCalledWith('Attack', 30);
      expect(screen.getByRole('status').textContent).toBe('Attack 18 to 30. 12 levels logged: 2 Keys found, 1 Chaos Key, +40 Fate.');
      expect((input as HTMLInputElement).value).toBe('');
    });
  }

  it('refuses a lower level without rolling', () => {
    render(<SetLevelControl skill="Attack" variant="classic" />);
    fireEvent.change(screen.getByLabelText('Set level'), { target: { value: '12' } });
    expect(screen.getByText("Already level 18. Levels can't go down.")).toBeTruthy();
    fireEvent.submit(screen.getByRole('form', { name: 'Set Attack level' }));
    expect(setSkillLevel).not.toHaveBeenCalled();
  });

  it('says when Chunked levels past the tier cap will roll nothing', () => {
    game.gameModeId = 'chunked';
    render(<SetLevelControl skill="Attack" variant="osrs" />);
    fireEvent.change(screen.getByLabelText('Set level'), { target: { value: '35' } });
    expect(screen.getByText(/Levels past 30 roll nothing until the next tier opens\./)).toBeTruthy();
  });

  it('offers no input for a locked skill or one at 99', () => {
    game.skills = {};
    render(<SetLevelControl skill="Attack" variant="classic" />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Unlock a tier of this skill first.')).toBeTruthy();
    cleanup();
    game.skills = { Attack: 10 };
    game.levels = { Attack: 99 };
    render(<SetLevelControl skill="Attack" variant="osrs" />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Already level 99.')).toBeTruthy();
  });
});
