import { useState } from 'react';

/**
 * Typed useState wrapper that transparently syncs to localStorage.
 * Falls back to `initial` when the key is absent or JSON.parse fails
 * (private browsing, quota exceeded, JSON corruption).
 *
 * Usage:
 *   const [filter, setFilter] = useLocalStorage<JournalStatus>('jrnl:quest:filter', 'ALL');
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setInner] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (action) => {
    setInner((prev) => {
      const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage quota / private mode — degrade silently */
      }
      return next;
    });
  };

  return [value, setValue];
}
