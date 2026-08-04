/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChunkInfoHeader } from './ChunkInfoHeader';

afterEach(cleanup);

describe('ChunkInfoHeader', () => {
  it.each([
    ['available', 'Unlocked'],
    ['locked', 'Locked'],
    ['mixed', 'Varies'],
  ] as const)('shows %s status as %s', (status, label) => {
    render(
      <ChunkInfoHeader
        title="Varrock West"
        meta={<>chunk (50, 53) · Misthalin</>}
        status={status}
        showModeSwitch={false}
        mode="chunk"
        onModeChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(label)).toBeTruthy();
  });
  it('shows location state and exposes close and mode controls', async () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    render(
      <ChunkInfoHeader
        title="Varrock West"
        meta={<>chunk (50, 53) · Misthalin</>}
        status="available"
        showModeSwitch
        mode="chunk"
        onModeChange={onModeChange}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Varrock West' })).toBeTruthy();
    expect(screen.getByText('Unlocked')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Chunk information scope' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close chunk info' }));
    expect(onModeChange).toHaveBeenCalledWith('region');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
