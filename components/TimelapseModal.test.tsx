// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureChain } from '../utils/integrity';
import type { LogEntry } from '../types';
import { TimelapseModal } from './TimelapseModal';

vi.mock('../context/GameContext', () => ({
  useGame: () => ({ gameModeId: 'vanilla', customMode: undefined }),
}));
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => undefined }));

afterEach(() => cleanup());

const legacyRitual: LogEntry = {
  id: 'old-ritual', timestamp: Date.parse('2026-06-01T00:00:00Z'), type: 'ALTAR', message: 'Ritual of Clarity',
};

describe('TimelapseModal integrity banner', () => {
  it('shows a replay warning, not a broken run, for a legacy ritual without a recorded cost', () => {
    render(<TimelapseModal history={ensureChain([legacyRitual])} onClose={vi.fn()} />);

    expect(screen.getByText(/REPLAY WARNING — 1 note/)).toBeTruthy();
    expect(screen.queryByText(/INTEGRITY: BROKEN/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Close timelapse' })).toBeTruthy();
  });

  it('still reports a tampered hash chain as broken', () => {
    const [entry] = ensureChain([{ ...legacyRitual, message: 'Ritual of Greed' }]);
    render(<TimelapseModal history={[{ ...entry, message: 'Edited after the fact' }]} onClose={vi.fn()} />);

    expect(screen.getByText(/INTEGRITY: BROKEN/)).toBeTruthy();
  });
});
