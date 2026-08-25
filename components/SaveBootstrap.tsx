import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameState } from '../types';
import { createFreshState } from '../context/GameContext';
import {
  getPendingSave,
  type PendingSaveEntry,
} from '../utils/pendingSaves';
import { profileMirrorMetadataKey } from '../utils/storageRecovery';
import {
  openRecoveryDatabase,
} from '../utils/recoveryDatabase';
import type {
  RecoveryRepository,
} from '../utils/recoveryTypes';
import {
  resolveSaveRecovery,
  type SaveRecoveryDecision,
  type SaveRecoveryInput,
} from '../utils/saveRecovery';

export interface SaveBootstrapResult {
  initialState: GameState;
  initialData: string | null;
  persistenceRevision: number;
  source: 'empty' | 'pending' | 'mirror' | 'journal' | 'recovery';
  needsJournalImport: boolean;
}

export interface SaveBootstrapDependencies {
  createFreshState: () => GameState;
  readPending: (storageKey: string) => string | null;
  readPrimary: (storageKey: string) => string | null;
  readMirrorMetadata: (storageKey: string) => string | null;
  openRepository: (profileId: string) => RecoveryRepository | PromiseLike<RecoveryRepository>;
  resolveSaveRecovery: (
    input: SaveRecoveryInput,
  ) => SaveRecoveryDecision | PromiseLike<SaveRecoveryDecision>;
}

type ReadyDecision = Extract<SaveRecoveryDecision, { kind: 'ready' }>;

const unavailableRecoveryRepository: RecoveryRepository = {
  getHead: async () => null,
  putHead: async () => ({ stored: false, reason: 'storage_unavailable' }),
  listCheckpoints: async () => [],
  putCheckpoint: async () => ({ stored: false, reason: 'storage_unavailable' }),
  deleteCheckpoints: async () => ({ stored: false, reason: 'storage_unavailable' }),
  getMetadata: async () => null,
  putMetadata: async () => ({ stored: false, reason: 'storage_unavailable' }),
  close: () => undefined,
};

const readStorage = (key: string): string | null => {
  return window.localStorage.getItem(key);
};

const pendingData = (entry: PendingSaveEntry | null): string | null => entry?.data ?? null;

const openProductionRepository = async (): Promise<RecoveryRepository> => {
  if (typeof indexedDB === 'undefined') return unavailableRecoveryRepository;
  try {
    return await openRecoveryDatabase();
  } catch {
    throw new Error('Recovery storage could not be opened.');
  }
};

export const productionSaveBootstrapDependencies: SaveBootstrapDependencies = {
  createFreshState,
  readPending: storageKey => pendingData(getPendingSave(storageKey)),
  readPrimary: storageKey => readStorage(storageKey),
  readMirrorMetadata: storageKey => readStorage(profileMirrorMetadataKey(storageKey)),
  openRepository: _profileId => openProductionRepository(),
  resolveSaveRecovery,
};

/** Alias kept deliberately descriptive for callers that construct a boundary explicitly. */
export const defaultSaveBootstrapDependencies = productionSaveBootstrapDependencies;

export const createSaveBootstrapDependencies = (
  overrides: Partial<SaveBootstrapDependencies> = {},
): SaveBootstrapDependencies => ({
  ...productionSaveBootstrapDependencies,
  ...overrides,
});

const decisionResult = (
  decision: SaveRecoveryDecision,
  makeFreshState: () => GameState,
): SaveBootstrapResult | null => {
  if (decision.kind === 'empty') {
    return {
      initialState: makeFreshState(),
      initialData: null,
      persistenceRevision: 0,
      source: 'empty',
      needsJournalImport: false,
    };
  }
  if (decision.kind !== 'ready') return null;
  return {
    initialState: decision.state,
    initialData: decision.data,
    persistenceRevision: decision.persistenceRevision,
    source: decision.source,
    needsJournalImport: decision.needsJournalImport,
  };
};

export const saveBootstrapResultFromDecision = (
  decision: SaveRecoveryDecision,
  makeFreshState: () => GameState = createFreshState,
): SaveBootstrapResult | null => decisionResult(decision, makeFreshState);

type BootstrapView =
  | { identity: string; phase: 'loading' }
  | { identity: string; phase: 'ready'; result: SaveBootstrapResult }
  | { identity: string; phase: 'blocked'; decision: Exclude<SaveRecoveryDecision, ReadyDecision | { kind: 'empty' }> }
  | { identity: string; phase: 'error' };

export interface SaveBootstrapProps {
  profileId: string;
  storageKey: string;
  dependencies?: SaveBootstrapDependencies;
  children: (result: SaveBootstrapResult) => ReactNode;
}

const decisionMessage = (
  decision: Exclude<SaveRecoveryDecision, ReadyDecision | { kind: 'empty' }>,
): string => decision.kind === 'unsupported'
  ? 'A newer save format needs review before the game can open.'
  : 'Saved progress needs review before the game can open.';

/**
 * Resolves all durable save candidates before rendering the GameProvider.
 * The request token and repository close guard make profile changes and
 * unmounts safe even when IndexedDB or arbitration completes later.
 */
export const SaveBootstrap: React.FC<SaveBootstrapProps> = ({
  profileId,
  storageKey,
  dependencies = defaultSaveBootstrapDependencies,
  children,
}) => {
  const identity = `${profileId}\u0000${storageKey}`;
  const requestRef = useRef(0);
  const [view, setView] = useState<BootstrapView>({ identity, phase: 'loading' });
  const activeView = view.identity === identity ? view : { identity, phase: 'loading' as const };

  useEffect(() => {
    const request = ++requestRef.current;
    let cancelled = false;
    let repository: RecoveryRepository | null = null;
    let closed = false;
    const closeRepository = () => {
      if (closed || repository === null) return;
      closed = true;
      try {
        repository.close();
      } catch {
        // Closing an already-aborted IDB connection is harmless for startup.
      }
    };
    const isCurrent = () => !cancelled && requestRef.current === request;

    setView({ identity, phase: 'loading' });

    const load = async () => {
      try {
        const defaults = dependencies.createFreshState();
        const input: Omit<SaveRecoveryInput, 'head' | 'checkpoints'> = {
          profileId,
          pendingRaw: dependencies.readPending(storageKey),
          primaryRaw: dependencies.readPrimary(storageKey),
          mirrorMetadataRaw: dependencies.readMirrorMetadata(storageKey),
          defaults,
        };

        repository = await dependencies.openRepository(profileId);
        if (!isCurrent()) {
          closeRepository();
          return;
        }
        const [head, checkpoints] = await Promise.all([
          repository.getHead(profileId),
          repository.listCheckpoints(profileId),
        ]);
        const decision = await dependencies.resolveSaveRecovery({
          ...input,
          head,
          checkpoints,
        });
        const result = decisionResult(decision, dependencies.createFreshState);
        closeRepository();
        if (!isCurrent()) return;
        if (result !== null) {
          setView({ identity, phase: 'ready', result });
        } else if (decision.kind === 'recovery_required' || decision.kind === 'unsupported') {
          setView({ identity, phase: 'blocked', decision });
        }
      } catch {
        closeRepository();
        if (!isCurrent()) return;
        setView({ identity, phase: 'error' });
      } finally {
        closeRepository();
      }
    };

    void load();
    return () => {
      cancelled = true;
      requestRef.current += 1;
      closeRepository();
    };
  }, [dependencies, identity, profileId, storageKey]);

  if (activeView.phase === 'loading') {
    return <div role="status">Checking saved progress…</div>;
  }
  if (activeView.phase === 'blocked') {
    return (
      <div role="status" aria-live="polite">
        <p>{decisionMessage(activeView.decision)}</p>
        <p>The game remains closed until this save decision is resolved.</p>
      </div>
    );
  }
  if (activeView.phase === 'error') {
    return (
      <div role="status" aria-live="polite">
        <p>Unable to check saved progress.</p>
        <p>The game remains closed until saved progress can be checked.</p>
      </div>
    );
  }
  return <>{children(activeView.result)}</>;
};
