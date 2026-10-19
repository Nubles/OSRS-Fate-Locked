// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureChain } from '../utils/integrity';
import type { LogEntry } from '../types';
import { TimelapseModal } from './TimelapseModal';
import { UI_STYLE_KEY } from '../utils/uiStyle';

// The run's saved counters, as a fresh run holds them.
const SAVED = { keys: 3, specialKeys: 0, chaosKeys: 0, fatePoints: 0 };
const mode = vi.hoisted(() => ({ current: { gameModeId: 'vanilla', customMode: undefined as unknown } as Record<string, unknown> }));
vi.mock('../context/GameContext', () => ({
  useGame: () => mode.current,
}));
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => undefined }));

afterEach(() => {
  cleanup();
  mode.current = { gameModeId: 'vanilla', customMode: undefined, ...SAVED };
});

const legacyRitual: LogEntry = {
  id: 'old-ritual', timestamp: Date.parse('2026-06-01T00:00:00Z'), type: 'ALTAR', message: 'Ritual of Clarity',
};

describe('TimelapseModal integrity banner', () => {
  it('shows a replay warning, not an edited run, for a legacy ritual without a recorded cost', () => {
    mode.current = { gameModeId: 'vanilla', customMode: undefined, ...SAVED };
    render(<TimelapseModal history={ensureChain([legacyRitual])} onClose={vi.fn()} />);

    expect(screen.getByText(/HISTORY DOESN'T ADD UP: 1 problem$/)).toBeTruthy();
    expect(screen.getByText(/didn't record its price, so Fate is an estimate/)).toBeTruthy();
    expect(screen.queryByText(/HISTORY EDITED/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Close timelapse' })).toBeTruthy();
  });

  it('still reports a tampered hash chain as edited', () => {
    mode.current = { gameModeId: 'vanilla', customMode: undefined, ...SAVED };
    const [entry] = ensureChain([{ ...legacyRitual, message: 'Ritual of Greed' }]);
    render(<TimelapseModal history={[{ ...entry, message: 'Edited after the fact' }]} onClose={vi.fn()} />);

    expect(screen.getByText(/HISTORY EDITED/)).toBeTruthy();
  });

  it('exports a run bundle without claiming to sign or verify it', () => {
    mode.current = { gameModeId: 'vanilla', customMode: undefined, ...SAVED };
    render(<TimelapseModal history={ensureChain([legacyRitual])} onClose={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Export run bundle' });
    expect(button.getAttribute('title')).toMatch(/Nothing is signed/);
    expect(document.body.textContent).not.toMatch(/Signing|Verified|INTEGRITY: OK/);
  });
});

describe('TimelapseModal replay under the run mode', () => {
  it("does not warn about Fate a pity-off run legitimately holds", () => {
    // Legacy Hardcore has no pity: 30 failures at +2 reach 60 Fate.
    mode.current = { gameModeId: 'hardcore', customMode: undefined, ...SAVED, fatePoints: 60 };
    const history = ensureChain(Array.from({ length: 30 }, (_, index): LogEntry => ({
      id: `hardcore-fail-${index}`, timestamp: index + 1, type: 'ROLL_FAIL', message: 'No Key.',
      meta: { fatePointsEarned: 2 },
    })));
    render(<TimelapseModal history={history} onClose={vi.fn()} />);

    expect(screen.getByText('HISTORY INTACT (SELF-REPORTED)')).toBeTruthy();
    expect(screen.queryByText(/HISTORY DOESN'T ADD UP/)).toBeNull();
  });
});

describe('TimelapseModal in the OSRS layout', () => {
  afterEach(() => localStorage.removeItem(UI_STYLE_KEY));

  it('draws a stone window with the event on parchment and colours only the outcome word', () => {
    localStorage.setItem(UI_STYLE_KEY, 'osrs');
    mode.current = { gameModeId: 'vanilla', customMode: undefined, ...SAVED };
    const history = ensureChain([
      { id: 'a', timestamp: 1, type: 'ROLL_SUCCESS', message: 'Key Found!' },
      { id: 'b', timestamp: 2, type: 'ROLL_FAIL', message: 'No Key.' },
    ]);
    const onClose = vi.fn();
    render(<TimelapseModal history={history} onClose={onClose} />);
    expect(screen.getByRole('heading', { name: 'Timelapse' })).toBeTruthy();
    expect(screen.getByText('HISTORY INTACT (SELF-REPORTED)')).toBeTruthy();
    const outcome = screen.getByText('NO KEY');
    expect(outcome.className).toContain('owb-tl-outcome');
    expect(outcome.dataset.tone).toBe('bad');
    expect(document.querySelector('.owb-tl-event')).toBeTruthy();
    screen.getByRole('button', { name: 'Close timelapse' }).click();
    expect(onClose).toHaveBeenCalled();
  });
});
