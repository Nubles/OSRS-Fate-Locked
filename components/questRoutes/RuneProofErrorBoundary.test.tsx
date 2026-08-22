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
  it('contains a panel failure and leaves the surrounding RuneProof workspace usable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', preventExpectedError);
    try {
      render(
        <div>
          <span>RuneProof remains</span>
          <RuneProofErrorBoundary>
            <BrokenPanel />
          </RuneProofErrorBoundary>
        </div>,
      );
    } finally {
      window.removeEventListener('error', preventExpectedError);
    }

    expect(screen.getByText('RuneProof remains')).toBeTruthy();
    expect(screen.getByText('RuneProof is temporarily unavailable. Choose another reviewed RuneProof quest.'))
      .toBeTruthy();
    expect(screen.queryByText(/sensitive internal route failure/i)).toBeNull();
  });
});
