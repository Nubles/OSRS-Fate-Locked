import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Film, Share2, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useIsOsrsUi } from '../utils/uiStyle';
import { OsrsTitleBar } from './osrs/OsrsWindowChrome';
import { MAP_IMAGE } from '../utils/mapCoords';
import { buildFilmTimeline, DEFAULT_MAX_STEPS, filmDays, filmFramePlan } from '../utils/runFilm/timeline';
import { FilmPainter, GLOW_FRAMES, type FilmFrameExtras, type FilmShape, type FilmSkillView, type FilmSprites } from '../utils/runFilm/painter';
import { SITE } from './ShareCardCanvas';
import { gemSmallSrc, skillIconSrc, slotSilhouetteSrc, slotUiSrc } from './osrs/OsrsDashGems';
import { EQUIPMENT_SLOTS, SKILLS_LIST } from '../data/items';
import { encodeFilm, FilmCancelled, FILM_FPS, type FilmFile } from '../utils/runFilm/encode';
import { loadRitualFonts, RS_BOLD, RS_FONT } from './rituals/ritualAssets';
import { getGameMode } from '../config/gameModes';
import { showToast } from '../utils/toast';
import { useLocalStorage } from '../hooks/useLocalStorage';

/** Frames before the first step and after the last, so the film opens and ends on a still map. */
const LEAD_FRAMES = 12;
const HOLD_FRAMES = 48;
/** The end card's frames, after the hold. */
const END_FRAMES = 96;

const SHAPES: { id: FilmShape; label: string; hint: string }[] = [
  { id: 'wide', label: 'Wide', hint: 'Discord, YouTube' },
  { id: 'tall', label: 'Tall', hint: 'TikTok, Shorts, Reels' },
];
const SPEEDS: { id: number; label: string }[] = [
  { id: 0.25, label: '25%' }, { id: 0.5, label: '50%' }, { id: 1, label: '100%' }, { id: 2, label: '200%' }, { id: 4, label: '400%' },
];
/** Set lengths, in seconds, for where the film is going. 0: follow the speed. */
const LENGTHS: { id: number; label: string; hint: string }[] = [
  { id: 0, label: 'By speed', hint: 'The speed below sets the length' },
  { id: 10, label: '10s', hint: 'A Discord clip' },
  { id: 15, label: '15s', hint: 'A YouTube intro' },
  { id: 30, label: '30s', hint: 'TikTok, Shorts, Reels' },
  { id: 60, label: '60s', hint: 'A full YouTube segment' },
];
const ON_OFF: { id: 'on' | 'off'; label: string }[] = [{ id: 'on', label: 'On' }, { id: 'off', label: 'Off' }];
const SIZES: { id: 1 | 1.5; label: string; hint: string }[] = [
  { id: 1, label: '720p', hint: 'Quicker to make, smaller file' },
  { id: 1.5, label: '1080p', hint: 'Sharper, for YouTube and editing' },
];
const SKILL_VIEWS: { id: FilmSkillView; label: string; hint: string }[] = [
  { id: 'tiers', label: 'Tiers', hint: 'Tier numerals, I to X' },
  { id: 'levels', label: 'Levels', hint: 'Your skill levels, as the skills tab shows them' },
  { id: 'both', label: 'Both', hint: 'Levels with each skill’s tier beside them' },
];

/** The film's choices, remembered on this device. */
interface FilmChoices {
  shape: FilmShape;
  speed: number;
  scale: 1 | 1.5;
  /** null: levels when the run has any, else tiers. */
  skillView: FilmSkillView | null;
  /** Seconds, or 0 to follow the speed. */
  length: number;
  endCard: 'on' | 'off';
}
const DEFAULT_CHOICES: FilmChoices = { shape: 'wide', speed: 1, scale: 1, skillView: null, length: 0, endCard: 'on' };
const cleanChoices = (c: Partial<FilmChoices> | null | undefined): FilmChoices => ({
  shape: c?.shape === 'tall' ? 'tall' : 'wide',
  speed: SPEEDS.some(s => s.id === c?.speed) ? c!.speed! : 1,
  scale: c?.scale === 1.5 ? 1.5 : 1,
  skillView: SKILL_VIEWS.some(v => v.id === c?.skillView) ? c!.skillView! : null,
  length: LENGTHS.some(l => l.id === c?.length) ? c!.length! : 0,
  endCard: c?.endCard === 'off' ? 'off' : 'on',
});

const shortDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

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

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [storedChoices, setChoices] = useLocalStorage<FilmChoices>('runFilm:choices', DEFAULT_CHOICES);
  const choices = cleanChoices(storedChoices);
  const { shape, speed, scale, length } = choices;
  const endFrames = choices.endCard === 'on' ? END_FRAMES : 0;
  const choose = (patch: Partial<FilmChoices>) => {
    setChoices(prev => ({ ...cleanChoices(prev), ...patch }));
    if (phase.kind !== 'making') setPhase({ kind: 'idle' });
  };

  // Which days to film: the whole run unless the player picks.
  const days = useMemo(() => filmDays(history), [history]);
  const firstDay = days[0]?.day ?? 1, lastDay = days[days.length - 1]?.day ?? 1;
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const fromDay = Math.min(Math.max(range?.from ?? firstDay, firstDay), lastDay);
  const toDay = Math.max(Math.min(range?.to ?? lastDay, lastDay), fromDay);
  const pickDays = (from: number, to: number) => {
    setRange(from <= firstDay && to >= lastDay ? null : { from, to: Math.max(from, to) });
    if (phase.kind !== 'making') setPhase({ kind: 'idle' });
  };
  // Lines in the chosen days, spread over the film at the chosen speed, or
  // over whatever's left of a set length once the opening, hold and end card are in.
  const lines = days.reduce((n, d) => (d.day >= fromDay && d.day <= toDay ? n + d.lines : n), 0);
  const stepFrames = length
    ? Math.max(FILM_FPS, length * FILM_FPS - LEAD_FRAMES - HOLD_FRAMES - endFrames)
    : Math.max(1, Math.round(Math.min(lines, DEFAULT_MAX_STEPS) / speed));

  const [title, setTitle] = useState('');
  const defaultTitle = `${activeProfileName || 'My run'} · Fate Locked ${getGameMode(gameModeId).name}`;
  const filmTitle = title.trim() || defaultTitle;

  const chunked = gameModeId === 'chunked';
  const timeline = useMemo(() => buildFilmTimeline(history, {
    chunked,
    finalRegions: unlocks.regions ?? [],
    finalChunks: unlocks.chunks ?? [],
    finalSkills: unlocks.skills,
    finalGear: unlocks.equipment,
    finalLevels: unlocks.levels,
    maxSteps: stepFrames,
    fromDay,
    toDay,
  }), [history, chunked, unlocks.regions, unlocks.chunks, unlocks.skills, unlocks.equipment, unlocks.levels, stepFrames, fromDay, toDay]);
  const skillView: FilmSkillView = choices.skillView ?? (timeline.hasLevels ? 'both' : 'tiers');
  const plan = useMemo(() => filmFramePlan(timeline.steps.length, stepFrames, LEAD_FRAMES, HOLD_FRAMES + endFrames), [timeline, stepFrames, endFrames]);
  const frames = plan.total;
  const endStart = frames - endFrames;
  const showLevels = skillView !== 'tiers';
  const extrasAt = (i: number): FilmFrameExtras => ({
    endCard: endFrames && i >= endStart ? { summary: timeline.summary, age: i - endStart, showLevels, site: SITE } : null,
  });
  const seconds = Math.round(frames / FILM_FPS);

  // The preview: any frame of the film, drawn without making it. Starts on the last.
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const previewFrame = Math.min(previewAt ?? frames - 1, frames - 1);

  // Stop work and free the file when the window closes.
  useEffect(() => () => { abortRef.current?.abort(); }, []);
  useEffect(() => () => { if (phase.kind === 'ready') URL.revokeObjectURL(phase.url); }, [phase]);

  // At rest the canvas shows the preview frame (the film's last, unless the player moves it).
  const painterRef = useRef<{ key: string; painter: FilmPainter } | null>(null);
  useEffect(() => {
    if (phase.kind !== 'idle' && phase.kind !== 'failed') return;
    let cancelled = false;
    (async () => {
      await loadRitualFonts(3000);
      const [map, sprites] = await Promise.all([loadMap(), loadSprites()]);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      // The painter is kept while the shape, size and skills view stay, so dragging the preview stays smooth.
      const key = `${shape}|${scale}|${skillView}`;
      if (painterRef.current?.key !== key) {
        painterRef.current = { key, painter: new FilmPainter(canvas, map, shape, { regular: RS_FONT, bold: RS_BOLD }, sprites, { skillView, scale }) };
      }
      const stepIndex = plan.stepAt(previewFrame);
      const owned = new Set(timeline.start);
      for (let s = 0; s <= stepIndex; s += 1) for (const k of timeline.steps[s].added) owned.add(k);
      painterRef.current.painter.paint(owned, new Map(), stepIndex < 0 ? timeline.opening : timeline.steps[stepIndex], filmTitle, extrasAt(previewFrame));
    })().catch(() => { /* the Make button reports a map that won't load */ });
    return () => { cancelled = true; };
    // extrasAt reads endStart, endFrames and showLevels, listed here.
  }, [phase.kind, shape, scale, skillView, timeline, plan, previewFrame, filmTitle, endStart, endFrames, showLevels]);

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
      painterRef.current = null;
      const painter = new FilmPainter(canvas, map, shape, { regular: RS_FONT, bold: RS_BOLD }, sprites, { skillView, scale });
      const owned = new Set(timeline.start);
      let glow = new Map<string, number>();
      let applied = -1;
      // Frames come in order, so each one only needs the steps since the last.
      const draw = (i: number) => {
        const stepIndex = plan.stepAt(i);
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
        painter.paint(owned, glow, stepIndex < 0 ? timeline.opening : timeline.steps[stepIndex], filmTitle, extrasAt(i));
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

  const seg = <T extends string | number>(label: string, options: { id: T; label: string; hint?: string }[], value: T, onPick: (id: T) => void, wide = false) => (
    <div className={`flex flex-wrap items-center gap-2 min-w-0${wide ? ' sm:col-span-2' : ''}`}>
      <span className={`text-xs w-14 shrink-0 ${sub}`}>{label}</span>
      <div role="group" aria-label={label} className={osrs ? 'flex flex-wrap gap-1' : 'flex flex-wrap items-center gap-1 p-1 bg-black/40 rounded-full border border-white/10'}>
        {options.map(o => (
          <button
            key={String(o.id)}
            type="button"
            aria-pressed={value === o.id}
            disabled={making}
            onClick={() => onPick(o.id)}
            className={osrs ? `osrs-btn${value === o.id ? ' is-on' : ''}` : `px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 ${value === o.id ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
            style={osrs ? { height: 26, padding: '0 10px' } : undefined}
            title={o.hint}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
  const field = osrs ? '' : 'bg-black/40 border border-white/10 rounded-md px-2 py-1 text-sm text-white disabled:opacity-40';
  const dayOption = (d: { day: number; firstAt: number }) => (
    <option key={d.day} value={d.day}>Day {d.day} · {shortDate(d.firstAt)}</option>
  );

  const body = (
    <div className="flex flex-col items-center gap-3 p-3 sm:p-5">
      <p className={`text-sm text-center max-w-prose ${sub}`}>
        Your run&rsquo;s log played back on the world map: the fog lifts where fate opened land, with your skills, gear and latest unlocks beside it.
        About {seconds} seconds. Made on this device; nothing is uploaded.
      </p>
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
      {(phase.kind === 'idle' || phase.kind === 'failed') && !empty && (
        <label className={`w-full max-w-xl flex items-center gap-2 text-xs ${sub}`}>
          <span className="w-14 shrink-0">Preview</span>
          <input
            type="range"
            min={0}
            max={frames - 1}
            value={previewFrame}
            onChange={e => setPreviewAt(Number(e.target.value))}
            className="flex-1 min-w-0"
            style={{ accentColor: osrs ? '#ff981f' : '#10b981' }}
            aria-valuetext={`${(previewFrame / FILM_FPS).toFixed(1)} of ${seconds} seconds`}
          />
          <span className="w-16 text-right tabular-nums">{(previewFrame / FILM_FPS).toFixed(1)}s / {seconds}s</span>
        </label>
      )}
      <div className="w-full max-w-xl grid gap-2 sm:grid-cols-2">
        {seg('Shape', SHAPES, shape, id => { choose({ shape: id }); setPreviewAt(null); })}
        {seg('Size', SIZES, scale, id => choose({ scale: id }))}
        {seg('Length', LENGTHS, length, id => { choose({ length: id }); setPreviewAt(null); }, true)}
        {seg('Speed', SPEEDS, length ? -1 : speed, id => { choose({ speed: id, length: 0 }); setPreviewAt(null); }, true)}
        {seg('Skills', SKILL_VIEWS, skillView, id => choose({ skillView: id }))}
        {seg('End card', ON_OFF, choices.endCard, id => { choose({ endCard: id }); setPreviewAt(null); })}
        {days.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 min-w-0 sm:col-span-2">
            <span className={`text-xs w-14 shrink-0 ${sub}`}>Days</span>
            <select aria-label="First day" className={field} disabled={making} value={fromDay} onChange={e => { pickDays(Number(e.target.value), toDay); setPreviewAt(null); }}>
              {days.map(dayOption)}
            </select>
            <span className={`text-xs ${sub}`}>to</span>
            <select aria-label="Last day" className={field} disabled={making} value={toDay} onChange={e => { pickDays(fromDay, Number(e.target.value)); setPreviewAt(null); }}>
              {days.filter(d => d.day >= fromDay).map(dayOption)}
            </select>
            {range && <button type="button" className={osrs ? 'osrs-btn' : 'text-xs text-gray-400 hover:text-white underline'} style={osrs ? { height: 26, padding: '0 10px' } : undefined} disabled={making} onClick={() => { setRange(null); setPreviewAt(null); }}>Whole run</button>}
          </div>
        )}
        <label className="flex flex-wrap items-center gap-2 min-w-0 sm:col-span-2">
          <span className={`text-xs w-14 shrink-0 ${sub}`}>Title</span>
          <input
            type="text"
            className={`flex-1 min-w-0 ${field}`}
            value={title}
            maxLength={60}
            placeholder={defaultTitle}
            disabled={making}
            onChange={e => { setTitle(e.target.value); if (phase.kind === 'ready') setPhase({ kind: 'idle' }); }}
          />
        </label>
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
