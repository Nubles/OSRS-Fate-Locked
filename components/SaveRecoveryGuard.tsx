import { useEffect, useSyncExternalStore, type FC } from 'react';
import {
  getPendingSaveRevision,
  hasAnyPendingSaves,
  subscribePendingSaves,
} from '../utils/pendingSaves';

export const SaveRecoveryGuard: FC = () => {
  useSyncExternalStore(
    subscribePendingSaves,
    getPendingSaveRevision,
    getPendingSaveRevision,
  );
  const pending = hasAnyPendingSaves();

  useEffect(() => {
    if (!pending) return;

    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [pending]);

  return null;
};
