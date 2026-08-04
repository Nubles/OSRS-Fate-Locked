/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChunkInfoHeader } from './ChunkInfoHeader';

afterEach(cleanup);

describe('ChunkInfoHeader', () => {
  it('shows location state and exposes close and mode controls', async () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    render(
      <ChunkInfoHeader
        title="Varrock West"
        meta={<>chunk (50, 53) · Misthalin</>}
        unlocked
        showModeSwitch
        mode="chunk"
        onModeChange={onModeChange}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Varrock West' })).toBeTruthy();
    expect(screen.getByText('Unlocked')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close chunk info' }));
    expect(onModeChange).toHaveBeenCalledWith('region');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
