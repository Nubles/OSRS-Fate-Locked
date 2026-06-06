import React from 'react';

interface LootBeamProps {
  /** Raw hex colour (rarity colour). */
  color: string;
  /** Base point in viewport px — the beam rises upward from here. */
  x: number;
  y: number;
  height?: number;
  /** Bigger, brighter, with rising sparks — for the rarer unlocks. */
  intense?: boolean;
}

/**
 * An OSRS-style pillar of light. Pure CSS (keyframes in styles.css), fixed-
 * positioned, self-dismissing via the `loot-beam` animation. Rendered by
 * EffectsLayer when a roll/unlock event fires.
 */
export const LootBeam: React.FC<LootBeamProps> = ({ color, x, y, height = 210, intense }) => {
  const w = intense ? 48 : 32;
  const coreW = intense ? 8 : 5;
  return (
    <div
      className="fixed z-[190] pointer-events-none"
      style={{
        left: x,
        top: y - height,
        width: w,
        height,
        transform: 'translateX(-50%)',
        transformOrigin: 'bottom center',
        animation: 'loot-beam 1.6s ease-out forwards',
      }}
    >
      {/* soft outer column */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: '100%',
          background: `linear-gradient(to top, ${color}, ${color}55 45%, transparent)`,
          filter: `blur(${intense ? 6 : 4}px)`,
          WebkitMaskImage: 'linear-gradient(to top, black, transparent)',
          maskImage: 'linear-gradient(to top, black, transparent)',
          borderRadius: '50% / 10px',
        }}
      />
      {/* bright core */}
      <div
        className="absolute bottom-0 left-1/2"
        style={{
          width: coreW,
          height: '100%',
          transform: 'translateX(-50%)',
          background: `linear-gradient(to top, #ffffff, ${color} 26%, transparent)`,
          filter: 'blur(1px)',
        }}
      />
      {/* base halo */}
      <div
        className="absolute left-1/2 bottom-0 rounded-full"
        style={{
          width: w * 2.3,
          height: 26,
          transform: 'translate(-50%, 50%)',
          background: color,
          filter: `blur(${intense ? 18 : 12}px)`,
          animation: 'loot-beam-glow 1.2s ease-in-out infinite',
        }}
      />
      {/* rising sparks (rare unlocks only) */}
      {intense &&
        [0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${28 + i * 22}%`,
              bottom: 6,
              width: 3,
              height: 3,
              background: '#fff',
              boxShadow: `0 0 6px ${color}`,
              animation: `loot-spark ${1 + i * 0.2}s ease-out ${i * 0.15}s forwards`,
            }}
          />
        ))}
    </div>
  );
};
