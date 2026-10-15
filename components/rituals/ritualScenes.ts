/**
 * One scene per Void Altar ritual. RITUAL_SCENES is keyed by every ritual id,
 * so a new ritual in config/economy.ts doesn't typecheck until it has a scene.
 * Scene positions are in the 420x300 stage; FX positions are a third of that.
 */
import {
  BARROWS_BROTHERS, BARROWS_ROLLS, GREED_REFUND_FRACTION, INVOCATION_ROLLS, INVOCATIONS, PACT_DEBT, PACT_ODDS_BONUS, PACT_ROLLS,
  SACRIFICE_TIERS, TEARS_FAILS, getRitual, invocationOmniBonus, type BarrowsBrother, type Ritual,
} from '../../config/economy';
import { chunkLabel } from '../../utils/chunkAdjacency';
import { MAP_IMAGE } from '../../utils/mapCoords';
import { RITUAL_MAP_COLS, RITUAL_MAP_ROWS, ritualMapWindow } from '../../utils/ritualMapWindow';
import { RS_BOLD, RS_SMALL, skillIcon, slotIcon, spriteImg, spriteUrl, SPRITE_H, SPRITE_W, type SpriteName } from './ritualAssets';
import { makeCoin, makeDie, makePortal, pixelCanvas } from './ritualPixels';
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

/** A small text panel in the scene, e.g. the Pact's blood contract. */
const panel = (className: string, text: string, font = RS_BOLD): HTMLDivElement => {
  const d = document.createElement('div');
  d.className = className;
  d.style.fontFamily = font;
  d.textContent = text;
  return d;
};

/** Saradomin's Ward: Saradomin's light shines on your Key; places out of reach fall dark, the rest light up. */
const ward: Scene = (k) => {
  const cx = 210, cy = 168;
  const halo = glow('rgba(140,210,255,.5)');
  k.node(cx, cy, halo, 1);
  const keyNode = k.node(cx, cy, k.slot(spriteImg('key', 2)), 4);
  // One of each kind of place a Key can land on, near and far.
  const places: Array<[SpriteName, boolean, string]> = [
    ['baby_mole', false, 'Boss'], ['castle_wars_ticket', true, 'Minigame'], ['coins_10000', true, 'Shop'],
    ['dragon_defender', true, 'Guild'], ['fire_cape', false, 'Minigame'], ['pet_snakeling', false, 'Boss'],
  ];
  const pos = places.map((_, i) => [(i < 3 ? 70 : 350) + [8, -12, 10][i % 3] * (i < 3 ? 1 : -1), 86 + (i % 3) * 84] as const);
  const kinds: HTMLElement[] = [];
  const nodes = places.map(([name, , kind], i) => {
    const n = k.node(pos[i][0], pos[i][1], k.slot(spriteImg(name, 2)), 3);
    n.style.opacity = '0';
    const l = k.label(pos[i][0], pos[i][1] + 42, kind, { color: '#ffff00' }).node;
    l.style.opacity = '0';
    kinds.push(l);
    return n;
  });
  const star = spriteImg('saradomin_light', 3);
  const starNode = k.node(cx, -50, star, 6);
  const beam = Object.assign(document.createElement('div'), { className: 'ritual-beam' });
  k.node(cx, 112, beam, 2);
  k.at(0, () => nodes.forEach((n, i) => {
    k.anim(n, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 200, delay: i * 50, easing: 'steps(3, end)' });
    k.anim(kinds[i], [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 120 + i * 50, easing: 'steps(4, end)' });
  }));
  k.at(400, () => k.anim(starNode, [{ transform: 'translateY(0)' }, { transform: 'translateY(100px)' }], { duration: 520, easing: 'ease-out' }));
  const stopSparkle = k.fx.emitter(fx => {
    if (Math.random() >= 0.5) return;
    fx.add({ x: 60 + Math.random() * 20, y: 10 + Math.random() * 20, vy: 0.3, life: 14, color: Math.random() < 0.5 ? '#fff6c8' : '#9fd8ff', kind: 'plus' });
  });
  k.at(950, () => {
    k.anim(beam, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'steps(4, end)' });
    k.fx.ring(70, 56, '#fff6c8', 26, 1.5);
  });
  places.forEach(([, reachable], i) => {
    const t = 1200 + (reachable ? 380 : 0) + (i % 3) * 90;
    k.at(t, () => {
      const slot = nodes[i].firstElementChild as HTMLElement;
      k.hide(kinds[i], 80);
      if (reachable) {
        slot.style.outline = '2px solid #ffff00';
        k.fx.burst(pos[i][0] / 3, pos[i][1] / 3, 8, ['#ffffff', '#fff6c8', '#ffd84a'], 1, { kind: 'plus' });
        k.show(k.label(pos[i][0], pos[i][1] + 42, 'In reach', { color: '#00ff00' }).node, 160);
      } else {
        k.anim(slot, [{ filter: 'none', opacity: 1 }, { filter: 'grayscale(1) brightness(.6)', opacity: 0.75 }], { duration: 260, easing: 'steps(4, end)' });
        k.show(k.label(pos[i][0], pos[i][1] + 42, 'Out of reach', { color: '#ff3a2a' }).node, 160);
      }
    });
  });
  k.at(2050, () => {
    stopSparkle();
    k.anim(halo, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0.6 }], { duration: 700, easing: 'ease-out' });
    k.pop(keyNode, 320);
    k.fx.ring(70, 56, '#9fd8ff', 30, 1.6);
    k.fx.burst(70, 56, 18, ['#ffffff', '#9fd8ff', '#ffd84a'], 1.5, { kind: 'plus' });
  });
  k.at(2300, () => k.ambient(star, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.3)' }, { filter: 'brightness(1)' }], { duration: 1200, easing: 'steps(6, end)' }));
  return {
    end: 2400,
    title: getRitual('WARD').name,
    icon: () => spriteImg('saradomin_light', 2),
    text: 'Saradomin wards your next Key. It can only land on something you can use right now.',
  };
};

/**
 * The weeping wall of the Tears of Guthix cave: rough rock hanging from the
 * ceiling, with a crystal at each crack the tears run from (two blue, one green).
 * `streams` are the cracks' x positions on the 110px-wide canvas.
 */
const makeWeepingWall = (scale: number, streams: Array<[number, 'blue' | 'green']>): HTMLCanvasElement => {
  const W = 110, H = 26;
  const { el, g } = pixelCanvas(W, H, scale);
  if (!g) return el;
  // Fixed jitter so the wall is the same rock every time.
  const noise = (i: number) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  const px = (x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const bottom: number[] = [];
  for (let x = 0; x < W; x++) {
    let b = 15 + Math.round(Math.sin(x / 7) * 2 + noise(x) * 2);
    for (const [sx] of streams) {
      const d = Math.abs(x - sx);
      if (d < 5) b = Math.max(b, 23 - d * 2);
    }
    // The ends fall away into the dark.
    if (x < 4 || x > W - 5) b -= 4 - Math.min(x, W - 1 - x);
    bottom.push(b);
  }
  const rock = ['#4a4238', '#433b32', '#524a3f', '#3a332b'];
  for (let x = 0; x < W; x++) {
    for (let y = 0; y <= bottom[x]; y++) {
      const shade = y < 4 ? '#24201b' : y < 7 ? '#2f2923' : rock[Math.floor(noise(x * 31 + y * 7) * 4)];
      px(x, y, shade);
    }
    px(x, bottom[x], '#1a1611');
    if (bottom[x] - 1 > 7 && noise(x * 5) > 0.55) px(x, bottom[x] - 1, '#5c5244');
  }
  // Seams in the rock.
  for (let i = 0; i < 9; i++) {
    const x0 = Math.floor(noise(i * 91) * (W - 10)) + 4, y0 = 8 + Math.floor(noise(i * 17) * 5);
    for (let j = 0; j < 4; j++) px(x0 + j, y0 + (j > 1 ? 1 : 0), '#2a241d');
  }
  const pal = {
    blue: { lo: '#1f6fb0', mid: '#4fb3ff', hi: '#bfe6ff' },
    green: { lo: '#1f8a1f', mid: '#3fd43f', hi: '#b6f5b6' },
  };
  for (const [sx, colour] of streams) {
    const c = pal[colour];
    const tip = bottom[sx];
    // A small crystal cluster in the crack, lit from inside.
    for (const [dx, dy, col] of [
      [0, -5, c.lo], [0, -4, c.mid], [0, -3, c.hi], [0, -2, c.mid], [0, -1, c.mid], [0, 0, c.lo],
      [-1, -3, c.lo], [-1, -2, c.mid], [1, -4, c.lo], [1, -3, c.mid], [1, -2, c.lo],
      [-2, -1, c.lo], [2, -2, c.lo],
    ] as Array<[number, number, string]>) px(sx + dx, tip + dy, col);
  }
  return el;
};

/** Tears of Guthix: blue tears run down the wall into your bowl; a green one misses. Ten fails will pay double. */
const tears: Scene = (k) => {
  const fails = TEARS_FAILS;
  // Cracks at stage x 150, 210 and 270: canvas x = (stage x - 45) / 3.
  k.node(210, 40, makeWeepingWall(3, [[35, 'blue'], [55, 'blue'], [75, 'green']]), 2);
  const halo = glow('rgba(79,179,255,.45)');
  k.node(210, 186, halo, 1);
  const bowlNode = k.node(210, 186, spriteImg('stone_bowl', 3), 4);
  const streams = [150, 210, 270];
  // A tear falls from a crack in the wall into the bowl (FX units are a third of the stage).
  const tear = (sx: number, color: string, miss = 0) => {
    const x0 = sx / 3, y0 = 25, x1 = 70 + miss, y1 = 58;
    const n = 14;
    k.fx.add({ x: x0, y: y0, vx: (x1 - x0) / n, vy: (y1 - y0) / n, life: n, color, size: 2 });
  };
  const stopDrip = k.fx.emitter(fx => {
    for (const sx of streams) if (Math.random() < 0.25) fx.add({ x: sx / 3, y: 24, vy: 0.4, life: 6, color: '#4fb3ff' });
  });
  let t = 250;
  for (let i = 0; i < 9; i++) {
    const sx = streams[i % 3];
    k.at(t, () => tear(sx, i % 2 ? '#8fd3ff' : '#4fb3ff'));
    k.at(t + 560, () => k.fx.burst(70, 58, 3, ['#4fb3ff', '#ffffff'], 0.7, { g: 0.05 }));
    t += 120;
  }
  k.at(800, () => tear(270, '#3fd43f', 26));
  k.at(1360, () => k.fx.burst(96, 60, 6, ['#3fd43f', '#1f8a1f'], 0.8, { g: 0.06 }));
  k.at(1700, () => {
    stopDrip();
    k.anim(halo, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0.5 }], { duration: 700, easing: 'ease-out' });
    k.pop(bowlNode, 300);
    k.fx.ring(70, 62, '#8fd3ff', 26, 1.4);
    k.pop(k.label(310, 186, 'x2', { font: 'bold', big: true, color: '#4fb3ff' }).node, 280);
  });
  const pips: HTMLDivElement[] = [];
  for (let i = 0; i < fails; i++) {
    const p = document.createElement('div');
    Object.assign(p.style, { width: '14px', height: '14px', background: '#4fb3ff', border: '2px solid #0b2a44', boxShadow: 'inset -2px -2px 0 #1f6fb0' });
    const n = k.node(210 + (i - (fails - 1) / 2) * 22, 252, p, 3);
    n.style.opacity = '0';
    pips.push(n);
  }
  k.at(1950, () => k.ticker(45, fails, i => { pips[i].style.opacity = '1'; }, () => pips.forEach(p => { p.style.opacity = '1'; })));
  k.at(2400, () => k.show(k.label(210, 280, `Next ${fails} failed rolls`).node, 160));
  return {
    end: 2600,
    title: getRitual('TEARS').name,
    icon: () => spriteImg('stone_bowl', 2),
    text: `Your next ${fails} failed rolls give double Fate. It ends when a roll lands.`,
  };
};

/** Zamorak's Pact: the unholy symbol burns, three rolls are marked +15%, and a blood contract names the debt. */
const pact: Scene = (k) => {
  const halo = glow('rgba(200,20,20,.55)');
  k.node(210, 92, halo, 1);
  const sym = k.node(210, 92, spriteImg('unholy_symbol', 3), 4);
  sym.style.opacity = '0';
  const embers = ['#ff2a1a', '#ff8a00', '#8a0000'];
  const stopFire = k.fx.emitter(fx => {
    for (let i = 0; i < 2; i++) {
      fx.add({ x: 50 + Math.random() * 40, y: 46, vy: -0.5 - Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.4,
        life: 18 + Math.floor(Math.random() * 16), color: embers[Math.floor(Math.random() * 3)], flicker: true });
    }
  });
  k.at(0, () => {
    k.anim(sym, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 360, easing: 'steps(6, end)' });
    k.anim(halo, [{ opacity: 0 }, { opacity: 0.8 }], { duration: 500, easing: 'steps(5, end)' });
  });
  const xs = [120, 210, 300];
  xs.forEach((x, i) => {
    const d = makeDie(4);
    d.draw([6]);
    const n = k.node(x, 196, d.el, 3);
    n.style.opacity = '0';
    const t = 550 + i * 230;
    k.at(t, () => {
      k.pop(n, 260);
      k.fx.burst(x / 3, 65, 8, embers, 1.1);
    });
    k.at(t + 120, () => k.pop(k.label(x, 244, `+${PACT_ODDS_BONUS}%`, { font: 'bold', color: '#00ff00' }).node, 220));
  });
  const scroll = panel('ritual-scroll', `Blood Debt: ${PACT_DEBT} Fate`);
  const scrollNode = k.node(210, 280, scroll, 6);
  scrollNode.style.opacity = '0';
  k.at(1500, () => {
    k.anim(scrollNode, [{ opacity: 0, transform: 'scaleX(.1)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: 320, easing: 'steps(8, end)' });
  });
  k.at(1850, () => {
    stopFire();
    k.fx.ring(70, 31, '#ff2a1a', 30, 1.6);
    k.fx.burst(70, 31, 16, ['#ff2a1a', '#8a0000', '#ffb000'], 1.5);
    for (let i = 0; i < 10; i++) k.fx.add({ x: 46 + Math.random() * 48, y: 96, vy: 0.4 + Math.random() * 0.3, g: 0.03, life: 14, color: '#8a0000' });
  });
  k.at(1900, () => k.ambient(halo, [{ opacity: 0.8 }, { opacity: 0.45 }, { opacity: 0.8 }], { duration: 1100, easing: 'steps(5, end)' }));
  return {
    end: 2200,
    title: getRitual('PACT').name,
    icon: () => spriteImg('unholy_symbol', 2),
    text: `Your next ${PACT_ROLLS} rolls get +${PACT_ODDS_BONUS}% odds. Then Zamorak takes the next ${PACT_DEBT} Fate you earn.`,
  };
};

/** Amascut's Invocations: each chosen handicap lights up on the tablet and the Omni-Key chance climbs. */
const invocations: Scene = (k, { meta }) => {
  const chosen = Array.isArray(meta.invocations)
    ? INVOCATIONS.filter(i => (meta.invocations as unknown[]).includes(i.id)).map(i => i.id)
    : INVOCATIONS.map(i => i.id);
  k.node(210, 34, spriteImg('tumekens_shadow', 2), 4);
  const tablet = document.createElement('div');
  tablet.className = 'ritual-tablet';
  const rows = INVOCATIONS.map(inv => {
    const row = document.createElement('div');
    row.className = 'ritual-row';
    row.style.fontFamily = RS_SMALL;
    const tick = Object.assign(document.createElement('div'), { className: 'ritual-tick' });
    const name = document.createElement('span');
    name.textContent = `${inv.name}: ${inv.handicap}`;
    const bonus = document.createElement('span');
    bonus.textContent = `+${inv.omniBonus}%`;
    bonus.style.visibility = 'hidden';
    row.append(tick, name, bonus);
    tablet.append(row);
    return { inv, row, tick, bonus };
  });
  const tabletNode = k.node(210, 136, tablet, 3);
  tabletNode.style.opacity = '0';
  const halo = glow('rgba(255,200,80,.45)');
  k.node(210, 252, halo, 1);
  const counter = k.label(210, 252, 'Omni-Key chance +0%', { font: 'bold', color: '#ffff00' });
  counter.node.style.opacity = '0';
  k.at(0, () => { k.show(tabletNode, 240); k.show(counter.node, 240); });
  const sand = ['#ffd84a', '#e8b54a', '#c48a00'];
  let total = 0, t = 450;
  rows.forEach(({ inv, row, tick, bonus }) => {
    if (!chosen.includes(inv.id)) {
      k.at(t - 100, () => { row.style.opacity = '0.45'; });
      return;
    }
    total += inv.omniBonus;
    const now = total;
    const y = 136 - 52 + rows.findIndex(r => r.inv === inv) * 26 + 18;
    k.at(t, () => {
      tick.classList.add('ritual-on');
      row.style.color = '#000';
      bonus.style.visibility = 'visible';
      counter.span.textContent = `Omni-Key chance +${now}%`;
      k.fx.burst(32, y / 3, 10, sand, 1, { g: 0.05 });
    });
    t += 330;
  });
  const all = chosen.length === INVOCATIONS.length;
  const final = invocationOmniBonus(chosen);
  k.at(t + 50, () => {
    counter.span.textContent = `Omni-Key chance +${final}%`;
    k.anim(halo, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0.5 }], { duration: 700, easing: 'ease-out' });
    k.pop(counter.node, 300);
    k.fx.ring(70, 84, '#ffd84a', 30, 1.6);
    k.fx.burst(70, 84, all ? 22 : 12, ['#ffffff', ...sand], 1.5, { kind: 'plus' });
  });
  if (all) k.at(t + 300, () => k.pop(k.label(210, 282, 'All four invoked', { color: '#ff981f' }).node, 220));
  else k.at(t + 300, () => k.show(k.label(210, 282, `Next ${INVOCATION_ROLLS} rolls`).node, 160));
  return {
    end: t + 500,
    title: getRitual('INVOCATIONS').name,
    icon: () => spriteImg('tumekens_shadow', 2),
    text: `Your next ${INVOCATION_ROLLS} rolls carry your invocations. Successes get a ${final}% higher Omni-Key chance.`,
  };
};

const BROTHER_SPRITES: Record<BarrowsBrother['id'], [SpriteName, SpriteName]> = {
  AHRIM: ['ahrim_hood', 'ahrim_staff'],
  DHAROK: ['dharok_helm', 'dharok_axe'],
  GUTHAN: ['guthan_helm', 'guthan_spear'],
  KARIL: ['karil_coif', 'karil_crossbow'],
  TORAG: ['torag_helm', 'torag_hammers'],
  VERAC: ['verac_helm', 'verac_flail'],
};

/** Barrows Chest: a spade breaks the mound, the selector runs the six crypts and stops on fate's brother. */
const barrows: Scene = (k, { meta }) => {
  const brother = BARROWS_BROTHERS.find(b => b.id === meta.brother) ?? BARROWS_BROTHERS[1];
  const chosen = BARROWS_BROTHERS.indexOf(brother);
  const cx = 210, cy = 132, R = 108;
  const floor = document.createElement('div');
  Object.assign(floor.style, { width: '400px', height: '290px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(92,84,66,.7) 0%, rgba(58,52,40,.45) 55%, rgba(0,0,0,0) 72%)' });
  k.node(cx, cy, floor, 0);
  const halo = glow('rgba(120,200,80,.4)');
  k.node(cx, cy, halo, 1);
  const pos = BARROWS_BROTHERS.map((_, i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / BARROWS_BROTHERS.length;
    return [cx + Math.cos(a) * R * 1.15, cy + Math.sin(a) * R * 0.92] as const;
  });
  const helms = BARROWS_BROTHERS.map((b, i) => {
    const img = spriteImg(BROTHER_SPRITES[b.id][0], 2);
    img.style.filter = 'brightness(1.5)';
    const n = k.node(pos[i][0], pos[i][1], k.slot(img), 3);
    n.style.opacity = '0';
    return n;
  });
  const spade = k.node(cx, cy - 120, spriteImg('spade', 3), 6);
  const sel = document.createElement('div');
  sel.className = 'ritual-select';
  const selNode = k.node(pos[0][0], pos[0][1], sel, 4);
  selNode.style.opacity = '0';
  const dirt = ['#5a3d1a', '#8a6332', '#3a2610'];
  k.at(0, () => k.anim(spade, [{ transform: 'translateY(0) rotate(-20deg)' }, { transform: 'translateY(118px) rotate(0deg)' }], { duration: 300, easing: 'ease-in' }));
  k.at(300, () => {
    k.fx.burst(70, 50, 22, dirt, 1.3, { g: 0.08 });
    k.anim(spade, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'steps(3, end)' });
  });
  k.at(420, () => helms.forEach((n, i) => k.anim(n, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration: 200, delay: i * 40, easing: 'steps(3, end)' })));
  let t = 760, gap = 50;
  const hops = 12 + chosen;
  for (let hop = 0; hop <= hops; hop++) {
    const [x, y] = pos[hop % pos.length];
    k.at(t, () => {
      selNode.style.opacity = '1';
      selNode.style.left = `${x}px`;
      selNode.style.top = `${y}px`;
      k.fx.burst(x / 3, y / 3, 2, ['#8aff5a', '#3fd43f'], 0.8);
    });
    t += gap;
    gap *= 1.1;
  }
  const reveal = t + 150;
  const bright = (img: HTMLImageElement) => { img.style.filter = 'brightness(1.5)'; return img; };
  const weapon = k.node(cx + 44, cy, bright(spriteImg(BROTHER_SPRITES[brother.id][1], 3)), 4);
  weapon.style.opacity = '0';
  const helm = k.node(cx - 44, cy, bright(spriteImg(BROTHER_SPRITES[brother.id][0], 3)), 5);
  helm.style.opacity = '0';
  k.at(reveal, () => {
    selNode.style.opacity = '0';
    helms.forEach((n, i) => k.anim(n, [{ opacity: 1 }, { opacity: i === chosen ? 0 : 0.12 }], { duration: 240, easing: 'steps(4, end)' }));
    k.anim(halo, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0.55 }], { duration: 700, easing: 'ease-out' });
    k.pop(helm, 320);
    k.fx.ring(70, 44, '#8aff5a', 30, 1.6);
    k.fx.burst(70, 44, 18, ['#ffffff', '#8aff5a', '#3fd43f'], 1.5, { kind: 'plus' });
  });
  k.at(reveal + 160, () => k.pop(weapon, 280));
  k.at(reveal + 300, () => k.pop(k.label(cx, 254, brother.name, { font: 'bold', color: '#ffff00' }).node, 240));
  k.at(reveal + 480, () => k.show(k.label(cx, 280, brother.effect, { color: '#00ff00' }).node, 160));
  return {
    end: reveal + 650,
    title: getRitual('BARROWS').name,
    icon: () => spriteImg(BROTHER_SPRITES[brother.id][0], 2),
    text: `${brother.name} powers your next ${BARROWS_ROLLS} rolls. ${brother.effect}.`,
  };
};

/** A stone altar like the Chaos Altar's: a wide slab on a plinth, a red rune cut into the front. */
const makeAltar = (scale: number): HTMLCanvasElement => {
  const { el, g } = pixelCanvas(60, 22, scale);
  if (!g) return el;
  const box = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  box(0, 0, 60, 6, '#12100d');
  box(1, 1, 58, 4, '#5d554b');
  box(1, 1, 58, 1, '#7a7166');
  box(1, 4, 58, 1, '#3a3530');
  box(5, 6, 50, 16, '#12100d');
  box(6, 6, 48, 15, '#3a3530');
  box(6, 6, 2, 15, '#4a443c');
  box(51, 6, 3, 15, '#24201b');
  box(6, 19, 48, 2, '#24201b');
  // The rune: a red ring with a cross through it.
  g.fillStyle = '#a00000';
  for (const [x, y] of [[28, 9], [29, 9], [30, 9], [31, 9], [27, 10], [32, 10], [26, 11], [33, 11], [26, 12], [33, 12], [26, 13], [33, 13], [27, 14], [32, 14], [28, 15], [29, 15], [30, 15], [31, 15]]) g.fillRect(x, y, 1, 1);
  for (let i = 0; i < 9; i++) { g.fillRect(25 + i, 8 + i, 1, 1); g.fillRect(34 - i, 8 + i, 1, 1); }
  g.fillStyle = '#5a0000';
  g.fillRect(14, 1, 3, 1); g.fillRect(40, 2, 4, 1); g.fillRect(41, 3, 1, 1);
  return el;
};

/** Sacrifice: three of your top tiers are laid on the altar and burn; an Omni-Key rises from the flames. */
const sacrifice: Scene = (k, { meta }) => {
  const taken = Array.isArray(meta.taken) && meta.taken.length
    ? (meta.taken as Array<{ table?: string; name?: string; tier?: number }>).slice(0, SACRIFICE_TIERS)
    : [{ table: 'skill', name: 'Woodcutting', tier: 5 }, { table: 'gear', name: 'Body', tier: 3 }, { table: 'skill', name: 'Fishing', tier: 4 }];
  const usesLeft = typeof meta.usesLeft === 'number' ? meta.usesLeft : null;
  const halo = glow('rgba(170,20,40,.5)');
  k.node(210, 236, halo, 1);
  k.node(210, 244, makeAltar(3), 2);
  const xs = [110, 210, 310];
  const offerings = taken.map((o, i) => {
    // A skill shows its skill-tab icon; a gear slot shows its equipment-tab slot.
    const n = k.node(xs[i], 70, o.table === 'gear' ? slotIcon(o.name ?? 'Body', 2) : k.slot(skillIcon(o.name ?? 'Attack', 2), 72, 72), 3);
    n.style.opacity = '0';
    const l = k.label(xs[i], 122, `${o.name ?? 'Tier'}${o.tier ? ` tier ${o.tier}` : ''}`);
    l.node.style.opacity = '0';
    return { n, l };
  });
  const flames = ['#ff2a1a', '#8a0000', '#ff8a00', '#2a0a0a'];
  const stopFire = k.fx.emitter(fx => {
    if (Math.random() >= 0.7) return;
    fx.add({ x: 46 + Math.random() * 48, y: 76, vy: -0.4 - Math.random() * 0.5, life: 12 + Math.floor(Math.random() * 10), color: flames[Math.floor(Math.random() * 4)], flicker: true });
  });
  k.at(0, () => k.anim(halo, [{ opacity: 0 }, { opacity: 0.7 }], { duration: 500, easing: 'steps(5, end)' }));
  offerings.forEach(({ n, l }, i) => {
    k.at(150 + i * 140, () => { k.pop(n, 260); k.show(l.node, 160); });
    const t = 900 + i * 280;
    k.at(t, () => {
      k.hide(l.node, 120);
      k.anim(n, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${210 - xs[i]}px,160px) scale(.3)`, opacity: 0 }], { duration: 360, easing: 'ease-in' });
    });
    k.at(t + 340, () => k.fx.burst(70, 78, 14, flames, 1.3, { g: -0.03 }));
  });
  const omni = spriteImg('omni_key', 3);
  const omniNode = k.node(210, 214, omni, 5);
  omniNode.style.opacity = '0';
  const rise = 900 + offerings.length * 280 + 350;
  k.at(rise, () => {
    stopFire();
    k.anim(omniNode, [{ opacity: 0, transform: 'translateY(20px) scale(.4)' }, { opacity: 1, transform: 'translateY(-70px) scale(1)' }], { duration: 520, easing: 'ease-out' });
    k.anim(halo, [{ opacity: 0.7 }, { opacity: 1, offset: 0.3 }, { opacity: 0.5 }], { duration: 700, easing: 'ease-out' });
  });
  k.at(rise + 500, () => {
    k.fx.ring(70, 48, '#e6ccff', 30, 1.6);
    k.fx.burst(70, 48, 18, ['#ffffff', '#b77cf2', '#8fe8ff'], 1.5, { kind: 'plus' });
  });
  if (usesLeft !== null) k.at(rise + 650, () => k.show(k.label(210, 282, `Sacrifices left this run: ${usesLeft}`).node, 160));
  return {
    end: rise + 750,
    title: getRitual('SACRIFICE').name,
    icon: () => spriteImg('omni_key', 2),
    text: `Fate takes ${taken.map(o => `${o.name ?? 'a tier'}${o.tier ? ` tier ${o.tier}` : ''}`).join(', ')}. You receive an Omni-Key.`,
  };
};

export const RITUAL_SCENES: Record<Ritual['id'], Scene> = {
  LUCK: clarity,
  GREED: greed,
  CHAOS: chaos,
  GAMBIT: gambit,
  CARTOGRAPHER: cartographer,
  TRANSMUTE: transmute,
  WARD: ward,
  TEARS: tears,
  PACT: pact,
  INVOCATIONS: invocations,
  BARROWS: barrows,
  SACRIFICE: sacrifice,
};
