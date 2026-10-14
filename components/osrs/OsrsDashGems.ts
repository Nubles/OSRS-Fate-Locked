import type React from 'react';
/**
 * The one tier ladder of the OSRS layout: Tier I..X drawn as the ten cut gems
 * from Opal to Zenyte. Skills use all ten; equipment slots (Tier 1..9) use
 * the first nine. Presentation only: tiers themselves come from GameState.
 */
export interface TierGem { name: string; file: string; color: string }

export const TIER_GEMS: readonly TierGem[] = [
  { name: 'Opal', file: 'opal', color: '#d9cfc0' },
  { name: 'Jade', file: 'jade', color: '#6fbf6a' },
  { name: 'Red topaz', file: 'red_topaz', color: '#e0703c' },
  { name: 'Sapphire', file: 'sapphire', color: '#5a7cf0' },
  { name: 'Emerald', file: 'emerald', color: '#2fbf5a' },
  { name: 'Ruby', file: 'ruby', color: '#e03535' },
  { name: 'Diamond', file: 'diamond', color: '#dcecff' },
  { name: 'Dragonstone', file: 'dragonstone', color: '#c060e0' },
  { name: 'Onyx', file: 'onyx', color: '#a8a8a8' },
  { name: 'Zenyte', file: 'zenyte', color: '#f5a623' },
];

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

const base = (): string => import.meta.env.BASE_URL ?? '/';

/** Gem for tier `t` (1-based); null for tier 0. */
export const tierGem = (t: number): TierGem | null => (t > 0 ? TIER_GEMS[Math.min(t, TIER_GEMS.length) - 1] : null);
export const gemSrc = (t: number): string => `${base()}osrs-ui/gems/${TIER_GEMS[Math.min(Math.max(t, 1), TIER_GEMS.length) - 1].file}.png`;
export const gemColor = (t: number): string => tierGem(t)?.color ?? '#8a7c66';
export const roman = (t: number): string => ROMAN[Math.min(Math.max(t, 1), 10) - 1];

/** Local 25px (or 16px small) skill icon. */
export const skillIconSrc = (skill: string, small = false): string =>
  `${base()}osrs-ui/skills/${small ? 'small/' : ''}${skill.toLowerCase()}.png`;
export const itemSrc = (name: string | number): string => `${base()}osrs-ui/items/${name}.png`;

/** `#rrggbb` to rgba() at alpha `a`, for tier-tinted selected rows. */
export const tint = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

/**
 * Item sprite by OSRS item id: the packed local copy under osrs-ui/items when
 * there is one. Pair it with {@link itemSpriteFallback} on the <img>'s
 * onError so items without a local sprite load the wiki image instead.
 */
export const itemSpriteSrc = (id: number): string => itemSrc(id);
export const wikiImageSrc = (file: string): string =>
  `https://oldschool.runescape.wiki/images/${(file || '').replace(/ /g, '_')}`;
export const itemSpriteFallback = (wikiFile?: string) => (e: { currentTarget: HTMLImageElement }) => {
  const img = e.currentTarget;
  if (wikiFile && !img.dataset.fallback) { img.dataset.fallback = '1'; img.src = wikiImageSrc(wikiFile); return; }
  img.style.visibility = 'hidden';
};

/**
 * The gem's cut stone sits at (6,5) and measures 22x24 inside its 36x32 item
 * sprite. Drawn as a background at native size so it stays pixel-crisp.
 */
export const gemCropStyle = (t: number): React.CSSProperties => ({
  backgroundImage: `url(${gemSrc(t)})`,
  backgroundPosition: '-6px -5px',
  backgroundRepeat: 'no-repeat',
});
/** Half-size (11x12) gem sprite, drawn at an integer scale. */
export const gemSmallSrc = (t: number): string => `${base()}osrs-ui/slots/gem-${TIER_GEMS[Math.min(Math.max(t, 1), TIER_GEMS.length) - 1].file}.png`;

/*
 * The Worn Equipment doll is drawn at any scale (1x to 3x), so it uses
 * high-resolution art (public/osrs-ui/hd/) instead of stretching the 36px
 * game sprites: each slot's silhouette traced to SVG from cache sprites
 * 156-166, the slot tile and connector lines (sprites 170, 172, 173) at 4x,
 * and gems and worn items rendered from their OSRS cache models at 3-4x.
 */
const SLOT_SPRITE: Record<string, string> = {
  Head: 'head', Cape: 'cape', Neck: 'neck', Ammo: 'ammo', Weapon: 'weapon', Body: 'body',
  Shield: 'shield', Legs: 'legs', Gloves: 'hands', Boots: 'feet', Ring: 'ring',
};
export const slotSilhouetteSrc = (slot: string): string => `${base()}osrs-ui/hd/slots/${SLOT_SPRITE[slot] ?? 'head'}.svg`;
/** Slot tile and the connector lines. */
// Used inside CSS custom properties, where a relative url() would resolve
// against the stylesheet instead of the page, so make it absolute.
export const slotUiSrc = (name: 'tile' | 'line-v' | 'line-h'): string => absoluteUrl(`${base()}osrs-ui/hd/${name}.png`);
/** A tier's gem for an equipment slot corner. */
export const gemHdSrc = (t: number): string => `${base()}osrs-ui/hd/gems/${TIER_GEMS[Math.min(Math.max(t, 1), TIER_GEMS.length) - 1].file}.png`;
/** A worn item's icon at 3x (108x96), for every item in the equipment catalogue. */
export const itemHdSrc = (id: number): string => `${base()}osrs-ui/hd/items/${id}.png`;
/** A page-relative asset path made absolute, for url() inside CSS custom properties. */
export const absoluteUrl = (path: string): string => {
  try { return new URL(path, document.baseURI).href; } catch { return path; }
};
