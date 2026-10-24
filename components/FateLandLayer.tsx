import React, { useMemo } from 'react';
import type { FateMark } from '../types';
import { MAP_IMAGE } from '../utils/mapCoords';
import { CHUNK_PX, THREAD_GOLD, chunkBox, fogPath, isBaneMark, omenColor, outlineEdges, threadStart } from '../utils/fateMap';

/**
 * A Chunked run's land as fate sees it, drawn over the World map inside its
 * pan/zoom layer (components/RegionMap.tsx): fog over the land the run
 * neither holds nor has on its frontier, Fate's Thread and the frontier chunks
 * nearest it, and the omen fate drew on each held chunk. Strokes and badges keep their on-screen size
 * at every zoom through the --osrs-map-s scale RegionMap sets on the layer.
 */
interface Props {
  osrs: boolean;
  fog: boolean;
  /** Chunks the run holds (its start chunk and any sea it sails included). */
  held: ReadonlySet<string>;
  frontier: ReadonlySet<string>;
  thread?: string;
  /** The frontier chunks nearest the thread (utils/fateLand.ts threadLeaning). */
  leaning: readonly string[];
  marks: Readonly<Record<string, FateMark>>;
}

const S = 'var(--osrs-map-s, 0.2)';
/** A length that stays `px` screen pixels at every zoom. */
const px = (n: number) => `calc(${n}px / ${S})`;
const ORANGE = '#ff981f';
const W = MAP_IMAGE.width;
const H = MAP_IMAGE.height;
const svgProps = { className: 'absolute inset-0 pointer-events-none', width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': true } as const;

/** A five-pointed star of radius r around (0, 0). */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const a = Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? 11 : 4.6;
  return `${(r * Math.cos(a)).toFixed(2)},${(-r * Math.sin(a)).toFixed(2)}`;
}).join(' ');

/** Children drawn at a constant screen size around (x, y). */
const Pinned: React.FC<{ x: number; y: number; children: React.ReactNode }> = ({ x, y, children }) => (
  <g style={{ transform: `translate(${x}px, ${y}px) scale(calc(1 / ${S}))` }}>{children}</g>
);

export const FateLandLayer: React.FC<Props> = ({ osrs, fog, held, frontier, thread, leaning, marks }) => {
  const fogD = useMemo(() => (fog ? fogPath([...held, ...frontier], W, H) : ''), [fog, held, frontier]);
  const heldEdges = useMemo(() => (fog && osrs ? outlineEdges(held) : []), [fog, osrs, held]);
  const from = thread ? threadStart(held, thread) : undefined;
  const half = CHUNK_PX / 2;
  const font = osrs ? "'RSBold', sans-serif" : 'ui-sans-serif, system-ui, sans-serif';

  return (
    <>
      {fog && (
        <>
          {/* Greyscale: a grey fill blended by saturation keeps the map's light and dark but drops its colour. */}
          <svg {...svgProps} style={{ mixBlendMode: 'saturation' }} data-testid="fate-fog">
            <path d={fogD} fill="#808080" fillRule="evenodd" />
          </svg>
          <svg {...svgProps}>
            <path d={fogD} fill={osrs ? 'rgba(31, 26, 20, 0.55)' : 'rgba(14, 12, 10, 0.55)'} fillRule="evenodd" />
          </svg>
        </>
      )}
      <svg {...svgProps} data-testid="fate-land">
        {heldEdges.length > 0 && (
          <g stroke={ORANGE} style={{ strokeWidth: px(2) }} strokeLinecap="square">
            {heldEdges.map(([x1, y1, x2, y2]) => <line key={`${x1},${y1},${x2},${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />)}
          </g>
        )}
        {fog && osrs && (
          <g fill="none" stroke={ORANGE} style={{ strokeWidth: px(1), strokeDasharray: `${px(4)} ${px(4)}` }}>
            {[...frontier].map(key => {
              const { x, y } = chunkBox(key);
              return <rect key={key} x={x} y={y} width={CHUNK_PX} height={CHUNK_PX} />;
            })}
          </g>
        )}

        {/* Every held chunk carries an omen: a small pip in its corner, + for a boon, − for a bane. */}
        {Object.entries(marks).map(([key, mark]) => {
          const { x, y } = chunkBox(key);
          const bane = isBaneMark(mark);
          return (
            <Pinned key={`m${key}`} x={x} y={y}>
              <g data-mark={mark}>
                <rect x={3} y={3} width={13} height={13} fill={omenColor(mark)} stroke="#000" strokeWidth={2} />
                <line x1={6.5} y1={9.5} x2={12.5} y2={9.5} stroke="#000" strokeWidth={2} />
                {!bane && <line x1={9.5} y1={6.5} x2={9.5} y2={12.5} stroke="#000" strokeWidth={2} />}
              </g>
            </Pinned>
          );
        })}

        {thread && leaning.map(key => {
          const { x, y } = chunkBox(key);
          return (
            <g key={`l${key}`} data-thread-leaning={key}>
              {/* Dashed, in the thread's gold: told apart from the thread's own solid box. */}
              <rect x={x + 3} y={y + 3} width={CHUNK_PX - 6} height={CHUNK_PX - 6} fill="none" stroke="rgba(0,0,0,0.6)" style={{ strokeWidth: px(4) }} />
              <rect x={x + 3} y={y + 3} width={CHUNK_PX - 6} height={CHUNK_PX - 6} fill="none" stroke={THREAD_GOLD}
                style={{ strokeWidth: px(2), strokeDasharray: `${px(6)} ${px(4)}` }} />
            </g>
          );
        })}

        {thread && (() => {
          const { x, y } = chunkBox(thread);
          const a = from ? chunkBox(from) : null;
          return (
            <g data-thread={thread}>
              {a && (
                <>
                  <line x1={a.x + half} y1={a.y + half} x2={x + half} y2={y + half} stroke="#000" strokeLinecap="round"
                    style={{ strokeWidth: px(4), strokeDasharray: `${px(5)} ${px(6)}` }} />
                  <line x1={a.x + half} y1={a.y + half} x2={x + half} y2={y + half} stroke={THREAD_GOLD} strokeLinecap="round"
                    style={{ strokeWidth: px(2), strokeDasharray: `${px(5)} ${px(6)}` }} />
                </>
              )}
              <rect x={x} y={y} width={CHUNK_PX} height={CHUNK_PX} fill="none" stroke="#000" style={{ strokeWidth: px(5) }} />
              <rect x={x} y={y} width={CHUNK_PX} height={CHUNK_PX} fill="none" stroke={THREAD_GOLD} style={{ strokeWidth: px(3) }} />
              <Pinned x={x + half} y={y + half}>
                <polygon points={STAR} fill={THREAD_GOLD} stroke="#000" strokeWidth={1.2} strokeLinejoin="round" />
              </Pinned>
            </g>
          );
        })()}
      </svg>
    </>
  );
};

export default FateLandLayer;
