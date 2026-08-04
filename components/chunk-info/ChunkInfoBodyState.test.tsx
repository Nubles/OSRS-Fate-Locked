/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChunkInfoBodyState } from './ChunkInfoBodyState';

afterEach(cleanup);

describe('ChunkInfoBodyState', () => {
  it.each([
    ['loading', 'Loading chunk content'],
    ['empty', 'No indexed content'],
    ['error', 'Chunk content unavailable'],
  ] as const)('renders the %s state', (kind, label) => {
    render(<ChunkInfoBodyState kind={kind} />);

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('disables loading skeleton animation when reduced motion is requested', () => {
    const { container } = render(<ChunkInfoBodyState kind="loading" />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(3);
    skeletons.forEach((skeleton) => {
      expect(skeleton.className).toContain('motion-reduce:animate-none');
    });
  });
  it('announces errors and offers a retry action when one is available', () => {
    render(<ChunkInfoBodyState kind="error" onRetry={() => undefined} />);

    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive');
    expect(screen.getByRole('button', { name: 'Retry loading chunk content' })).toBeTruthy();
  });
});
