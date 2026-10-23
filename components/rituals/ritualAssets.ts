/**
 * Game artwork for the Void Altar: item sprites from the OSRS cache (by item id,
 * via the osrsreboxed-db icon dump) and the RuneScape fonts RuneLite ships.
 * Bundled rather than hotlinked from the Wiki so a scene never plays with a
 * missing picture. Everything here loads with the Altar's lazy chunk only.
 */
import plainFont from './fonts/runescape.ttf?url';
import boldFont from './fonts/runescape_bold.ttf?url';
import smallFont from './fonts/runescape_small.ttf?url';

const files = import.meta.glob('./sprites/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export type SpriteName =
  | 'coins_1' | 'coins_2' | 'coins_3' | 'coins_4' | 'coins_5' | 'coins_25' | 'coins_100' | 'coins_250' | 'coins_1000' | 'coins_10000'
  | 'chaos_rune' | 'chaos_key' | 'key' | 'omni_key' | 'void_seal' | 'crandor_map'
  | 'rune_pickaxe' | 'dragon_scimitar' | 'dragon_bones' | 'clue_scroll' | 'castle_wars_ticket'
  | 'baby_mole' | 'fire_cape' | 'dragon_defender' | 'pet_snakeling'
  | 'saradomin_light' | 'stone_bowl' | 'unholy_symbol' | 'tumekens_shadow' | 'spade'
  | 'ahrim_hood' | 'dharok_helm' | 'guthan_helm' | 'karil_coif' | 'torag_helm' | 'verac_helm'
  | 'ahrim_staff' | 'dharok_axe' | 'guthan_spear' | 'karil_crossbow' | 'torag_hammers' | 'verac_flail';

// The skill tab's icons (25x25, as RuneLite ships them) and the equipment
// tab's slots (36x36: the stone tile with the slot's outline, from the cache).
const skillFiles = import.meta.glob('./skills/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const slotFiles = import.meta.glob('./slots/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const pixelImg = (src: string, w: number, h: number): HTMLImageElement => {
  const img = new Image(w, h);
  img.src = src;
  img.alt = '';
  img.draggable = false;
  img.style.imageRendering = 'pixelated';
  return img;
};

/** A skill's icon by name ("Woodcutting"), at a whole-number scale. */
export const skillIcon = (skill: string, scale = 2): HTMLImageElement =>
  pixelImg(skillFiles[`./skills/${skill.toLowerCase()}.png`] ?? '', 25 * scale, 25 * scale);

/** An equipment slot by the tracker's slot name ("Body"), at a whole-number scale. */
export const slotIcon = (slot: string, scale = 2): HTMLImageElement =>
  pixelImg(slotFiles[`./slots/${slot.toLowerCase()}.png`] ?? '', 36 * scale, 36 * scale);

/** Every inventory sprite is 36x32, the game's item icon size. */
export const SPRITE_W = 36;
export const SPRITE_H = 32;

export const spriteUrl = (name: SpriteName): string => files[`./sprites/${name}.png`] ?? '';

/** An item sprite at a whole-number scale, so its pixels stay square. */
export const spriteImg = (name: SpriteName, scale = 2): HTMLImageElement => {
  const img = new Image(SPRITE_W * scale, SPRITE_H * scale);
  img.src = spriteUrl(name);
  img.alt = '';
  img.draggable = false;
  img.style.imageRendering = 'pixelated';
  return img;
};

export const RS_FONT = '"RuneScape Plain", ui-sans-serif, system-ui, sans-serif';
export const RS_BOLD = '"RuneScape Bold", ui-sans-serif, system-ui, sans-serif';
export const RS_SMALL = '"RuneScape Small", ui-sans-serif, system-ui, sans-serif';

let fontsLoading: Promise<void> | null = null;

/**
 * Registers the RuneScape fonts once. Resolves after at most `waitMs` so a slow
 * network never holds a scene back; text falls back to the system font until
 * the faces arrive.
 */
export const loadRitualFonts = (waitMs = 400): Promise<void> => {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve();
  if (!fontsLoading) {
    fontsLoading = Promise.all(([
      ['RuneScape Plain', plainFont], ['RuneScape Bold', boldFont], ['RuneScape Small', smallFont],
    ] as const).map(async ([family, url]) => {
      const face = new FontFace(family, `url(${url})`);
      document.fonts.add(face);
      await face.load();
    })).then(() => undefined, () => undefined);
  }
  return Promise.race([fontsLoading, new Promise<void>(resolve => setTimeout(resolve, waitMs))]);
};
