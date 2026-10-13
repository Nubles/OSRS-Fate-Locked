/**
 * Hand-drawn pixel art and the chunky particle layer the ritual scenes share.
 * Everything renders at low resolution and is scaled up with square pixels,
 * like the game's own sprites. Randomness here is visual jitter only.
 */

export interface PixelArt<T> { el: HTMLCanvasElement; draw: (value: T) => void }

export const pixelCanvas = (w: number, h: number, scale: number) => {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  el.style.width = `${w * scale}px`;
  el.style.height = `${h * scale}px`;
  el.style.imageRendering = 'pixelated';
  const g = el.getContext('2d');
  if (g) g.imageSmoothingEnabled = false;
  return { el, g };
};

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[6, 6]],
  2: [[3, 3], [9, 9]],
  3: [[3, 3], [6, 6], [9, 9]],
  4: [[3, 3], [9, 3], [3, 9], [9, 9]],
  5: [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]],
  6: [[3, 3], [9, 3], [3, 6], [9, 6], [3, 9], [9, 9]],
};

/** A 15px die. `draw([face, greyed])`. */
export const makeDie = (scale: number): PixelArt<[number, boolean?]> => {
  const { el, g } = pixelCanvas(15, 15, scale);
  const draw = ([face, grey]: [number, boolean?]) => {
    if (!g) return;
    g.clearRect(0, 0, 15, 15);
    g.fillStyle = '#000';
    g.fillRect(1, 0, 13, 15);
    g.fillRect(0, 1, 15, 13);
    g.fillStyle = grey ? '#7d776c' : '#efe6d2';
    g.fillRect(1, 1, 13, 13);
    g.fillStyle = grey ? '#56514a' : '#b9a685';
    g.fillRect(1, 12, 13, 2);
    g.fillRect(12, 1, 2, 13);
    g.fillStyle = grey ? '#9a948a' : '#fffaf0';
    g.fillRect(1, 1, 11, 1);
    g.fillRect(1, 1, 1, 11);
    g.fillStyle = grey ? '#33302b' : '#7a0f0f';
    for (const [x, y] of PIPS[face] ?? PIPS[1]) g.fillRect(x, y, 2, 2);
  };
  draw([1]);
  return { el, draw };
};

const KEY_GLYPH = ['..XXX...', '.X...X..', '.X...X..', '..XXX...', '...X....', '...XX...', '...X....', '...XX...'];
const SKULL_GLYPH = ['..XXXX..', '.XXXXXX.', 'XX..X..X', 'XX..X..X', 'XXXXXXXX', '.XXX.XX.', '..XXXX..', '..X.X.X.'];

/**
 * The Gambit coin, drawn mid-turn: `w` is the coin's width as a fraction of a
 * face-on view, negative for the skull side.
 */
export const makeCoin = (scale: number): PixelArt<number> => {
  const N = 18;
  const { el, g } = pixelCanvas(N, N, scale);
  const draw = (w: number) => {
    if (!g) return;
    g.clearRect(0, 0, N, N);
    const key = w >= 0;
    const a = Math.abs(w);
    const rx = Math.max(1.2, a * 8.5);
    const pal = key
      ? { rim: '#6e4500', body: '#d9a300', hi: '#ffe27a', sym: '#7a4a00' }
      : { rim: '#2c1a3c', body: '#7d6a8f', hi: '#b8a6c9', sym: '#1d1028' };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + 0.5 - 9) / rx;
      const dy = (y + 0.5 - 9) / 8.5;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      g.fillStyle = d > 0.66 || a < 0.35 ? pal.rim : (dx < -0.2 && dy < -0.2 ? pal.hi : pal.body);
      g.fillRect(x, y, 1, 1);
    }
    if (a > 0.7) {
      g.fillStyle = pal.sym;
      (key ? KEY_GLYPH : SKULL_GLYPH).forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === 'X') g.fillRect(5 + x, 5 + y, 1, 1);
      }));
    }
  };
  draw(1);
  return { el, draw };
};

/** A Pest Control style swirl. `draw(open)` sizes it 0..1; `spin()` turns it a step. */
export const makePortal = (scale: number) => {
  const W = 64, H = 40;
  const { el, g } = pixelCanvas(W, H, scale);
  const pal = ['#22082f', '#3d1060', '#5f1f96', '#8b3fd0', '#b77cf2', '#e6ccff'];
  let open = 0, turn = 0;
  const render = () => {
    if (!g) return;
    g.clearRect(0, 0, W, H);
    if (open <= 0.01) return;
    const rx = 30 * open, ry = 18 * open;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - 32) / rx, dy = (y + 0.5 - 20) / ry;
      const e = Math.sqrt(dx * dx + dy * dy);
      if (e > 1) continue;
      const v = Math.sin(Math.atan2(dy, dx) * 3 + turn * 0.9 - e * 9);
      const i = Math.max(0, Math.min(pal.length - 1, Math.floor((1 - e) * 3.2 + (v > 0.35 ? 2 : v > -0.2 ? 1 : 0))));
      g.fillStyle = e > 0.9 ? '#120418' : pal[i];
      g.fillRect(x, y, 1, 1);
    }
  };
  return {
    el,
    get open() { return open; },
    draw(o: number) { open = o; render(); },
    spin() { turn += 1; render(); },
  };
};

interface Particle {
  x: number; y: number; vx: number; vy: number; g: number;
  life: number; age: number; color: string;
  kind: 'sq' | 'plus' | 'ring'; size?: number; flicker?: boolean;
  r?: number; max?: number; speed?: number;
}

export type ParticleInit = Partial<Particle> & { x: number; y: number };

/** FX canvas units: a third of the 420x300 scene, drawn at 25 fps. */
export const FX_W = 140;
export const FX_H = 100;

export class PixelFx {
  readonly el: HTMLCanvasElement;
  enabled = true;
  private g: CanvasRenderingContext2D | null;
  private particles: Particle[] = [];
  private emitters: Array<(fx: PixelFx) => void> = [];
  private timer: ReturnType<typeof setInterval>;

  constructor() {
    const { el, g } = pixelCanvas(FX_W, FX_H, 3);
    this.el = el;
    this.g = g;
    this.timer = setInterval(() => this.tick(), 40);
  }

  add(p: ParticleInit) {
    if (!this.enabled) return;
    this.particles.push({ vx: 0, vy: 0, g: 0, life: 20, age: 0, kind: 'sq', color: '#fff', ...p });
  }

  burst(x: number, y: number, n: number, colors: string[], speed = 1.2, extra: Partial<Particle> = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 14 + Math.floor(Math.random() * 12), color: colors[i % colors.length], ...extra });
    }
  }

  ring(x: number, y: number, color: string, max = 26, speed = 1.4) {
    this.add({ kind: 'ring', x, y, r: 2, max, speed, color, life: Math.ceil(max / speed) });
  }

  /** Runs `fn` every frame until the returned stop function is called. */
  emitter(fn: (fx: PixelFx) => void): () => void {
    this.emitters.push(fn);
    return () => { this.emitters = this.emitters.filter(f => f !== fn); };
  }

  clear() { this.particles = []; this.emitters = []; }

  destroy() { clearInterval(this.timer); this.clear(); }

  private tick() {
    const g = this.g;
    if (!g) return;
    g.clearRect(0, 0, FX_W, FX_H);
    if (this.enabled) this.emitters.forEach(f => f(this));
    this.particles = this.particles.filter(p => p.age < p.life);
    for (const p of this.particles) {
      p.age++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      const k = 1 - p.age / p.life;
      if (p.flicker && Math.random() < 0.25) continue;
      g.globalAlpha = k > 0.5 ? 1 : k > 0.25 ? 0.66 : 0.33;
      g.fillStyle = p.color;
      const x = Math.round(p.x), y = Math.round(p.y);
      if (p.kind === 'sq') {
        g.fillRect(x, y, p.size ?? 1, p.size ?? 1);
      } else if (p.kind === 'plus') {
        const arm = k > 0.5 ? 2 : 1;
        g.fillRect(x - arm, y, arm * 2 + 1, 1);
        g.fillRect(x, y - arm, 1, arm * 2 + 1);
      } else {
        p.r = Math.min(p.max ?? 26, (p.r ?? 2) + (p.speed ?? 1.4));
        this.circle(x, y, Math.round(p.r));
      }
    }
    g.globalAlpha = 1;
  }

  /** A 1px midpoint circle, so rings stay pixel-crisp. */
  private circle(cx: number, cy: number, r: number) {
    const g = this.g;
    if (!g) return;
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) g.fillRect(cx + a, cy + b, 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  }
}
