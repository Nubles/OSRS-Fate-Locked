import { useEffect, useRef } from 'react';

/**
 * Plays an event's effects once per event id. An event that arrives while
 * `enabled` is false (Animations off) is marked as seen, so turning
 * Animations back on later replays nothing.
 */
export const useOncePerEvent = <E extends { id: string }>(
  event: E | null | undefined,
  enabled: boolean,
  play: (event: E) => void,
): void => {
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!event || event.id === seen.current) return;
    seen.current = event.id;
    if (enabled) play(event);
  }, [event, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
};
