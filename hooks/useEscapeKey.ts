import { useEffect } from 'react';

/**
 * Calls `handler` when Escape is pressed. Pass `active = false` to disable
 * (e.g. when the owning modal is closed) so stale listeners don't pile up.
 */
export const useEscapeKey = (handler: () => void, active = true): void => {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handler, active]);
};
