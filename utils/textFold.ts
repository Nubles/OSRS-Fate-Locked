/**
 * Search text folding shared by every name search in the tracker: case,
 * accents and the joiners inside a word (apostrophes, full stops, quotes) are
 * ignored, and every other run of characters is one space. So "cooks
 * assistant" finds "Cook's Assistant", "kril" finds "K'ril Tsutsaroth" and a
 * stray space before or after the text changes nothing.
 *
 * Pure functions with no imports, so the lazy services and the panels can
 * share them without pulling a component module into a chunk.
 */

export interface Folded {
  text: string;
  /** For each character of `text`, the index of the source character it came from. */
  map: number[];
}

const WORD_CHAR = /[\p{L}\p{N}]/u;
/** Characters that join a word rather than split it: "Cook's", "H.A.M.", "Mr. Mordaut". */
const DROPPED = /['‘’`.´"“”]/u;

/** Lower-case letters and digits; dropped joiners; every other run of characters becomes one space. */
export const foldText = (src: string): Folded => {
  let text = '';
  const map: number[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (WORD_CHAR.test(ch)) {
      // Strip accents so "Pollnivneach" and "Pollnívneach" read the same.
      const lower = ch.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      for (const c of lower) { text += c; map.push(i); }
    } else if (DROPPED.test(ch)) {
      continue;
    } else if (text.length > 0 && text[text.length - 1] !== ' ') {
      text += ' ';
      map.push(i);
    }
  }
  if (text.endsWith(' ')) { text = text.slice(0, -1); map.pop(); }
  return { text, map };
};

const foldCache = new Map<string, Folded>();
/** foldText with a small cache, for names folded again on every keystroke. */
export const folded = (s: string): Folded => {
  let f = foldCache.get(s);
  if (!f) {
    f = foldText(s);
    if (foldCache.size > 5000) foldCache.clear();
    foldCache.set(s, f);
  }
  return f;
};

const keyCache = new Map<string, string>();
/**
 * Well above the longest list searched by name (about 6,200 entity names on
 * the World map today), so one search never empties the cache for the next.
 */
const KEY_CACHE_MAX = 50000;
/** The folded text alone, cached: what the searches compare against. */
export const foldKey = (s: string): string => {
  let k = keyCache.get(s);
  if (k === undefined) {
    k = foldText(s).text;
    if (keyCache.size >= KEY_CACHE_MAX) keyCache.clear();
    keyCache.set(s, k);
  }
  return k;
};

export interface FoldedMatcher {
  /** False when the term folds to nothing (only spaces or punctuation): the plain trimmed match is used then. */
  readonly folded: boolean;
  /** A plain "contains". `key` is the text already folded by foldText, when the caller holds it. */
  includes(text: string, key?: string): boolean;
  /** 3 when the text is the term, 2 when it starts with it, 1 when it contains it, 0 otherwise. */
  rank(text: string, key?: string): 0 | 1 | 2 | 3;
}

/**
 * Folds the term once for a whole search, so a list of thousands of names is
 * not folding the same term again for each name. A term that folds to nothing
 * falls back to the plain trimmed, lower-case match.
 */
export const foldedMatcher = (term: string): FoldedMatcher => {
  const needle = foldText(term).text;
  const q = needle || term.trim().toLowerCase();
  const hay = needle
    ? (text: string, key?: string) => key ?? foldKey(text)
    : (text: string) => text.toLowerCase();
  return {
    folded: needle.length > 0,
    includes: (text, key) => hay(text, key).includes(q),
    rank: (text, key) => {
      if (!q) return 0;
      const h = hay(text, key);
      return h === q ? 3 : h.startsWith(q) ? 2 : h.includes(q) ? 1 : 0;
    },
  };
};

/**
 * A plain "contains", folded. A term that folds to nothing (only spaces or
 * punctuation) falls back to the plain trimmed match. For a long list, make
 * one foldedMatcher and reuse it.
 */
export const foldedIncludes = (text: string, term: string): boolean => foldedMatcher(term).includes(text);

/**
 * How a name matches a term, folded as foldedIncludes folds: 3 when it is the
 * same, 2 when it starts with the term, 1 when it contains it, 0 otherwise.
 * Searches rank by this so starts-with stays ahead of contains.
 */
export const foldedRank = (text: string, term: string): 0 | 1 | 2 | 3 => foldedMatcher(term).rank(text);
