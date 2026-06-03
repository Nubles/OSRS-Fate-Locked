import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';

/**
 * Wraps a numeric value and gives it a little "pop" (and a brief colour flash on
 * increase) whenever it changes — so earning a key or fate point feels tactile.
 * Re-triggers cleanly via a key bump, and respects the in-app animations toggle.
 */
export const PopOnChange: React.FC<{
  value: number;
  /** Tailwind colour class flashed briefly when the value goes up. */
  flashClass?: string;
  className?: string;
  children?: React.ReactNode;
}> = ({ value, flashClass = 'text-white', className, children }) => {
  const { animationsEnabled } = useGame();
  const prev = useRef(value);
  const [tick, setTick] = useState(0);
  const [up, setUp] = useState(false);

  useEffect(() => {
    if (value !== prev.current) {
      setUp(value > prev.current);
      setTick((t) => t + 1);
      prev.current = value;
    }
  }, [value]);

  // Clear the flash colour shortly after a bump.
  useEffect(() => {
    if (!tick) return;
    const t = setTimeout(() => setUp(false), 450);
    return () => clearTimeout(t);
  }, [tick]);

  const animate = animationsEnabled && tick > 0;

  return (
    <span
      key={animate ? tick : 'static'}
      className={`inline-block ${animate ? 'animate-count-pop' : ''} ${animate && up ? flashClass : ''} transition-colors ${className ?? ''}`}
    >
      {children ?? value}
    </span>
  );
};
