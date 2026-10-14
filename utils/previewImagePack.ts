/**
 * Preview builds only (VITE_PREVIEW_IMAGE_PACK=1). The private preview link
 * cannot load images from the OSRS Wiki, so the preview ships a pack of
 * wiki images as data URIs (wiki-pack.json next to index.html) and this
 * swaps any wiki image URL for its packed copy before the browser asks for it.
 * The live site never includes this module.
 *
 * The high-resolution item renders (public/osrs-ui/hd/items, one file per
 * item) are too many files for the preview, so they come as packs too
 * (hd-items-*.json, listed in hd-items.json). Those load only when the first
 * one is asked for; an image waits for them instead of failing.
 */
const WIKI_PREFIX = 'https://oldschool.runescape.wiki/images/';
// Item sprites by id (UTILITY_ITEM_IDS); packed under "osrs-sprite/<id>.png".
const SPRITE_PREFIX = 'https://chisel.weirdgloop.org/static/img/osrs-sprite/';

const keyOf = (url: string): string | null => {
  if (url.startsWith(SPRITE_PREFIX)) return `osrs-sprite/${url.slice(SPRITE_PREFIX.length).split('?')[0]}`.toLowerCase();
  if (!url.startsWith(WIKI_PREFIX)) return null;
  let file = url.slice(WIKI_PREFIX.length).split('?')[0];
  try { file = decodeURIComponent(file); } catch { /* keep raw */ }
  return file.replace(/ /g, '_').toLowerCase();
};

const loadPack = async (file: string): Promise<Record<string, unknown>> => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
    return res.ok ? await res.json() : {};
  } catch { return {}; }
};

const HD_ITEM = /(?:^|\/)osrs-ui\/hd\/items\/(\d+)\.png$/;
let hdItems: Map<string, string> | null = null;
let hdLoading: Promise<Map<string, string>> | null = null;
const loadHdItems = (): Promise<Map<string, string>> => {
  hdLoading ??= (async () => {
    const index = await loadPack('hd-items.json');
    const files = Array.isArray(index.packs) ? (index.packs as unknown[]).filter((f): f is string => typeof f === 'string') : [];
    const map = new Map<string, string>();
    for (const pack of await Promise.all(files.map(loadPack))) {
      for (const [id, uri] of Object.entries(pack)) if (typeof uri === 'string') map.set(id, uri);
    }
    hdItems = map;
    return map;
  })();
  return hdLoading;
};
/** An HD item URL: its packed copy now, or null while the packs still load (then `later` sets it). */
const swapHd = (value: string, later: (uri: string) => void): string | null => {
  const m = HD_ITEM.exec(value.split('?')[0]);
  if (!m) return value;
  if (hdItems) return hdItems.get(m[1]) ?? value;
  void loadHdItems().then((map) => later(map.get(m[1]) ?? value));
  return null;
};

export const installPreviewImagePack = async (): Promise<void> => {
  // The pack is split into several files (each published file has a size cap);
  // the first one lists the others under "__more".
  const first = await loadPack('wiki-pack.json');
  const more = Array.isArray(first.__more) ? (first.__more as unknown[]).filter((f): f is string => typeof f === 'string') : [];
  const packs = [first, ...(await Promise.all(more.map(loadPack)))];
  const lookup = new Map<string, string>();
  for (const pack of packs) {
    for (const [file, uri] of Object.entries(pack)) {
      if (typeof uri === 'string') lookup.set(file.replace(/ /g, '_').toLowerCase(), uri);
    }
  }
  if (!lookup.size) return;
  const swap = (value: string) => {
    const key = keyOf(value);
    return key ? lookup.get(key) ?? value : value;
  };

  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    if (name === 'src' && typeof value === 'string') {
      const hd = swapHd(value, (uri) => setAttribute.call(this, name, uri));
      if (hd === null) return undefined;
      value = hd;
    }
    if ((name === 'src' || name === 'href' || name === 'poster') && typeof value === 'string') value = swap(value);
    return setAttribute.call(this, name, value);
  };
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (desc?.set && desc.get) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get: desc.get,
      set(value: string) {
        if (typeof value === 'string') {
          const hd = swapHd(value, (uri) => desc.set!.call(this, uri));
          if (hd === null) return;
          value = swap(hd);
        }
        desc.set!.call(this, value);
      },
    });
  }
};
