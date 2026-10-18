/**
 * Plays one ritual scene: a short timeline of steps that build and animate
 * DOM nodes on a 420x300 stage, then a title and an in-game item dialog.
 * Skipping runs every remaining step at once and finishes every animation,
 * so a skipped scene and a reduced-motion scene land on the same last frame
 * the full one does. The last frame stays up until the player clicks through
 * (its dialog says "Click here to continue"): a result that closed itself
 * hid what the ritual did before it could be read.
 */
import './ritualStage.css';
import { PixelFx } from './ritualPixels';
import { RS_BOLD, RS_FONT, RS_SMALL } from './ritualAssets';

export const SCENE_W = 420;
export const SCENE_H = 300;

interface Ticker { id: ReturnType<typeof setInterval> | null; done?: () => void; finished: boolean }

export interface SceneKit {
  readonly scene: HTMLDivElement;
  readonly fx: PixelFx;
  /** True while skipping or under reduced motion: animations land on their last frame at once. */
  readonly instant: boolean;
  /** Schedules a step `t` ms into the scene. */
  at(t: number, fn: () => void): void;
  /** A zero-size anchor at (x, y) that centres its child there. Move the node; scale the child. */
  node(x: number, y: number, child?: Node, z?: number): HTMLDivElement;
  label(x: number, y: number, text: string, opts?: { color?: string; font?: 'plain' | 'bold' | 'small'; big?: boolean }): { node: HTMLDivElement; span: HTMLSpanElement };
  slot(child: Node, w?: number, h?: number): HTMLDivElement;
  anim(target: Element, keyframes: Keyframe[], opts: number | KeyframeAnimationOptions): Animation;
  show(target: Element, ms?: number): Animation;
  hide(target: Element, ms?: number): Animation;
  pop(target: Element, ms?: number): Animation;
  /** Frame-by-frame swaps every `ms`; a skip jumps straight to `done`. */
  ticker(ms: number, frames: number, fn: (i: number) => void, done?: () => void): void;
  /** A looping interval (a portal's spin) that a skip stops, then runs `done`. */
  loop(ms: number, fn: () => void, done?: () => void): () => void;
  /** An endless ambient animation, dropped under reduced motion and cancelled on close. */
  ambient(target: Element, keyframes: Keyframe[], opts: KeyframeAnimationOptions): void;
}

export interface SceneResult {
  /** When the scene's last step lands, in ms. */
  end: number;
  title: string;
  /** The item dialog: its icon and the game message. */
  icon: () => Node;
  text: string;
}

export type SceneFactory<I> = (kit: SceneKit, input: I) => SceneResult;

const FONTS = { plain: RS_FONT, bold: RS_BOLD, small: RS_SMALL } as const;

export interface RitualPlayer { skip(): void; destroy(): void }

export const playScene = <I>(
  host: HTMLElement,
  factory: SceneFactory<I>,
  input: I,
  { reducedMotion, onDone }: { reducedMotion: boolean; onDone: () => void },
): RitualPlayer => {
  const fit = document.createElement('div');
  fit.className = 'ritual-fit';
  const scene = document.createElement('div');
  scene.className = 'ritual-scene';
  fit.append(scene);
  const fx = new PixelFx();
  fx.el.classList.add('ritual-fx');
  scene.append(fx.el);

  const anims: Animation[] = [];
  const ambients: Animation[] = [];
  const tickers: Ticker[] = [];
  const timeouts: Array<ReturnType<typeof setTimeout>> = [];
  const steps: Array<{ t: number; fn: () => void; ran: boolean }> = [];
  let instant = reducedMotion;
  if (reducedMotion) fx.enabled = false;

  const kit: SceneKit = {
    scene,
    fx,
    get instant() { return instant; },
    at(t, fn) { steps.push({ t, fn, ran: false }); },
    node(x, y, child, z) {
      const n = document.createElement('div');
      n.className = 'ritual-node';
      n.style.left = `${x}px`;
      n.style.top = `${y}px`;
      if (z) n.style.zIndex = String(z);
      if (child) n.append(child);
      scene.append(n);
      return n;
    },
    label(x, y, text, opts = {}) {
      const span = document.createElement('span');
      span.className = `ritual-label${opts.big ? ' ritual-big' : ''}`;
      span.textContent = text;
      span.style.fontFamily = FONTS[opts.font ?? 'small'];
      span.style.color = opts.color ?? '#ff981f';
      return { node: kit.node(x, y, span, 6), span };
    },
    slot(child, w, h) {
      const s = document.createElement('div');
      s.className = 'ritual-slot';
      if (w) s.style.width = `${w}px`;
      if (h) s.style.height = `${h}px`;
      s.append(child);
      return s;
    },
    anim(target, keyframes, opts) {
      const a = target.animate(keyframes, { fill: 'forwards', ...(typeof opts === 'number' ? { duration: opts } : opts) });
      anims.push(a);
      if (instant) a.finish();
      return a;
    },
    show: (target, ms = 200) => kit.anim(target, [{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'steps(4, end)' }),
    hide: (target, ms = 200) => kit.anim(target, [{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'steps(4, end)' }),
    pop: (target, ms = 260) => kit.anim(target, [
      { transform: 'scale(.3)', opacity: 0 },
      { transform: 'scale(1.15)', opacity: 1, offset: 0.6 },
      { transform: 'scale(1)', opacity: 1 },
    ], { duration: ms, easing: 'ease-out' }),
    ticker(ms, frames, fn, done) {
      if (instant) { done?.(); return; }
      let i = 0;
      const t: Ticker = { id: null, done, finished: false };
      t.id = setInterval(() => {
        if (i >= frames) { if (t.id) clearInterval(t.id); t.finished = true; done?.(); return; }
        fn(i++);
      }, ms);
      tickers.push(t);
    },
    loop(ms, fn, done) {
      if (instant) { done?.(); return () => {}; }
      const t: Ticker = { id: setInterval(fn, ms), done, finished: false };
      tickers.push(t);
      return () => { if (t.id) clearInterval(t.id); t.finished = true; };
    },
    ambient(target, keyframes, opts) {
      if (reducedMotion || instant) return;
      ambients.push(target.animate(keyframes, { iterations: Infinity, ...opts }));
    },
  };

  const result = factory(kit, input);

  const title = document.createElement('h2');
  title.className = 'ritual-title';
  title.style.fontFamily = RS_BOLD;
  title.textContent = result.title;
  const dialog = document.createElement('div');
  dialog.className = 'ritual-dialog';
  const icon = document.createElement('div');
  icon.className = 'ritual-dialog-icon';
  icon.append(result.icon());
  const text = document.createElement('div');
  text.className = 'ritual-dialog-text';
  text.style.fontFamily = RS_FONT;
  text.setAttribute('aria-live', 'polite');
  const message = document.createElement('span');
  message.textContent = result.text;
  const cont = document.createElement('span');
  cont.className = 'ritual-continue';
  cont.textContent = 'Click here to continue';
  text.append(message, cont);
  dialog.append(icon, text);
  fit.append(title, dialog);
  host.append(fit);

  kit.at(Math.max(0, result.end - 450), () => {
    kit.anim(title, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'steps(4, end)' });
    kit.anim(dialog, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'steps(4, end)' });
  });
  kit.at(result.end, () => { cont.style.visibility = 'visible'; });

  steps.sort((a, b) => a.t - b.t);
  const run = (s: (typeof steps)[number]) => { if (!s.ran) { s.ran = true; s.fn(); } };

  let ended = false;
  let destroyed = false;
  const finishAll = () => {
    instant = true;
    timeouts.forEach(clearTimeout);
    for (const t of tickers) {
      if (t.id) clearInterval(t.id);
      if (!t.finished) { t.finished = true; t.done?.(); }
    }
    steps.forEach(run);
    anims.forEach(a => { try { a.finish(); } catch { /* an animation with no end */ } });
    fx.clear();
  };
  const markEnded = () => { ended = true; };

  const resize = () => {
    const r = host.getBoundingClientRect();
    const needH = fit.offsetHeight || 460;
    const s = Math.min(1, (r.width - 24) / SCENE_W, (r.height - 24) / needH);
    fit.style.transform = `scale(${Math.max(0.5, s)})`;
  };
  resize();
  window.addEventListener('resize', resize);

  const player: RitualPlayer = {
    skip() {
      if (ended) { player.destroy(); return; }
      finishAll();
      markEnded();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      finishAll();
      ambients.forEach(a => a.cancel());
      fx.destroy();
      window.removeEventListener('resize', resize);
      fit.remove();
      onDone();
    },
  };

  if (instant) {
    steps.forEach(run);
    markEnded();
  } else {
    for (const s of steps) timeouts.push(setTimeout(() => run(s), s.t));
    timeouts.push(setTimeout(markEnded, result.end));
  }
  return player;
};
