import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Profile, ProfileMetadata } from '../types';
import { parseAndMigrateSave } from '../utils/saveSchema';
import { profileBaseKey } from '../utils/profileStorage';
import { discardPendingSave } from '../utils/pendingSaves';
import {
  LEGACY_SAVE_KEY,
  PROFILE_METADATA_BACKUP_KEY,
  PROFILE_METADATA_LOCK_KEY,
  PROFILES_KEY,
  parseProfileMetadata,
  resolveProfileMetadata,
  sanitizeProfileName,
  type ProfileRecoveryNotice,
} from '../utils/profileMetadata';
import {
  initializeProfileMetadata,
  mutateProfileMetadata,
  profileMetadataLockRetryDelay,
  resumeProfileDeletion,
  type ProfileMutation,
  type ProfileMutationFailure,
  type ProfileTransactionDependencies,
  type ProfileTransactionResult,
} from '../utils/profileMetadataTransaction';
import type { ProfileDeletionCleanupFailureReason } from '../utils/recoveryTypes';
import { writerLeaseKey } from '../utils/profileWriterLease';
import { initialState } from './GameContext';
import { openRecoveryDatabase } from '../utils/recoveryDatabase';

export type ProfilePendingAction =
  | 'initializing'
  | 'create'
  | 'rename'
  | 'select'
  | 'delete'
  | null;
type ProfileStartupTerminalFailure = Extract<
  ProfileMutationFailure,
  'busy' | 'invalid_metadata' | 'unsupported_metadata'
>;

export interface ProfileContextType {
  profiles: Profile[];
  activeProfileId: string;
  activeProfileName: string;
  storageKeyForActiveProfile: string;
  pendingAction: ProfilePendingAction;
  mutationFailure: ProfileMutationFailure | null;
  recoveryNotice: ProfileRecoveryNotice | null;
  metadataReadOnly: boolean;
  pendingDeletionCount: number;
  retryProfileDeletionCleanup(): Promise<void>;
  createProfile(name: string): Promise<ProfileTransactionResult>;
  switchProfile(id: string): Promise<ProfileTransactionResult>;
  renameProfile(id: string, newName: string): Promise<ProfileTransactionResult>;
  deleteProfile(id: string): Promise<ProfileTransactionResult>;
  dismissRecoveryNotice(): void;
  recentlyCreatedId: string | null;
  clearRecentlyCreated(): void;
  registerProfileEvictionHandler(handler: (profileId: string) => void): () => void;
}

export class ProfileDeletionCleanupRetryError extends Error {
  readonly reason: ProfileDeletionCleanupFailureReason;

  constructor(reason: ProfileDeletionCleanupFailureReason) {
    super('Profile storage cleanup is still pending.');
    this.name = 'ProfileDeletionCleanupRetryError';
    this.reason = reason;
  }
}

type CleanupWorkerSummary = {
  pendingCount: number;
  reason: ProfileDeletionCleanupFailureReason | null;
};

type CleanupWaiter = {
  generation: number;
  resolve: (summary: CleanupWorkerSummary) => void;
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11);
};

let pageOwnerId: string | null = null;

const getPageOwnerId = (): string => {
  if (pageOwnerId === null) pageOwnerId = generateId();
  return pageOwnerId;
};

const unavailableStorage: ProfileTransactionDependencies['storage'] = {
  get length(): number { throw new DOMException('Storage is unavailable', 'SecurityError'); },
  key: () => { throw new DOMException('Storage is unavailable', 'SecurityError'); },
  getItem: () => { throw new DOMException('Storage is unavailable', 'SecurityError'); },
  setItem: () => { throw new DOMException('Storage is unavailable', 'SecurityError'); },
  removeItem: () => { throw new DOMException('Storage is unavailable', 'SecurityError'); },
};

const browserStorage = (): ProfileTransactionDependencies['storage'] => {
  try {
    return window.localStorage;
  } catch {
    return unavailableStorage;
  }
};

const createDependencies = (
  shouldAbort: () => boolean,
  onProfileDeletionCommitted: (metadata: ProfileMetadata) => void,
): ProfileTransactionDependencies => ({
  storage: browserStorage(),
  ownerId: getPageOwnerId(),
  now: Date.now,
  wait: milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds)),
  validateGameSave: raw => parseAndMigrateSave(raw, initialState).ok,
  createProfileId: generateId,
  onProfileDeletionCommitted,
  shouldAbort,
  ...(typeof indexedDB === 'undefined'
    ? {}
    : { openRecoveryRepository: () => openRecoveryDatabase() }),
});

const createMemoryStorage = (): ProfileTransactionDependencies['storage'] => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
};

const emptyNotice = (kind: ProfileRecoveryNotice['kind']): ProfileRecoveryNotice => ({
  kind,
  recoveredProfiles: 0,
  generatedNames: 0,
  unreadableSaves: 0,
  overflowSaves: 0,
  rollbackFailures: 0,
});

const initializeMemoryFallback = async (
  deps: ProfileTransactionDependencies,
): Promise<ProfileTransactionResult> => {
  const fallback = await initializeProfileMetadata({
    ...deps,
    storage: createMemoryStorage(),
    ownerId: deps.ownerId + '-memory',
  });
  if (fallback.metadata === null) return fallback;
  return {
    ok: false,
    reason: 'storage_unavailable',
    metadata: fallback.metadata,
    notice: emptyNotice('read_only'),
  };
};

const initializeWithStorageFallback = async (
  deps: ProfileTransactionDependencies,
): Promise<ProfileTransactionResult> => {
  try {
    const primary = deps.storage.getItem(PROFILES_KEY);
    const backup = deps.storage.getItem(PROFILE_METADATA_BACKUP_KEY);
    if (
      parseProfileMetadata(primary).status === 'unsupported'
      || parseProfileMetadata(backup).status === 'unsupported'
    ) {
      const resolution = resolveProfileMetadata({
        primary,
        backup,
        legacySave: deps.storage.getItem(LEGACY_SAVE_KEY),
        storage: deps.storage,
        now: deps.now(),
        validateGameSave: deps.validateGameSave,
        createProfileId: deps.createProfileId,
      });
      return failedResult(
        'unsupported_metadata',
        resolution.metadata,
        resolution.notice,
      );
    }
  } catch {
    // The normal initializer owns storage-unavailable fallback behavior.
  }
  const result = await initializeProfileMetadata(deps);
  if (
    result.metadata === null
    && result.ok === false
    && result.reason === 'storage_unavailable'
  ) return initializeMemoryFallback(deps);
  return result;
};

const failedResult = (
  reason: ProfileMutationFailure,
  metadata: ProfileMetadata | null,
  notice: ProfileRecoveryNotice | null,
): ProfileTransactionResult => ({
  ok: false,
  reason,
  metadata,
  notice,
});

const ProfileContext = createContext<ProfileContextType | null>(null);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const operationAbortedRef = useRef(false);
  const committedDeletionCallbackRef = useRef<(metadata: ProfileMetadata) => void>(() => undefined);
  const dependenciesRef = useRef<ProfileTransactionDependencies | null>(null);
  if (dependenciesRef.current === null) {
    dependenciesRef.current = createDependencies(
      () => operationAbortedRef.current,
      committed => committedDeletionCallbackRef.current(committed),
    );
  }
  const dependencies = dependenciesRef.current;

  const [metadata, setMetadata] = useState<ProfileMetadata | null>(null);
  const metadataRef = useRef<ProfileMetadata | null>(null);
  const [startupTerminalFailure, setStartupTerminalFailure] = useState<ProfileStartupTerminalFailure | null>(null);
  const startupTerminalFailureRef = useRef<ProfileStartupTerminalFailure | null>(null);
  const [pendingAction, setPendingAction] = useState<ProfilePendingAction>('initializing');
  const pendingActionRef = useRef<ProfilePendingAction>('initializing');
  const [mutationFailure, setMutationFailure] = useState<ProfileMutationFailure | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<ProfileRecoveryNotice | null>(null);
  const [metadataReadOnly, setMetadataReadOnly] = useState(false);
  const metadataReadOnlyRef = useRef(false);
  const readOnlyReasonRef = useRef<ProfileMutationFailure>('unsupported_metadata');
  const [recentlyCreatedId, setRecentlyCreatedId] = useState<string | null>(null);
  const evictionHandlerRef = useRef<((profileId: string) => void) | null>(null);
  const queuedEvictionIdsRef = useRef<string[]>([]);
  const mountedRef = useRef(false);
  const busyRereadArmedRef = useRef(false);
  const busyRereadTimerRef = useRef<number | null>(null);
  const busyRereadCallbackRef = useRef<() => void>(() => undefined);
  const cleanupRequestedGenerationRef = useRef(0);
  const cleanupProcessedGenerationRef = useRef(0);
  const cleanupWaitersRef = useRef<CleanupWaiter[]>([]);
  const cleanupWorkerRef = useRef<Promise<CleanupWorkerSummary> | null>(null);
  const cleanupRescheduleTimerRef = useRef<number | null>(null);
  const cleanupWorkerStarterRef = useRef<() => void>(() => undefined);

  const clearBusyRereadTimer = useCallback(() => {
    if (busyRereadTimerRef.current === null) return;
    window.clearTimeout(busyRereadTimerRef.current);
    busyRereadTimerRef.current = null;
  }, []);

  const scheduleStartupBusyReread = useCallback(() => {
    clearBusyRereadTimer();
    const delay = profileMetadataLockRetryDelay(dependencies);
    busyRereadTimerRef.current = window.setTimeout(() => {
      busyRereadTimerRef.current = null;
      busyRereadCallbackRef.current();
    }, delay);
  }, [clearBusyRereadTimer, dependencies]);

  const setPending = useCallback((next: ProfilePendingAction) => {
    pendingActionRef.current = next;
    setPendingAction(next);
  }, []);

  const installMetadata = useCallback((next: ProfileMetadata): boolean => {
    const current = metadataRef.current;
    if (current !== null && next.revision < current.revision) return false;
    metadataRef.current = next;
    setMetadata(next);
    return true;
  }, []);

  const queueOrRunEviction = useCallback((profileId: string) => {
    const evictionHandler = evictionHandlerRef.current;
    if (evictionHandler !== null) {
      evictionHandler(profileId);
      return;
    }
    if (!queuedEvictionIdsRef.current.includes(profileId)) {
      queuedEvictionIdsRef.current.push(profileId);
    }
  }, []);

  committedDeletionCallbackRef.current = committed => {
    if (
      !mountedRef.current
      || startupTerminalFailureRef.current !== null
      || metadataReadOnlyRef.current
    ) return;
    const current = metadataRef.current;
    if (current === null || committed.revision < current.revision) return;
    const keepsLocalSelection = committed.profiles.some(
      profile => profile.id === current.activeProfileId,
    );
    if (!keepsLocalSelection) queueOrRunEviction(current.activeProfileId);
    const candidate = {
      ...committed,
      activeProfileId: keepsLocalSelection ? current.activeProfileId : committed.activeProfileId,
    };
    if (installMetadata(candidate)) {
      for (const intent of committed.deletions) {
        discardPendingSave(profileBaseKey(intent.profileId));
      }
    }
  };

  const enterStartupTerminal = useCallback((
    reason: ProfileStartupTerminalFailure,
    noticeKind: Extract<ProfileRecoveryNotice['kind'], 'read_only' | 'unsupported'>,
  ) => {
    startupTerminalFailureRef.current = reason;
    setStartupTerminalFailure(reason);
    busyRereadArmedRef.current = false;
    clearBusyRereadTimer();
    queuedEvictionIdsRef.current = [];
    metadataReadOnlyRef.current = true;
    readOnlyReasonRef.current = reason;
    setMetadataReadOnly(true);
    setMutationFailure(reason);
    setRecoveryNotice(emptyNotice(noticeKind));
    setPending(null);
  }, [clearBusyRereadTimer, setPending]);

  const applyInitializationResult = useCallback((result: ProfileTransactionResult) => {
    if (startupTerminalFailureRef.current !== null) return;
    if (operationAbortedRef.current && metadataRef.current !== null) {
      busyRereadArmedRef.current = false;
      clearBusyRereadTimer();
      return;
    }
    const current = metadataRef.current;
    if (result.metadata !== null && current !== null && result.metadata.revision < current.revision) return;
    if (result.metadata !== null) installMetadata(result.metadata);
    setRecoveryNotice(result.notice);
    if (result.ok === true) {
      metadataReadOnlyRef.current = false;
      setMetadataReadOnly(false);
      setMutationFailure(null);
      busyRereadArmedRef.current = false;
      clearBusyRereadTimer();
      return;
    }

    setMutationFailure(result.reason);
    const retryStartup = result.reason === 'busy' && result.metadata === null;
    busyRereadArmedRef.current = retryStartup;
    if (retryStartup) scheduleStartupBusyReread();
    else clearBusyRereadTimer();
    const readOnly = result.reason === 'unsupported_metadata'
      || result.reason === 'storage_unavailable'
      || result.notice?.kind === 'read_only'
      || result.notice?.kind === 'unsupported';
    metadataReadOnlyRef.current = readOnly;
    setMetadataReadOnly(readOnly);
    if (readOnly) readOnlyReasonRef.current = result.reason;
  }, [
    clearBusyRereadTimer,
    installMetadata,
    scheduleStartupBusyReread,
  ]);

  const mergeIncomingMetadata = useCallback((
    incoming: ProfileMetadata,
    notice: ProfileRecoveryNotice | null,
  ) => {
    const current = metadataRef.current;
    if (current === null) {
      installMetadata(incoming);
      if (notice !== null) setRecoveryNotice(notice);
      return;
    }

    if (incoming.revision < current.revision) return;

    if (incoming.profiles.some(profile => profile.id === current.activeProfileId)) {
      installMetadata({ ...incoming, activeProfileId: current.activeProfileId });
      if (notice !== null) setRecoveryNotice(notice);
      return;
    }

    queueOrRunEviction(current.activeProfileId);
    const replacement = incoming.profiles.some(profile => profile.id === incoming.activeProfileId)
      ? incoming.activeProfileId
      : incoming.profiles[0].id;
    installMetadata({ ...incoming, activeProfileId: replacement });
    setRecoveryNotice(emptyNotice('remote_removal'));
  }, [installMetadata, queueOrRunEviction]);

  const runCleanupPass = useCallback(async (): Promise<CleanupWorkerSummary> => {
    const intents = [...(metadataRef.current?.deletions ?? [])];
    let reason: ProfileDeletionCleanupFailureReason | null = null;
    for (const intent of intents) {
      if (!mountedRef.current || operationAbortedRef.current) break;
      operationAbortedRef.current = false;
      let result: Awaited<ReturnType<typeof resumeProfileDeletion>>;
      try {
        result = await resumeProfileDeletion(intent, dependencies);
      } catch {
        result = {
          status: 'cleanup_pending',
          reason: 'storage_unavailable',
          metadata: metadataRef.current,
          removedEntries: 0,
          removalFailures: 0,
          rollbackFailures: 0,
        };
      }
      if (!mountedRef.current) {
        return {
          pendingCount: metadataRef.current?.deletions.length ?? 0,
          reason: null,
        };
      }
      if (
        result.metadata !== null
        && (
          metadataRef.current === null
          || result.metadata.revision > metadataRef.current.revision
        )
      ) mergeIncomingMetadata(result.metadata, null);
      if (result.status === 'cleanup_pending') {
        if (reason === null || result.reason === 'profile_in_use') reason = result.reason;
      }
    }

    const pendingCount = metadataRef.current?.deletions.length ?? 0;
    if (mountedRef.current) {
      setMutationFailure(pendingCount === 0 ? null : reason);
    }
    return { pendingCount, reason };
  }, [dependencies, mergeIncomingMetadata]);

  const settleCleanupWaiters = useCallback((summary: CleanupWorkerSummary) => {
    const pending: CleanupWaiter[] = [];
    for (const waiter of cleanupWaitersRef.current) {
      if (waiter.generation <= cleanupProcessedGenerationRef.current) waiter.resolve(summary);
      else pending.push(waiter);
    }
    cleanupWaitersRef.current = pending;
  }, []);

  const ensureCleanupWorker = useCallback(() => {
    if (
      !mountedRef.current
      || cleanupWorkerRef.current !== null
      || cleanupProcessedGenerationRef.current >= cleanupRequestedGenerationRef.current
      || pendingActionRef.current !== null
    ) return;
    if (cleanupRescheduleTimerRef.current !== null) {
      window.clearTimeout(cleanupRescheduleTimerRef.current);
      cleanupRescheduleTimerRef.current = null;
    }

    const worker = (async (): Promise<CleanupWorkerSummary> => {
      let summary: CleanupWorkerSummary = {
        pendingCount: metadataRef.current?.deletions.length ?? 0,
        reason: null,
      };
      let remainingPasses = 2;
      while (
        mountedRef.current
        && pendingActionRef.current === null
        && cleanupProcessedGenerationRef.current < cleanupRequestedGenerationRef.current
        && remainingPasses > 0
      ) {
        const attemptedGeneration = cleanupRequestedGenerationRef.current;
        remainingPasses -= 1;
        operationAbortedRef.current = false;
        summary = await runCleanupPass();
        if (!mountedRef.current) break;
        cleanupProcessedGenerationRef.current = Math.max(
          cleanupProcessedGenerationRef.current,
          attemptedGeneration,
        );
        settleCleanupWaiters(summary);
      }
      return summary;
    })();
    cleanupWorkerRef.current = worker;
    const finish = (summary: CleanupWorkerSummary) => {
      if (cleanupWorkerRef.current !== worker) return;
      cleanupWorkerRef.current = null;
      if (
        mountedRef.current
        && pendingActionRef.current === null
        && cleanupProcessedGenerationRef.current < cleanupRequestedGenerationRef.current
        && cleanupRescheduleTimerRef.current === null
      ) {
        cleanupRescheduleTimerRef.current = window.setTimeout(() => {
          cleanupRescheduleTimerRef.current = null;
          cleanupWorkerStarterRef.current();
        }, 0);
      }
      settleCleanupWaiters(summary);
    };
    void worker.then(finish, () => finish({
      pendingCount: metadataRef.current?.deletions.length ?? 0,
      reason: 'storage_unavailable',
    }));
  }, [runCleanupPass, settleCleanupWaiters]);

  cleanupWorkerStarterRef.current = ensureCleanupWorker;

  const scheduleDeletionCleanup = useCallback((): Promise<CleanupWorkerSummary> => {
    const generation = cleanupRequestedGenerationRef.current + 1;
    cleanupRequestedGenerationRef.current = generation;
    const completion = new Promise<CleanupWorkerSummary>(resolve => {
      cleanupWaitersRef.current.push({ generation, resolve });
    });
    cleanupWorkerStarterRef.current();
    return completion;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const initialize = async () => {
      operationAbortedRef.current = false;
      const result = await initializeWithStorageFallback(dependencies);
      if (cancelled || !mountedRef.current) return;
      applyInitializationResult(result);
      setPending(null);
      if (result.ok && result.metadata.deletions.length > 0) {
        void scheduleDeletionCleanup();
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      operationAbortedRef.current = true;
      if (cleanupRescheduleTimerRef.current !== null) {
        window.clearTimeout(cleanupRescheduleTimerRef.current);
        cleanupRescheduleTimerRef.current = null;
      }
      cleanupProcessedGenerationRef.current = cleanupRequestedGenerationRef.current;
      const summary = {
        pendingCount: metadataRef.current?.deletions.length ?? 0,
        reason: null,
      };
      for (const waiter of cleanupWaitersRef.current) waiter.resolve(summary);
      cleanupWaitersRef.current = [];
      queuedEvictionIdsRef.current = [];
      busyRereadArmedRef.current = false;
      clearBusyRereadTimer();
    };
  }, [
    applyInitializationResult,
    clearBusyRereadTimer,
    dependencies,
    scheduleDeletionCleanup,
    setPending,
  ]);

  const rereadAfterBusy = useCallback(async () => {
    if (
      startupTerminalFailureRef.current !== null
      || (metadataReadOnlyRef.current
        && (readOnlyReasonRef.current === 'invalid_metadata'
          || readOnlyReasonRef.current === 'unsupported_metadata'))
    ) return;
    if (pendingActionRef.current !== null || !busyRereadArmedRef.current) return;
    busyRereadArmedRef.current = false;
    clearBusyRereadTimer();
    setPending('initializing');
    operationAbortedRef.current = false;
    const result = await initializeWithStorageFallback(dependencies);
    if (!mountedRef.current || startupTerminalFailureRef.current !== null) return;
    if (operationAbortedRef.current && metadataRef.current !== null) {
      busyRereadArmedRef.current = false;
      clearBusyRereadTimer();
      const compatibilityReadOnly = metadataReadOnlyRef.current
        && (readOnlyReasonRef.current === 'invalid_metadata'
          || readOnlyReasonRef.current === 'unsupported_metadata');
      if (!compatibilityReadOnly) {
        setMutationFailure(null);
      }
      setPending(null);
      return;
    }
    if (
      result.ok === false
      && result.reason === 'busy'
      && result.metadata === null
      && metadataRef.current === null
    ) {
      enterStartupTerminal('busy', 'read_only');
      return;
    }
    if (
      metadataReadOnlyRef.current
      && (readOnlyReasonRef.current === 'invalid_metadata'
        || readOnlyReasonRef.current === 'unsupported_metadata')
    ) {
      setPending(null);
      return;
    }
    if (result.metadata !== null) mergeIncomingMetadata(result.metadata, result.notice);
    if (result.ok === true) {
      setMutationFailure(null);
      metadataReadOnlyRef.current = false;
      setMetadataReadOnly(false);
    } else {
      setMutationFailure(result.reason);
      const readOnly = result.reason === 'unsupported_metadata'
        || result.notice?.kind === 'read_only'
        || result.notice?.kind === 'unsupported';
      if (readOnly) {
        metadataReadOnlyRef.current = true;
        readOnlyReasonRef.current = result.reason;
        setMetadataReadOnly(true);
      }
    }
    if (result.notice !== null) setRecoveryNotice(result.notice);
    setPending(null);
  }, [
    clearBusyRereadTimer,
    dependencies,
    enterStartupTerminal,
    mergeIncomingMetadata,
    setPending,
  ]);

  busyRereadCallbackRef.current = () => { void rereadAfterBusy(); };

  const failClosedForIncomingPrimary = useCallback((
    reason: Extract<ProfileMutationFailure, 'invalid_metadata' | 'unsupported_metadata'>,
    noticeKind: Extract<ProfileRecoveryNotice['kind'], 'read_only' | 'unsupported'>,
  ) => {
    if (metadataRef.current === null) {
      enterStartupTerminal(reason, noticeKind);
      return;
    }
    busyRereadArmedRef.current = false;
    clearBusyRereadTimer();
    queuedEvictionIdsRef.current = [];
    metadataReadOnlyRef.current = true;
    readOnlyReasonRef.current = reason;
    setMetadataReadOnly(true);
    setMutationFailure(reason);
    setRecoveryNotice(emptyNotice(noticeKind));
  }, [clearBusyRereadTimer, enterStartupTerminal]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROFILES_KEY) {
        operationAbortedRef.current = true;
        const parsed = parseProfileMetadata(event.newValue);
        if (parsed.status === 'unsupported') {
          failClosedForIncomingPrimary('unsupported_metadata', 'unsupported');
          return;
        }
        if (parsed.status !== 'current') {
          failClosedForIncomingPrimary('invalid_metadata', 'read_only');
          return;
        }
        const current = metadataRef.current;
        if (current === null) {
          if (startupTerminalFailureRef.current === null) installMetadata(parsed.metadata);
          if (parsed.metadata.deletions.length > 0) void scheduleDeletionCleanup();
          return;
        }
        if (parsed.metadata.revision <= current.revision) {
          if (parsed.metadata.deletions.length > 0) void scheduleDeletionCleanup();
          return;
        }
        mergeIncomingMetadata(parsed.metadata, null);
        if (parsed.metadata.deletions.length > 0) void scheduleDeletionCleanup();
        return;
      }
      if (event.key === PROFILE_METADATA_LOCK_KEY && busyRereadArmedRef.current) {
        void rereadAfterBusy();
      }
      const pendingIntents = metadataRef.current?.deletions ?? [];
      const cleanupRelevant = event.key === PROFILE_METADATA_LOCK_KEY
        || event.key === PROFILE_METADATA_BACKUP_KEY
        || pendingIntents.some(intent => (
          event.key === writerLeaseKey(profileBaseKey(intent.profileId))
        ));
      if (pendingIntents.length > 0 && cleanupRelevant) {
        operationAbortedRef.current = true;
        void scheduleDeletionCleanup();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [
    failClosedForIncomingPrimary,
    installMetadata,
    mergeIncomingMetadata,
    rereadAfterBusy,
    scheduleDeletionCleanup,
  ]);

  const runMutation = useCallback(async (
    action: Exclude<ProfilePendingAction, 'initializing' | null>,
    mutation: ProfileMutation,
  ): Promise<ProfileTransactionResult> => {
    const current = metadataRef.current;
    if (pendingActionRef.current !== null) {
      return failedResult('busy', current, recoveryNotice);
    }
    if (metadataReadOnlyRef.current) {
      return failedResult(readOnlyReasonRef.current, current, recoveryNotice);
    }

    setPending(action);
    setMutationFailure(null);
    const finishCleanupScheduling = () => {
      setPending(null);
      if (metadataReadOnlyRef.current) return;
      if ((metadataRef.current?.deletions.length ?? 0) > 0) {
        void scheduleDeletionCleanup();
      } else {
        cleanupWorkerStarterRef.current();
      }
    };
    let result: ProfileTransactionResult;
    try {
      operationAbortedRef.current = false;
      result = await mutateProfileMetadata(dependencies, mutation);
    } catch {
      result = failedResult('invalid_metadata', current, recoveryNotice);
    }

    if (!mountedRef.current) return result;
    if (
      metadataReadOnlyRef.current
      && (readOnlyReasonRef.current === 'invalid_metadata'
        || readOnlyReasonRef.current === 'unsupported_metadata')
    ) {
      const reason = readOnlyReasonRef.current;
      const notice = reason === 'unsupported_metadata'
        ? emptyNotice('unsupported')
        : emptyNotice('read_only');
      setPending(null);
      return failedResult(reason, metadataRef.current, notice);
    }
    if (result.ok === true) {
      const localActiveId = metadataRef.current?.activeProfileId ?? result.metadata.activeProfileId;
      const preserveLocalSelection = action === 'rename' || action === 'delete';
      const activeProfileId = preserveLocalSelection
        && result.metadata.profiles.some(profile => profile.id === localActiveId)
        ? localActiveId
        : result.metadata.activeProfileId;
      const candidate = { ...result.metadata, activeProfileId };
      if (!installMetadata(candidate)) {
        setMutationFailure('busy');
        finishCleanupScheduling();
        return failedResult('busy', metadataRef.current, recoveryNotice);
      }
      if (action === 'delete' && mutation.type === 'delete') {
        discardPendingSave(profileBaseKey(mutation.profileId));
      }
      if (result.notice !== null) setRecoveryNotice(result.notice);
      if (action === 'create' && mutation.type === 'create') {
        setRecentlyCreatedId(mutation.profile.id);
      }
      setMutationFailure(null);
      busyRereadArmedRef.current = false;
    } else {
      const failureNotice = result.deleteDetails !== undefined
        && result.deleteDetails.rollbackFailures > 0
        ? {
            ...(result.notice ?? emptyNotice('partial')),
            rollbackFailures: result.deleteDetails.rollbackFailures,
          }
        : result.notice;
      if (result.reason === 'not_found' && result.metadata !== null) {
        try {
          const parsed = parseProfileMetadata(JSON.stringify(result.metadata));
          const currentMetadata = metadataRef.current;
          if (
            parsed.status === 'current'
            && currentMetadata !== null
            && parsed.metadata.revision > currentMetadata.revision
          ) mergeIncomingMetadata(parsed.metadata, result.notice);
        } catch {
          // A failed result never installs metadata that cannot be strictly revalidated.
        }
      }
      setMutationFailure(result.reason);
      const readOnly = result.reason === 'unsupported_metadata'
        || failureNotice?.kind === 'read_only'
        || failureNotice?.kind === 'unsupported';
      if (readOnly) {
        metadataReadOnlyRef.current = true;
        readOnlyReasonRef.current = result.reason;
        setMetadataReadOnly(true);
      }
      if (failureNotice !== null) setRecoveryNotice(failureNotice);
      busyRereadArmedRef.current = result.reason === 'busy';
    }
    finishCleanupScheduling();
    return result;
  }, [
    dependencies,
    installMetadata,
    mergeIncomingMetadata,
    recoveryNotice,
    scheduleDeletionCleanup,
    setPending,
  ]);

  const createProfile = useCallback((name: string): Promise<ProfileTransactionResult> => {
    const current = metadataRef.current;
    if (pendingActionRef.current !== null) {
      return Promise.resolve(failedResult('busy', current, recoveryNotice));
    }
    if (metadataReadOnlyRef.current) {
      return Promise.resolve(failedResult(readOnlyReasonRef.current, current, recoveryNotice));
    }
    const profile: Profile = {
      id: generateId(),
      name: sanitizeProfileName(name),
      createdAt: Date.now(),
    };
    return runMutation('create', { type: 'create', profile });
  }, [recoveryNotice, runMutation]);

  const switchProfile = useCallback((id: string): Promise<ProfileTransactionResult> =>
    runMutation('select', { type: 'select', profileId: id }), [runMutation]);

  const renameProfile = useCallback((id: string, newName: string): Promise<ProfileTransactionResult> =>
    runMutation('rename', {
      type: 'rename',
      profileId: id,
      name: sanitizeProfileName(newName),
    }), [runMutation]);

  const deleteProfile = useCallback((id: string): Promise<ProfileTransactionResult> =>
    runMutation('delete', { type: 'delete', profileId: id }), [runMutation]);

  const retryProfileDeletionCleanup = useCallback(async (): Promise<void> => {
    if (metadataReadOnlyRef.current) {
      throw new ProfileDeletionCleanupRetryError('unsupported_metadata');
    }
    const summary = await scheduleDeletionCleanup();
    if (!mountedRef.current) return;
    const pendingCount = metadataRef.current?.deletions.length ?? summary.pendingCount;
    if (pendingCount > 0) {
      const reason = summary.reason ?? 'storage_unavailable';
      setMutationFailure(reason);
      throw new ProfileDeletionCleanupRetryError(reason);
    }
    setMutationFailure(null);
  }, [scheduleDeletionCleanup]);

  const dismissRecoveryNotice = useCallback(() => setRecoveryNotice(null), []);
  const clearRecentlyCreated = useCallback(() => setRecentlyCreatedId(null), []);
  const registerProfileEvictionHandler = useCallback((
    handler: (profileId: string) => void,
  ): (() => void) => {
    evictionHandlerRef.current = handler;
    const queued = queuedEvictionIdsRef.current;
    queuedEvictionIdsRef.current = [];
    for (const profileId of queued) handler(profileId);
    return () => {
      if (evictionHandlerRef.current === handler) evictionHandlerRef.current = null;
    };
  }, []);

  const value = useMemo<ProfileContextType | null>(() => {
    if (metadata === null) return null;
    const activeProfile = metadata.profiles.find(profile => profile.id === metadata.activeProfileId);
    return {
      profiles: metadata.profiles,
      activeProfileId: metadata.activeProfileId,
      activeProfileName: activeProfile?.name ?? 'Unknown',
      storageKeyForActiveProfile: profileBaseKey(metadata.activeProfileId),
      pendingAction,
      mutationFailure,
      recoveryNotice,
      metadataReadOnly,
      pendingDeletionCount: metadata.deletions.length,
      retryProfileDeletionCleanup,
      createProfile,
      switchProfile,
      renameProfile,
      deleteProfile,
      dismissRecoveryNotice,
      recentlyCreatedId,
      clearRecentlyCreated,
      registerProfileEvictionHandler,
    };
  }, [
    metadata,
    pendingAction,
    mutationFailure,
    recoveryNotice,
    metadataReadOnly,
    retryProfileDeletionCleanup,
    createProfile,
    switchProfile,
    renameProfile,
    deleteProfile,
    dismissRecoveryNotice,
    recentlyCreatedId,
    clearRecentlyCreated,
    registerProfileEvictionHandler,
  ]);

  if (startupTerminalFailure !== null) {
    const message = startupTerminalFailure === 'busy'
      ? 'Profiles are still being updated in another tab. Refresh this page to try again.'
      : startupTerminalFailure === 'unsupported_metadata'
        ? 'Profile data was updated by a newer version of the app. Refresh after opening this version in the original tab.'
        : 'Profile data changed to an invalid format while loading. Refresh this page to continue safely.';
    return <div role="alert">{message}</div>;
  }

  if (value === null) {
    return <div role="status">Loading profiles...</div>;
  }

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfiles = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfiles must be used within a ProfileProvider');
  }
  return context;
};
