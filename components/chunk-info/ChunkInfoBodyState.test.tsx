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
});
