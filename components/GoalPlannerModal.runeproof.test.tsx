// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { UnlockState } from '../types';
import { GoalPlannerModal } from './GoalPlannerModal';

const legacy = vi.hoisted(() => ({ catalogue: vi.fn(), analysis: vi.fn(), checks: vi.fn(), actions: vi.fn() }));
vi.mock('../data/questWalkthroughLoader', () => ({ loadQuestStrategyCatalogue: legacy.catalogue, loadQuestWalkthroughFor: legacy.catalogue }));
vi.mock('../utils/questRoutes/analyzeQuest', () => ({ analyzeQuest: legacy.analysis }));
vi.mock('../hooks/useRuneProofPreviewChecks', () => ({ useRuneProofPreviewChecks: legacy.checks }));
vi.mock('../hooks/useRuneProofPreviewActions', () => ({ useRuneProofPreviewActions: legacy.actions }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({ unlocks: plannerUnlocks(), gameModeId: 'chunked', runId: 'normal-planner' }) }));
const plannerUnlocks = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {},
  skills: {},
  levels: { Cooking: 99, Construction: 99, Mining: 99 },
  regions: [],
  chunks: ['19,57'],
  mobility: ['Fairy rings'],
  arcana: [],
  housing: [],
  merchants: ['General store'],
  minigames: ['Tempoross'],
  bosses: [],
  storage: [],
  guilds: ['Cooks Guild'],
  farming: [],
  slayerUnlocks: ['Bigger and Badder'],
  quests: ['Druidic Ritual'],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
  ...overrides,
});


afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe('ordinary Goal Planner boundary', () => {
  it('keeps quest, diary and region planning independent of the retired RuneProof workspace', () => {
    vi.stubEnv('VITE_RUNEPROOF_PREVIEW', 'true');
    const { rerender } = render(<GoalPlannerModal onClose={() => {}} initialTarget={{ kind: 'quest', id: "Cook's Assistant" }} />);
    expect(screen.getByRole('dialog', { name: 'Goal Planner' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: "Cook's Assistant" })).toBeTruthy();
    expect(screen.queryByText(/RuneProof|Loading .*route/)).toBeNull();
    rerender(<GoalPlannerModal onClose={() => {}} initialTarget={{ kind: 'region', id: 'Lumbridge' }} />);
    expect(screen.getByRole('heading', { name: 'Lumbridge' })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Search quests, diaries, regions…'), { target: { value: 'Lumbridge' } });
    expect(screen.getAllByRole('button').some(button => button.textContent?.includes('Diary'))).toBe(true);
    for (const spy of Object.values(legacy)) expect(spy).not.toHaveBeenCalled();
  });
  it('closes with Escape and restores page scrolling', () => {
    const close = vi.fn();
    document.body.style.overflow = 'auto';
    const { unmount } = render(<GoalPlannerModal onClose={close} />);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });
});
