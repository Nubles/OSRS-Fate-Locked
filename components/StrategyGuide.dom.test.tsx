// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SKILLS_LIST, REGIONS_LIST } from '../constants';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { TableType } from '../types';
import { evaluateQuestEligibility } from '../utils/journalStatus';

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

/** The quests whose display name is not their id. */
const RENAMED = Object.values(QUEST_DATA).filter(q => q.name !== q.id);

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

describe('Strategy Guide quests', () => {
  it('lists every quest under its id and drops it once completed', () => {
    expect(RENAMED.map(q => q.id).sort()).toEqual(['Desert Treasure II', 'Forgettable Tale...', 'RFD: The Cook', 'The Ribbiting Tale']);
    const open = buildGuideContent(unlocksWith(3, 10), 'vanilla');
    for (const quest of Object.values(QUEST_DATA)) {
      expect(open[quest.id]?.id, quest.id).toBe(quest.id);
      expect(buildGuideContent(unlocksWith(3, 10, { quests: [quest.id] }), 'vanilla')[quest.id], quest.id).toBeUndefined();
    }
    for (const quest of RENAMED) expect(open[quest.name]).toBeUndefined();
  });

  it('judges each quest as the Quest Log does', () => {
    for (const [mode, base] of [['vanilla', unlocksWith(10, 99)], ['chunked', unlocksWith(10, 99, { regions: [] })]] as const) {
      for (const quest of Object.values(QUEST_DATA)) {
        const unlocks = { ...base, quests: Object.keys(QUEST_DATA).filter(id => id !== quest.id) };
        const entry = buildGuideContent(unlocks, mode)[quest.id];
        expect(analyzeRequirement(entry, unlocks, mode).isFullyPlayable, `${mode} ${quest.id}`)
          .toBe(evaluateQuestEligibility(quest, unlocks, mode).eligible);
      }
    }
  });

  it('hides a completed renamed quest and shows the name of one still to do', () => {
    game.unlocks = unlocksWith(10, 99, { quests: Object.keys(QUEST_DATA).filter(id => id !== 'RFD: The Cook') });
    render(<StrategyGuide onClose={() => {}} />);
    openLocked('');
    const titles = screen.queryAllByRole('heading', { level: 3 }).map(h => h.textContent);
    expect(titles).toContain('RFD: Start (The Cook)');
    expect(titles).not.toContain('Desert Treasure II - The Fallen Empire');
  });

  it('pins a quest by its id and unpins an older pin made by its name', () => {
    game.unlocks = unlocksWith(10, 99, { quests: Object.keys(QUEST_DATA).filter(id => id !== 'RFD: The Cook') });
    render(<StrategyGuide onClose={() => {}} />);
    openLocked('RFD: Start');
    fireEvent.click(screen.getByTitle('Pin as Goal'));
    expect(game.togglePin).toHaveBeenLastCalledWith('RFD: The Cook');
    cleanup();
    game.pinnedGoals = ['RFD: Start (The Cook)'];
    render(<StrategyGuide onClose={() => {}} />);
    openLocked('RFD: Start');
    fireEvent.click(screen.getByTitle('Unpin Goal'));
    expect(game.togglePin).toHaveBeenLastCalledWith('RFD: Start (The Cook)');
  });
});
