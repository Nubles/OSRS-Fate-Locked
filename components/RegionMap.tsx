
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';
import { Lock, Unlock, ZoomIn, ZoomOut, Move, Loader2, Download, Grid3x3, Paintbrush, Eye, EyeOff, ClipboardCopy, Trash2, FileDown, FileUp, Radio, Undo2, Redo2, Search, X, Target, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { ChunkActivityPanel } from './ChunkActivityPanel';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { REGION_CHUNKS } from '../data/regionChunks';
import { consumePendingChunk, chunkUnlocked, chunkForPlace } from '../utils/chunkLocations';
import { isFreeArea } from '../utils/freeAreas';
import { chunkContentService } from '../services/ChunkContentService';
import { chunkReachability } from '../utils/chunkReach';

type LensTone = 'good' | 'warn' | 'bad';
const TONE_FILL: Record<LensTone, string> = { good: 'rgba(16,185,129,0.30)', warn: 'rgba(245,158,11,0.10)', bad: 'rgba(239,68,68,0.22)' };
const TONE_STROKE: Record<LensTone, string> = { good: '#34d399', warn: '#f59e0b', bad: '#f87171' };

// Map marker overlays (stars/implings/crop circles/crime/clues). Keyed by the
// picker's category name; anything unlisted falls back to sky blue.
const OVERLAY_COLORS: Record<string, string> = {
  'Shooting Stars': '#38bdf8',
  'Impling Spawns': '#a78bfa',
  'Puro-Puro Entrances': '#fbbf24',
  'Organized Crime': '#4ade80',
  'Clues': '#e879f9',
};
const overlayColor = (cat: string) => OVERLAY_COLORS[cat] ?? '#38bdf8';


import {
  MAP_IMAGE,
  MAP_BOUNDS,
  CHUNK_TILES,
  TileCoord,
  ChunkCoord,
  tileToPixel,
  pixelToTile,
  tileToChunk,
} from '../utils/mapCoords';

const REGION_COORDS: Record<string, { x: number; y: number }> = {
  'Misthalin': { x: 73.41, y: 41.69 },
  'Asgarnia': { x: 65.97, y: 37.47 },
  'Kandarin': { x: 52.67, y: 39.47 },
  'Karamja': { x: 61.7, y: 53.5 },
  'Kharidian Desert': { x: 76.55, y: 59.68 },
  'Morytania': { x: 84.39, y: 36.65 },
  'Fremennik': { x: 55.96, y: 26.73 },
  'Tirannwn': { x: 41.69, y: 44.33 },
  'Wilderness': { x: 71.13, y: 20.58 },
  'Kourend & Kebos': { x: 20.77, y: 24.23 },
  'Varlamore': { x: 17.91, y: 47.45 },
  'Islands & Others': { x: 78, y: 25 },
  'The Open Seas': { x: 61.81, y: 74.35 }
};

// REGION_CHUNKS lives in data/regionChunks.ts (shared with utils/chunkLocations
// and the consistency tests). Re-exported here for back-compat.
export { REGION_CHUNKS } from '../data/regionChunks';



// Maps a leaf/sub-region back to its continent, derived once from
// REGION_GROUPS + MISTHALIN_AREAS. Used by isRegionUnlocked to walk
// the hierarchy.
const PARENT_CONTINENT: Record<string, string> = (() => {
  const parents: Record<string, string> = {};
  for (const [continent, subs] of Object.entries(REGION_GROUPS)) {
    for (const sub of subs) parents[sub] = continent;
  }
  for (const area of MISTHALIN_AREAS) parents[area] = 'Misthalin';
  return parents;
})();

// A chunk's region is unlocked if:
//  1. it's in ALWAYS_UNLOCKED_REGIONS, or
//  2. it appears directly in unlocks.regions, or
//  3. its parent continent is unlocked, or
//  4. its parent continent is "complete" (every sibling sub-region is unlocked),
//  5. or — if the region IS a continent — every one of its sub-regions is unlocked.
// Rule (4) is the "continent turns fully green once all sub-areas are done"
// rule and covers chunks tagged at the continent level too.
const isRegionUnlocked = (region: string, unlocks: string[]): boolean => {
  if (isFreeArea(region)) return true;
  if (unlocks.includes(region)) return true;
  const continent = PARENT_CONTINENT[region];
  if (continent) {
    if (isFreeArea(continent)) return true;
    if (unlocks.includes(continent)) return true;
    const siblings = continent === 'Misthalin' ? MISTHALIN_AREAS : (REGION_GROUPS[continent] ?? []);
    if (siblings.length > 0 && siblings.every(s => unlocks.includes(s) || isFreeArea(s))) return true;
  }
  const children = region === 'Misthalin' ? MISTHALIN_AREAS : REGION_GROUPS[region];
  if (children && children.length > 0 && children.every(s => unlocks.includes(s) || isFreeArea(s))) return true;
  return false;
};

// Every unlockable/assignable region name, deduped + alphabetised. Pulled
// from the existing unlock data so the authoring dropdown can't introduce
// typos that would fail to match unlocks.regions at runtime.
const AUTHORING_STORAGE_KEY = 'fate-region-chunks-draft-v1';
// Rolling backup that only advances when the draft is MORE substantial than
// what it currently holds. Protects against accidental seed-overwrites if
// the primary key is wiped or reset. Recovery-only — never auto-loaded.
const AUTHORING_BACKUP_KEY = 'fate-region-chunks-backup-v1';
// Pre-versioning drafts are stashed here once, in case an author needs them.
const LEGACY_RESCUE_KEY = 'fate-chunks-legacy-rescue-v1';

const countChunks = (d: Record<string, ChunkCoord[]>) =>
  Object.values(d).reduce((a, arr) => a + (Array.isArray(arr) ? arr.length : 0), 0);

// ── Seed-versioned drafts ───────────────────────────────────────────────────
// The authoring draft must not permanently shadow shipped data: when a new
// deploy changes REGION_CHUNKS / SUB_AREA_CHUNKS, viewers who never touched
// the authoring tool should see the update automatically. So each stored
// draft remembers (a) the hash of the shipped seed it came from and (b)
// whether the user actually edited it. Untouched drafts re-seed on a seed
// change; hand-edited drafts are kept (Wipe resets to the shipped baseline).
const hashStr = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
const SEED_HASH = hashStr(JSON.stringify(REGION_CHUNKS) + '|' + JSON.stringify(SUB_AREA_CHUNKS));

interface StoredDraft {
  v: 2;
  seed: string;
  dirty: boolean;
  data: Record<string, ChunkCoord[]>;
}
interface LoadedDraft {
  data: Record<string, ChunkCoord[]>;
  dirty: boolean;
  /** True when stale user edits were preserved over a newer shipped seed. */
  keptStaleEdits: boolean;
}

const loadVersionedDraft = (key: string, shipped: Record<string, ChunkCoord[]>): LoadedDraft => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 2 && parsed.data) {
        const stored = parsed as StoredDraft;
        if (stored.seed === SEED_HASH) return { data: stored.data, dirty: stored.dirty, keptStaleEdits: false };
        if (!stored.dirty) return { data: shipped, dirty: false, keptStaleEdits: false }; // stale seed, no edits → resync
        return { data: stored.data, dirty: true, keptStaleEdits: true };                   // keep real edits
      }
      // Legacy (pre-versioning) draft: can't tell edits from stale seed.
      // Resync to shipped — viewers get current data — but stash the old
      // draft once so an author can recover it.
      if (parsed && typeof parsed === 'object') {
        try {
          if (!localStorage.getItem(LEGACY_RESCUE_KEY)) localStorage.setItem(LEGACY_RESCUE_KEY, raw);
        } catch { /* ignore */ }
      }
    }
  } catch { /* fall through */ }
  return { data: shipped, dirty: false, keptStaleEdits: false };
};

const loadInitialDraft = (): LoadedDraft => loadVersionedDraft(AUTHORING_STORAGE_KEY, REGION_CHUNKS);

const GRID_LINE_COLOR = 'rgba(255,255,255,0.12)';
const UNLOCKED_FILL = 'rgba(16, 185, 129, 0.35)';
const LOCKED_FILL = 'rgba(239, 68, 68, 0.30)';
const ACTIVE_STROKE = 'rgba(250, 204, 21, 0.9)';

// ── Sub-area authoring layer ───────────────────────────────────────────────
// The map has two paintable layers: continents (REGION_CHUNKS, the broad
// landmass blocks) and named sub-areas within them (SUB_AREA_CHUNKS —
// Falador, Port Sarim, …, the granularity the unlock system tracks).
const CONTINENT_NAMES: string[] = ['Misthalin', ...Object.keys(REGION_GROUPS)].sort();
const SUB_AREA_NAMES: string[] = [...new Set([...MISTHALIN_AREAS, ...Object.values(REGION_GROUPS).flat()])].sort();
const SUBAREA_STORAGE_KEY = 'fate-subarea-chunks-draft-v1';

const loadInitialSubDraft = (): LoadedDraft => loadVersionedDraft(SUBAREA_STORAGE_KEY, SUB_AREA_CHUNKS);

const serializeSubDraft = (data: Record<string, ChunkCoord[]>) => {
  const entries = Object.entries(data)
    .filter(([, list]) => list.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
      return `  '${name.replace(/'/g, "\\'")}': [${sorted.map(c => `{ cx: ${c.cx}, cy: ${c.cy} }`).join(', ')}],`;
    });
  return `export const SUB_AREA_CHUNKS: Record<string, ChunkCoord[]> = {\n${entries.join('\n')}\n};`;
};

const chunkKey = (c: ChunkCoord) => `${c.cx},${c.cy}`;

const serializeDraft = (data: Record<string, ChunkCoord[]>) => {
  const entries = Object.entries(data)
    .filter(([, list]) => list.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
      const body = sorted.map(c => `    { cx: ${c.cx}, cy: ${c.cy} },`).join('\n');
      return `  '${name.replace(/'/g, "\\'")}': [\n${body}\n  ],`;
    });
  return `export const REGION_CHUNKS: Record<string, ChunkCoord[]> = {\n${entries.join('\n')}\n};`;
};

// Chunk-space offset between the web app's map coordinates and canonical OSRS
// runescript coordinates (what RuneLite reports as `WorldPoint.getX() >> 6`).
// MAP_BOUNDS is now calibrated exactly to the canonical chunk grid (see
// utils/mapCoords.ts), so our cx/cy already equal canonical region coords and
// no offset is required. Kept as an explicit field in RuneLite exports so the
// plugin never has to guess.
const RUNELITE_CHUNK_OFFSET = { cx: 0, cy: 0 } as const;

// The heavy, rarely-changing part of the map: the 9216x6528 image, ~600 chunk
// rects, the chunk grid and the region markers. Memoized so per-frame hover
// state updates in MapContent never reconcile this subtree — pans/zooms don't
// even reach React (they write the transform straight to the wrapper node).
interface MapSurfaceProps {
  chunkRects: { key: string; region: string; x: number; y: number; w: number; h: number; fill: string; isActive: boolean }[];
  gridLines: { verticals: { x: number; y1: number; y2: number }[]; horizontals: { y: number; x1: number; x2: number }[] };
  showGrid: boolean;
  rectBox: { cx0: number; cy0: number; cx1: number; cy1: number } | null;
  rectKind: 'add' | 'remove' | null;
  regionUnlocks: string[];
}

// Progressive map: a tiny low-res placeholder shows instantly (and sizes the
// surface), while the full-res image streams in and fades over it on load. The
// browser caches the full image, so on later mounts onLoad fires immediately.
const ProgressiveMapImage: React.FC = () => {
  const [hiLoaded, setHiLoaded] = useState(false);
  const hiRef = useRef<HTMLImageElement>(null);
  // When the full image is already in cache (every visit after the first), its
  // load event can fire before React attaches onLoad — leaving the image stuck
  // transparent so only the blurry placeholder ever shows. Reconcile on mount.
  useEffect(() => {
    if (hiRef.current?.complete && hiRef.current.naturalWidth > 0) setHiLoaded(true);
  }, []);
  return (
    <>
      <img
        src={MAP_IMAGE.srcLo}
        alt="OSRS World Map"
        className="w-full h-full object-fill pointer-events-none opacity-60 grayscale-[0.2]"
        draggable={false}
      />
      <img
        ref={hiRef}
        src={MAP_IMAGE.src}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-fill pointer-events-none grayscale-[0.2] transition-opacity duration-500"
        style={{ opacity: hiLoaded ? 0.6 : 0 }}
        draggable={false}
        decoding="async"
        fetchPriority="high"
        onLoad={() => setHiLoaded(true)}
      />
    </>
  );
};

const MapSurface = React.memo(({ chunkRects, gridLines, showGrid, rectBox, rectKind, regionUnlocks }: MapSurfaceProps) => (
  <>
    <ProgressiveMapImage />

    <svg
      className="absolute inset-0 pointer-events-none"
      width={MAP_IMAGE.width}
      height={MAP_IMAGE.height}
      viewBox={`0 0 ${MAP_IMAGE.width} ${MAP_IMAGE.height}`}
    >
      <g>
        {chunkRects.map(r => (
          <rect
            key={r.key}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={r.fill}
            stroke={r.isActive ? ACTIVE_STROKE : 'none'}
            strokeWidth={r.isActive ? 2 : 0}
          />
        ))}
      </g>

      {rectBox && (() => {
        const minCx = Math.min(rectBox.cx0, rectBox.cx1), maxCx = Math.max(rectBox.cx0, rectBox.cx1);
        const minCy = Math.min(rectBox.cy0, rectBox.cy1), maxCy = Math.max(rectBox.cy0, rectBox.cy1);
        const tl = tileToPixel({ tx: minCx * CHUNK_TILES, ty: (maxCy + 1) * CHUNK_TILES });
        const br = tileToPixel({ tx: (maxCx + 1) * CHUNK_TILES, ty: minCy * CHUNK_TILES });
        return (
          <rect
            x={tl.px} y={tl.py} width={br.px - tl.px} height={br.py - tl.py}
            fill={rectKind === 'remove' ? 'rgba(239,68,68,0.25)' : 'rgba(250,204,21,0.25)'}
            stroke={ACTIVE_STROKE} strokeWidth={3} strokeDasharray="10 7"
          />
        );
      })()}

      {showGrid && (
        <g stroke={GRID_LINE_COLOR} strokeWidth={1}>
          {gridLines.verticals.map(v => (
            <line key={`v${v.x}`} x1={v.x} x2={v.x} y1={v.y1} y2={v.y2} />
          ))}
          {gridLines.horizontals.map(h => (
            <line key={`h${h.y}`} x1={h.x1} x2={h.x2} y1={h.y} y2={h.y} />
          ))}
        </g>
      )}
    </svg>

    {Object.entries(REGION_COORDS).map(([region, coords]) => {
      const isMisthalin = region === 'Misthalin';
      const isUnlocked = isFreeArea(region) || regionUnlocks.includes(region);
      const subRegions = isMisthalin ? MISTHALIN_AREAS : REGION_GROUPS[region] || [];
      return (
        <div
          key={region}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 group/marker z-10"
          style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
        >
          <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 shadow-[0_0_15px_black] flex items-center justify-center transition-all duration-300 ${isUnlocked ? 'bg-emerald-900/90 border-emerald-400 text-emerald-400 hover:scale-125 hover:bg-emerald-800' : 'bg-red-900/90 border-red-500 text-red-500 hover:scale-110 grayscale-[0.5]'}`}>
            {isUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-black/95 border border-white/20 rounded p-3 opacity-0 group-hover/marker:opacity-100 transition-opacity pointer-events-none z-50 flex flex-col gap-2 scale-90 group-hover/marker:scale-100 origin-bottom duration-200">
            <h4 className={`font-bold text-sm border-b pb-1 ${isUnlocked ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>{region}</h4>
            <div className="flex flex-wrap gap-1">
              {subRegions.slice(0, 8).map(area => (
                <span key={area} className={`text-[9px] px-1.5 py-0.5 rounded text-gray-300 ${regionUnlocks.includes(area) || isFreeArea(area) ? 'bg-emerald-900/40 text-emerald-300' : 'bg-white/10'}`}>{area}</span>
              ))}
              {subRegions.length > 8 && <span className="text-[9px] text-gray-500">+{subRegions.length - 8} more...</span>}
            </div>
          </div>
        </div>
      );
    })}
  </>
));

interface GameSnapshot {
  keys: number; specialKeys: number; chaosKeys: number;
  fatePoints: number; activeBuff: string; pinnedGoals: string[];
}

const MapContent = React.memo(({ regionUnlocks, getGameSnapshot }: { regionUnlocks: string[]; getGameSnapshot: () => GameSnapshot }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContentRef = useRef<HTMLDivElement>(null);

  /** Write the pan/zoom transform straight to the surface node (no render). */
  const applyTransform = useCallback((t: { x: number; y: number; scale: number }) => {
    transformRef.current = t;
    const node = mapContentRef.current;
    if (node) node.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
  }, []);

  // Deep link: `fate:show-chunk` {cx, cy} (from the Oracle / palette / location
  // chips) opens this chunk's activity panel and centres the map on it. A
  // request fired before this map mounted is parked in chunkLocations and
  // consumed here on mount.
  useEffect(() => {
    const show = (chunk: ChunkCoord) => {
      setAuthoring(false);
      setSelectedChunk(chunk);
      // Centre the chunk in the viewport at a readable zoom. The container may
      // still be mounting when the event arrives (tab switch), so retry once.
      const centre = () => {
        const container = containerRef.current;
        if (!container) return false;
        const rect = container.getBoundingClientRect();
        if (rect.width === 0) return false;
        const scale = Math.max(transformRef.current.scale, 0.8);
        const { px, py } = tileToPixel({ tx: (chunk.cx + 0.5) * CHUNK_TILES, ty: (chunk.cy + 0.5) * CHUNK_TILES });
        applyTransform({ x: rect.width / 2 - px * scale, y: rect.height / 2 - py * scale, scale });
        return true;
      };
      // The container can be 0px when the tab is still mounting (esp. when the
      // map is reached programmatically, e.g. from the assistant). Poll briefly
      // until it has a size rather than giving up after one retry.
      if (!centre()) {
        let tries = 0;
        const timer = window.setInterval(() => {
          if (centre() || ++tries >= 15) window.clearInterval(timer);
        }, 100);
      }
    };
    const onShow = (e: Event) => {
      const d = (e as CustomEvent<{ cx?: number; cy?: number }>).detail;
      if (typeof d?.cx === 'number' && typeof d?.cy === 'number') show({ cx: d.cx, cy: d.cy });
    };
    // Consume a request that arrived before this map mounted (lazy tab).
    const pending = consumePendingChunk();
    if (pending) show(pending);
    window.addEventListener('fate:show-chunk', onShow);
    return () => window.removeEventListener('fate:show-chunk', onShow);
  }, [applyTransform]);

  // First-paint guard. The map surface is a huge (9216×6528) will-change:transform
  // layer; on first mount — especially while the tab content is animating in, or
  // when reached programmatically (a "show on map" redirect) — the browser
  // sometimes fails to rasterise it, so the map shows blank until a tab switch
  // forces a repaint. Toggling will-change off→on after the first frame tears
  // down and rebuilds the layer, forcing the missing paint. It's a sub-pixel
  // no-op visually.
  useEffect(() => {
    const node = mapContentRef.current;
    if (!node) return;
    const id = requestAnimationFrame(() => {
      node.style.willChange = 'auto';
      void node.offsetHeight; // flush a reflow between the two writes
      node.style.willChange = 'transform';
    });
    return () => cancelAnimationFrame(id);
  }, []);
  // Pan/zoom lives in a ref and is applied straight to the DOM node — going
  // through React state re-rendered the whole 600-element map surface on every
  // mousemove frame, which is what made dragging laggy.
  const transformRef = useRef({ x: -470, y: -288, scale: 0.2 });
  const [isExporting, setIsExporting] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [hoverTile, setHoverTile] = useState<TileCoord | null>(null);

  // ── Chunk lens ──────────────────────────────────────────────────────────────
  // Highlight every chunk that holds a chosen resource / monster (e.g. "Coal
  // rocks", "Yew tree"), or the best training node for a skill — unlocked chunks
  // brighter, locked ones dim, with a jump-to-match.
  const { unlocks } = useGame();
  const [lensReady, setLensReady] = useState(chunkContentService.ready);
  useEffect(() => { if (!lensReady) chunkContentService.init().then(() => setLensReady(true)); }, [lensReady]);
  const [lensInput, setLensInput] = useState('');
  const [lens, setLens] = useState<{ kind: 'entity' | 'reach' | 'drop'; key: string; label: string } | null>(null);
  const [onlyUnlocked, setOnlyUnlocked] = useState(false);
  const jumpIdx = useRef(0);

  // ── Map overlays ──────────────────────────────────────────────────────────
  // Marker layers from the picker export: shooting stars, impling spawns, crop
  // circles, organized-crime spots, clue steps. Toggle per category; optionally
  // restrict to chunks you own.
  const [overlayCats, setOverlayCats] = useState<Set<string>>(new Set());
  const [overlayOwnedOnly, setOverlayOwnedOnly] = useState(false);
  const overlayCategories = useMemo(() => (lensReady ? chunkContentService.overlayCategories() : []), [lensReady]);
  const toggleOverlay = useCallback((cat: string) => {
    setOverlayCats(prev => { const next = new Set(prev); next.has(cat) ? next.delete(cat) : next.add(cat); return next; });
  }, []);

  const lensSuggestions = useMemo(() => {
    if (!lensReady || lens || lensInput.trim().length < 2) return [];
    return chunkContentService.searchEntities(lensInput.trim(), 6);
  }, [lensInput, lensReady, lens]);

  // Item drops ("where do I get X") — shown alongside the entity suggestions.
  const lensItemSuggestions = useMemo(() => {
    if (!lensReady || lens || lensInput.trim().length < 2) return [];
    return chunkContentService.searchItems(lensInput.trim(), 5);
  }, [lensInput, lensReady, lens]);

  const lensResult = useMemo(() => {
    if (!lens || !lensReady) return null;

    // Reachability mode: paint your OWNED chunks by whether they connect to home.
    if (lens.kind === 'reach') {
      const res = chunkReachability(chunkContentService.connectGraph(), unlocks, chunkForPlace('Lumbridge'));
      const chunks: { cx: number; cy: number; tone: LensTone }[] = [];
      for (const id of res.reachable) { const n = +id; chunks.push({ cx: Math.floor(n / 256), cy: n % 256, tone: 'good' }); }
      for (const id of res.stranded) { const n = +id; chunks.push({ cx: Math.floor(n / 256), cy: n % 256, tone: 'bad' }); }
      return {
        chunks, primary: res.reachable.size, total: res.ownedCount,
        primaryLabel: 'reachable', totalLabel: 'owned',
        detail: res.stranded.size > 0 ? `${res.stranded.size} stranded (owned but no route from Lumbridge)` : 'Every owned chunk is reachable.',
        mode: 'reach' as const,
      };
    }

    // Find mode: highlight chunks holding a resource/entity (or best skill node).
    const seen = new Map<string, { cx: number; cy: number; tone: LensTone }>();
    const add = (cx: number, cy: number) => {
      const k = `${cx},${cy}`;
      if (!seen.has(k)) seen.set(k, { cx, cy, tone: chunkUnlocked(cx, cy, unlocks) ? 'good' : 'warn' });
    };
    let detail = '';
    if (lens.kind === 'drop') {
      const monsters = chunkContentService.itemSources(lens.key);
      const located = new Set<string>();
      for (const m of monsters) {
        const hit = chunkContentService.entityLocations(m, ['monster']);
        if (hit?.locations.length) { located.add(m); for (const l of hit.locations) add(l.cx, l.cy); }
      }
      detail = located.size
        ? `Dropped by ${[...located].slice(0, 3).join(', ')}${located.size > 3 ? `, +${located.size - 3}` : ''}`
        : `Dropped by ${monsters.length} monster${monsters.length === 1 ? '' : 's'} — none in the chunk map.`;
    } else {
      const hit = chunkContentService.entityLocations(lens.key);
      for (const l of hit?.locations ?? []) add(l.cx, l.cy);
    }
    const chunks = [...seen.values()];
    return {
      chunks, primary: chunks.filter(c => c.tone === 'good').length, total: chunks.length,
      primaryLabel: 'unlocked', totalLabel: 'total', detail, mode: 'find' as const,
    };
  }, [lens, lensReady, unlocks]);

  const visibleLensChunks = useMemo(
    () => (lensResult ? (onlyUnlocked && lensResult.mode === 'find' ? lensResult.chunks.filter(c => c.tone === 'good') : lensResult.chunks) : []),
    [lensResult, onlyUnlocked],
  );

  const highlightRects = useMemo(() => {
    const chunkPx = CHUNK_TILES * (MAP_IMAGE.width / (MAP_BOUNDS.tileMaxX - MAP_BOUNDS.tileMinX));
    const chunkPy = CHUNK_TILES * (MAP_IMAGE.height / (MAP_BOUNDS.tileMaxY - MAP_BOUNDS.tileMinY));
    return visibleLensChunks.map(c => {
      const { px, py } = tileToPixel({ tx: c.cx * CHUNK_TILES, ty: (c.cy + 1) * CHUNK_TILES });
      return { key: `${c.cx},${c.cy}`, x: px, y: py, w: chunkPx, h: chunkPy, tone: c.tone };
    });
  }, [visibleLensChunks]);

  const overlayMarkers = useMemo(() => {
    if (!lensReady || overlayCats.size === 0) return [];
    const all = chunkContentService.overlays();
    const out: { key: string; x: number; y: number; color: string; owned: boolean }[] = [];
    let i = 0;
    for (const cat of overlayCats) {
      const color = overlayColor(cat);
      for (const p of all[cat] ?? []) {
        const owned = chunkUnlocked(p.cx, p.cy, unlocks);
        if (overlayOwnedOnly && !owned) continue;
        const { px, py } = tileToPixel({ tx: p.x, ty: p.y });
        out.push({ key: `${cat}:${i++}`, x: px, y: py, color, owned });
      }
    }
    return out;
  }, [lensReady, overlayCats, overlayOwnedOnly, unlocks]);

  const clearLens = useCallback(() => { setLens(null); setLensInput(''); jumpIdx.current = 0; }, []);
  const pickLens = useCallback((kind: 'entity' | 'reach' | 'drop', key: string, label: string) => {
    setLens({ kind, key, label }); setLensInput(''); jumpIdx.current = 0;
  }, []);
  const jumpToMatch = useCallback((dir: number) => {
    const list = visibleLensChunks;
    if (!list.length) return;
    jumpIdx.current = ((jumpIdx.current + dir) % list.length + list.length) % list.length;
    const c = list[jumpIdx.current];
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width) return;
    const scale = Math.max(transformRef.current.scale, 0.7);
    const { px, py } = tileToPixel({ tx: (c.cx + 0.5) * CHUNK_TILES, ty: (c.cy + 0.5) * CHUNK_TILES });
    applyTransform({ x: rect.width / 2 - px * scale, y: rect.height / 2 - py * scale, scale });
  }, [visibleLensChunks, applyTransform]);
  // Coalesce hover updates to one state set per animation frame — mousemove
  // can fire far more often than the readout needs to repaint.
  const hoverRaf = useRef<number | null>(null);
  const pendingHover = useRef<TileCoord | null>(null);
  const queueHover = (t: TileCoord | null) => {
    pendingHover.current = t;
    if (hoverRaf.current == null) {
      hoverRaf.current = requestAnimationFrame(() => {
        hoverRaf.current = null;
        setHoverTile(pendingHover.current);
      });
    }
  };
  useEffect(() => () => { if (hoverRaf.current != null) cancelAnimationFrame(hoverRaf.current); }, []);

  const [authoring, setAuthoring] = useState(false);
  const [activeRegion, setActiveRegion] = useState<string>(CONTINENT_NAMES[0] ?? '');
  const [soloView, setSoloView] = useState(false);
  // Seed-versioned drafts: untouched drafts auto-resync to new shipped data;
  // hand-edited ones are kept (and flagged so we can tell the author below).
  const [initialRegionLoad] = useState(loadInitialDraft);
  const [initialSubLoad] = useState(loadInitialSubDraft);
  const [draftChunks, setDraftChunks] = useState<Record<string, ChunkCoord[]>>(initialRegionLoad.data);
  const [regionDirty, setRegionDirty] = useState(initialRegionLoad.dirty);
  // Sub-area layer: which authoring level is active, the sub-area being
  // painted, and its own draft (seeded from data/subAreaChunks.ts).
  const [authorLevel, setAuthorLevel] = useState<'REGION' | 'SUBAREA'>('REGION');
  const [activeSubArea, setActiveSubArea] = useState<string>(SUB_AREA_NAMES[0] ?? '');
  const [subDraft, setSubDraft] = useState<Record<string, ChunkCoord[]>>(initialSubLoad.data);
  const [subDirty, setSubDirty] = useState(initialSubLoad.dirty);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<ChunkCoord | null>(null);

  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const paintMode = useRef<'add' | 'remove' | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── Undo / redo — one snapshot per gesture (so a whole drag undoes at once).
  // Snapshots capture BOTH layers so undo works regardless of which level the
  // gesture edited.
  type LayerSnapshot = { r: Record<string, ChunkCoord[]>; s: Record<string, ChunkCoord[]> };
  const [undoStack, setUndoStack] = useState<LayerSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<LayerSnapshot[]>([]);
  const draftRef = useRef(draftChunks);
  const subRef = useRef(subDraft);
  const undoRef = useRef(undoStack);
  const redoRef = useRef(redoStack);
  useEffect(() => { draftRef.current = draftChunks; }, [draftChunks]);
  useEffect(() => { subRef.current = subDraft; }, [subDraft]);
  useEffect(() => { undoRef.current = undoStack; }, [undoStack]);
  useEffect(() => { redoRef.current = redoStack; }, [redoStack]);
  const snapshot = (): LayerSnapshot => ({ r: draftRef.current, s: subRef.current });
  const restore = (snap: LayerSnapshot) => { setDraftChunks(snap.r); setSubDraft(snap.s); };
  // Every editing gesture calls pushHistory first, so it doubles as the
  // dirty-marker: only hand-edited drafts survive a shipped-seed change.
  const pushHistory = () => {
    if (authorLevel === 'SUBAREA') setSubDirty(true); else setRegionDirty(true);
    setUndoStack(s => [...s.slice(-49), snapshot()]);
    setRedoStack([]);
  };
  const undo = useCallback(() => {
    const s = undoRef.current; if (!s.length) return;
    setRedoStack(r => [...r, snapshot()]);
    setUndoStack(s.slice(0, -1));
    restore(s[s.length - 1]);
    setRegionDirty(true); setSubDirty(true); // restore touches both layers
  }, []);
  const redo = useCallback(() => {
    const r = redoRef.current; if (!r.length) return;
    setUndoStack(u => [...u, snapshot()]);
    setRedoStack(r.slice(0, -1));
    restore(r[r.length - 1]);
    setRegionDirty(true); setSubDirty(true);
  }, []);

  // ── Rectangle fill (Alt+drag a box) ─────────────────────────────────────────
  const rectStart = useRef<ChunkCoord | null>(null);
  const rectEnd = useRef<ChunkCoord | null>(null);
  const rectMode = useRef<'add' | 'remove' | null>(null);
  const [rectBox, setRectBox] = useState<{ cx0: number; cy0: number; cx1: number; cy1: number } | null>(null);

  useEffect(() => {
    try {
      const envelope: StoredDraft = { v: 2, seed: SEED_HASH, dirty: regionDirty, data: draftChunks };
      const serialized = JSON.stringify(envelope);
      localStorage.setItem(AUTHORING_STORAGE_KEY, serialized);
      // Only advance the backup when current state is at least as big as
      // whatever the backup holds. A shrinking draft (wipe, clear, refresh
      // race, etc.) never overwrites the backup — recovery-only, never
      // auto-loaded.
      const backupRaw = localStorage.getItem(AUTHORING_BACKUP_KEY);
      let backupCount = 0;
      if (backupRaw) {
        const parsed = JSON.parse(backupRaw);
        backupCount = countChunks(parsed?.v === 2 ? parsed.data : parsed);
      }
      if (countChunks(draftChunks) >= backupCount) {
        localStorage.setItem(AUTHORING_BACKUP_KEY, serialized);
      }
    } catch { /* quota or parse error — ignore */ }
  }, [draftChunks, regionDirty]);

  // Persist the sub-area layer + derive the chunk -> sub-area lookup that
  // drives per-chunk unlock colouring and the activity panel's header.
  useEffect(() => {
    try {
      const envelope: StoredDraft = { v: 2, seed: SEED_HASH, dirty: subDirty, data: subDraft };
      localStorage.setItem(SUBAREA_STORAGE_KEY, JSON.stringify(envelope));
    } catch { /* ignore */ }
  }, [subDraft, subDirty]);

  // Tell an author once when their hand-edits were kept over a newer seed.
  useEffect(() => {
    if (initialRegionLoad.keptStaleEdits || initialSubLoad.keptStaleEdits) {
      showToast('map data updated — your local edits kept (Wipe to sync)');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const chunkSubArea = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [sub, chunks] of Object.entries(subDraft)) for (const c of chunks) m[chunkKey(c)] = sub;
    return m;
  }, [subDraft]);
  const chunkOnMap = (chunk: ChunkCoord) =>
    Object.values(draftChunks).some(list => list.some(c => c.cx === chunk.cx && c.cy === chunk.cy));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const prev = transformRef.current;
      const factor = Math.exp(-e.deltaY * 0.001);
      const newScale = Math.min(Math.max(0.2, prev.scale * factor), 5);
      const newX = mouseX - (mouseX - prev.x) * (newScale / prev.scale);
      const newY = mouseY - (mouseY - prev.y) * (newScale / prev.scale);
      applyTransform({ x: newX, y: newY, scale: newScale });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Undo / redo keyboard shortcuts (authoring only).
  useEffect(() => {
    if (!authoring) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authoring, undo, redo]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 1600);
  };

  const chunkAtEvent = (clientX: number, clientY: number): ChunkCoord | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const t = transformRef.current;
    const localX = (clientX - rect.left - t.x) / t.scale;
    const localY = (clientY - rect.top - t.y) / t.scale;
    if (localX < 0 || localY < 0 || localX > MAP_IMAGE.width || localY > MAP_IMAGE.height) return null;
    return tileToChunk(pixelToTile({ px: localX, py: localY }));
  };

  /** Single-assignment add into whichever layer is active. */
  const addChunkToActive = (chunk: ChunkCoord) => {
    if (authorLevel === 'SUBAREA') {
      if (!activeSubArea) return;
      if (!chunkOnMap(chunk)) { showToast('not on the map — paint it at Region level first'); return; }
      setSubDraft(prev => {
        const next: Record<string, ChunkCoord[]> = {};
        for (const [name, list] of Object.entries(prev)) {
          const filtered = list.filter(c => c.cx !== chunk.cx || c.cy !== chunk.cy);
          if (filtered.length) next[name] = filtered;
        }
        next[activeSubArea] = [...(next[activeSubArea] ?? []), chunk];
        return next;
      });
      return;
    }
    if (!activeRegion) return;
    setDraftChunks(prev => {
      const next: Record<string, ChunkCoord[]> = {};
      // Single-assignment: remove this chunk from any other region first.
      for (const [name, list] of Object.entries(prev)) {
        const filtered = list.filter(c => c.cx !== chunk.cx || c.cy !== chunk.cy);
        if (filtered.length) next[name] = filtered;
      }
      next[activeRegion] = [...(next[activeRegion] ?? []), chunk];
      return next;
    });
  };

  const removeChunk = (chunk: ChunkCoord) => {
    const strip = (prev: Record<string, ChunkCoord[]>) => {
      const next: Record<string, ChunkCoord[]> = {};
      for (const [name, list] of Object.entries(prev)) {
        const filtered = list.filter(c => c.cx !== chunk.cx || c.cy !== chunk.cy);
        if (filtered.length) next[name] = filtered;
      }
      return next;
    };
    if (authorLevel === 'SUBAREA') setSubDraft(strip);
    else setDraftChunks(strip);
  };

  // Fill (or clear) every chunk inside the dragged box for the active layer.
  const applyRect = (mode: 'add' | 'remove') => {
    const a = rectStart.current, b = rectEnd.current;
    if (!a || !b) return;
    const activeName = authorLevel === 'SUBAREA' ? activeSubArea : activeRegion;
    if (mode === 'add' && !activeName) return;
    const minCx = Math.min(a.cx, b.cx), maxCx = Math.max(a.cx, b.cx);
    const minCy = Math.min(a.cy, b.cy), maxCy = Math.max(a.cy, b.cy);
    const inBox = (c: ChunkCoord) => c.cx >= minCx && c.cx <= maxCx && c.cy >= minCy && c.cy <= maxCy;
    const apply = (prev: Record<string, ChunkCoord[]>) => {
      const next: Record<string, ChunkCoord[]> = {};
      // Clear the box from every entry first (keeps single-assignment).
      for (const [name, list] of Object.entries(prev)) {
        const filtered = list.filter(c => !inBox(c));
        if (filtered.length) next[name] = filtered;
      }
      if (mode === 'add') {
        const add: ChunkCoord[] = [];
        for (let cx = minCx; cx <= maxCx; cx++) for (let cy = minCy; cy <= maxCy; cy++) {
          const c = { cx, cy };
          // Sub-areas can only cover chunks that exist on the map.
          if (authorLevel === 'SUBAREA' && !chunkOnMap(c)) continue;
          add.push(c);
        }
        next[activeName] = [...(next[activeName] ?? []), ...add];
      }
      return next;
    };
    if (authorLevel === 'SUBAREA') setSubDraft(apply);
    else setDraftChunks(apply);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.button !== 0 && e.button !== 2) return;
    didDrag.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    // Alt+drag = rectangle fill (Alt+right-drag = rectangle erase).
    if (authoring && e.altKey) {
      didDrag.current = true; // so the trailing onClick bails
      pushHistory();
      rectMode.current = e.button === 2 ? 'remove' : 'add';
      const c = chunkAtEvent(e.clientX, e.clientY);
      rectStart.current = c; rectEnd.current = c;
      setRectBox(c ? { cx0: c.cx, cy0: c.cy, cx1: c.cx, cy1: c.cy } : null);
      return;
    }
    if (authoring && e.shiftKey) {
      pushHistory();
      paintMode.current = e.button === 2 ? 'remove' : 'add';
      const chunk = chunkAtEvent(e.clientX, e.clientY);
      if (chunk) {
        paintMode.current === 'add' ? addChunkToActive(chunk) : removeChunk(chunk);
      }
      return;
    }
    if (e.button === 0) isDragging.current = true;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (rectMode.current) {
      const c = chunkAtEvent(e.clientX, e.clientY);
      if (c && rectStart.current) {
        rectEnd.current = c;
        setRectBox({ cx0: rectStart.current.cx, cy0: rectStart.current.cy, cx1: c.cx, cy1: c.cy });
      }
    } else if (paintMode.current) {
      const chunk = chunkAtEvent(e.clientX, e.clientY);
      if (chunk) {
        paintMode.current === 'add' ? addChunkToActive(chunk) : removeChunk(chunk);
      }
    } else if (isDragging.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) didDrag.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      const prev = transformRef.current;
      applyTransform({ ...prev, x: prev.x + dx, y: prev.y + dy });
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t = transformRef.current;
    const localX = (e.clientX - rect.left - t.x) / t.scale;
    const localY = (e.clientY - rect.top - t.y) / t.scale;
    if (localX < 0 || localY < 0 || localX > MAP_IMAGE.width || localY > MAP_IMAGE.height) {
      queueHover(null);
    } else {
      queueHover(pixelToTile({ px: localX, py: localY }));
    }
  };

  const onMouseUp = () => {
    isDragging.current = false;
    if (rectMode.current) {
      applyRect(rectMode.current);
      rectMode.current = null;
      rectStart.current = null;
      rectEnd.current = null;
      setRectBox(null);
    }
    // Defer clearing paintMode so onClick (which fires after mouseup) can still bail.
    window.setTimeout(() => { paintMode.current = null; }, 0);
  };

  const onClick = (e: React.MouseEvent) => {
    if (didDrag.current || paintMode.current) return;
    const chunk = chunkAtEvent(e.clientX, e.clientY);
    if (!chunk) return;
    if (authoring) {
      pushHistory();
      addChunkToActive(chunk);
    } else {
      // Open the activity panel for the clicked chunk ("what can I play here?").
      setSelectedChunk(prev => (prev && prev.cx === chunk.cx && prev.cy === chunk.cy ? null : chunk));
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (!authoring) return;
    e.preventDefault();
    if (e.shiftKey || e.altKey) return; // shift = paint-erase, alt = rect-erase (handled in mousedown)
    const chunk = chunkAtEvent(e.clientX, e.clientY);
    if (chunk) { pushHistory(); removeChunk(chunk); }
  };

  const handleExport = async () => {
    if (!mapContentRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(mapContentRef.current, {
        useCORS: true,
        allowTaint: true,
        width: MAP_IMAGE.width,
        height: MAP_IMAGE.height,
        scale: 1,
        logging: false,
        backgroundColor: '#0b0d10',
        onclone: (doc) => {
          const el = doc.getElementById('map-content-inner');
          if (el) {
            el.style.transform = 'none';
            el.style.top = '0';
            el.style.left = '0';
          }
        }
      });
      const link = document.createElement('a');
      link.download = `fate-locked-map-${Date.now()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.8);
      link.click();
    } catch (err) {
      console.error("Map export failed:", err);
      showToast('map image export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const exportDraftToClipboard = async () => {
    const isSub = authorLevel === 'SUBAREA';
    const code = isSub ? serializeSubDraft(subDraft) : serializeDraft(draftChunks);
    const label = isSub ? 'SUB_AREA_CHUNKS' : 'REGION_CHUNKS';
    // navigator.clipboard silently rejects on non-HTTPS origins and when the
    // document isn't focused, so fall back to the execCommand textarea trick,
    // then to a manual prompt — and surface the char count so a successful
    // (or empty) copy is never ambiguous.
    let copied = false;
    try { await navigator.clipboard.writeText(code); copied = true; } catch { /* fall through */ }
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { /* fall through */ }
    }
    if (copied) showToast(`${label} copied (${code.length} chars)`);
    else window.prompt(`Copy this into ${isSub ? 'data/subAreaChunks.ts' : 'REGION_CHUNKS'}:`, code);
  };

  const exportRuneLiteBundle = () => {
    // v2 bundle: adds the sub-area layer, the region hierarchy (so the plugin
    // resolves lock state exactly like the app), and live run state for the
    // in-game HUD. The plugin still accepts v1 bundles.
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      chunkOffset: RUNELITE_CHUNK_OFFSET,
      chunks: draftChunks,
      subAreaChunks: subDraft,
      regionGroups: { Misthalin: MISTHALIN_AREAS, ...REGION_GROUPS },
      unlockedRegions: regionUnlocks,
      state: getGameSnapshot(),
    };
    const json = JSON.stringify(payload, null, 2);
    // Clipboard first (paste straight into the plugin's side panel)…
    navigator.clipboard?.writeText(json).catch(() => {});
    // …and the file download for the watch-this-path workflow.
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fate-locked-bundle-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('RuneLite bundle copied + downloaded');
  };

  const exportDraftJson = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      chunks: draftChunks,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fate-region-chunks-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const regionCount = Object.values(draftChunks).filter(arr => arr.length > 0).length;
    showToast(`exported ${regionCount} regions as JSON`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const raw = parsed && typeof parsed === 'object' && 'chunks' in parsed ? parsed.chunks : parsed;
      if (!raw || typeof raw !== 'object') throw new Error('missing chunks object');
      const cleaned: Record<string, ChunkCoord[]> = {};
      for (const [region, list] of Object.entries(raw)) {
        if (!Array.isArray(list)) throw new Error(`"${region}" is not an array`);
        const coords: ChunkCoord[] = [];
        for (const c of list) {
          if (!c || typeof c !== 'object' || typeof (c as any).cx !== 'number' || typeof (c as any).cy !== 'number') {
            throw new Error(`bad chunk in "${region}"`);
          }
          coords.push({ cx: (c as any).cx, cy: (c as any).cy });
        }
        cleaned[region] = coords;
      }
      const regionCount = Object.values(cleaned).filter(arr => arr.length > 0).length;
      const chunkCount = Object.values(cleaned).reduce((a, arr) => a + arr.length, 0);
      if (!window.confirm(`Replace current draft with ${regionCount} regions / ${chunkCount} chunks from "${file.name}"?`)) return;
      pushHistory();
      setDraftChunks(cleaned);
      showToast(`imported ${regionCount} regions`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`import failed: ${msg}`);
    }
  };

  // "Wipe" = sync back to the shipped baseline (discard local edits). The
  // draft becomes non-dirty again, so future deploys auto-resync it too.
  const clearDraft = () => {
    if (authorLevel === 'SUBAREA') {
      if (!window.confirm('Reset sub-area assignments to the shipped baseline?\n\nYour local sub-area edits are discarded (undo can bring them back this session).')) return;
      pushHistory();
      setSubDraft(SUB_AREA_CHUNKS);
      setSubDirty(false);
      showToast('sub-areas reset to shipped baseline');
      return;
    }
    if (!window.confirm('Reset region chunks to the shipped baseline?\n\nYour local region edits are discarded (undo can bring them back this session).')) return;
    pushHistory();
    setDraftChunks(REGION_CHUNKS);
    setRegionDirty(false);
    showToast('regions reset to shipped baseline');
  };

  const clearActiveRegion = () => {
    const isSub = authorLevel === 'SUBAREA';
    const name = isSub ? activeSubArea : activeRegion;
    if (!name) return;
    if (!window.confirm(`Clear all chunks for "${name}"?`)) return;
    pushHistory();
    const drop = (prev: Record<string, ChunkCoord[]>) => {
      const next = { ...prev };
      delete next[name];
      return next;
    };
    if (isSub) setSubDraft(drop);
    else setDraftChunks(drop);
    showToast(`cleared "${name}"`);
  };

  const gridLines = useMemo(() => {
    const verticals: { x: number; y1: number; y2: number }[] = [];
    const horizontals: { y: number; x1: number; x2: number }[] = [];
    const firstCx = Math.ceil(MAP_BOUNDS.tileMinX / CHUNK_TILES);
    const lastCx = Math.floor(MAP_BOUNDS.tileMaxX / CHUNK_TILES);
    const firstCy = Math.ceil(MAP_BOUNDS.tileMinY / CHUNK_TILES);
    const lastCy = Math.floor(MAP_BOUNDS.tileMaxY / CHUNK_TILES);
    for (let cx = firstCx; cx <= lastCx; cx++) {
      const { px } = tileToPixel({ tx: cx * CHUNK_TILES, ty: MAP_BOUNDS.tileMinY });
      verticals.push({ x: px, y1: 0, y2: MAP_IMAGE.height });
    }
    for (let cy = firstCy; cy <= lastCy; cy++) {
      const { py } = tileToPixel({ tx: MAP_BOUNDS.tileMinX, ty: cy * CHUNK_TILES });
      horizontals.push({ y: py, x1: 0, x2: MAP_IMAGE.width });
    }
    return { verticals, horizontals };
  }, []);

  const chunkRects = useMemo(() => {
    const chunkPx = CHUNK_TILES * (MAP_IMAGE.width / (MAP_BOUNDS.tileMaxX - MAP_BOUNDS.tileMinX));
    const chunkPy = CHUNK_TILES * (MAP_IMAGE.height / (MAP_BOUNDS.tileMaxY - MAP_BOUNDS.tileMinY));
    const rects: { key: string; region: string; x: number; y: number; w: number; h: number; fill: string; isActive: boolean }[] = [];
    const subLevel = authoring && authorLevel === 'SUBAREA';
    for (const [region, chunks] of Object.entries(draftChunks)) {
      const regionActive = authoring && !subLevel && region === activeRegion;
      if (soloView && authoring && !subLevel && !regionActive) continue;
      const continentUnlocked = isRegionUnlocked(region, regionUnlocks);
      for (const { cx, cy } of chunks) {
        // Sub-area-aware colouring: a chunk inside a named sub-area (e.g. the
        // Falador chunks) reflects THAT area's unlock state, not the whole
        // continent's. Unnamed in-between chunks fall back to the continent.
        const subArea = chunkSubArea[`${cx},${cy}`];
        // At the sub-area authoring level the yellow "active" stroke marks the
        // chunks of the selected sub-area, and Solo hides everything else.
        const isActive = subLevel ? subArea === activeSubArea : regionActive;
        if (soloView && subLevel && !isActive) continue;
        const unlocked = subArea ? isRegionUnlocked(subArea, regionUnlocks) : continentUnlocked;
        const fill = unlocked ? UNLOCKED_FILL : LOCKED_FILL;
        const { px, py } = tileToPixel({ tx: cx * CHUNK_TILES, ty: (cy + 1) * CHUNK_TILES });
        rects.push({ key: `${region}:${cx},${cy}`, region, x: px, y: py, w: chunkPx, h: chunkPy, fill, isActive });
      }
    }
    return rects;
  }, [draftChunks, chunkSubArea, regionUnlocks, authoring, authorLevel, activeRegion, activeSubArea, soloView]);

  const activeChunkCount = authorLevel === 'SUBAREA'
    ? (subDraft[activeSubArea]?.length ?? 0)
    : (draftChunks[activeRegion]?.length ?? 0);
  const totalRegionsWithChunks = authorLevel === 'SUBAREA'
    ? Object.values(subDraft).filter(arr => arr.length > 0).length
    : Object.values(draftChunks).filter(arr => arr.length > 0).length;
  const hoverChunk = hoverTile ? tileToChunk(hoverTile) : null;

  return (
    <div className="h-[600px] w-full bg-[#0b0d10] rounded-lg border border-white/10 relative overflow-hidden group select-none shadow-inner">
      {/* ── Chunk lens control ─────────────────────────────────────────────── */}
      {!authoring && (
        <div className="absolute top-2 left-2 z-30 w-64 max-w-[70%]">
          <div className="bg-[#101010]/95 border border-white/15 rounded-lg shadow-xl backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <Search size={13} className="text-gray-500 shrink-0" />
              <input
                value={lensInput}
                onChange={(e) => setLensInput(e.target.value)}
                placeholder={lens ? lens.label : 'Highlight coal, yews, a monster…'}
                className="flex-1 min-w-0 bg-transparent text-[11px] text-gray-200 placeholder:text-gray-600 focus:outline-none"
              />
              {lens && <button onClick={clearLens} title="Clear" className="text-gray-500 hover:text-white shrink-0"><X size={13} /></button>}
            </div>

            {(lensSuggestions.length > 0 || lensItemSuggestions.length > 0) && (
              <div className="max-h-52 overflow-y-auto custom-scrollbar border-t border-white/5">
                {lensSuggestions.map(s => (
                  <button
                    key={s.kind + s.name}
                    onClick={() => pickLens('entity', s.name, s.name)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1 text-left hover:bg-white/10"
                  >
                    <span className="text-[11px] text-gray-200 truncate">{s.name}</span>
                    <span className="text-[9px] text-gray-500 font-mono shrink-0">{s.kind} · {s.locations.length}</span>
                  </button>
                ))}
                {lensItemSuggestions.map(it => (
                  <button
                    key={'item:' + it.name}
                    onClick={() => pickLens('drop', it.name, it.name)}
                    title="Highlight chunks whose monsters drop this item"
                    className="w-full flex items-center justify-between gap-2 px-2 py-1 text-left hover:bg-white/10"
                  >
                    <span className="text-[11px] text-amber-200/90 truncate">{it.name}</span>
                    <span className="text-[9px] text-amber-500/70 font-mono shrink-0">drop · {it.sources}</span>
                  </button>
                ))}
              </div>
            )}

            {!lens && lensSuggestions.length === 0 && lensItemSuggestions.length === 0 && (
              <button
                onClick={() => pickLens('reach', 'reach', 'Reachability')}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 border-t border-white/5 text-left hover:bg-white/5"
              >
                <Target size={12} className="text-emerald-400 shrink-0" />
                <span className="text-[10px] text-gray-400">Reachability — find stranded unlocks</span>
              </button>
            )}

            {lens && lensResult && (
              <div className="px-2 py-1.5 border-t border-white/5 space-y-1.5">
                {lens.kind !== 'entity' && <div className="text-[11px] font-semibold text-gray-200 truncate">{lens.label}</div>}
                {lensResult.detail && <div className="text-[9px] text-gray-500 leading-snug">{lensResult.detail}</div>}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-gray-400">
                    <span className={lensResult.mode === 'reach' ? 'text-emerald-300' : 'text-emerald-300'}>{lensResult.primary}</span> {lensResult.primaryLabel} · {lensResult.total} {lensResult.totalLabel}
                  </span>
                  {lensResult.mode === 'find' && (
                    <label className="flex items-center gap-1 text-[9px] text-gray-500 cursor-pointer shrink-0">
                      <input type="checkbox" checked={onlyUnlocked} onChange={(e) => setOnlyUnlocked(e.target.checked)} className="accent-emerald-500" />
                      only unlocked
                    </label>
                  )}
                </div>
                {visibleLensChunks.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => jumpToMatch(-1)} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300"><ChevronLeft size={12} /></button>
                    <span className="flex-1 text-center text-[9px] text-gray-500 flex items-center justify-center gap-1"><Target size={9} /> jump to match</span>
                    <button onClick={() => jumpToMatch(1)} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300"><ChevronRight size={12} /></button>
                  </div>
                ) : (
                  <div className="text-[9px] text-gray-600 text-center">No matching chunks.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Map overlay layers ─────────────────────────────────────────────── */}
      {!authoring && overlayCategories.length > 0 && (
        <div className="absolute bottom-2 left-2 z-30 w-56 max-w-[70%]">
          <div className="bg-[#101010]/95 border border-white/15 rounded-lg shadow-xl backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/5">
              <Layers size={12} className="text-sky-400 shrink-0" />
              <span className="text-[10px] font-semibold text-gray-300 flex-1">Overlays</span>
              {overlayCats.size > 0 && (
                <label className="flex items-center gap-1 text-[9px] text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={overlayOwnedOnly} onChange={(e) => setOverlayOwnedOnly(e.target.checked)} className="accent-sky-500" />
                  owned only
                </label>
              )}
            </div>
            <div className="p-1.5 flex flex-wrap gap-1">
              {overlayCategories.map(cat => {
                const on = overlayCats.has(cat);
                const color = overlayColor(cat);
                const count = chunkContentService.overlays()[cat]?.length ?? 0;
                return (
                  <button
                    key={cat}
                    onClick={() => toggleOverlay(cat)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors ${on ? 'border-white/30 bg-white/10 text-gray-100' : 'border-white/5 text-gray-500 hover:bg-white/5'}`}
                    title={`${cat} — ${count} marker${count === 1 ? '' : 's'}`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, opacity: on ? 1 : 0.4 }} />
                    <span className="truncate max-w-[88px]">{cat}</span>
                    <span className="text-[8px] text-gray-500 font-mono">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`w-full h-full ${authoring ? 'cursor-crosshair' : 'cursor-move'}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseLeave={() => { onMouseUp(); setHoverTile(null); }}
      >
        <div
          ref={mapContentRef}
          id="map-content-inner"
          style={{
            // Initial value only — drags/zooms write to the node directly
            // via applyTransform (see transformRef above).
            transform: `translate(${transformRef.current.x}px, ${transformRef.current.y}px) scale(${transformRef.current.scale})`,
            transformOrigin: '0 0',
            width: `${MAP_IMAGE.width}px`,
            height: `${MAP_IMAGE.height}px`,
            position: 'absolute',
            top: 0,
            left: 0,
            willChange: 'transform',
          }}
        >
          <MapSurface
            chunkRects={chunkRects}
            gridLines={gridLines}
            showGrid={showGrid}
            rectBox={rectBox}
            rectKind={rectMode.current}
            regionUnlocks={regionUnlocks}
          />

          {/* Chunk-lens highlight overlay — inside the transformed layer so the
              glow pans & zooms with the map. Unlocked matches bright, locked dim. */}
          {highlightRects.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              width={MAP_IMAGE.width}
              height={MAP_IMAGE.height}
              viewBox={`0 0 ${MAP_IMAGE.width} ${MAP_IMAGE.height}`}
            >
              {highlightRects.map(r => (
                <rect
                  key={r.key}
                  x={r.x} y={r.y} width={r.w} height={r.h}
                  fill={TONE_FILL[r.tone]}
                  stroke={TONE_STROKE[r.tone]}
                  strokeWidth={r.tone === 'good' ? 9 : r.tone === 'bad' ? 8 : 5}
                  strokeDasharray={r.tone === 'warn' ? '16 12' : undefined}
                  className={r.tone === 'good' ? 'lens-pulse' : ''}
                />
              ))}
            </svg>
          )}

          {/* Map marker overlays (stars/implings/crop circles/crime/clues) —
              inside the transformed layer so they pan & zoom with the map.
              Owned-chunk markers bright, others dimmed. */}
          {overlayMarkers.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              width={MAP_IMAGE.width}
              height={MAP_IMAGE.height}
              viewBox={`0 0 ${MAP_IMAGE.width} ${MAP_IMAGE.height}`}
            >
              {overlayMarkers.map(m => (
                <circle
                  key={m.key}
                  cx={m.x} cy={m.y} r={44}
                  fill={m.color}
                  fillOpacity={m.owned ? 0.9 : 0.25}
                  stroke="#000"
                  strokeOpacity={0.55}
                  strokeWidth={7}
                />
              ))}
            </svg>
          )}

          {/* Gold spotlight on the selected chunk (panel open / deep link) —
              lives inside the transformed layer so it pans & zooms with the
              map. Sibling of MapSurface so selection never re-renders the
              memoized 700-element surface. */}
          {selectedChunk && !authoring && (() => {
            const { px, py } = tileToPixel({
              tx: selectedChunk.cx * CHUNK_TILES,
              ty: (selectedChunk.cy + 1) * CHUNK_TILES,
            });
            const size = CHUNK_TILES * (MAP_IMAGE.width / (MAP_BOUNDS.tileMaxX - MAP_BOUNDS.tileMinX));
            return (
              <div
                className="absolute pointer-events-none rounded-sm border-[5px] border-yellow-400 animate-pulse"
                style={{
                  left: px,
                  top: py,
                  width: size,
                  height: size,
                  boxShadow: '0 0 28px 6px rgba(250, 204, 21, 0.55), inset 0 0 22px rgba(250, 204, 21, 0.35)',
                }}
              />
            );
          })()}
        </div>
      </div>

      {/* Authoring toolbar (top-right) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
        <button
          onClick={() => setAuthoring(a => !a)}
          className={`px-3 py-1.5 rounded border text-xs font-semibold shadow-lg flex items-center gap-1.5 transition-colors ${authoring ? 'bg-amber-500/90 border-amber-300 text-black' : 'bg-black/80 border-white/20 text-white hover:bg-white/10'}`}
          title="Toggle chunk authoring mode"
        >
          <Paintbrush size={14} />
          {authoring ? 'Authoring ON' : 'Authoring OFF'}
        </button>

        {authoring && (
          <div className="bg-black/90 border border-white/20 rounded-md shadow-lg p-3 flex flex-col gap-2 w-[260px]">
            {/* Layer toggle: paint broad continent blocks, or the named
                sub-areas inside them (Falador, Port Sarim, …). */}
            <div className="flex bg-[#0b0d10] border border-white/20 rounded p-0.5 gap-0.5">
              {(['REGION', 'SUBAREA'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setAuthorLevel(lvl)}
                  className={`flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${authorLevel === lvl ? 'bg-amber-600/80 text-black' : 'text-gray-400 hover:text-gray-200'}`}
                  title={lvl === 'REGION' ? 'Paint continent blocks (REGION_CHUNKS)' : 'Paint named sub-areas like Falador (SUB_AREA_CHUNKS)'}
                >
                  {lvl === 'REGION' ? 'Regions' : 'Sub-areas'}
                </button>
              ))}
            </div>

            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              Active {authorLevel === 'SUBAREA' ? 'Sub-area' : 'Region'}
            </label>
            {authorLevel === 'SUBAREA' ? (
              <select
                value={activeSubArea}
                onChange={e => setActiveSubArea(e.target.value)}
                className="bg-[#0b0d10] border border-white/20 rounded px-2 py-1 text-xs text-white"
              >
                {['Misthalin', ...Object.keys(REGION_GROUPS)].map(cont => (
                  <optgroup key={cont} label={cont}>
                    {(cont === 'Misthalin' ? MISTHALIN_AREAS : REGION_GROUPS[cont]).map(name => {
                      const count = subDraft[name]?.length ?? 0;
                      return (
                        <option key={name} value={name}>
                          {name}{count ? ` (${count})` : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            ) : (
              <select
                value={activeRegion}
                onChange={e => setActiveRegion(e.target.value)}
                className="bg-[#0b0d10] border border-white/20 rounded px-2 py-1 text-xs text-white"
              >
                {CONTINENT_NAMES.map(name => {
                  const count = draftChunks[name]?.length ?? 0;
                  return (
                    <option key={name} value={name}>
                      {name}{count ? ` (${count})` : ''}
                    </option>
                  );
                })}
              </select>
            )}

            <div className="text-[10px] text-gray-400 leading-relaxed mt-1">
              click = add · right-click = remove · shift+drag = paint · <b className="text-amber-300/80">alt+drag = box fill</b> · alt+right-drag = box erase · <b className="text-amber-300/80">⌘/Ctrl+Z undo</b>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={undo}
                disabled={undoStack.length === 0}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-black/60 border-white/20 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-black/60 flex items-center justify-center gap-1"
                title="Undo (⌘/Ctrl+Z)"
              >
                <Undo2 size={12} /> Undo{undoStack.length ? ` (${undoStack.length})` : ''}
              </button>
              <button
                onClick={redo}
                disabled={redoStack.length === 0}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-black/60 border-white/20 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-black/60 flex items-center justify-center gap-1"
                title="Redo (⌘/Ctrl+Y)"
              >
                <Redo2 size={12} /> Redo
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setSoloView(s => !s)}
                className={`flex-1 px-2 py-1 rounded text-[11px] border flex items-center justify-center gap-1 ${soloView ? 'bg-emerald-900/80 border-emerald-500/60 text-emerald-200' : 'bg-black/60 border-white/20 text-gray-300 hover:bg-white/10'}`}
                title="Show only the active region"
              >
                {soloView ? <Eye size={12} /> : <EyeOff size={12} />}
                Solo
              </button>
              <button
                onClick={clearActiveRegion}
                disabled={activeChunkCount === 0}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-black/60 border-white/20 text-gray-300 hover:bg-red-900/40 hover:text-red-200 disabled:opacity-40 disabled:hover:bg-black/60 flex items-center justify-center gap-1"
                title="Remove all chunks for the active region"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={exportDraftToClipboard}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-emerald-900/70 border-emerald-500/50 text-emerald-100 hover:bg-emerald-800/80 flex items-center justify-center gap-1"
                title={authorLevel === 'SUBAREA' ? 'Copy SUB_AREA_CHUNKS as TS literal (paste into data/subAreaChunks.ts)' : 'Copy REGION_CHUNKS as TS literal'}
              >
                <ClipboardCopy size={12} />
                TS
              </button>
              <button
                onClick={exportDraftJson}
                disabled={authorLevel === 'SUBAREA'}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-sky-900/70 border-sky-500/50 text-sky-100 hover:bg-sky-800/80 disabled:opacity-40 flex items-center justify-center gap-1"
                title={authorLevel === 'SUBAREA' ? 'JSON export works at the Regions level' : 'Download draft as JSON file'}
              >
                <FileDown size={12} />
                JSON
              </button>
              <button
                onClick={exportRuneLiteBundle}
                disabled={authorLevel === 'SUBAREA'}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-amber-900/70 border-amber-500/50 text-amber-100 hover:bg-amber-800/80 disabled:opacity-40 flex items-center justify-center gap-1"
                title={authorLevel === 'SUBAREA' ? 'RuneLite export works at the Regions level' : 'Export bundle for RuneLite plugin (chunks + unlocks + offset)'}
              >
                <Radio size={12} />
                RL
              </button>
              <button
                onClick={() => importFileRef.current?.click()}
                disabled={authorLevel === 'SUBAREA'}
                className="flex-1 px-2 py-1 rounded text-[11px] border bg-indigo-900/70 border-indigo-500/50 text-indigo-100 hover:bg-indigo-800/80 disabled:opacity-40 flex items-center justify-center gap-1"
                title={authorLevel === 'SUBAREA' ? 'JSON import works at the Regions level' : 'Import draft from JSON file'}
              >
                <FileUp size={12} />
                Load
              </button>
              <button
                onClick={clearDraft}
                className="px-2 py-1 rounded text-[11px] border bg-black/60 border-white/20 text-gray-400 hover:bg-red-900/40 hover:text-red-200"
                title="Reset this layer to the shipped baseline"
              >
                Wipe
              </button>
            </div>
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFile}
            />

            <div className="text-[10px] text-gray-500 pt-1 border-t border-white/10">
              {activeChunkCount} chunks in "{authorLevel === 'SUBAREA' ? activeSubArea : activeRegion}" · {totalRegionsWithChunks} {authorLevel === 'SUBAREA' ? 'sub-areas' : 'regions'} total
            </div>
          </div>
        )}
      </div>

      {/* Navigation controls (bottom-right) */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="p-2 bg-black/80 border border-white/20 rounded hover:bg-white/10 text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export Map Image"
        >
          {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
        </button>
        <button
          onClick={() => setShowGrid(g => !g)}
          className={`p-2 border rounded text-white shadow-lg active:scale-95 transition-transform ${showGrid ? 'bg-emerald-900/80 border-emerald-500/60' : 'bg-black/80 border-white/20 hover:bg-white/10'}`}
          title="Toggle chunk grid (64-tile)"
        >
          <Grid3x3 size={20} />
        </button>
        <button
          onClick={() => applyTransform({ ...transformRef.current, scale: Math.min(transformRef.current.scale + 0.5, 5) })}
          className="p-2 bg-black/80 border border-white/20 rounded hover:bg-white/10 text-white shadow-lg active:scale-95 transition-transform"
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={() => applyTransform({ ...transformRef.current, scale: Math.max(transformRef.current.scale - 0.5, 0.2) })}
          className="p-2 bg-black/80 border border-white/20 rounded hover:bg-white/10 text-white shadow-lg active:scale-95 transition-transform"
        >
          <ZoomOut size={20} />
        </button>
      </div>

      {/* Status / hover readout (top-left) */}
      <div className="absolute top-4 left-4 pointer-events-none z-20 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-black/80 px-3 py-1.5 rounded-full border border-white/10 text-xs text-gray-300 shadow-lg backdrop-blur-sm">
          <Move size={14} />
          <span>Drag to Pan • Scroll to Zoom</span>
        </div>
        {hoverTile && hoverChunk && (
          <div className="bg-black/80 px-3 py-1.5 rounded border border-white/10 text-[11px] font-mono text-emerald-300 shadow-lg backdrop-blur-sm">
            tile ({Math.round(hoverTile.tx)}, {Math.round(hoverTile.ty)}) · chunk ({hoverChunk.cx}, {hoverChunk.cy})
          </div>
        )}
        {toast && (
          <div className="bg-emerald-900/90 border border-emerald-500/60 px-3 py-1.5 rounded text-[11px] font-mono text-emerald-200 shadow-lg">
            {toast}
          </div>
        )}
      </div>

      {/* Chunk activity panel: click any chunk (outside authoring) to see what
          that chunk — or its whole area — offers, gated by the run's unlocks. */}
      {selectedChunk && !authoring && (() => {
        const region = Object.entries(draftChunks).find(([, list]) =>
          list.some(c => c.cx === selectedChunk.cx && c.cy === selectedChunk.cy),
        )?.[0] ?? null;
        const subArea = chunkSubArea[`${selectedChunk.cx},${selectedChunk.cy}`] ?? null;
        const unlocked = subArea
          ? isRegionUnlocked(subArea, regionUnlocks)
          : region ? isRegionUnlocked(region, regionUnlocks) : false;
        return (
          <ChunkActivityPanel
            chunk={selectedChunk}
            region={region}
            subArea={subArea}
            regionChunks={region ? draftChunks[region] : []}
            unlocked={unlocked}
            onClose={() => setSelectedChunk(null)}
          />
        );
      })()}
    </div>
  );
}, (prev, next) => prev.regionUnlocks === next.regionUnlocks);

export const RegionMap: React.FC = () => {
  const { unlocks, keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals } = useGame();
  // Live run state for the RuneLite bundle, read lazily at export time via a
  // stable getter so MapContent's memoization (regionUnlocks-only) holds.
  const snapRef = useRef({ keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0, activeBuff: 'NONE', pinnedGoals: [] as string[] });
  snapRef.current = { keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals: pinnedGoals ?? [] };
  const getGameSnapshot = useCallback(() => snapRef.current, []);
  return <MapContent regionUnlocks={unlocks.regions} getGameSnapshot={getGameSnapshot} />;
};
