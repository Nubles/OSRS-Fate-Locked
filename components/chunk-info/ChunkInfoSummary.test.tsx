/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChunkInfoSummary } from './ChunkInfoSummary';

afterEach(cleanup);

describe('ChunkInfoSummary', () => {
  it('renders uniform availability totals', () => {
    render(<ChunkInfoSummary summary={{ kind: 'availability', available: 11, locked: 4 }} />);
    expect(screen.getByText('Available now').previousElementSibling?.textContent).toBe('11');
    expect(screen.getByText('Needs unlocks').previousElementSibling?.textContent).toBe('4');
  });

  it('renders neutral totals for a mixed area aggregate', () => {
    render(<ChunkInfoSummary summary={{ kind: 'indexed', indexedActivities: 15, groups: 6 }} />);
    expect(screen.getByText('Indexed activities').previousElementSibling?.textContent).toBe('15');
    expect(screen.getByText('Content groups').previousElementSibling?.textContent).toBe('6');
  });
});
