import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { markPersistRequested, readNagRecord } from '../utils/backupNag';
import {
  PERSISTENT_STORAGE_EVENT,
  browserTraits,
  requestPersistenceQuietly,
  shouldRequestPersistenceQuietly,
  storageEngineFor,
} from '../utils/persistentStorage';
import type { PersistentStorageManager } from '../hooks/usePersistentStorage';

const browserStorage = (): PersistentStorageManager | undefined => {
  try {
    return typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { storage?: PersistentStorageManager }).storage;
  } catch {
    return undefined;
  }
};

/**
 * Quietly asks the browser to keep this site's storage once a run records its
 * first History entry, once per profile (utils/persistentStorage.ts decides).
 * No prompt, no toast, never blocks: Chrome and Safari answer silently, and
 * Firefox, whose answer is a permission prompt, is left to the backup
 * reminder's own button. Renders nothing; always mounted.
 */
export const PersistentStorageDriver: React.FC = () => {
  const { history } = useGame();
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const hasHistory = history.length > 0;

  useEffect(() => {
    if (!hasHistory) return;
    const engine = storageEngineFor(browserTraits());
    if (!shouldRequestPersistenceQuietly({
      historyLength: history.length,
      requestedAt: readNagRecord(storageKey).persistRequestedAt,
      engine,
    })) return;
    // Recorded first, so a StrictMode replay or a second tab doesn't ask again.
    markPersistRequested(storageKey);
    void requestPersistenceQuietly(browserStorage()).then(granted => {
      if (granted === true && typeof window !== 'undefined') window.dispatchEvent(new Event(PERSISTENT_STORAGE_EVENT));
    });
    // history.length is read for the decision; the effect only needs to rerun
    // when the run first gains History or the profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, hasHistory]);

  return null;
};
