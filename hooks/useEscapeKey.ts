import { useEffect } from 'react';

/**
 * Calls `handler` when Escape is pressed. Pass `active = false` to disable
 * (e.g. when the owning modal is closed) so stale listeners don't pile up.
 * Pass `top = true` for a layer over a window (a popover): it listens in the
 * capture phase and stops the key, so the window under it stays open.
 */
export const useEscapeKey = (handler: () => void, active = true, top = false): void => {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (top) e.stopImmediatePropagation();
        handler();
      }
    };
    window.addEventListener('keydown', onKeyDown, top);
    return () => window.removeEventListener('keydown', onKeyDown, top);
  }, [handler, active, top]);
};
