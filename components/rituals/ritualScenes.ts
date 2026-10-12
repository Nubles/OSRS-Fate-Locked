/**
 * One scene per Void Altar ritual. RITUAL_SCENES is keyed by every ritual id,
 * so a new ritual in config/economy.ts doesn't typecheck until it has a scene.
 * Scene positions are in the 420x300 stage; FX positions are a third of that.
 */
import { GREED_REFUND_FRACTION, getRitual, type Ritual } from '../../config/economy';
import { chunkLabel } from '../../utils/chunkAdjacency';
import { MAP_IMAGE } from '../../utils/mapCoords';
import { RITUAL_MAP_COLS, RITUAL_MAP_ROWS, ritualMapWindow } from '../../utils/ritualMapWindow';
import { RS_BOLD, RS_SMALL, spriteImg, spriteUrl, SPRITE_H, SPRITE_W, type SpriteName } from './ritualAssets';
import { makeCoin, makeDie, makePortal } from './ritualPixels';
import type { SceneFactory } from './ritualStage';

export interface RitualSceneInput {
  /** The RITUAL event's meta (won/stake/keysWon for the Gambit, chunk for the Cartographer). */
  meta: Record<string, unknown>;
  /** The run's land, for the Cartographer's map. */
  ownedChunks: readonly string[];
}

type Scene = SceneFactory<RitualSceneInput>;

const glow = (color: string): HTMLDivElement => {
  const g = document.createElement('div');
  g.className = 'ritual-glow';
  g.style.background = `radial-gradient(circle, ${color} 0%, rgba(0,0,0,0) 65%)`;
  return g;
};

const swapSprite = (img: HTMLImageElement, name: SpriteName, scale: number) => {
  img.src = spriteUrl(name);
  img.width = SPRITE_W * scale;
  img.height = SPRITE_H * scale;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Clarity: two dice land, the weaker crumbles, the better one is kept. */
const clarity: Scene = (k) => {
  const halo = glow('rgba(79,163,255,.45)');
  k.node(210, 120, halo, 1);
  const dl = makeDie(6), dr = makeDie(6);
  const L = k.node(135, -60, dl.el, 3), R = k.node(285, -60, dr.el, 3);
  const one = k.label(135, 192, 'Roll one'), two = k.label(285, 192, 'Roll two');
  one.node.style.opacity = '0';
  two.node.style.opacity = '0';
  const fall: Keyframe[] = [
    { transform: 'translateY(0)' },
    { transform: 'translateY(190px)', offset: 0.72, easing: 'ease-out' },
    { transform: 'translateY(176px)', offset: 0.86, easing: 'ease-in' },
    { transform: 'translateY(190px)' },
  ];
  k.at(0, () => {
    k.anim(L, fall, { duration: 760, easing: 'cubic-bezier(.5,0,1,1)' });
    k.ticker(70, 10, i => { dl.draw([1 + (i * 5) % 6]); dl.el.style.transform = `rotate(${(i % 4) * 90}deg)`; },
      () => { dl.draw([2]); dl.el.style.transform = 'none'; });
  });
  k.at(120, () => {
    k.anim(R, fall, { duration: 760, easing: 'cubic-bezier(.5,0,1,1)' });
    k.ticker(70, 10, i => { dr.draw([1 + (i * 3 + 2) % 6]); dr.el.style.transform = `rotate(${(i % 4) * -90}deg)`; },
      () => { dr.draw([5]); dr.el.style.transform = 'none'; });
  });
  k.at(560, () => k.fx.burst(45, 58, 8, ['#8a7a5a', '#5e5340'], 0.8, { g: 0.08 }));
  k.at(700, () => k.fx.burst(95, 58, 8, ['#8a7a5a', '#5e5340'], 0.8, { g: 0.08 }));
  k.at(850, () => { k.show(one.node); k.show(two.node); });
  k.at(1250, () => { dl.draw([2, true]); one.span.style.color = '#8b8478'; });
  k.at(1500, () => {
    k.hide(L, 240);
    k.hide(one.node, 240);
    for (let i = 0; i < 26; i++) {
      k.fx.add({ x: 37 + Math.random() * 16, y: 36 + Math.random() * 16, vx: (Math.random() - 0.5) * 0.5, vy: Math.random() * 0.4,
        g: 0.09, life: 20 + Math.floor(Math.random() * 10), color: i % 2 ? '#7d776c' : '#56514a' });
    }
  });
  k.at(1700, () => {
    k.anim(R, [{ transform: 'translate(0,190px)' }, { transform: 'translate(-75px,180px)' }], { duration: 420, easing: 'ease-out' });
    k.anim(two.node, [{ transform: 'translate(0,0)' }, { transform: 'translate(-75px,0)' }], { duration: 420, easing: 'ease-out' });
  });
  k.at(2000, () => {
    two.span.textContent = 'Kept';
    two.span.style.color = '#00ff00';
    k.anim(halo, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'steps(5, end)' });
    k.fx.ring(70, 40, '#9fd8ff', 30, 1.6);
    k.fx.burst(70, 40, 14, ['#ffffff', '#9fd8ff', '#4fa3ff'], 1.3, { kind: 'plus' });
  });
  k.at(2250, () => k.fx.ring(70, 40, '#4fa3ff', 22, 1.2));
  return {
    end: 2350,
    title: getRitual('LUCK').name,
    icon: () => { const d = makeDie(4); d.draw([5]); return d.el; },
    text: 'Your next Key roll is made twice. The better result counts.',
  };
};

/** Greed: a coin stack climbs every in-game stack size, spills, and two Keys appear. */
const greed: Scene = (k) => {
  const coin = spriteImg('coins_1', 3);
  const qty = document.createElement('span');
  Object.assign(qty.style, { position: 'absolute', left: '6px', top: '2px', color: '#ffff00', textShadow: '1px 1px 0 #000', fontSize: '32px', lineHeight: '1', fontFamily: RS_SMALL });
  qty.textContent = '1';
  const slot = k.slot(coin, 128, 112);
  slot.style.position = 'relative';
  slot.append(qty);
  k.node(210, 100, slot, 3);
  // The game's stack sprites, then its stack-text colours: yellow, white from 100K, green from 10M.
  const stacks: Array<[SpriteName, string, string?]> = [
    ['coins_1', '1'], ['coins_2', '2'], ['coins_3', '3'], ['coins_4', '4'], ['coins_5', '5'], ['coins_25', '25'],
    ['coins_100', '100'], ['coins_250', '250'], ['coins_1000', '1000'], ['coins_10000', '10000'],
    ['coins_10000', '100K', '#ffffff'], ['coins_10000', '10M', '#00ff80'],
  ];
  const set = ([name, q, color]: [SpriteName, string, string?]) => {
    swapSprite(coin, name, 3);
    qty.textContent = q;
    qty.style.color = color ?? '#ffff00';
  };
  k.at(150, () => k.ticker(120, stacks.length, i => {
    set(stacks[i]);
    coin.animate([{ transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], { duration: 90, easing: 'steps(2, end)' });
    k.fx.burst(70, 28, 2, ['#ffd84a', '#c48a00'], 0.9, { g: 0.1, vy: -1 });
  }, () => set(stacks[stacks.length - 1])));
  k.at(1700, () => {
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tx = side * (95 + Math.random() * 90), ty = 95 + Math.random() * 70, peak = -50 - Math.random() * 40;
      const n = k.node(210, 110, spriteImg('coins_1', 2), 4);
      k.anim(n, [{ transform: 'translate(0,0)' }, { transform: `translate(${tx * 0.5}px,${peak}px)`, offset: 0.45 }, { transform: `translate(${tx}px,${ty}px)` }],
        { duration: 560 + i * 30, easing: 'linear' });
    }
  });
  k.at(1950, () => {
    for (const x of [160, 260]) k.pop(k.node(x, 228, k.slot(spriteImg('key', 2)), 3), 280);
    k.pop(k.label(210, 228, 'x2', { font: 'bold', big: true, color: '#ffff00' }).node, 280);
  });
  k.at(2150, () => k.show(k.label(210, 280, 'Next successful roll').node, 160));
  const refund = GREED_REFUND_FRACTION === 0.5 ? 'half' : `${Math.round(GREED_REFUND_FRACTION * 100)}%`;
  return {
    end: 2400,
    title: getRitual('GREED').name,
    icon: () => spriteImg('coins_10000', 2),
    text: `If your next Key roll lands, it pays 2 Keys. If it fails, ${refund} the Fate comes back.`,
  };
};

/** Chaos: a selector circles the unlock tables, they collapse into a Chaos rune, which becomes a Chaos Key. */
const chaos: Scene = (k) => {
  const cx = 210, cy = 138, R = 104;
  const halo = glow('rgba(255,70,20,.55)');
  k.node(cx, cy, halo, 1);
  const rune = spriteImg('chaos_rune', 3);
  const center = k.node(cx, cy, rune, 3);
  const tables: SpriteName[] = ['rune_pickaxe', 'dragon_scimitar', 'dragon_bones', 'crandor_map', 'clue_scroll', 'castle_wars_ticket'];
  const pos = tables.map((_, i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / tables.length;
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.95] as const;
  });
  const nodes = tables.map((name, i) => {
    const n = k.node(pos[i][0], pos[i][1], k.slot(spriteImg(name, 2)), 3);
    n.style.opacity = '0';
    return n;
  });
  const sel = document.createElement('div');
  sel.className = 'ritual-select';
  const selNode = k.node(pos[0][0], pos[0][1], sel, 4);
  selNode.style.opacity = '0';
  const embers = ['#ff4f1f', '#ffb000', '#c81400'];
  const stopEmbers = k.fx.emitter(fx => {
    for (let i = 0; i < 2; i++) {
      fx.add({ x: Math.random() * 140, y: 100, vy: -0.6 - Math.random() * 0.7, vx: (Math.random() - 0.5) * 0.3,
        life: 30 + Math.floor(Math.random() * 30), color: embers[Math.floor(Math.random() * 3)], flicker: true });
    }
  });
  k.at(0, () => nodes.forEach(n => k.anim(n, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 200, easing: 'steps(3, end)' })));
  // The selector hops slower and slower, like a reel winding down.
  let t = 280, gap = 45;
  for (let hop = 0; hop < 12; hop++) {
    const [x, y] = pos[hop % tables.length];
    k.at(t, () => {
      selNode.style.opacity = '1';
      selNode.style.left = `${x}px`;
      selNode.style.top = `${y}px`;
      k.fx.burst(x / 3, y / 3, 3, ['#ff4f1f', '#ffb000'], 0.9);
    });
    t += gap;
    gap *= 1.12;
  }
  const fly = t + 160;
  k.at(fly, () => {
    selNode.style.opacity = '0';
    nodes.forEach((n, i) => k.anim(n, [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${cx - pos[i][0]}px,${cy - pos[i][1]}px) scale(.2)`, opacity: 0 },
    ], { duration: 340, delay: i * 35, easing: 'ease-in' }));
  });
  k.at(fly + 520, () => {
    k.anim(halo, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0.25 }], { duration: 700, easing: 'ease-out' });
    swapSprite(rune, 'chaos_key', 3);
    k.pop(center, 320);
    k.fx.ring(70, 46, '#ff4f1f', 32, 1.6);
    k.fx.burst(70, 46, 18, ['#ffb000', '#ff4f1f', '#ffffff'], 1.5, { kind: 'plus' });
  });
  k.at(fly + 900, stopEmbers);
  return {
    end: fly + 950,
    title: getRitual('CHAOS').name,
    icon: () => spriteImg('chaos_key', 2),
    text: 'You receive a Chaos Key: one random unlock from every table at once.',
  };
};

/** Void Gambit: a portal opens and drinks your Fate while a coin flips; Keys fly out or the coin falls in. */
const gambit: Scene = (k, { meta }) => {
  const won = meta.won === true;
  const stake = typeof meta.stake === 'number' ? meta.stake : null;
  const keysWon = typeof meta.keysWon === 'number' ? meta.keysWon : null;
  const portal = makePortal(4);
  k.node(210, 222, portal.el, 1);
  const coin = makeCoin(5);
  const coinNode = k.node(210, 130, coin.el, 4);
  const stakeLabel = k.label(210, 34, stake !== null ? `${stake} Fate staked` : 'All your Fate staked', { font: 'bold', big: true, color: '#ffff00' });

  // Opens or closes the portal over `ms`, turning it as it goes; a skip snaps it to `target`.
  let stopSwirl = () => {};
  const openTo = (target: number, ms: number) => {
    stopSwirl();
    const from = portal.open, t0 = performance.now();
    stopSwirl = k.loop(60, () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      portal.draw(from + (target - from) * p);
      portal.spin();
      if (p >= 1 && target === 0) stopSwirl();
    }, () => portal.draw(target));
  };
  const stopOrbs = k.fx.emitter(fx => {
    if (Math.random() >= 0.6) return;
    const x = Math.random() < 0.5 ? 0 : 139, y = 10 + Math.random() * 60;
    fx.add({ x, y, vx: (70 - x) / 45, vy: (74 - y) / 45, life: 45, color: Math.random() < 0.5 ? '#f59e0b' : '#ffd36b', size: 2 });
  });
  k.at(0, () => openTo(1, 450));
  k.at(500, () => {
    k.anim(coinNode, [{ transform: 'translateY(0)' }, { transform: 'translateY(-82px)', offset: 0.45, easing: 'ease-in' }, { transform: 'translateY(0)' }], { duration: 1100, easing: 'ease-out' });
    // An even number of half-turns lands key side up, an odd number skull side up.
    const halfTurns = won ? 6 : 7, frames = 24;
    k.ticker(46, frames, i => coin.draw(Math.cos((i + 1) * Math.PI * halfTurns / frames)), () => coin.draw(won ? 1 : -1));
  });
  k.at(1650, () => {
    stopOrbs();
    if (won) {
      k.pop(coinNode, 260);
      k.fx.burst(70, 43, 16, ['#ffe27a', '#ffffff', '#d9a300'], 1.4, { kind: 'plus' });
      k.hide(stakeLabel.node, 120);
      const shown = Math.min(5, Math.max(1, keysWon ?? 1));
      for (let i = 0; i < shown; i++) {
        const x = 210 + (i - (shown - 1) / 2) * 80;
        const n = k.node(210, 130, k.slot(spriteImg('key', 2)), 5);
        k.anim(n, [{ transform: 'translate(0,0) scale(.3)', opacity: 0 }, { transform: `translate(${x - 210}px,-88px) scale(1)`, opacity: 1 }],
          { duration: 380, delay: i * 70, easing: 'ease-out' });
      }
      openTo(0, 600);
    } else {
      k.anim(coinNode, [{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: 'translateY(92px) scale(.2)', opacity: 0 }], { duration: 520, easing: 'ease-in' });
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 25;
        k.fx.add({ x: 70 + Math.cos(a) * r, y: 74 + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r / 18, vy: -Math.sin(a) * r * 0.6 / 18, life: 18, color: i % 2 ? '#f59e0b' : '#ffd36b', size: 2 });
      }
    }
  });
  if (won) {
    k.at(1950, () => k.pop(k.label(210, 236, keysWon !== null ? `+${plural(keysWon, 'Key')}` : 'You win', { font: 'bold', big: true, color: '#ffff00' }).node, 260));
  } else {
    k.at(2050, () => {
      stakeLabel.span.textContent = stake !== null ? `${stake} Fate lost` : 'Fate lost';
      stakeLabel.span.style.color = '#ff3a2a';
      k.fx.ring(70, 74, '#b77cf2', 22, 1.3);
      openTo(0, 500);
    });
  }
  return {
    end: 2500,
    title: getRitual('GAMBIT').name,
    icon: () => spriteImg(won ? 'key' : 'void_seal', 2),
    text: won
      ? (keysWon !== null ? `The Void blinks. You win ${plural(keysWon, 'Key')}.` : 'The Void blinks. You win.')
      : (stake !== null ? `The Void keeps your ${stake} Fate.` : 'The Void keeps your Fate.'),
  };
};

/** Cartographer: the world map unrolls around your land, fog lifts off the chosen chunk, a trail ends in an X. */
const cartographer: Scene = (k, { meta, ownedChunks }) => {
  const chosenKey = typeof meta.chunk === 'string' ? meta.chunk : null;
  const label = chosenKey ? chunkLabel(chosenKey) : 'new land';
  const frame = document.createElement('div');
  frame.className = 'ritual-map';
  const inner = document.createElement('div');
  inner.className = 'ritual-map-inner';
  frame.append(inner);
  k.node(210, 150, frame, 2);
  const rodBottom = k.node(210, 22, Object.assign(document.createElement('div'), { className: 'ritual-rod' }), 3);
  k.node(210, 22, Object.assign(document.createElement('div'), { className: 'ritual-rod' }), 3);
  frame.style.clipPath = 'inset(0 0 100% 0)';
  k.at(0, () => {
    k.anim(frame, [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: 640, easing: 'steps(12, end)' });
    k.anim(rodBottom, [{ transform: 'translateY(0)' }, { transform: 'translateY(256px)' }], { duration: 640, easing: 'steps(12, end)' });
  });

  if (chosenKey) {
    const w = ritualMapWindow(chosenKey, ownedChunks);
    // The small low-res map (the Map tab's placeholder) scaled to 60px chunks; its chunky pixels suit the scene.
    const chunkPx = 300 / RITUAL_MAP_COLS;
    const mapCols = MAP_IMAGE.width / 192, mapRows = MAP_IMAGE.height / 192;
    Object.assign(inner.style, {
      backgroundImage: `url(${MAP_IMAGE.srcLo})`,
      backgroundSize: `${mapCols * chunkPx}px ${mapRows * chunkPx}px`,
      backgroundPosition: `${-(w.cx0 - 15) * chunkPx}px ${-(65 - w.cyTop) * chunkPx}px`,
    });
    let chosenCell: HTMLDivElement | null = null;
    for (const c of w.cells) {
      const cell = document.createElement('div');
      cell.className = `ritual-cell${c.owned ? ' ritual-owned' : ' ritual-fog'}`;
      cell.style.left = `${c.col * chunkPx}px`;
      cell.style.top = `${c.row * chunkPx}px`;
      inner.append(cell);
      if (c.chosen) chosenCell = cell;
    }
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '300');
    svg.setAttribute('height', String(RITUAL_MAP_ROWS * chunkPx));
    Object.assign(svg.style, { left: '0', top: '0' });
    inner.append(svg);
    const mk = (tag: string, attrs: Record<string, string | number>) => {
      const e = document.createElementNS(NS, tag);
      for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, String(v));
      svg.append(e);
      return e;
    };
    const tx = w.chosen.col * chunkPx + chunkPx / 2, ty = w.chosen.row * chunkPx + chunkPx / 2;
    const outline = mk('rect', { x: tx - 28, y: ty - 28, width: 56, height: 56, fill: 'none', stroke: '#ffff00', 'stroke-width': 2, 'stroke-dasharray': '6 4', opacity: 0 });
    const dots: Element[] = [];
    if (w.from) {
      const fx0 = w.from.col * chunkPx + chunkPx / 2, fy0 = w.from.row * chunkPx + chunkPx / 2;
      for (let i = 1; i < 13; i++) {
        const t = i / 13, bend = Math.sin(t * Math.PI) * 14;
        // A gentle bend off the straight line, like a hand-drawn route.
        const x = fx0 + (tx - fx0) * t - (ty - fy0) / 60 * bend, y = fy0 + (ty - fy0) * t + (tx - fx0) / 60 * bend;
        if (Math.hypot(x - tx, y - ty) < 16) break;
        dots.push(mk('rect', { x: Math.round(x) - 2, y: Math.round(y) - 2, width: 4, height: 4, fill: '#8a0000', opacity: 0 }));
      }
    }
    const cross = [[-12, -12, 12, 12], [12, -12, -12, 12]].map(([x1, y1, x2, y2]) => mk('line', {
      x1: tx + x1, y1: ty + y1, x2: tx + x2, y2: ty + y2, stroke: '#a00000', 'stroke-width': 5, 'stroke-linecap': 'square', 'stroke-dasharray': 34, 'stroke-dashoffset': 34,
    }));
    k.at(760, () => k.anim(outline, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 500, easing: 'steps(4, end)' }));
    k.at(1250, () => {
      if (!chosenCell) return;
      k.anim(chosenCell, [{ backgroundColor: 'rgba(26,18,8,.66)' }, { backgroundColor: 'rgba(26,18,8,0)' }], { duration: 400, easing: 'steps(4, end)' });
      chosenCell.classList.add('ritual-owned');
    });
    k.at(1450, () => k.ticker(45, dots.length, i => dots[i].setAttribute('opacity', '1'), () => dots.forEach(d => d.setAttribute('opacity', '1'))));
    k.at(2100, () => k.anim(cross[0], [{ strokeDashoffset: '34px' }, { strokeDashoffset: '0px' }], { duration: 160, easing: 'steps(4, end)' }));
    k.at(2260, () => {
      k.anim(cross[1], [{ strokeDashoffset: '34px' }, { strokeDashoffset: '0px' }], { duration: 160, easing: 'steps(4, end)' });
      k.anim(outline, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'steps(2, end)' });
    });
  }
  k.at(2450, () => {
    const ribbon = document.createElement('div');
    ribbon.className = 'ritual-ribbon';
    ribbon.style.fontFamily = RS_BOLD;
    ribbon.textContent = label;
    k.pop(k.node(210, 22, ribbon, 6), 260);
  });
  return {
    end: 2700,
    title: getRitual('CARTOGRAPHER').name,
    icon: () => spriteImg('crandor_map', 2),
    text: chosenKey ? `You chart a course to ${label}. The chunk is yours.` : 'You chart a course. The chunk is yours.',
  };
};

/** Transmutation: the Keys spark like High Alchemy, are pulled into the altar and fuse into an Omni-Key. */
const transmute: Scene = (k) => {
  const cx = 210, cy = 134, R = 100;
  const count = getRitual('TRANSMUTE').keyCost ?? 5;
  const halo = glow('rgba(170,120,255,.5)');
  k.node(cx, cy, halo, 1);
  const pos = Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / count;
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.92] as const;
  });
  const keys = pos.map(([x, y]) => k.node(x, y, k.slot(spriteImg('key', 2)), 3));
  const stopHum = k.fx.emitter(fx => {
    if (Math.random() >= 0.35) return;
    const a = Math.random() * Math.PI * 2;
    fx.add({ x: 70 + Math.cos(a) * 14, y: 45 + Math.sin(a) * 14, life: 10, color: '#b77cf2' });
  });
  k.at(0, () => k.anim(halo, [{ opacity: 0 }, { opacity: 0.5 }], { duration: 500, easing: 'steps(5, end)' }));
  const gap = Math.round(1150 / count);
  pos.forEach(([x, y], i) => {
    const t = 300 + i * gap;
    k.at(t, () => k.fx.burst(x / 3, y / 3, 12, ['#ffffff', '#9cff9c', '#3fd43f'], 1.1, { kind: 'plus' }));
    k.at(t + 140, () => k.anim(keys[i], [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${cx - x}px,${cy - y}px) scale(.3)`, opacity: 0 },
    ], { duration: 380, easing: 'ease-in' }));
  });
  const fused = 300 + count * gap + 420;
  const omni = spriteImg('omni_key', 3);
  const omniNode = k.node(cx, cy, omni, 4);
  omniNode.style.opacity = '0';
  k.at(fused, () => {
    stopHum();
    k.anim(halo, [{ opacity: 0.5 }, { opacity: 1, offset: 0.3 }, { opacity: 0.6 }], { duration: 700, easing: 'ease-out' });
    k.pop(omniNode, 340);
    k.fx.ring(70, 45, '#e6ccff', 34, 1.7);
    k.fx.burst(70, 45, 20, ['#ffffff', '#b77cf2', '#8fe8ff'], 1.6, { kind: 'plus' });
  });
  k.at(fused + 260, () => k.fx.ring(70, 45, '#8fe8ff', 24, 1.2));
  k.at(fused + 400, () => k.ambient(omni, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }], { duration: 1400, easing: 'steps(6, end)' }));
  return {
    end: fused + 450,
    title: getRitual('TRANSMUTE').name,
    icon: () => spriteImg('omni_key', 2),
    text: `${count === 5 ? 'Five' : count} Keys melt together. You receive an Omni-Key.`,
  };
};

export const RITUAL_SCENES: Record<Ritual['id'], Scene> = {
  LUCK: clarity,
  GREED: greed,
  CHAOS: chaos,
  GAMBIT: gambit,
  CARTOGRAPHER: cartographer,
  TRANSMUTE: transmute,
};
