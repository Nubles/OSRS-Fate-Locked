// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import type { RecoveryRepository } from '../utils/recoveryTypes';
import type { SaveRecoveryDecision } from '../utils/saveRecovery';
import { resolveSaveRecovery } from '../utils/saveRecovery';
import { checksumSave } from '../utils/saveIntegrity';
import {
  SaveBootstrap,
  productionResetRecovery,
  productionExportRecovery,
  type SaveBootstrapDependencies,
  type SaveBootstrapResult,
} from './SaveBootstrap';
import { MAX_SAVE_BYTES } from '../utils/saveSchema';

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
  const leaseValues = new Map<string, string>();
  return {
    leaseOptions: {
      ownerId: 'save-bootstrap-test-owner',
      arbitrationMs: 0,
      renewMs: 60_000,
      storage: {
        getItem: key => leaseValues.get(key) ?? null,
        setItem: (key, value) => { leaseValues.set(key, value); },
        removeItem: key => { leaseValues.delete(key); },
      },
    },
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

  it('closes a repository that opens after unmount without starting stale reads', async () => {
    const opening = deferred<RecoveryRepository>();
    const opened = repository();
    const resolveSaveRecovery = vi.fn(async () => ({ kind: 'empty' as const }));
    const deps = dependencies({
      openRepository: vi.fn(() => opening.promise),
      resolveSaveRecovery,
    });
    const view = render(
      <SaveBootstrap dependencies={deps} profileId="alpha" storageKey="FATE_PROFILE_alpha">
        {() => <div>game mounted</div>}
      </SaveBootstrap>,
    );

    view.unmount();
    await act(async () => {
      opening.resolve(opened);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect((opened.close as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(opened.getHead).not.toHaveBeenCalled();
    expect(opened.listCheckpoints).not.toHaveBeenCalled();
    expect(resolveSaveRecovery).not.toHaveBeenCalled();
  });

  it('closes a stale delayed-open repository before a profile switch can read it', async () => {
    const firstOpening = deferred<RecoveryRepository>();
    const secondOpening = deferred<RecoveryRepository>();
    const firstRepository = repository();
    const secondRepository = repository();
    let openCount = 0;
    const resolveSaveRecovery = vi.fn(async () => readyDecision('mirror'));
    const deps = dependencies({
      openRepository: vi.fn(() => {
        openCount += 1;
        return openCount === 1 ? firstOpening.promise : secondOpening.promise;
      }),
      resolveSaveRecovery,
    });
    const view = render(<ProfileHarness dependencies={deps} />);

    await act(async () => {
      view.rerender(<ProfileHarness dependencies={deps} profileId="beta" />);
    });
    await act(async () => {
      firstOpening.resolve(firstRepository);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect((firstRepository.close as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(firstRepository.getHead).not.toHaveBeenCalled();
    expect(firstRepository.listCheckpoints).not.toHaveBeenCalled();
    expect(resolveSaveRecovery).not.toHaveBeenCalled();

    await act(async () => {
      secondOpening.resolve(secondRepository);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(await screen.findByTestId('profile-result')).toBeTruthy();
    expect((secondRepository.close as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
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

  it('renders blocking recovery actions without replacing the save before confirmation', async () => {
    const archiveCorruptEvidence = vi.fn(async () => ({ ok: true as const }));
    const replaceSave = vi.fn(async () => ({ ok: true as const }));
    const decision: Extract<SaveRecoveryDecision, { kind: 'recovery_required' }> = {
      kind: 'recovery_required',
      primaryRaw: '{"broken":true}',
      candidates: [{
        source: 'checkpoint',
        data: 'safe-checkpoint',
        state: { ...initialState, runId: 'safe-run' },
        persistenceRevision: 3,
        runId: 'safe-run',
        runRevision: 3,
        capturedAt: 123,
        checksum: 'a'.repeat(64),
      }],
      cause: 'corrupt_primary',
    };
    const deps = dependencies({
      resolveSaveRecovery: vi.fn(async () => decision),
      archiveCorruptEvidence,
      replaceSave,
    });
    const user = userEvent.setup();

    render(
      <SaveBootstrap dependencies={deps} profileId="alpha" storageKey="FATE_PROFILE_alpha">
        {() => <div>game mounted</div>}
      </SaveBootstrap>,
    );

    expect(await screen.findByRole('heading', { name: 'Saved progress needs recovery' })).toBeTruthy();
    expect(replaceSave).not.toHaveBeenCalled();
    expect(screen.queryByText('game mounted')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Recover latest safe save' }));

    expect(archiveCorruptEvidence).toHaveBeenCalledOnce();
    expect(replaceSave).toHaveBeenCalledOnce();
  });

  it('keeps the blocking screen when archival fails', async () => {
    const archiveCorruptEvidence = vi.fn(async () => ({
      ok: false as const,
      message: 'Corrupt save evidence could not be archived.',
    }));
    const replaceSave = vi.fn(async () => ({ ok: true as const }));
    const decision: Extract<SaveRecoveryDecision, { kind: 'recovery_required' }> = {
      kind: 'recovery_required',
      primaryRaw: '{"broken":true}',
      candidates: [],
      cause: 'corrupt_primary',
    };
    const deps = dependencies({
      resolveSaveRecovery: vi.fn(async () => decision),
      archiveCorruptEvidence,
      replaceSave,
    });
    const user = userEvent.setup();

    render(
      <SaveBootstrap dependencies={deps} profileId="alpha" storageKey="FATE_PROFILE_alpha">
        {() => <div>game mounted</div>}
      </SaveBootstrap>,
    );

    expect(await screen.findByRole('heading', { name: 'Saved progress needs recovery' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Start a new run' }));
    await user.click(screen.getByRole('button', { name: 'Confirm start a new run' }));

    expect(archiveCorruptEvidence).toHaveBeenCalledOnce();
    expect(replaceSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('could not be archived');
    expect(screen.queryByText('game mounted')).toBeNull();
  });

  it('does not download an export after the bootstrap request becomes stale', async () => {
    const decision: Extract<SaveRecoveryDecision, { kind: 'unsupported' }> = {
      kind: 'unsupported',
      rawCandidates: ['{"version":999,"future":true}'],
    };
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    let current = true;
    const result = await productionExportRecovery('FATE_PROFILE_alpha', decision, {
      isCurrentRequest: () => current,
      buildArchive: async () => {
        current = false;
        return {
          version: 1 as const,
          capturedAt: 1,
          primary: null,
          mirrorMetadata: null,
        };
      },
    });

    expect(result).toEqual({ ok: false, message: 'This profile is no longer active.' });
    expect(download).not.toHaveBeenCalled();
    download.mockRestore();
  });

  it('keeps future-version evidence in a bounded exported Blob', async () => {
    const blobs: Blob[] = [];
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:recovery-test';
    });
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const futureEvidence = '{"version":999,"future":"keep this evidence"}';
    const result = await productionExportRecovery('FATE_PROFILE_alpha', {
      kind: 'unsupported',
      rawCandidates: [futureEvidence, 'x'.repeat(MAX_SAVE_BYTES * 2)],
    });

    expect(result).toEqual({ ok: true });
    expect(blobs).toHaveLength(1);
    const text = await blobs[0].text();
    expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(MAX_SAVE_BYTES);
    const payload = JSON.parse(text) as { rawCandidates?: string[] };
    expect(payload.rawCandidates).toContain(futureEvidence);
    expect(download).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledOnce();
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
    download.mockRestore();
  });

  it('resets the conflicting recovery journal before confirming a fresh run', async () => {
    const archiveCorruptEvidence = vi.fn(async () => ({ ok: true as const }));
    let journalConflicting = true;
    const resetRecovery = vi.fn(async () => {
      journalConflicting = false;
      return { ok: true as const };
    });
    const replaceSave = vi.fn(async () => ({ ok: true as const }));
    const decision: Extract<SaveRecoveryDecision, { kind: 'recovery_required' }> = {
      kind: 'recovery_required',
      primaryRaw: '{"broken":true}',
      candidates: [],
      cause: 'conflicting_runs',
    };
    const deps = dependencies({
      resolveSaveRecovery: vi.fn(async () => journalConflicting ? decision : { kind: 'empty' as const }),
      archiveCorruptEvidence,
      resetRecovery,
      replaceSave,
    });
    const user = userEvent.setup();

    render(
      <SaveBootstrap dependencies={deps} profileId="alpha" storageKey="FATE_PROFILE_alpha">
        {() => <div>game mounted</div>}
      </SaveBootstrap>,
    );

    await user.click(await screen.findByRole('button', { name: 'Start a new run' }));
    await user.click(screen.getByRole('button', { name: 'Confirm start a new run' }));

    expect(resetRecovery).toHaveBeenCalledOnce();
    expect(replaceSave).toHaveBeenCalledOnce();
    expect(resetRecovery.mock.invocationCallOrder[0]).toBeLessThan(replaceSave.mock.invocationCallOrder[0]);
    expect(await screen.findByText('game mounted')).toBeTruthy();

    const firstMount = screen.getByText('game mounted');
    expect(firstMount).toBeTruthy();
    cleanup();
    render(
      <SaveBootstrap dependencies={deps} profileId="alpha" storageKey="FATE_PROFILE_alpha">
        {() => <div>game mounted</div>}
      </SaveBootstrap>,
    );
    expect(await screen.findByText('game mounted')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Saved progress needs recovery' })).toBeNull();
  });

  it('writes a fresh journal head and removes old checkpoints so reload resolves cleanly', async () => {
    const freshState = { ...initialState, runId: '00000000-0000-4000-8000-000000000001' };
    const freshData = JSON.stringify(freshState);
    const freshChecksum = await checksumSave(freshData);
    let head = {
      profileId: 'alpha',
      persistenceRevision: 4,
      runId: 'old-run',
      runRevision: 4,
      capturedAt: 10,
      checksum: 'b'.repeat(64),
      data: '{"old":true}',
    };
    let checkpoints = [{
      ...head,
      reason: 'interval' as const,
    }];
    const journal = repository();
    journal.getHead = vi.fn(async () => head);
    journal.listCheckpoints = vi.fn(async () => checkpoints);
    journal.putHead = vi.fn(async record => {
      head = record;
      return { stored: true as const };
    });
    journal.deleteCheckpoints = vi.fn(async (_profileId, revisions) => {
      checkpoints = checkpoints.filter(checkpoint => !revisions.includes(checkpoint.persistenceRevision));
      return { stored: true as const };
    });

    const reset = await productionResetRecovery(
      {
        profileId: 'alpha',
        storageKey: 'FATE_PROFILE_alpha',
        data: freshData,
        state: freshState,
        persistenceRevision: 0,
        capturedAt: null,
        checksum: freshChecksum,
      },
      () => ({ ok: true as const }),
      { openRepository: async () => journal, now: () => 100 },
    );

    expect(reset).toEqual({ ok: true });
    expect(head.runId).toBe('00000000-0000-4000-8000-000000000001');
    expect(head.persistenceRevision).toBe(5);
    expect(checkpoints).toEqual([]);
    const reloadDecision = await resolveSaveRecovery({
      profileId: 'alpha',
      pendingRaw: null,
      primaryRaw: freshData,
      mirrorMetadataRaw: JSON.stringify({
        version: 1,
        persistenceRevision: head.persistenceRevision,
        capturedAt: head.capturedAt,
        checksum: freshChecksum,
      }),
      defaults: initialState,
      head,
      checkpoints,
    });
    expect(reloadDecision.kind).toBe('ready');
    expect(reloadDecision.kind === 'ready' ? reloadDecision.state.runId : null).toBe('00000000-0000-4000-8000-000000000001');
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
