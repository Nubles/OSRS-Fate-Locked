import React from 'react';
import { MAP_IMAGE, type ChunkCoord } from '../../utils/mapCoords';
import { areaMapCut, chunksForArea } from '../../utils/areaMapCut';

/**
 * An area unlock's picture: its piece of the tracker's own world map with the
 * area outlined in yellow. Renders nothing when the area has no chunks on the
 * map (underground areas), so callers keep their old picture for those.
 */
export const OsrsAreaMap: React.FC<{
  name: string; maxWidth?: number; maxHeight?: number;
  /** The chunks to show, when they don't come from the area's name (a bank's chunk). */
  chunks?: ChunkCoord[];
  /** A map icon drawn at the middle of the outlined chunks (the bank symbol). */
  marker?: string;
  markerSize?: number;
}> = ({ name, maxWidth = 320, maxHeight = 210, chunks, marker, markerSize = 30 }) => {
  const own = chunks ?? chunksForArea(name);
  const cut = areaMapCut(own);
  if (!cut) return null;
  const s = Math.min(maxWidth / cut.width, maxHeight / cut.height);
  const w = Math.round(cut.width * s);
  const h = Math.round(cut.height * s);
  const size = `${MAP_IMAGE.width * s}px ${MAP_IMAGE.height * s}px`;
  const pos = `${-cut.x * s}px ${-cut.y * s}px`;
  return (
    <div role="img" aria-label={`${name} on the world map`} style={{
      position: 'relative', width: w, height: h, maxWidth: '100%',
      backgroundImage: `url(${MAP_IMAGE.src}), url(${MAP_IMAGE.srcLo})`,
      backgroundSize: `${size}, ${size}`, backgroundPosition: `${pos}, ${pos}`, backgroundRepeat: 'no-repeat',
      border: '2px solid #000', boxShadow: '0 0 0 1px var(--osrs-bevel-hi, #5c5244), 0 0 0 3px #000', backgroundColor: '#0e0c0a',
    }}>
      <svg aria-hidden="true" viewBox={`0 0 ${cut.width} ${cut.height}`} width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
        {cut.edges.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth={4} vectorEffect="non-scaling-stroke" strokeLinecap="square" />
        ))}
        {cut.edges.map(([x1, y1, x2, y2], i) => (
          <line key={`y${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffff00" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="square" />
        ))}
      </svg>
      {marker && (() => {
        // Middle of the outlined chunks, in the crop's pixels.
        const xs = cut.edges.flatMap(([x1, , x2]) => [x1, x2]);
        const ys = cut.edges.flatMap(([, y1, , y2]) => [y1, y2]);
        const mx = ((Math.min(...xs) + Math.max(...xs)) / 2) * s;
        const my = ((Math.min(...ys) + Math.max(...ys)) / 2) * s;
        return <img src={marker} alt="" aria-hidden="true" className="osrs-px" width={markerSize} height={markerSize}
          style={{ position: 'absolute', left: mx - markerSize / 2, top: my - markerSize / 2, objectFit: 'contain' }} />;
      })()}
    </div>
  );
};

export default OsrsAreaMap;
