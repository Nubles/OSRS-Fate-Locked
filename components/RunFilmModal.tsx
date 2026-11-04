import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Film, Share2, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useIsOsrsUi } from '../utils/uiStyle';
import { OsrsTitleBar } from './osrs/OsrsWindowChrome';
import { MAP_IMAGE } from '../utils/mapCoords';
import { buildFilmTimeline } from '../utils/runFilm/timeline';
import { FilmPainter, GLOW_FRAMES, type FilmShape, type FilmSprites } from '../utils/runFilm/painter';
import { gemSmallSrc, skillIconSrc, slotSilhouetteSrc, slotUiSrc } from './osrs/OsrsDashGems';
import { EQUIPMENT_SLOTS, SKILLS_LIST } from '../data/items';
import { encodeFilm, FilmCancelled, FILM_FPS, type FilmFile } from '../utils/runFilm/encode';
import { loadRitualFonts, RS_BOLD, RS_FONT } from './rituals/ritualAssets';
import { getGameMode } from '../config/gameModes';
import { showToast } from '../utils/toast';

/** Frames before the first step and after the last, so the film opens and ends on a still map. */
const LEAD_FRAMES = 12;
const HOLD_FRAMES = 48;

const SHAPES: { id: FilmShape; label: string; hint: string }[] = [
  { id: 'wide', label: 'Wide', hint: 'Discord, YouTube' },
  { id: 'tall', label: 'Tall', hint: 'TikTok, Shorts, Reels' },
];

type Phase =
  | { kind: 'idle' }
  | { kind: 'making'; done: number; total: number }
  | { kind: 'ready'; file: FilmFile; url: string }
  | { kind: 'failed'; message: string };

let mapLoading: Promise<HTMLImageElement> | null = null;
const loadMap = (): Promise<HTMLImageElement> => {
  mapLoading ??= loadImage(MAP_IMAGE.sizes[0].src).catch(err => { mapLoading = null; throw err; });
  return mapLoading;
};

/** The skills-tab and equipment sprites. One that fails to load is left out; the film draws without it. */
let spritesLoading: Promise<FilmSprites> | null = null;
const loadSprites = (): Promise<FilmSprites> => {
  const soft = (src: string) => loadImage(src).catch(() => undefined);
  spritesLoading ??= (async () => {
    const [skills, slots, tile, gems] = await Promise.all([
      Promise.all(SKILLS_LIST.map(async s => [s, await soft(skillIconSrc(s))] as const)),
      Promise.all(EQUIPMENT_SLOTS.map(async s => [s, await soft(slotSilhouetteSrc(s))] as const)),
      soft(slotUiSrc('tile')),
      Promise.all(Array.from({ length: 10 }, (_, i) => soft(gemSmallSrc(i + 1)))),
    ]);
    return { skills: Object.fromEntries(skills), slots: Object.fromEntries(slots), tile, gems };
  })();
  return spritesLoading;
};

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('The world map could not be loaded. Check your connection and try again.'));
  img.src = src;
});

/**
 * Run Film: the run's log played back on the world map as a short video,
 * made on the player's device (utils/runFilm). Opened from Share Run.
 */
export const RunFilmModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { history, unlocks, gameModeId } = useGame();
  const { activeProfileName } = useProfiles();
  const osrs = useIsOsrsUi();
  const dialogRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  useFocusTrap(dialogRef);
  useEscapeKey(onClose, true);

  const [shape, setShape] = useState<FilmShape>('wide');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const chunked = gameModeId === 'chunked';
  const timeline = useMemo(() => buildFilmTimeline(history, {
    chunked,
    finalRegions: unlocks.regions ?? [],
    finalChunks: unlocks.chunks ?? [],
    finalSkills: unlocks.skills,
    finalGear: unlocks.equipment,
  }), [history, chunked, unlocks.regions, unlocks.chunks, unlocks.skills, unlocks.equipment]);
  const frames = LEAD_FRAMES + timeline.steps.length + HOLD_FRAMES;
  const seconds = Math.round(frames / FILM_FPS);
  const title = `${activeProfileName || 'My run'} · Fate Locked ${getGameMode(gameModeId).name}`;

  // Stop work and free the file when the window closes.
  useEffect(() => () => { abortRef.current?.abort(); }, []);
  useEffect(() => () => { if (phase.kind === 'ready') URL.revokeObjectURL(phase.url); }, [phase]);

  // At rest the canvas shows the film's last frame: the run's map today.
  useEffect(() => {
    if (phase.kind !== 'idle' && phase.kind !== 'failed') return;
    let cancelled = false;
    (async () => {
      await loadRitualFonts(3000);
      const [map, sprites] = await Promise.all([loadMap(), loadSprites()]);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const owned = new Set(timeline.start);
      for (const step of timeline.steps) for (const k of step.added) owned.add(k);
      new FilmPainter(canvas, map, shape, { regular: RS_FONT, bold: RS_BOLD }, sprites)
        .paint(owned, new Map(), timeline.steps[timeline.steps.length - 1] ?? timeline.opening, title);
    })().catch(() => { /* the Make button reports a map that won't load */ });
    return () => { cancelled = true; };
  }, [phase.kind, shape, timeline, title]);

  const make = async () => {
    const canvas = canvasRef.current;
    if (!canvas || phase.kind === 'making') return;
    if (phase.kind === 'ready') URL.revokeObjectURL(phase.url);
    const abort = new AbortController();
    abortRef.current = abort;
    setPhase({ kind: 'making', done: 0, total: frames });
    try {
      await loadRitualFonts(3000);
      const [map, sprites] = await Promise.all([loadMap(), loadSprites()]);
      const painter = new FilmPainter(canvas, map, shape, { regular: RS_FONT, bold: RS_BOLD }, sprites);
      const owned = new Set(timeline.start);
      let glow = new Map<string, number>();
      let applied = -1;
      // Frames come in order, so each one only needs the steps since the last.
      const draw = (i: number) => {
        const stepIndex = Math.min(timeline.steps.length - 1, i - LEAD_FRAMES);
        const next = new Map<string, number>();
        for (const [k, left] of glow) if (left > 1) next.set(k, left - 1);
        glow = next;
        while (applied < stepIndex) {
          applied += 1;
          const step = timeline.steps[applied];
          for (const k of step.added) { owned.add(k); glow.set(k, GLOW_FRAMES); }
          for (const k of step.raised) glow.set(k, GLOW_FRAMES);
        }
        // Before the first step the film shows the run as it began.
        painter.paint(owned, glow, stepIndex < 0 ? timeline.opening : timeline.steps[stepIndex], title);
      };
      const file = await encodeFilm({
        canvas, frames, draw, signal: abort.signal,
        onProgress: (done, total) => { if (done % 6 === 0 || done === total) setPhase({ kind: 'making', done, total }); },
      });
      if (abort.signal.aborted) return;
      setPhase({ kind: 'ready', file, url: URL.createObjectURL(file.blob) });
    } catch (err) {
      if (err instanceof FilmCancelled || abort.signal.aborted) { setPhase({ kind: 'idle' }); return; }
      setPhase({ kind: 'failed', message: err instanceof Error ? err.message : 'The film could not be made.' });
    }
  };

  const fileName = (ext: string) =>
    `fate-locked-film-${(activeProfileName || 'run').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'run'}-${new Date().toISOString().slice(0, 10)}.${ext}`;

  const download = () => {
    if (phase.kind !== 'ready') return;
    const link = document.createElement('a');
    link.download = fileName(phase.file.ext);
    link.href = phase.url;
    link.click();
  };

  const share = async () => {
    if (phase.kind !== 'ready') return;
    const file = new File([phase.file.blob], fileName(phase.file.ext), { type: phase.file.mime });
    try {
      await navigator.share({ files: [file], title: 'My Fate Locked run' });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') showToast('Sharing didn’t work here. Use Download instead.');
    }
  };
  const canShare = phase.kind === 'ready' && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [new File([phase.file.blob], `film.${phase.file.ext}`, { type: phase.file.mime })] });

  const empty = timeline.steps.length === 0;
  const making = phase.kind === 'making';
  const pct = making ? Math.round((phase.done / Math.max(1, phase.total)) * 100) : 0;
  const btn = osrs ? 'osrs-btn' : 'flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 bg-white/10 hover:bg-white/15 text-white border border-white/10';
  const primary = osrs ? 'osrs-btn' : 'flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 bg-emerald-700 hover:bg-emerald-600 text-white';
  const sub = osrs ? 'owb-sub' : 'text-gray-400';

  const body = (
    <div className="flex flex-col items-center gap-3 p-3 sm:p-5">
      <p className={`text-sm text-center max-w-prose ${sub}`}>
        Your run&rsquo;s log played back on the world map: the fog lifts where fate opened land, with your Key rolls and latest unlocks beside it.
        About {seconds} seconds. Made on this device; nothing is uploaded.
      </p>
      <div role="group" aria-label="Film shape" className={osrs ? 'owb-tabs' : 'flex items-center gap-1 p-1 bg-black/40 rounded-full border border-white/10'}>
        {SHAPES.map(s => (
          <button
            key={s.id}
            type="button"
            aria-pressed={shape === s.id}
            disabled={making}
            onClick={() => { setShape(s.id); if (phase.kind !== 'making') setPhase({ kind: 'idle' }); }}
            className={osrs ? 'owb-tab' : `px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${shape === s.id ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
            title={s.hint}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="relative w-full flex justify-center">
        <canvas
          ref={canvasRef}
          aria-hidden={phase.kind === 'ready'}
          className={`${phase.kind === 'ready' ? 'hidden' : 'block'} h-auto max-w-full ${osrs ? '' : 'rounded-md border border-white/10 bg-black'}`}
          style={{ width: shape === 'tall' ? 'min(100%, 300px)' : '100%' }}
        />
        {phase.kind === 'ready' && (
          <video
            src={phase.url}
            controls
            autoPlay
            muted
            loop
            playsInline
            aria-label="Your Run Film"
            className={`block h-auto max-w-full ${osrs ? '' : 'rounded-md border border-white/10'}`}
            style={{ width: shape === 'tall' ? 'min(100%, 300px)' : '100%' }}
          />
        )}
      </div>
      {empty && <p className={`text-sm ${sub}`}>Your log is empty, so there&rsquo;s nothing to film yet. Roll a Key first.</p>}
      {making && (
        <div className="w-full max-w-md" aria-live="polite">
          <div className={`text-xs mb-1 ${sub}`}>Making your film… {pct}%</div>
          <div className={osrs ? 'owb-film-bar' : 'h-2 rounded bg-white/10 overflow-hidden'}>
            <div className={osrs ? 'owb-film-fill' : 'h-full bg-emerald-500'} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {phase.kind === 'failed' && <p role="alert" className="text-sm text-red-400">{phase.message}</p>}
      {timeline.offMap.length > 0 && (
        <p className={`text-xs text-center ${sub}`}>
          {timeline.offMap.length === 1 ? `${timeline.offMap[0]} is` : `${timeline.offMap.length} Areas are`} underground with no square on the world map, so {timeline.offMap.length === 1 ? 'it shows' : 'they show'} only in the Latest list.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {phase.kind !== 'ready' && (
          <button type="button" className={primary} onClick={make} disabled={making || empty}>
            {!osrs && <Film size={15} />} {making ? 'Making…' : phase.kind === 'failed' ? 'Try again' : 'Make my film'}
          </button>
        )}
        {making && <button type="button" className={btn} onClick={() => abortRef.current?.abort()}>Stop</button>}
        {phase.kind === 'ready' && (
          <>
            <button type="button" className={primary} onClick={download}>{!osrs && <Download size={15} />} Download {phase.file.ext.toUpperCase()}</button>
            {canShare && <button type="button" className={btn} onClick={share}>{!osrs && <Share2 size={15} />} Share</button>}
            <button type="button" className={btn} onClick={() => setPhase({ kind: 'idle' })}>Make another</button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Run Film"
      tabIndex={-1}
      // Opened inside Share Run: a click here must not reach Share Run's backdrop too.
      onClick={e => { e.stopPropagation(); onClose(); }}
      className={osrs ? 'fixed inset-0 z-[110] owb-share-backdrop' : 'fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto'}
    >
      {osrs ? (
        <div className="osrs-win owb-win owb-share" onClick={e => e.stopPropagation()}>
          <OsrsTitleBar title="Run Film" onClose={onClose} />
          <div className="owb-share-body custom-scrollbar">{body}</div>
        </div>
      ) : (
        <div className="mx-auto my-auto w-full max-w-4xl bg-[#0f1115] border border-white/10 rounded-xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-white/10">
            <div className="text-sm font-semibold text-gray-200">Run Film</div>
            <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-gray-500 hover:text-white"><X size={18} /></button>
          </div>
          {body}
        </div>
      )}
    </div>
  );
};
