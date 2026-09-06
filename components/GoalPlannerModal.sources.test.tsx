// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GoalPlannerModal } from './GoalPlannerModal';

const source = vi.hoisted(() => ({ ready: false, init: vi.fn<() => Promise<boolean>>(), unlocks: { quests: [] } }));
vi.mock('../services/ChunkContentService', () => ({ chunkContentService: source }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({ unlocks: source.unlocks, gameModeId: 'vanilla' }) }));
vi.mock('../utils/journalStatus', () => ({
  evaluateQuestEligibility: () => ({ status: source.ready ? 'AVAILABLE' : 'UNKNOWN', eligible: source.ready, confirmable: false, manualChecks: [] }),
  evaluateDiaryTaskEligibility: vi.fn(), getDiaryStatus: vi.fn(), getQuestStatus: vi.fn(),
}));
vi.mock('../utils/goalPlanner', () => ({
  listGoalTargets: () => [{ kind: 'quest', id: "Cook's Assistant", label: "Cook's Assistant", group: 'Lumbridge' }],
  planForTarget: () => ({ targetKind: 'quest', targetId: "Cook's Assistant", targetLabel: "Cook's Assistant", alreadyReachable: source.ready, alreadyDone: false, needsConfirmation: false, remaining: source.ready ? 0 : 1, steps: [], manualSteps: [], questSteps: [], regionSteps: [], skillSteps: [], alternativeSteps: [] }),
}));
afterEach(() => { cleanup(); source.ready = false; vi.clearAllMocks(); });
it('loads sources on a planner-only opening and refreshes both picker and selected plan', async () => {
  let finish!: (value: boolean) => void;
  source.init.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<GoalPlannerModal onClose={() => {}} initialTarget={{ kind: 'quest', id: "Cook's Assistant" }} />);
  const picker = screen.getByRole('button', { name: /Cook.s Assistant/ });
  expect(source.init).toHaveBeenCalledTimes(1);
  expect(picker.querySelector('.bg-gray-600')).toBeTruthy();
  expect(screen.queryByText(/Available right now/)).toBeNull();
  await act(async () => { source.ready = true; finish(true); });
  expect(picker.querySelector('.bg-amber-400')).toBeTruthy();
  expect(screen.getByText(/Available right now/)).toBeTruthy();
});
it('allows source loading to finish after the planner is closed', async () => {
  let finish!: (value: boolean) => void;
  source.init.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<GoalPlannerModal onClose={() => {}} />);
  view.unmount();
  await act(async () => { source.ready = true; finish(true); });
  expect(screen.queryByRole('dialog')).toBeNull();
});
