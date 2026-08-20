// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuneProofErrorBoundary } from './RuneProofErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const BrokenPanel = (): React.ReactNode => {
  throw new Error('sensitive internal route failure');
};

describe('RuneProofErrorBoundary', () => {
  it('contains a panel failure and leaves the surrounding planner usable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', preventExpectedError);
    try {
      render(
        <div>
          <span>Goal Planner remains</span>
          <RuneProofErrorBoundary>
            <BrokenPanel />
          </RuneProofErrorBoundary>
        </div>,
      );
    } finally {
      window.removeEventListener('error', preventExpectedError);
    }

    expect(screen.getByText('Goal Planner remains')).toBeTruthy();
    expect(screen.getByText('RuneProof preview is unavailable. The Goal Planner is still available.'))
      .toBeTruthy();
    expect(screen.queryByText(/sensitive internal route failure/i)).toBeNull();
  });
});
