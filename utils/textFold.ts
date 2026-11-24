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

/**
 * A plain "contains", folded. A term that folds to nothing (only spaces or
 * punctuation) falls back to the plain trimmed match.
 */
export const foldedIncludes = (text: string, term: string): boolean => {
  const needle = foldText(term).text;
  return needle.length === 0 ? text.toLowerCase().includes(term.trim().toLowerCase()) : folded(text).text.includes(needle);
};

/**
 * How a name matches a term, folded as foldedIncludes folds: 3 when it is the
 * same, 2 when it starts with the term, 1 when it contains it, 0 otherwise.
 * Searches rank by this so starts-with stays ahead of contains.
 */
export const foldedRank = (text: string, term: string): 0 | 1 | 2 | 3 => {
  const needle = foldText(term).text;
  const q = needle || term.trim().toLowerCase();
  if (!q) return 0;
  const hay = needle ? folded(text).text : text.toLowerCase();
  return hay === q ? 3 : hay.startsWith(q) ? 2 : hay.includes(q) ? 1 : 0;
};
