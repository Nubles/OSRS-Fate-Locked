/**
 * Preview builds only (VITE_PREVIEW_IMAGE_PACK=1). The private preview link
 * cannot load images from the OSRS Wiki, so the preview ships a pack of
 * wiki images as data URIs (wiki-pack.json next to index.html) and this
 * swaps any wiki image URL for its packed copy before the browser asks for it.
 * Boss models are packed the same way (models-pack.json): the preview can
 * hold only so many files, so a fetch for models/<slug>.gltf is answered
 * from the pack, loaded the first time a model is asked for.
 * The live site never includes this module.
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

let modelPack: Promise<Record<string, unknown>> | null = null;
const MODEL_URL = /\/models\/([a-z0-9-]+\.gltf)(?:\?|$)/;

const installModelPack = () => {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const match = MODEL_URL.exec(url);
    if (match) {
      modelPack ??= loadPack('models-pack.json');
      const body = (await modelPack)[match[1]];
      if (typeof body === 'string') return new Response(body, { headers: { 'Content-Type': 'model/gltf+json' } });
    }
    return realFetch(input, init);
  };
};

export const installPreviewImagePack = async (): Promise<void> => {
  installModelPack();
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
    if ((name === 'src' || name === 'href' || name === 'poster') && typeof value === 'string') value = swap(value);
    return setAttribute.call(this, name, value);
  };
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (desc?.set && desc.get) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get: desc.get,
      set(value: string) { desc.set!.call(this, typeof value === 'string' ? swap(value) : value); },
    });
  }
};
