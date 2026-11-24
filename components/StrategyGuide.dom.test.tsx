// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SKILLS_LIST, REGIONS_LIST } from '../constants';
import { DIARY_DATA } from '../data/diaryData';
import { TableType } from '../types';

const unlocksWith = (tier: number, level: number, over: Record<string, unknown> = {}): any => ({
  equipment: {}, skills: Object.fromEntries(SKILLS_LIST.map(s => [s, tier])),
  levels: Object.fromEntries(SKILLS_LIST.map(s => [s, level])), regions: [...REGIONS_LIST],
  chunks: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], banks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {}, ...over,
});
const game = vi.hoisted(() => ({
  unlocks: undefined as any,
  togglePin: vi.fn(),
  pinnedGoals: [] as string[],
  gameModeId: 'vanilla',
}));
vi.mock('../context/GameContext', () => ({ useGame: () => game }));

import { StrategyGuide, buildGuideContent, analyzeRequirement, calculateProphecyScore } from './StrategyGuide';

afterEach(() => {
  cleanup();
  game.pinnedGoals = [];
  game.togglePin.mockReset();
});

const openLocked = (search: string) => {
  fireEvent.click(screen.getAllByRole('button').find(b => (b.textContent || '').trim() === 'Locked')!);
  fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: search } });
};

describe('Strategy Guide skill chips', () => {
  it('shows a combat-level requirement as a check, not a locked skill', () => {
    game.unlocks = unlocksWith(3, 10);
    render(<StrategyGuide onClose={() => {}} />);
    openLocked('Western Easy');
    expect(screen.getByText('Required: Combat level 40')).toBeTruthy();
    const html = document.body.innerHTML;
    expect(html).not.toContain('Combat level_icon.png');
    expect(screen.queryByText(/^Combat level 40$/)).toBeNull();
  });

  it('shows an either-of-two-skills requirement as a check, not a locked skill', () => {
    game.unlocks = unlocksWith(3, 10);
    render(<StrategyGuide onClose={() => {}} />);
    openLocked('Fremennik Elite');
    expect(screen.getByText('Required: Strength or Agility 60')).toBeTruthy();
    expect(document.body.innerHTML).not.toContain('Strength or Agility_icon.png');
  });

  it('turns only game skills into skill chips, and scores a combat level as a check', () => {
    const skills = new Set<string>(SKILLS_LIST);
    for (const unlocks of [unlocksWith(0, 1), unlocksWith(3, 10), unlocksWith(1, 10, { regions: [] })]) {
      const content = buildGuideContent(unlocks, 'vanilla');
      const odd = Object.values(content).flatMap(req => Object.keys(req.skills)
        .filter(skill => !skills.has(skill) && !(skill === 'Quest Points' && req.category === TableType.QUESTS))
        .map(skill => `${req.id}: ${skill}`));
      expect(odd).toEqual([]);
    }
    const unlocks = unlocksWith(3, 10);
    const western = buildGuideContent(unlocks, 'vanilla')['Western Easy'];
    const analysis = analyzeRequirement(western, unlocks, 'vanilla');
    expect(analysis.missingChecks).toContain('Combat level 40');
    expect(analysis.missingSkills.map((s: any) => s.skill)).not.toContain('Combat level');
    // The combat level weighs as one check (20), not as a locked skill (50 plus each level short).
    const without = { ...analysis, missingChecks: analysis.missingChecks.filter((c: string) => c !== 'Combat level 40') };
    expect(calculateProphecyScore(western, analysis) - calculateProphecyScore(western, without)).toBe(20);
    expect(DIARY_DATA['Western Easy'].id).toBe('Western Easy');
  });
});
