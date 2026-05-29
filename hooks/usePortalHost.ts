import { useEffect, useState } from 'react';

/**
 * Resolves a persistent portal host element by id (created once in the app
 * shell). Returns null until mounted, so transient overlays — toasts and
 * reveals — can render into a single shared stacking container instead of
 * each pinning itself to the same screen corner and overlapping.
 */
export function usePortalHost(id: string): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById(id));
  }, [id]);
  return host;
}
