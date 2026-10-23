import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FateLand, GameState } from '../types';
import { MAP_IMAGE } from '../utils/mapCoords';
import { mapImageIndexForScale } from '../utils/mapImageSize';
import { CHUNKED_START_KEY, chunkKey, getChunkFrontier } from '../utils/chunkAdjacency';
import { chunkPlaceLabel } from '../utils/chunkPlaceLabel';
import { CHUNK_PX, spinHopTimes, spinHops, spinWindow, type SpinWindow } from '../utils/fateMap';
import { fateBeats } from '../utils/fateSiteMap';
import { dimPixels, dissolvePixels, fogPixels, inkNoise, sketchPixels } from '../utils/fateSketch';
import { useRevealHost } from './osrs/OsrsKeysState';

/**
 * "Fate draws the map": the moment before a Chunked run's chunk reveal. A
 * piece of the world map around the drawn chunk shows the run's land in
 * colour and its frontier as it was before the draw, a yellow highlight hops
 * across that frontier and lands on the drawn chunk, which is sketched in
 * ink like a map clue and then fills with colour. The draw was made and saved
 * before this mounts; the hops are only for show. A click, Space, Enter or
 * Escape skips straight on to the reveal. PendingUnlockReveal loads it lazily.
 */
interface Props {
  /** The drawn chunk, "cx,cy". */
  chunk: string;
  /** The run's unlocks, the drawn chunk already among them. */
  unlocks: GameState['unlocks'];
  osrs: boolean;
  /** OSRS: draw inside the Spend Keys board's reveal window when it is open. */
  docked?: boolean;
  /** The run's fate: the seal, site and omen of the chunk show once its colour fills in. */
  land?: FateLand;
  onDone: () => void;
}

const CELL = 72;
const HOP_START = 250;
const HOP_MS = 1500;
const LAND = HOP_START + HOP_MS;
const SKETCH_AT = LAND + 450;
const SKETCH_MS = 800;
const COLOUR_AT = SKETCH_AT + SKETCH_MS + 350;
const COLOUR_MS = 700;
const END = COLOUR_AT + COLOUR_MS + 650;
/** Extra time to read the chunk's omen before the reveal, and for each further line. */
const OMEN_HOLD = 1100;
const BEAT_HOLD = 900;
/** Without even the small map after this long, skip the spin rather than hold up the reveal. */
const LOAD_GIVE_UP = 2500;

const ORANGE = '#ff981f';
const YELLOW = '#ffff00';

interface Layers { fog: HTMLCanvasElement; dim: HTMLCanvasElement; colour: HTMLCanvasElement;
  cell: { dim: Uint8ClampedArray; sketch: Uint8ClampedArray; colour: Uint8ClampedArray } }

const canvasOf = (w: number, h: number, data?: Uint8ClampedArray): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  if (data) c.getContext('2d')!.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  return c;
};

/** The window's piece of the map, as fog, dimmed and full-colour layers plus the drawn cell's pixels. */
const buildLayers = (src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, win: SpinWindow, dpr: number): Layers => {
  const w = Math.round(win.cols * CELL * dpr), h = Math.round(win.rows * CELL * dpr);
  const colour = canvasOf(w, h);
  const ctx = colour.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  const all = ctx.getImageData(0, 0, w, h).data;
  const cs = Math.round(CELL * dpr);
  const cell = ctx.getImageData(Math.round(win.drawn.col * CELL * dpr), Math.round(win.drawn.row * CELL * dpr), cs, cs).data;
  return {
    colour,
    fog: canvasOf(w, h, fogPixels(all)),
    dim: canvasOf(w, h, dimPixels(all)),
    cell: { dim: dimPixels(cell), sketch: sketchPixels(cell, cs, cs, Math.random), colour: Uint8ClampedArray.from(cell) },
  };
};

const FateDrawsMap: React.FC<Props> = ({ chunk, unlocks, osrs, docked = false, land, onDone }) => {
  const beats = useMemo(() => fateBeats(chunk, land), [chunk, land]);
  const host = useRevealHost();
  const inDock = osrs && docked && !!host;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    doneRef.current();
  };
  const [landed, setLanded] = useState(false);
  const [omenShown, setOmenShown] = useState(false);
  const place = useMemo(() => chunkPlaceLabel(chunk), [chunk]);

  // Worked out once: the run before and after the draw, the window, the hops.
  const plan = useMemo(() => {
    const after = unlocks.chunks ?? [];
    const before = after.filter(key => key !== chunk);
    const heldBefore = new Set([CHUNKED_START_KEY, ...before]);
    const frontierBefore = new Set(getChunkFrontier(before, unlocks).map(chunkKey));
    const frontierAfter = new Set(getChunkFrontier(after, unlocks).map(chunkKey));
    const win = spinWindow(chunk, heldBefore, frontierBefore, frontierAfter);
    const inView = win.cells.filter(c => c.state === 'frontier').map(c => c.key);
    const hops = spinHops(inView, chunk, Math.min(14, Math.max(7, inView.length * 2)), Math.random);
    return { win, hops, times: spinHopTimes(hops.length, HOP_MS) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { boxRef.current?.focus({ preventScroll: true }); }, [inDock]);

  // Click, Space, Enter or Escape: on to the reveal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { win, hops, times } = plan;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = win.cols * CELL, H = win.rows * CELL;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    // No canvas or bitmap decoding here (an old browser, a test page): straight on to the reveal.
    if (!ctx || typeof createImageBitmap !== 'function') { finish(); return; }
    const cs = Math.round(CELL * dpr);
    const cellImage = new ImageData(cs, cs);
    const noiseInk = inkNoise(cs, cs);
    const noiseColour = inkNoise(cs, cs);
    let layers: Layers | null = null;
    let hiRes = false;
    let start = 0;
    let raf = 0;
    let cancelled = false;
    const sx = (win.cx0 - 15) * CHUNK_PX, sy = (65 - win.cyTop) * CHUNK_PX;
    const sw = win.cols * CHUNK_PX, sh = win.rows * CHUNK_PX;

    // The small map draws at once; a sharper copy, when it arrives, sharpens it.
    // The canvas already counts device pixels, so the copy is picked at dpr 1.
    const hiSize = MAP_IMAGE.sizes[mapImageIndexForScale((CELL * dpr) / CHUNK_PX, 1)];
    const load = async (url: string, hi: boolean) => {
      const blob = await (await fetch(url)).blob();
      if (cancelled || (hiRes && !hi)) return;
      if (hi) {
        const k = hiSize.width / MAP_IMAGE.width;
        const bitmap = await createImageBitmap(blob, sx * k, sy * k, sw * k, sh * k);
        if (cancelled) return;
        layers = buildLayers(bitmap, 0, 0, sw * k, sh * k, win, dpr);
        hiRes = true;
        bitmap.close?.();
      } else {
        const bitmap = await createImageBitmap(blob);
        if (cancelled || hiRes) return;
        const k = bitmap.width / MAP_IMAGE.width;
        layers = buildLayers(bitmap, sx * k, sy * k, sw * k, sh * k, win, dpr);
        bitmap.close?.();
      }
      if (!start) { start = performance.now(); raf = requestAnimationFrame(frame); }
    };
    load(MAP_IMAGE.srcLo, false).catch(() => {});
    load(hiSize.src, true).catch(() => {});
    const giveUp = window.setTimeout(() => { if (!layers) finish(); }, LOAD_GIVE_UP);

    const cellRect = (col: number, row: number) => [col * CELL, row * CELL, CELL, CELL] as const;
    const blit = (src: HTMLCanvasElement, col: number, row: number, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.drawImage(src, col * cs, row * cs, cs, cs, col * CELL, row * CELL, CELL, CELL);
      ctx.globalAlpha = 1;
    };
    const drawn = win.cells.find(c => c.drawn)!;
    const cellOf = (key: string) => win.cells.find(c => c.key === key)!;
    let wasLanded = false;
    let wasOmen = false;

    function frame(now: number) {
      if (cancelled || !layers) return;
      const t = now - start;
      const L = layers;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(L.fog, 0, 0, W, H);
      const colourDone = t >= COLOUR_AT + COLOUR_MS;
      const grow = Math.min(1, Math.max(0, (t - COLOUR_AT) / COLOUR_MS));
      for (const c of win.cells) {
        if (c.drawn) continue;
        if (c.state === 'held') blit(L.colour, c.col, c.row);
        else if (c.state === 'frontier') blit(L.dim, c.col, c.row);
        else if (c.newFrontier && grow > 0) blit(L.dim, c.col, c.row, grow);
      }

      // The drawn chunk: dimmed frontier, then inked in, then coloured.
      if (t < SKETCH_AT) blit(L.dim, drawn.col, drawn.row);
      else {
        const ink = Math.min(1, (t - SKETCH_AT) / SKETCH_MS);
        const fill = Math.min(1, Math.max(0, (t - COLOUR_AT) / COLOUR_MS));
        if (fill <= 0) dissolvePixels(L.cell.dim, L.cell.sketch, noiseInk, ink, cellImage.data);
        else dissolvePixels(L.cell.sketch, L.cell.colour, noiseColour, fill, cellImage.data);
        ctx.putImageData(cellImage, Math.round(drawn.col * CELL * dpr), Math.round(drawn.row * CELL * dpr));
        if (fill < 1) {
          // The sketch's own ink border, like the edge of a clue map.
          ctx.strokeStyle = 'rgba(58, 40, 22, 0.9)';
          ctx.lineWidth = 2;
          ctx.strokeRect(drawn.col * CELL + 1, drawn.row * CELL + 1, CELL - 2, CELL - 2);
        }
      }

      // The chunk grid.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c <= win.cols; c++) { ctx.moveTo(c * CELL + 0.5, 0); ctx.lineTo(c * CELL + 0.5, H); }
      for (let r = 0; r <= win.rows; r++) { ctx.moveTo(0, r * CELL + 0.5); ctx.lineTo(W, r * CELL + 0.5); }
      ctx.stroke();

      // The frontier, dashed, and the run's land, outlined.
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (const c of win.cells) {
        const showFrontier = (c.state === 'frontier' && !(c.drawn && colourDone)) || (c.newFrontier && grow > 0);
        if (!showFrontier) continue;
        ctx.globalAlpha = c.newFrontier ? grow : 1;
        ctx.strokeRect(c.col * CELL + 0.5, c.row * CELL + 0.5, CELL - 1, CELL - 1);
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const held = (c: { state: string; drawn: boolean }) => c.state === 'held' || (c.drawn && colourDone);
      const isHeld = (col: number, row: number) => {
        const c = win.cells.find(x => x.col === col && x.row === row);
        return !!c && held(c);
      };
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const c of win.cells) {
        if (!held(c)) continue;
        const [x, y] = cellRect(c.col, c.row);
        if (!isHeld(c.col, c.row - 1)) { ctx.moveTo(x, y + 1); ctx.lineTo(x + CELL, y + 1); }
        if (!isHeld(c.col, c.row + 1)) { ctx.moveTo(x, y + CELL - 1); ctx.lineTo(x + CELL, y + CELL - 1); }
        if (!isHeld(c.col - 1, c.row)) { ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + CELL); }
        if (!isHeld(c.col + 1, c.row)) { ctx.moveTo(x + CELL - 1, y); ctx.lineTo(x + CELL - 1, y + CELL); }
      }
      ctx.stroke();

      // Fate's highlight: hopping the frontier, then blinking on the drawn chunk.
      let on: { col: number; row: number } | null = null;
      if (t >= HOP_START && t < LAND) {
        const ht = t - HOP_START;
        let i = 0;
        while (i + 1 < times.length && times[i + 1] <= ht) i++;
        on = cellOf(hops[i]);
      } else if (t >= LAND && t < SKETCH_AT) {
        on = Math.floor((t - LAND) / 110) % 2 === 0 ? drawn : null;
      } else if (t >= SKETCH_AT) {
        on = drawn;
      }
      if (on) {
        const [x, y] = cellRect(on.col, on.row);
        if (t < SKETCH_AT) {
          ctx.fillStyle = 'rgba(255, 255, 0, 0.18)';
          ctx.fillRect(x, y, CELL, CELL);
        }
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 5;
        ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
        ctx.strokeStyle = YELLOW;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }

      if (!wasLanded && t >= LAND) { wasLanded = true; setLanded(true); }
      if (beats.length > 0 && !wasOmen && t >= COLOUR_AT + COLOUR_MS) { wasOmen = true; setOmenShown(true); }
      if (t >= (beats.length > 0 ? END + OMEN_HOLD + BEAT_HOLD * (beats.length - 1) : END)) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(giveUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const caption = landed ? `Fate drew ${place}.` : 'Fate spins along your border...';
  // The second beat: once the chunk is in colour, what fate did with it.
  const shown = omenShown ? beats : [];
  const map = (
    <canvas ref={canvasRef} role="img" aria-label={`The world map around ${place}`}
      style={{ display: 'block', width: plan.win.cols * CELL, maxWidth: '100%', height: 'auto', aspectRatio: `${plan.win.cols} / ${plan.win.rows}` }} />
  );

  if (osrs) {
    const sh: React.CSSProperties = { textShadow: '1px 1px 0 #000' };
    const content = (
      <>
        <div style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ margin: 0, font: "16px 'RSBold', sans-serif", color: '#ff981f', ...sh }}>Fate draws the map</h2>
        </div>
        <div className="osrs-inner ospend-rv-body" style={{ minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 8px', background: '#120e0b' }}>
          <div style={{ border: '2px solid #000', boxShadow: '0 0 0 1px var(--osrs-bevel-hi, #5c5244), 0 0 0 3px #000', background: '#0e0c0a', maxWidth: '100%' }}>{map}</div>
          <span aria-live="polite" style={{ font: "16px 'RSBold', sans-serif", color: landed ? '#ffff00' : '#c77dff', textAlign: 'center', ...sh }}>{caption}</span>
          {shown.map(beat => <span key={beat.text} aria-live="polite" data-beat style={{ font: "16px 'RS', sans-serif", color: beat.color, textAlign: 'center', ...sh }}>{beat.text}</span>)}
          <span style={{ font: "16px 'RSSmall', 'RS', sans-serif", color: 'var(--osrs-tan, #c8b897)', ...sh }}>Click or press Space to skip</span>
        </div>
      </>
    );
    if (inDock) {
      return createPortal(
        <div ref={boxRef} tabIndex={-1} role="dialog" aria-label="Fate draws the map" className="ospend-docked" onClick={finish}
          style={{ color: '#ff981f', cursor: 'pointer', font: "16px 'RS', sans-serif" }}>
          {content}
        </div>,
        host!,
      );
    }
    return (
      <div ref={boxRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Fate draws the map" onClick={finish}
        style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,.6)', overflowY: 'auto', outline: 'none', cursor: 'pointer' }}>
        <div className="osrs-win" style={{ width: 'min(560px, 100%)', margin: 'auto', padding: 4, display: 'flex', flexDirection: 'column', gap: 4, color: '#ff981f', font: "16px 'RS', sans-serif" }}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Fate draws the map" onClick={finish}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md overflow-y-auto outline-none cursor-pointer p-4">
      <div className="m-auto flex flex-col items-center gap-4">
        <div className="text-amber-200/90 font-bold tracking-[0.3em] uppercase text-sm">Fate draws the map</div>
        {/* A clue-scroll map: parchment frame around the piece of the world. */}
        <div style={{ padding: 8, background: '#b8995e', border: '2px solid #3b2a14', boxShadow: 'inset 0 0 0 2px #d9c18a, inset 0 0 0 6px #8a6a38, 0 10px 40px rgba(0,0,0,.6)', maxWidth: '100%' }}>{map}</div>
        <div aria-live="polite" className={`text-base font-semibold ${landed ? 'text-yellow-300' : 'text-purple-300'}`}>{caption}</div>
        {shown.map(beat => <div key={beat.text} aria-live="polite" data-beat className="text-sm text-center max-w-md" style={{ color: beat.color }}>{beat.text}</div>)}
        <div className="text-[11px] text-gray-500">Click or press Space to skip</div>
      </div>
    </div>
  );
};

export default FateDrawsMap;
