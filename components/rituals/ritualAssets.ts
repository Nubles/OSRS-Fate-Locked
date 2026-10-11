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
  | 'rune_pickaxe' | 'dragon_scimitar' | 'dragon_bones' | 'clue_scroll' | 'castle_wars_ticket';

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
