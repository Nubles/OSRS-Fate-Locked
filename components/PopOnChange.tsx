import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';

/**
 * An odometer-style counter: when the value changes it rolls the old number out
 * and the new one in (up for an increase, down for a decrease) — so earning a
 * key feels tactile without any flashing. Deliberately avoids colour/opacity
 * flashes, which can affect photosensitive users; pure positional motion only.
 * Honours the in-app animations toggle and the OS reduce-motion setting.
 */
export const PopOnChange: React.FC<{
  value: number;
  className?: string;
  /** Accepted for API compatibility; no longer used (flashing was removed). */
  flashClass?: string;
  children?: React.ReactNode;
}> = ({ value, className }) => {
  const { animationsEnabled } = useGame();
  const [settled, setSettled] = useState(value);
  const [rolling, setRolling] = useState<{ from: number; to: number; dir: 'up' | 'down'; key: number } | null>(null);
  const prev = useRef(value);
  const keyRef = useRef(0);

  useEffect(() => {
    if (value === prev.current) return;
    const from = prev.current;
    prev.current = value;
    // Snap (no roll) when animations are off OR the OS asks to reduce motion.
    // The reduce-motion case MUST snap here: the reduce-motion CSS sets
    // `animation: none` on the roll track, so `onAnimationEnd` never fires and
    // `settled` would otherwise stay stuck a value behind (e.g. 0 keys earns a
    // key but the counter only catches up on the next one).
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!animationsEnabled || reduce) {
      setSettled(value);
      setRolling(null);
      return;
    }
    keyRef.current += 1;
    const k = keyRef.current;
    setRolling({ from, to: value, dir: value > from ? 'up' : 'down', key: k });
    // Safety net: if the animation (and thus onAnimationEnd) never runs for any
    // reason, still settle so the counter can't get stuck behind the real value.
    const t = window.setTimeout(() => {
      setSettled(value);
      setRolling(r => (r && r.key === k ? null : r));
    }, 650);
    return () => window.clearTimeout(t);
  }, [value, animationsEnabled]);

  if (!rolling) {
    return <span className={className}>{settled}</span>;
  }

  // Order the two lines so the visible one settles on the new value.
  const lines = rolling.dir === 'up' ? [rolling.from, rolling.to] : [rolling.to, rolling.from];

  return (
    <span className={`roll-box ${className ?? ''}`}>
      <span
        key={rolling.key}
        className={`roll-track roll-${rolling.dir}`}
        onAnimationEnd={() => {
          setSettled(rolling.to);
          setRolling(null);
        }}
      >
        <span>{lines[0]}</span>
        <span>{lines[1]}</span>
      </span>
    </span>
  );
};
