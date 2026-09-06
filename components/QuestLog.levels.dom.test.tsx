// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import { QUEST_DATA } from '../data/questData';
import { evaluateQuestEligibility } from '../utils/journalStatus';
import { QuestCard } from './QuestLog';

afterEach(cleanup);

it('opens the training guide with the attained level instead of the method cap', () => {
  const unlocks = { ...initialState.unlocks, levels: { Cooking: 70 }, skills: { Cooking: 1 } };
  const source = { ...QUEST_DATA["Cook's Assistant"], skills: { Cooking: 75 } };
  const eligibility = evaluateQuestEligibility(source, unlocks);
  const onSkillClick = vi.fn();
  render(<QuestCard quest={{ ...source, eligibility, status: eligibility.status }} unlocks={unlocks}
    currentQP={0} onToggle={vi.fn()} onSkillClick={onSkillClick} />);
  fireEvent.click(screen.getByTitle('Training guide: Cooking'));
  expect(onSkillClick).toHaveBeenCalledWith('Cooking', 75, 70, expect.anything());
});
