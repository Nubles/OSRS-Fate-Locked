import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { TableType } from '../types';
import { categoryColor } from '../utils/rarity';
import { X, Play, ZoomIn, ZoomOut, Sparkles, Maximize2 } from 'lucide-react';

import { COMBAT_POWERS_LABEL } from '../utils/tableDisplay';
interface Props { onClose: () => void; }

interface FNode {
  name: string;
  cat: string;
  label: string;
  color: string;
  time?: number;
  x: number; y: number;     // world coords
  hubX: number; hubY: number;
  order: number;            // chronological index (for the weave)
}
interface FHub { key: string; label: string; color: string; x: number; y: number; count: number; }

/**
 * The Fate Thread — a living tapestry of the run. Every fate-locked unlock is a
 * star, clustered by category around a pulsing core and stitched together by
 * threads of fate. Colours come from utils/rarity so it matches the rest of the
 * UI. Pan (drag), zoom (wheel / buttons), and "Weave" to replay your destiny in
 * the order it was unlocked.
 */
export const FateThread: React.FC<Props> = ({ onClose }) => {
  const { unlocks, history } = useGame();
  useEscapeKey(onClose, true);

  // ---- build the graph ------------------------------------------------------
  const { nodes, hubs, maxR } = useMemo(() => {
    const timeOf: Record<string, number> = {};
    for (const h of history) {
      if (h.type === 'UNLOCK' && (h.meta as any)?.item && !(((h.meta as any).item) in timeOf)) {
        timeOf[(h.meta as any).item] = h.timestamp;
      }
    }
    const skillNames = Object.keys(unlocks.skills || {}).filter(s => (unlocks.skills as any)[s] > 0);
    const gearNames = Object.keys(unlocks.equipment || {}).filter(s => (unlocks.equipment as any)[s] > 0);
    const defs: Array<[string, string, string[]]> = [
      [TableType.BOSSES, 'Bosses', unlocks.bosses],
      [TableType.REGIONS, 'Regions', unlocks.regions],
      [TableType.CHUNKS, 'Chunks', unlocks.chunks ?? []],
      [TableType.MINIGAMES, 'Minigames', unlocks.minigames],
      [TableType.GUILDS, 'Guilds', unlocks.guilds],
      [TableType.MOBILITY, 'Mobility', unlocks.mobility],
      [TableType.ARCANA, COMBAT_POWERS_LABEL, unlocks.arcana],
      [TableType.POH, 'Housing', unlocks.housing],
      [TableType.STORAGE, 'Storage', unlocks.storage],
      [TableType.MERCHANTS, 'Merchants', unlocks.merchants],
      [TableType.FARMING_LAYERS, 'Farming', unlocks.farming],
      [TableType.SKILLS, 'Skills', skillNames],
      [TableType.EQUIPMENT, 'Gear', gearNames],
    ];
    const cats = defs
      .map(([key, label, names]) => ({ key, label, color: categoryColor(key), names: (names || []) }))
      .filter(c => c.names.length > 0);

    const N = cats.length;
    const R_HUB = 170;
    const nodes: FNode[] = [];
    const hubs: FHub[] = [];
    let maxR = R_HUB;

    cats.forEach((cat, i) => {
      const theta = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
      const hx = R_HUB * Math.cos(theta), hy = R_HUB * Math.sin(theta);
      hubs.push({ key: cat.key, label: cat.label, color: cat.color, x: hx, y: hy, count: cat.names.length });
      const M = cat.names.length;
      const perRow = Math.max(1, Math.ceil(Math.sqrt(M)));
      cat.names.forEach((name, j) => {
        const row = Math.floor(j / perRow);
        const lastRow = Math.floor((M - 1) / perRow);
        const rowCount = row === lastRow ? ((M - 1) % perRow) + 1 : perRow;
        const r = R_HUB + 56 + row * 30;
        const a = theta + ((col(j, perRow) - (rowCount - 1) / 2) / Math.max(rowCount, 1)) * 1.05 * (R_HUB / r);
        const x = r * Math.cos(a), y = r * Math.sin(a);
        maxR = Math.max(maxR, r);
        nodes.push({ name, cat: cat.key, label: cat.label, color: cat.color, time: timeOf[name], x, y, hubX: hx, hubY: hy, order: 0 });
      });
    });
    // chronological order for the weave (unknown times sort first, as "seeded")
    nodes.sort((a, b) => (a.time ?? 0) - (b.time ?? 0)).forEach((n, idx) => { n.order = idx; });
    return { nodes, hubs, maxR };
  }, [unlocks, history]);

  // ---- viewport / pan & zoom ------------------------------------------------
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const fit = useCallback(() => {
    const el = wrapRef.current; if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    const scale = Math.min(w, h) / (maxR * 2.5 + 80);
    setView({ x: w / 2, y: h / 2, scale: Math.min(Math.max(scale, 0.25), 1.6) });
  }, [maxR]);
  useEffect(() => { fit(); }, [fit]);

  const onWheel = (e: React.WheelEvent) => {
    const f = e.deltaY < 0 ? 1.12 : 0.89;
    setView(v => ({ ...v, scale: Math.min(Math.max(v.scale * f, 0.2), 3) }));
  };
  const onDown = (e: React.MouseEvent) => { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setView(v => ({ ...v, x: drag.current!.vx + (e.clientX - drag.current!.x), y: drag.current!.vy + (e.clientY - drag.current!.y) }));
  };
  const onUp = () => { drag.current = null; };

  // ---- weave replay ---------------------------------------------------------
  const [weaveKey, setWeaveKey] = useState(0);
  const [weaving, setWeaving] = useState(false);
  const weave = () => { setWeaveKey(k => k + 1); setWeaving(true); window.setTimeout(() => setWeaving(false), nodes.length * 22 + 1400); };

  const [hover, setHover] = useState<FNode | null>(null);
  const twinkle = nodes.length <= 260; // keep it smooth on huge runs

  const total = nodes.length;
  const fmt = (t?: number) => (t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'seeded');

  return (
    <div className="fixed inset-0 z-[120] bg-[#06060a] flex flex-col" role="dialog" aria-modal="true" aria-label="Fate Thread">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <Sparkles className="text-amber-300" size={18} />
          <div>
            <h2 className="text-amber-200 font-black uppercase tracking-[0.2em] text-sm leading-none">Fate Thread</h2>
            <p className="text-[10px] text-gray-500 mt-1">{total} unlock{total !== 1 ? 's' : ''} woven across {hubs.length} {hubs.length === 1 ? 'strand' : 'strands'} of fate</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={weave} disabled={!total} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 transition-colors"><Play size={12} /> Weave</button>
          <button onClick={() => setView(v => ({ ...v, scale: Math.min(v.scale * 1.2, 3) }))} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10" aria-label="Zoom in"><ZoomIn size={14} /></button>
          <button onClick={() => setView(v => ({ ...v, scale: Math.max(v.scale * 0.83, 0.2) }))} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10" aria-label="Zoom out"><ZoomOut size={14} /></button>
          <button onClick={fit} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10" aria-label="Fit"><Maximize2 size={14} /></button>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 ml-1" aria-label="Close"><X size={16} /></button>
        </div>
      </div>

      {/* canvas */}
      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        style={{ background: 'radial-gradient(circle at 50% 45%, #131322 0%, #06060a 70%)' }}
      >
        {total === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <Sparkles className="text-gray-700 mb-3" size={40} />
            <p className="text-gray-400 font-bold">Your fate is unwritten.</p>
            <p className="text-gray-600 text-xs mt-1 max-w-xs">Roll keys and unlock content — each one becomes a star, threaded into your tapestry.</p>
          </div>
        ) : (
          <svg className="w-full h-full" key={weaveKey}>
            <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
              {/* threads: core -> hub */}
              {hubs.map(h => (
                <line key={'ch' + h.key} x1={0} y1={0} x2={h.x} y2={h.y}
                  stroke={h.color} strokeOpacity={0.35} strokeWidth={1.4}
                  strokeDasharray="3 5" style={{ animation: 'thread-flow 2.4s linear infinite' }} />
              ))}
              {/* threads: hub -> node */}
              {nodes.map((n, i) => (
                <line key={'hn' + i} x1={n.hubX} y1={n.hubY} x2={n.x} y2={n.y} stroke={n.color} strokeOpacity={0.14} strokeWidth={0.7} />
              ))}
              {/* hubs */}
              {hubs.map(h => (
                <g key={'h' + h.key}>
                  <circle cx={h.x} cy={h.y} r={7} fill={h.color} opacity={0.9} style={{ filter: `drop-shadow(0 0 6px ${h.color})` }} />
                  <text x={h.x} y={h.y - 12} textAnchor="middle" fill={h.color} fontSize={9} fontWeight={700} style={{ textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.85 }}>{h.label}</text>
                </g>
              ))}
              {/* nodes */}
              {nodes.map((n, i) => (
                <circle
                  key={'n' + i} cx={n.x} cy={n.y} r={hover === n ? 5 : 3.2}
                  fill={n.color}
                  style={{
                    filter: `drop-shadow(0 0 ${hover === n ? 8 : 4}px ${n.color})`,
                    cursor: 'pointer',
                    transformOrigin: `${n.x}px ${n.y}px`,
                    animation: weaving
                      ? `fate-node-in 0.5s ease-out ${n.order * 22}ms both`
                      : (twinkle ? `fate-twinkle ${2.5 + (i % 5) * 0.4}s ease-in-out ${(i % 7) * 0.2}s infinite` : undefined),
                  }}
                  onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(h => (h === n ? null : h))}
                />
              ))}
              {/* core */}
              <circle cx={0} cy={0} r={16} fill="url(#fateCore)" style={{ animation: 'fate-core 3s ease-in-out infinite', transformOrigin: '0px 0px' }} />
              <circle cx={0} cy={0} r={5} fill="#fde68a" style={{ filter: 'drop-shadow(0 0 10px #fbbf24)' }} />
            </g>
            <defs>
              <radialGradient id="fateCore">
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="45%" stopColor="#f59e0b" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </radialGradient>
            </defs>
          </svg>
        )}

        {/* hover tooltip */}
        {hover && (
          <div className="absolute bottom-4 left-4 bg-black/80 border border-white/15 rounded-lg px-3 py-2 pointer-events-none backdrop-blur-sm">
            <div className="text-[11px] font-bold text-white">{hover.name}</div>
            <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: hover.color }}>{hover.label} · unlocked {fmt(hover.time)}</div>
          </div>
        )}

        {/* legend */}
        <div className="absolute top-3 right-3 flex flex-col gap-1 bg-black/40 rounded-lg p-2 border border-white/10 max-h-[60%] overflow-y-auto custom-scrollbar pointer-events-none">
          {hubs.map(h => (
            <div key={'l' + h.key} className="flex items-center gap-1.5 text-[9px] text-gray-400">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: h.color, boxShadow: `0 0 4px ${h.color}` }} />
              <span className="truncate">{h.label}</span>
              <span className="text-gray-600 ml-auto pl-2">{h.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// local helper kept out of the hot path
function col(j: number, perRow: number): number { return j % perRow; }
