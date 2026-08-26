import { useCallback, useEffect, useRef, useState } from 'react';

export type PersistentStorageStatus =
  | 'unknown'
  | 'unsupported'
  | 'granted'
  | 'denied';

/** The small part of the Storage Manager API used by the app. */
export interface PersistentStorageManager {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

export interface UsePersistentStorageOptions {
  /** Injectable for tests and embedders; defaults to navigator.storage. */
  storage?: PersistentStorageManager;
}

export interface PersistentStorageState {
  status: PersistentStorageStatus;
  /** Ask the browser for persistent site storage. This is always opt-in. */
  requestPersistence: () => Promise<PersistentStorageStatus>;
  /** Descriptive alias for callers that prefer the full capability name. */
  requestPersistentStorage: () => Promise<PersistentStorageStatus>;
}

const browserStorage = (): PersistentStorageManager | undefined => {
  if (typeof navigator === 'undefined') return undefined;
  try {
    return (navigator as Navigator & { storage?: PersistentStorageManager }).storage;
  } catch {
    return undefined;
  }
};

const canRequestPersistence = (
  storage: PersistentStorageManager | undefined,
): storage is PersistentStorageManager & { persist: () => Promise<boolean> } => (
  typeof storage?.persist === 'function'
);

/**
 * Read the browser's persistence capability without asking for permission.
 * `persisted()` is only a status check; the permission request is made by the
 * returned callback after an explicit user action.
 */
export const usePersistentStorage = (
  options: UsePersistentStorageOptions = {},
): PersistentStorageState => {
  const storageRef = useRef<PersistentStorageManager | undefined>(
    options.storage ?? browserStorage(),
  );
  // Keep the capability unknown until the browser is checked or the player
  // explicitly asks for persistence. In particular, do not turn an
  // unsupported browser into a hidden/automatic permission decision.
  const [status, setStatus] = useState<PersistentStorageStatus>('unknown');
  const statusRef = useRef(status);
  statusRef.current = status;
  const requestRef = useRef<Promise<PersistentStorageStatus> | null>(null);
  const requestStartedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    const storage = storageRef.current;
    if (storage === undefined || typeof storage.persisted !== 'function') return;

    let active = true;
    void Promise.resolve()
      .then(() => storage.persisted?.())
      .then(isPersisted => {
        // A false `persisted()` result means permission has not been granted
        // yet; keep the request available rather than treating it as a denial.
        if (active && !requestStartedRef.current && isPersisted === true) {
          statusRef.current = 'granted';
          setStatus('granted');
        }
      })
      .catch(() => {
        // Browsers may reject the read in private/restricted contexts. The
        // explicit request below still gets a safe best-effort attempt.
      });

    return () => { active = false; };
  }, []);

  const requestPersistence = useCallback(async (): Promise<PersistentStorageStatus> => {
    const current = statusRef.current;
    if (current !== 'unknown') return current;
    if (requestRef.current !== null) return requestRef.current;
    requestStartedRef.current = true;

    const storage = storageRef.current;
    if (!canRequestPersistence(storage)) {
      statusRef.current = 'unsupported';
      if (mountedRef.current) setStatus('unsupported');
      return 'unsupported';
    }

    const request = (async (): Promise<PersistentStorageStatus> => {
      try {
        const granted = await storage.persist();
        const next: PersistentStorageStatus = granted === true ? 'granted' : 'denied';
        statusRef.current = next;
        if (mountedRef.current) setStatus(next);
        return next;
      } catch {
        // SecurityError and other browser-policy failures are expected in
        // private/restricted contexts; never surface raw browser errors.
        statusRef.current = 'denied';
        if (mountedRef.current) setStatus('denied');
        return 'denied';
      } finally {
        requestRef.current = null;
      }
    })();
    requestRef.current = request;
    return request;
  }, []);

  return {
    status,
    requestPersistence,
    requestPersistentStorage: requestPersistence,
  };
};
