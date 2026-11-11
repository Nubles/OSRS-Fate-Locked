import type { FilmMoment, FilmTimeline } from './timeline';

/**
 * Run Film director: where the camera looks and which caption card shows on
 * each frame. Pure, so the same film always cuts the same way.
 *
 * - Camera: when new land opens, the map eases in on it, holds, then eases
 *   back out to the whole map. Shots are spaced out so the film never feels
 *   jumpy; land that opens while the camera is busy just glows as usual.
 * - Captions: a step's biggest moment (a share of the map, a first boss, a 99,
 *   a lucky Key) gets a card. Cards queue for a moment when they bunch up and
 *   are dropped when they'd come too late to still match the map.
 */

/** A view of the map, in chunks from its top-left corner (the map is 48 × 34 chunks). */
export interface FilmCamera { x: number; y: number; w: number; h: number }
export const FULL_VIEW: FilmCamera = { x: 0, y: 0, w: 48, h: 34 };
const MAP_W = 48, MAP_H = 34, MIN_X = 15, MAX_Y = 65;

export interface FilmCaptionFrame {
  moment: FilmMoment;
  /** Frames since the card appeared. */
  age: number;
  /** Frames the card shows for. */
  length: number;
}

export interface FilmCut {
  camera: (frame: number) => FilmCamera;
  caption: (frame: number) => FilmCaptionFrame | null;
}

export interface DirectorOptions {
  camera: boolean;
  captions: boolean;
  /** Frames in the film. */
  total: number;
  /** The step each frame shows, or -1. */
  stepAt: (frame: number) => number;
}

/** Shot timing, in frames at 24 a second. */
export const SHOT = { lead: 8, easeIn: 14, hold: 30, easeOut: 16, gap: 30 } as const;
const SHOT_LEN = SHOT.easeIn + SHOT.hold + SHOT.easeOut;
/** A shot never zooms closer than this many chunks across, nor bothers when the land is wider than MAX_W. */
const MIN_W = 14, MAX_W = 30, PAD = 3;
export const CAPTION = { length: 60, fadeIn: 8, fadeOut: 10, maxDelay: 30 } as const;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a: FilmCamera, b: FilmCamera, t: number): FilmCamera => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t,
});

/** The view a shot of these chunks takes, or null when the land is too spread out to be worth a zoom. */
export const shotFor = (chunks: readonly string[]): FilmCamera | null => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of chunks) {
    const [cx, cy] = k.split(',').map(Number);
    const col = cx - MIN_X, row = MAX_Y - cy;
    if (!(col >= 0 && col < MAP_W && row >= 0 && row < MAP_H)) continue;
    x0 = Math.min(x0, col); x1 = Math.max(x1, col + 1);
    y0 = Math.min(y0, row); y1 = Math.max(y1, row + 1);
  }
  if (!Number.isFinite(x0)) return null;
  const w = Math.max(MIN_W, x1 - x0 + 2 * PAD, (y1 - y0 + 2 * PAD) * (MAP_W / MAP_H));
  if (w > MAX_W) return null;
  const h = w * (MAP_H / MAP_W);
  const x = Math.min(Math.max((x0 + x1) / 2 - w / 2, 0), MAP_W - w);
  const y = Math.min(Math.max((y0 + y1) / 2 - h / 2, 0), MAP_H - h);
  return { x, y, w, h };
};

export const directFilm = (timeline: FilmTimeline, o: DirectorOptions): FilmCut => {
  // The first frame each step shows on.
  const firstFrame: number[] = [];
  for (let i = 0; i < o.total; i += 1) {
    const s = o.stepAt(i);
    if (s >= 0 && firstFrame[s] === undefined) firstFrame[s] = i;
  }

  const shots: { start: number; view: FilmCamera }[] = [];
  if (o.camera) {
    let free = 0;
    timeline.steps.forEach((step, s) => {
      if (!step.added.length || firstFrame[s] === undefined) return;
      // Start easing in just before the land appears, so it opens as the camera arrives.
      const start = Math.max(0, firstFrame[s] - SHOT.lead);
      if (start < free || start + SHOT_LEN > o.total) return;
      const view = shotFor(step.added);
      if (!view) return;
      shots.push({ start, view });
      free = start + SHOT_LEN + SHOT.gap;
    });
  }

  const cards: { start: number; moment: FilmMoment }[] = [];
  if (o.captions) {
    let free = 0;
    timeline.steps.forEach((step, s) => {
      const moment = step.moments[0];
      if (!moment || firstFrame[s] === undefined) return;
      const start = Math.max(free, firstFrame[s]);
      if (start - firstFrame[s] > CAPTION.maxDelay || start + CAPTION.length > o.total) return;
      cards.push({ start, moment });
      free = start + CAPTION.length;
    });
  }

  return {
    camera: (frame) => {
      const shot = shots.find(sh => frame >= sh.start && frame < sh.start + SHOT_LEN);
      if (!shot) return FULL_VIEW;
      const t = frame - shot.start;
      if (t < SHOT.easeIn) return lerp(FULL_VIEW, shot.view, ease(t / SHOT.easeIn));
      if (t < SHOT.easeIn + SHOT.hold) return shot.view;
      return lerp(shot.view, FULL_VIEW, ease((t - SHOT.easeIn - SHOT.hold) / SHOT.easeOut));
    },
    caption: (frame) => {
      const card = cards.find(c => frame >= c.start && frame < c.start + CAPTION.length);
      return card ? { moment: card.moment, age: frame - card.start, length: CAPTION.length } : null;
    },
  };
};
