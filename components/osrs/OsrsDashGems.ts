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
