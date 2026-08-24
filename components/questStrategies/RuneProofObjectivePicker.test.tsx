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
    expect(region.className).toContain('max-h-[55%]');
    expect(region.className).toContain('overflow-y-auto');
    expect(within(region).getAllByRole('button')).toHaveLength(3);
    expect(within(region).getByText('Ready')).toBeTruthy();
    expect(within(region).getByText('Needs confirmation')).toBeTruthy();
    expect(within(region).getByText('Blocked')).toBeTruthy();
    expect(within(region).getByText('1/5 complete')).toBeTruthy();
    expect(within(region).queryByText("Cook's Assistant")).toBeNull();

    await user.click(within(region).getByRole('button', { name: /Sheep Shearer/i }));

    expect(onSelect).toHaveBeenCalledWith('Sheep Shearer');
  });

  it('defensively caps direct recommendation inputs at three', () => {
    render(
      <RuneProofObjectivePicker
        recommendations={[
          ...recommendations,
          { ...recommendations[0], questId: 'Fourth quest' },
          { ...recommendations[0], questId: 'Fifth quest' },
        ]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText('Fourth quest')).toBeNull();
    expect(screen.queryByText('Fifth quest')).toBeNull();
  });

  it('never renders review-only or complete rows as recommendations', () => {
    const malformed = [
      ...recommendations,
      { ...recommendations[0], questId: 'Review only', readiness: 'NEEDS_REVIEW' },
      { ...recommendations[0], questId: 'Already complete', readiness: 'COMPLETE' },
    ] as unknown as readonly RuneProofObjectiveRecommendation[];

    render(<RuneProofObjectivePicker recommendations={malformed} onSelect={vi.fn()} />);

    expect(screen.queryByText('Review only')).toBeNull();
    expect(screen.queryByText('Already complete')).toBeNull();
  });
});
