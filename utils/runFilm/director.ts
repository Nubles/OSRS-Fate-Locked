import type { FilmMoment, FilmTimeline } from './timeline';

/**
 * Run Film director: which caption card shows on each frame. Pure, so the
 * same film always cuts the same way. A step's biggest moment (a share of the
 * map, a first boss, a 99, a lucky Key) gets a card. Cards queue for a moment
 * when they bunch up and are dropped when they'd come too late to still match
 * the map.
 */

export interface FilmCaptionFrame {
  moment: FilmMoment;
  /** Frames since the card appeared. */
  age: number;
  /** Frames the card shows for. */
  length: number;
}

export interface FilmCut {
  caption: (frame: number) => FilmCaptionFrame | null;
}

export interface DirectorOptions {
  captions: boolean;
  /** Frames in the film. */
  total: number;
  /** The step each frame shows, or -1. */
  stepAt: (frame: number) => number;
}

/** Card timing, in frames at 24 a second. */
export const CAPTION = { length: 60, fadeIn: 8, fadeOut: 10, maxDelay: 30 } as const;

export const directFilm = (timeline: FilmTimeline, o: DirectorOptions): FilmCut => {
  // The first frame each step shows on.
  const firstFrame: number[] = [];
  for (let i = 0; i < o.total; i += 1) {
    const s = o.stepAt(i);
    if (s >= 0 && firstFrame[s] === undefined) firstFrame[s] = i;
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
    caption: (frame) => {
      const card = cards.find(c => frame >= c.start && frame < c.start + CAPTION.length);
      return card ? { moment: card.moment, age: frame - card.start, length: CAPTION.length } : null;
    },
  };
};
