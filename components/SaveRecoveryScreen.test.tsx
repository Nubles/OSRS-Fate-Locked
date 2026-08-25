// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import type { ValidatedRecoveryCandidate, SaveRecoveryDecision } from '../utils/saveRecovery';
import { SaveRecoveryScreen } from './SaveRecoveryScreen';

afterEach(cleanup);

const candidate = (
  persistenceRevision: number,
  overrides: Partial<ValidatedRecoveryCandidate> = {},
): ValidatedRecoveryCandidate => ({
  source: 'checkpoint',
  data: JSON.stringify({ ...initialState, runId: `run-${persistenceRevision}` }),
  state: {
    ...initialState,
    runId: `run-${persistenceRevision}`,
    runRevision: persistenceRevision,
    keys: persistenceRevision + 3,
    unlocks: {
      ...initialState.unlocks,
      regions: ['Lumbridge', 'Varrock'].slice(0, persistenceRevision > 1 ? 2 : 1),
    },
    history: Array.from({ length: persistenceRevision }, (_, index) => ({
      id: `event-${index}`,
      timestamp: index + 1,
      type: 'UNLOCK' as const,
      source: 'test',
      result: 'SUCCESS' as const,
      message: 'checkpoint event',
      prevHash: null,
      hash: null,
    })),
  },
  persistenceRevision,
  runId: `run-${persistenceRevision}`,
  runRevision: persistenceRevision,
  capturedAt: 1_700_000_000_000 + persistenceRevision,
  checksum: 'a'.repeat(64),
  ...overrides,
});

const corruptDecision = (
  overrides: Partial<Extract<SaveRecoveryDecision, { kind: 'recovery_required' }>> = {},
): Extract<SaveRecoveryDecision, { kind: 'recovery_required' }> => ({
  kind: 'recovery_required',
  primaryRaw: '{"secret":"do-not-render"}',
  candidates: [candidate(4), candidate(2)],
  cause: 'corrupt_primary',
  ...overrides,
});

const actions = () => ({
  onRecover: vi.fn(),
  onStartFresh: vi.fn(),
  onExportRecovery: vi.fn().mockReturnValue({ ok: true as const }),
  archiveCorruptEvidence: vi.fn().mockResolvedValue({ ok: true as const }),
  writePrimary: vi.fn(),
});

describe('SaveRecoveryScreen', () => {
  it('offers recovery without mounting or writing the game', () => {
    const recover = vi.fn();
    const current = actions();
    render(
      <SaveRecoveryScreen
        decision={corruptDecision()}
        onRecover={recover}
        {...current}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Saved progress needs recovery' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Recover latest safe save' }) as HTMLButtonElement).disabled).toBe(false);
    expect(current.writePrimary).not.toHaveBeenCalled();
    expect(recover).not.toHaveBeenCalled();
  });

  it('requires destructive confirmation before starting fresh', async () => {
    const current = actions();
    const user = userEvent.setup();
    render(<SaveRecoveryScreen decision={corruptDecision()} {...current} />);

    await user.click(screen.getByRole('button', { name: 'Start a new run' }));

    expect(screen.getByText('This preserves no recoverable checkpoint as the active run.')).toBeTruthy();
    expect(current.onStartFresh).not.toHaveBeenCalled();
  });

  it('summarizes the newest checkpoint and lets the player select an older one', async () => {
    const current = actions();
    const user = userEvent.setup();
    render(<SaveRecoveryScreen decision={corruptDecision()} {...current} />);

    expect(screen.getByText('7 keys · 2 visible regions · 4 events')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Choose another checkpoint' }));
    const select = screen.getByRole('combobox', { name: 'Recovery checkpoint' });
    await user.selectOptions(select, '1');
    expect(screen.getByText('5 keys · 2 visible regions · 2 events')).toBeTruthy();
  });

  it('supports keyboard activation of the recovery action', async () => {
    const current = actions();
    const user = userEvent.setup();
    render(<SaveRecoveryScreen decision={corruptDecision()} {...current} />);

    const recover = screen.getByRole('button', { name: 'Recover latest safe save' });
    recover.focus();
    await user.keyboard('{Enter}');

    expect(current.archiveCorruptEvidence).toHaveBeenCalledOnce();
    expect(current.onRecover).toHaveBeenCalledOnce();
  });

  it('does not expose raw save bytes in the recovery surface', () => {
    const current = actions();
    render(
      <SaveRecoveryScreen
        decision={corruptDecision({
          primaryRaw: '{"secret":"primary-private-data"}',
          candidates: [candidate(3, { data: '{"secret":"checkpoint-private-data"}' })],
        })}
        {...current}
      />,
    );

    const text = screen.getByRole('main').textContent ?? '';
    expect(text).not.toContain('primary-private-data');
    expect(text).not.toContain('checkpoint-private-data');
  });

  it('shows a safe export error without replacing the blocked run', async () => {
    const current = actions();
    current.onExportRecovery.mockReturnValue({ ok: false as const, message: 'Recovery export failed.' });
    const user = userEvent.setup();
    render(<SaveRecoveryScreen decision={corruptDecision()} {...current} />);

    await user.click(screen.getByRole('button', { name: 'Export recovery file' }));

    expect(screen.getByRole('alert').textContent).toContain('Recovery export failed.');
    expect(current.onRecover).not.toHaveBeenCalled();
    expect(current.onStartFresh).not.toHaveBeenCalled();
  });

  it('blocks replacement when corrupt evidence cannot be archived', async () => {
    const current = actions();
    current.archiveCorruptEvidence.mockResolvedValue({
      ok: false as const,
      message: 'Recovery evidence could not be archived.',
    });
    const user = userEvent.setup();
    render(<SaveRecoveryScreen decision={corruptDecision()} {...current} />);

    await user.click(screen.getByRole('button', { name: 'Recover latest safe save' }));

    expect(screen.getByRole('alert').textContent).toContain('Recovery evidence could not be archived.');
    expect(current.onRecover).not.toHaveBeenCalled();
    expect(current.writePrimary).not.toHaveBeenCalled();
  });

  it('archives evidence before confirming a recovery replacement', async () => {
    const current = actions();
    const order: string[] = [];
    current.archiveCorruptEvidence.mockImplementation(async () => {
      order.push('archive');
      return { ok: true as const };
    });
    current.onRecover.mockImplementation(() => { order.push('recover'); });
    const user = userEvent.setup();
    render(<SaveRecoveryScreen decision={corruptDecision()} {...current} />);

    await user.click(screen.getByRole('button', { name: 'Recover latest safe save' }));

    expect(order).toEqual(['archive', 'recover']);
  });

  it('keeps recovery disabled when no valid checkpoint exists until fresh start is confirmed', async () => {
    const current = actions();
    const user = userEvent.setup();
    render(
      <SaveRecoveryScreen
        decision={corruptDecision({ candidates: [] })}
        {...current}
      />,
    );

    expect((screen.getByRole('button', { name: 'Recover latest safe save' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Start a new run' }));
    expect(current.onStartFresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm start a new run' }));
    expect(current.archiveCorruptEvidence).toHaveBeenCalledOnce();
    expect(current.onStartFresh).toHaveBeenCalledOnce();
  });

  it('keeps future-version saves read-only while allowing evidence export', async () => {
    const current = actions();
    const user = userEvent.setup();
    const decision: Extract<SaveRecoveryDecision, { kind: 'unsupported' }> = {
      kind: 'unsupported',
      rawCandidates: ['{"version":999,"secret":"future-private-data"}'],
    };
    render(<SaveRecoveryScreen decision={decision} {...current} />);

    expect(screen.getByRole('heading', { name: 'A newer save version needs review' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start a new run' })).toBeNull();
    expect(screen.queryByText('future-private-data')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Export recovery file' }));
    expect(current.onExportRecovery).toHaveBeenCalledOnce();
  });
});
