/**
 * Preview builds only (VITE_PREVIEW_IMAGE_PACK=1). The private preview link
 * cannot load images from the OSRS Wiki, so the preview ships a pack of
 * wiki images as data URIs (wiki-pack.json next to index.html) and this
 * swaps any wiki image URL for its packed copy before the browser asks for it.
 * The live site never includes this module.
 */
const WIKI_PREFIX = 'https://oldschool.runescape.wiki/images/';

const keyOf = (url: string): string | null => {
  if (!url.startsWith(WIKI_PREFIX)) return null;
  let file = url.slice(WIKI_PREFIX.length).split('?')[0];
  try { file = decodeURIComponent(file); } catch { /* keep raw */ }
  return file.replace(/ /g, '_').toLowerCase();
};

export const installPreviewImagePack = async (): Promise<void> => {
  let pack: Record<string, string> = {};
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}wiki-pack.json`);
    if (res.ok) pack = await res.json();
  } catch { return; }
  const lookup = new Map<string, string>();
  for (const [file, uri] of Object.entries(pack)) lookup.set(file.replace(/ /g, '_').toLowerCase(), uri);
  const swap = (value: string) => {
    const key = keyOf(value);
    return key ? lookup.get(key) ?? value : value;
  };

  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    if ((name === 'src' || name === 'href') && typeof value === 'string') value = swap(value);
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
