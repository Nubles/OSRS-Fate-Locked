import { useCallback, useEffect, useRef, useState } from 'react';
import {
  claimWriterLease,
  releaseWriterLease,
  renewWriterLease,
  verifyWriterLease,
  writerLeaseKey,
  WRITER_LEASE_ARBITRATION_MS,
  WRITER_LEASE_RENEW_MS,
  type SaveOwnershipBlockReason,
  type SaveOwnershipStatus,
  type SaveWriteAuthorization,
  type WriterLeaseOwnershipResult,
  type WriterLeaseStorage,
} from '../utils/profileWriterLease';

export interface ProfileWriterLeaseOptions {
  storage?: WriterLeaseStorage;
  ownerId?: string;
  now?: () => number;
  arbitrationMs?: number;
  renewMs?: number;
}

export interface ProfileWriterLeaseHandle {
  ownerId: string;
  status: SaveOwnershipStatus;
  blockedReason: SaveOwnershipBlockReason;
  verify: () => boolean;
  authorizeWrite: () => SaveWriteAuthorization;
  takeOver: () => Promise<boolean>;
  release: () => boolean;
}

type LeaseState = {
  status: SaveOwnershipStatus;
  blockedReason: SaveOwnershipBlockReason;
};

let pageOwnerId: string | undefined;

const getPageOwnerId = (): string => {
  if (pageOwnerId !== undefined) return pageOwnerId;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    pageOwnerId = crypto.randomUUID();
  } else {
    pageOwnerId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  }
  return pageOwnerId;
};

const unavailableStorage: WriterLeaseStorage = {
  getItem: () => { throw new Error('Storage is unavailable'); },
  setItem: () => { throw new Error('Storage is unavailable'); },
  removeItem: () => { throw new Error('Storage is unavailable'); },
};

const getStorage = (storage?: WriterLeaseStorage): WriterLeaseStorage => {
  if (storage !== undefined) return storage;
  try {
    return window.localStorage;
  } catch {
    return unavailableStorage;
  }
};

const blockedState = (result: WriterLeaseOwnershipResult): LeaseState => ({
  status: 'blocked',
  blockedReason: result.status === 'unavailable' ? 'storage_unavailable' : 'foreign_owner',
});

export const useProfileWriterLease = (
  storageKey: string,
  options: ProfileWriterLeaseOptions = {},
): ProfileWriterLeaseHandle => {
  const [ownerId] = useState(() => options.ownerId ?? getPageOwnerId());
  const storageRef = useRef<WriterLeaseStorage | null>(null);
  const nowRef = useRef(options.now ?? Date.now);
  const arbitrationMsRef = useRef(options.arbitrationMs ?? WRITER_LEASE_ARBITRATION_MS);
  const renewMsRef = useRef(options.renewMs ?? WRITER_LEASE_RENEW_MS);
  const [leaseState, setLeaseState] = useState<LeaseState>({
    status: 'checking',
    blockedReason: null,
  });
  const leaseStateRef = useRef(leaseState);
  const mountedRef = useRef(false);
  const attemptTokenRef = useRef(0);
  const arbitrationTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const takeoverResolverRef = useRef<((owned: boolean) => void) | null>(null);

  if (storageRef.current === null) storageRef.current = getStorage(options.storage);
  leaseStateRef.current = leaseState;

  const updateState = useCallback((nextState: LeaseState) => {
    leaseStateRef.current = nextState;
    if (mountedRef.current) setLeaseState(nextState);
  }, []);

  const invalidateAttempt = useCallback(() => {
    attemptTokenRef.current += 1;
    if (arbitrationTimeoutRef.current !== null) {
      window.clearTimeout(arbitrationTimeoutRef.current);
      arbitrationTimeoutRef.current = null;
    }
    if (takeoverResolverRef.current !== null) {
      const resolve = takeoverResolverRef.current;
      takeoverResolverRef.current = null;
      resolve(false);
    }
  }, []);

  const runClaim = useCallback((force: boolean, resolve?: (owned: boolean) => void) => {
    invalidateAttempt();
    const result = claimWriterLease(
      storageRef.current!,
      storageKey,
      ownerId,
      nowRef.current(),
      force,
    );
    if (result.status !== 'owned') {
      updateState(blockedState(result));
      resolve?.(false);
      return;
    }

    updateState({ status: 'checking', blockedReason: null });
    const attemptToken = attemptTokenRef.current;
    if (resolve !== undefined) takeoverResolverRef.current = resolve;
    arbitrationTimeoutRef.current = window.setTimeout(() => {
      arbitrationTimeoutRef.current = null;
      if (attemptToken !== attemptTokenRef.current || !mountedRef.current) return;

      const verification = verifyWriterLease(
        storageRef.current!,
        storageKey,
        ownerId,
        nowRef.current(),
      );
      const ownsLease = verification.status === 'owned';
      updateState(ownsLease
        ? { status: 'owner', blockedReason: null }
        : blockedState(verification));
      if (takeoverResolverRef.current !== null) {
        const settleTakeover = takeoverResolverRef.current;
        takeoverResolverRef.current = null;
        settleTakeover(ownsLease);
      }
    }, arbitrationMsRef.current);
  }, [invalidateAttempt, ownerId, storageKey, updateState]);

  const authorizeWrite = useCallback((): SaveWriteAuthorization => {
    const result = verifyWriterLease(
      storageRef.current!,
      storageKey,
      ownerId,
      nowRef.current(),
    );
    if (result.status === 'owned') return { ok: true };

    invalidateAttempt();
    updateState(blockedState(result));
    return {
      ok: false,
      reason: result.status === 'unavailable'
        ? 'storage_unavailable'
        : 'ownership_conflict',
    };
  }, [invalidateAttempt, ownerId, storageKey, updateState]);

  const verify = useCallback((): boolean => authorizeWrite().ok, [authorizeWrite]);

  const takeOver = useCallback((): Promise<boolean> => new Promise(resolve => {
    runClaim(true, resolve);
  }), [runClaim]);

  const release = useCallback((): boolean => {
    invalidateAttempt();
    const result = releaseWriterLease(storageRef.current!, storageKey, ownerId);
    if (result === 'released') {
      updateState({ status: 'checking', blockedReason: null });
      return true;
    }
    updateState({
      status: 'blocked',
      blockedReason: result === 'unavailable' ? 'storage_unavailable' : 'foreign_owner',
    });
    return false;
  }, [invalidateAttempt, ownerId, storageKey, updateState]);

  useEffect(() => {
    mountedRef.current = true;
    runClaim(false);

    const recheck = () => {
      if (leaseStateRef.current.status === 'owner') {
        verify();
      } else {
        runClaim(false);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === writerLeaseKey(storageKey)) recheck();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    const intervalId = window.setInterval(() => {
      if (leaseStateRef.current.status !== 'owner') {
        runClaim(false);
        return;
      }
      const result = renewWriterLease(
        storageRef.current!,
        storageKey,
        ownerId,
        nowRef.current(),
      );
      if (result.status === 'owned') {
        updateState({ status: 'owner', blockedReason: null });
      } else {
        invalidateAttempt();
        updateState(blockedState(result));
      }
    }, renewMsRef.current);

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedRef.current = false;
      invalidateAttempt();
      window.clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [invalidateAttempt, ownerId, runClaim, storageKey, updateState, verify]);

  return {
    ownerId,
    status: leaseState.status,
    blockedReason: leaseState.blockedReason,
    verify,
    authorizeWrite,
    takeOver,
    release,
  };
};
