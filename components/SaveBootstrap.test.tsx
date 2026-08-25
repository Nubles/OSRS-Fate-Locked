// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import type { RecoveryRepository } from '../utils/recoveryTypes';
import type { SaveRecoveryDecision } from '../utils/saveRecovery';
import {
  SaveBootstrap,
  type SaveBootstrapDependencies,
  type SaveBootstrapResult,
} from './SaveBootstrap';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const repository = (): RecoveryRepository => ({
  getHead: vi.fn(async () => null),
  putHead: vi.fn(async () => ({ stored: true as const })),
  listCheckpoints: vi.fn(async () => []),
  putCheckpoint: vi.fn(async () => ({ stored: true as const })),
  deleteCheckpoints: vi.fn(async () => ({ stored: true as const })),
  getMetadata: vi.fn(async () => null),
  putMetadata: vi.fn(async () => ({ stored: true as const })),
  close: vi.fn(),
});

const readyDecision = (
  source: 'pending' | 'mirror' | 'journal',
  overrides: Partial<Extract<SaveRecoveryDecision, { kind: 'ready' }>> = {},
): Extract<SaveRecoveryDecision, { kind: 'ready' }> => ({
  kind: 'ready',
  source,
  reason: source === 'journal' ? 'interrupted_mirror' : 'normal',
  data: JSON.stringify({ ...initialState, userNotes: { source } }),
  state: { ...initialState, userNotes: { source } },
  persistenceRevision: source === 'journal' ? 8 : source === 'mirror' ? 7 : 0,
  needsJournalImport: source === 'journal',
  ...overrides,
});

const dependencies = (
  overrides: Partial<SaveBootstrapDependencies> = {},
): SaveBootstrapDependencies => {
  const repo = repository();
  return {
    createFreshState: () => ({ ...initialState }),
    readPending: () => null,
    readPrimary: () => null,
    readMirrorMetadata: () => null,
    openRepository: vi.fn(async () => repo),
    resolveSaveRecovery: vi.fn(async () => ({ kind: 'empty' as const })),
    ...overrides,
  };
};

const resultLabel = (result: SaveBootstrapResult): string => (
  `${result.source}:${result.persistenceRevision}:${result.initialData ?? 'none'}`
);

afterEach(() => cleanup());

describe('SaveBootstrap', () => {
  it('does not mount the game while durable candidates are unresolved', async () => {
    const arbitration = deferred<SaveRecoveryDecision>();
    render(
      <SaveBootstrap
        dependencies={dependencies({ resolveSaveRecovery: vi.fn(() => arbitration.promise) })}
        profileId="alpha"
        storageKey="FATE_PROFILE_alpha"
      >
        {() => <div>game mounted</div>}
      </SaveBootstrap>,
    );

    expect(screen.queryByText('game mounted')).toBeNull();
    expect(screen.getByText('Checking saved progress…')).toBeTruthy();

    await act(async () => {
      arbitration.resolve(readyDecision('mirror'));
      await arbitration.promise;
    });
  });

  it.each([
    ['pending', readyDecision('pending')],
    ['mirror', readyDecision('mirror')],
    ['journal', readyDecision('journal')],
  ] as const)('mounts from the arbitrated %s candidate', async (_source, decision) => {
    const resolveSaveRecovery = vi.fn(async () => decision);
    render(
      <SaveBootstrap dependencies={dependencies({ resolveSaveRecovery })} profileId="alpha" storageKey="FATE_PROFILE_alpha">
        {result => <div data-testid="bootstrap-result">{resultLabel(result)}</div>}
      </SaveBootstrap>,
    );

    expect((await screen.findByTestId('bootstrap-result')).textContent).toBe(
      `${decision.source}:${decision.persistenceRevision}:${decision.data}`,
    );
    expect(resolveSaveRecovery).toHaveBeenCalledOnce();
  });

  it('mounts a fresh state for an empty profile without a durable baseline', async () => {
    const fresh = { ...initialState, runId: 'fresh-run' };
    render(
      <SaveBootstrap
        dependencies={dependencies({ createFreshState: () => fresh })}
        profileId="alpha"
        storageKey="FATE_PROFILE_alpha"
      >
        {result => <div data-testid="bootstrap-result">{resultLabel(result)}:{result.initialState.runId}</div>}
      </SaveBootstrap>,
    );

    expect((await screen.findByTestId('bootstrap-result')).textContent).toBe('empty:0:none:fresh-run');
  });

  it.each([
    ['recovery', { kind: 'recovery_required', primaryRaw: '{bad', candidates: [], cause: 'corrupt_primary' }],
    ['unsupported', { kind: 'unsupported', rawCandidates: ['{"version":999}'] }],
  ] as const)('does not mount the game for a %s decision', async (_label, decision) => {
    render(
      <SaveBootstrap
        dependencies={dependencies({ resolveSaveRecovery: vi.fn(async () => decision) })}
        profileId="alpha"
        storageKey="FATE_PROFILE_alpha"
      >
        {() => <div>game mounted</div>}
      </SaveBootstrap>,
    );

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.queryByText('game mounted')).toBeNull();
  });

  it('cancels the previous profile bootstrap and ignores its late result', async () => {
    const first = deferred<SaveRecoveryDecision>();
    const second = deferred<SaveRecoveryDecision>();
    const firstRepository = repository();
    const secondRepository = repository();
    let request = 0;
    let opened = 0;
    const resolveSaveRecovery = vi.fn(() => {
      request += 1;
      return request === 1 ? first.promise : second.promise;
    });
    const deps = dependencies({
      openRepository: vi.fn(async () => {
        opened += 1;
        return opened === 1 ? firstRepository : secondRepository;
      }),
      resolveSaveRecovery,
    });
    const view = render(
      <ProfileHarness dependencies={deps} />,
    );

    expect(screen.getByText('Checking saved progress…')).toBeTruthy();
    await act(async () => {
      view.rerender(<ProfileHarness dependencies={deps} profileId="beta" />);
    });
    first.resolve(readyDecision('mirror', { data: 'stale', state: { ...initialState, runId: 'stale' } }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText(/stale/)).toBeNull();
    expect((firstRepository.close as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);

    await act(async () => {
      second.resolve(readyDecision('journal'));
      await second.promise;
    });
    expect((await screen.findByTestId('profile-result')).textContent).toContain('journal');
    expect((secondRepository.close as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('swallows a rejected stale promise after the profile changes', async () => {
    const first = deferred<SaveRecoveryDecision>();
    const second = deferred<SaveRecoveryDecision>();
    let request = 0;
    const resolveSaveRecovery = vi.fn(() => {
      request += 1;
      return request === 1 ? first.promise : second.promise;
    });
    const view = render(
      <ProfileHarness dependencies={dependencies({ resolveSaveRecovery })} />,
    );

    await act(async () => {
      view.rerender(<ProfileHarness dependencies={dependencies({ resolveSaveRecovery })} profileId="beta" />);
      first.reject(new Error('stale profile failure'));
      second.resolve(readyDecision('pending'));
      await Promise.allSettled([first.promise, second.promise]);
    });

    expect((await screen.findByTestId('profile-result')).textContent).toContain('pending');
    expect(screen.queryByText('stale profile failure')).toBeNull();
  });
});

const ProfileHarness = ({
  dependencies,
  profileId = 'alpha',
}: {
  dependencies: SaveBootstrapDependencies;
  profileId?: string;
}) => {
  return (
    <SaveBootstrap profileId={profileId} storageKey={`FATE_PROFILE_${profileId}`} dependencies={dependencies}>
      {result => <div data-testid="profile-result">{resultLabel(result)}</div>}
    </SaveBootstrap>
  );
};
