// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuneProofObjectiveRecommendation } from '../../utils/questStrategies/objectives';
import { RuneProofObjectivePicker } from './RuneProofObjectivePicker';

afterEach(cleanup);

const recommendations: readonly RuneProofObjectiveRecommendation[] = [
  {
    questId: 'Sheep Shearer',
    reason: 'Ready with your current unlocks.',
    progress: { completed: 1, total: 5 },
    readiness: 'READY',
  },
  {
    questId: 'The Restless Ghost',
    reason: 'Continue its reviewed route after confirming the current step.',
    progress: { completed: 0, total: 7 },
    readiness: 'CONFIRM',
  },
  {
    questId: 'Imp Catcher',
    reason: 'Has a reviewed route with an actionable blocker.',
    progress: { completed: 0, total: 6 },
    readiness: 'BLOCKED',
  },
];

describe('RuneProofObjectivePicker', () => {
  it('presents accessible recommendations and selects their quest', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<RuneProofObjectivePicker recommendations={recommendations} onSelect={onSelect} />);

    const region = screen.getByRole('region', { name: 'Recommended RuneProof quests' });
    expect(within(region).getAllByRole('button')).toHaveLength(3);
    expect(within(region).getByText('Ready')).toBeTruthy();
    expect(within(region).getByText('Needs confirmation')).toBeTruthy();
    expect(within(region).getByText('Blocked')).toBeTruthy();
    expect(within(region).getByText('1/5 complete')).toBeTruthy();
    expect(within(region).queryByText("Cook's Assistant")).toBeNull();

    await user.click(within(region).getByRole('button', { name: /Sheep Shearer/i }));

    expect(onSelect).toHaveBeenCalledWith('Sheep Shearer');
  });
});
