/**
 * The OSRS Journal window's search (components/osrs/OsrsJournalScreen.tsx):
 * one term, typed once, that narrows every tab's list. Pure functions only,
 * so the matching rules are pinned by OsrsJournalSearch.test.ts.
 *
 * An entry is a list of text fields (a quest's name, series and start point;
 * a diary task's text, area and tier; a combat task's name, boss and tier).
 * It matches when every word of the term is found in one of its fields, as a
 * substring that ignores case and punctuation ("cooks assistant" finds
 * "Cook's Assistant"), or when a word spells the first letters of a run of
 * words in a field ("rfd" finds the Recipe for Disaster series). The ranges
 * that matched are returned per field, in the field's own characters, so the
 * row can highlight them.
 */

export type Range = [start: number, end: number];

export interface JournalQuery {
  /** The term as typed, trimmed. */
  raw: string;
  /** The term with case and punctuation folded, words single-spaced. */
  norm: string;
  words: string[];
}

interface Folded {
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

/** The query for a typed term, or null when there is nothing to search for. */
export const compileJournalQuery = (term: string): JournalQuery | null => {
  const raw = term.trim();
  const norm = foldText(raw).text;
  if (!norm) return null;
  return { raw, norm, words: norm.split(' ') };
};

const foldCache = new Map<string, Folded>();
const folded = (s: string): Folded => {
  let f = foldCache.get(s);
  if (!f) {
    f = foldText(s);
    if (foldCache.size > 5000) foldCache.clear();
    foldCache.set(s, f);
  }
  return f;
};

/** Source range for folded positions [a, b). */
const toSource = (f: Folded, a: number, b: number): Range => [f.map[a], f.map[b - 1] + 1];

const findAll = (hay: string, needle: string): number[] => {
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
};

/** "rfd" against "Recipe for Disaster": the first letters of a run of words. */
const acronymRanges = (f: Folded, word: string): Range[] | null => {
  if (word.length < 2 || !/^[a-z]+$/.test(word)) return null;
  const starts: number[] = [];
  for (let i = 0; i < f.text.length; i++) if (f.text[i] !== ' ' && (i === 0 || f.text[i - 1] === ' ')) starts.push(i);
  for (let s = 0; s + word.length <= starts.length; s++) {
    let ok = true;
    for (let k = 0; k < word.length && ok; k++) ok = f.text[starts[s + k]] === word[k];
    if (ok) return starts.slice(s, s + word.length).map(i => toSource(f, i, i + 1));
  }
  return null;
};

/** Merge overlapping or touching ranges, sorted by start. */
export const mergeRanges = (ranges: Range[]): Range[] => {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
};

/**
 * Match an entry's fields against the query. Returns the highlight ranges for
 * each field (an empty list for a field with no hit), or null when the entry
 * does not match. A null or empty query matches everything with no ranges.
 */
export const matchJournalFields = (query: JournalQuery | null, fields: ReadonlyArray<string | undefined | null>): Range[][] | null => {
  const texts = fields.map(f => f ?? '');
  const hits: Range[][] = texts.map(() => []);
  if (!query) return hits;
  const fs = texts.map(folded);

  // The whole term as one phrase, in any field.
  let phrase = false;
  fs.forEach((f, fi) => {
    for (const at of findAll(f.text, query.norm)) { hits[fi].push(toSource(f, at, at + query.norm.length)); phrase = true; }
  });

  if (!phrase) {
    // Otherwise every word on its own, as a substring or as an acronym.
    for (const word of query.words) {
      let found = false;
      fs.forEach((f, fi) => {
        for (const at of findAll(f.text, word)) { hits[fi].push(toSource(f, at, at + word.length)); found = true; }
      });
      if (!found) {
        fs.forEach((f, fi) => {
          const acr = acronymRanges(f, word);
          if (acr) { hits[fi].push(...acr); found = true; }
        });
      }
      if (!found) return null;
    }
  }
  return hits.map(mergeRanges);
};

/**
 * Every place the term or any of its words shows in one text, for
 * highlighting a line that is not the entry itself (a group heading).
 */
export const hitRanges = (query: JournalQuery | null, text: string): Range[] => {
  if (!query || !text) return [];
  const f = folded(text);
  const out: Range[] = [];
  for (const at of findAll(f.text, query.norm)) out.push(toSource(f, at, at + query.norm.length));
  if (out.length) return mergeRanges(out);
  for (const word of query.words) {
    const subs = findAll(f.text, word);
    if (subs.length) subs.forEach(at => out.push(toSource(f, at, at + word.length)));
    else out.push(...(acronymRanges(f, word) ?? []));
  }
  return mergeRanges(out);
};

/** True when the entry's fields match the query (or there is no query). */
export const journalMatches = (query: JournalQuery | null, fields: ReadonlyArray<string | undefined | null>): boolean =>
  matchJournalFields(query, fields) !== null;

export interface Segment { text: string; hit: boolean }

/** Cut a text into plain and highlighted segments for the given ranges. */
export const splitHighlight = (text: string, ranges: Range[] | undefined): Segment[] => {
  if (!ranges || ranges.length === 0) return text ? [{ text, hit: false }] : [];
  const out: Segment[] = [];
  let at = 0;
  for (const [a, b] of mergeRanges(ranges)) {
    const s = Math.max(a, at);
    const e = Math.min(b, text.length);
    if (s >= e) continue;
    if (s > at) out.push({ text: text.slice(at, s), hit: false });
    out.push({ text: text.slice(s, e), hit: true });
    at = e;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
};

/* ── The fields each kind of entry is searched by ───────────────────────── */

const DIARY_TIER = /^(.*) (Easy|Medium|Hard|Elite)$/;

/** "Varrock Medium" as [area, tier]. */
export const diaryAreaAndTier = (tierId: string): [string, string] => {
  const m = DIARY_TIER.exec(tierId);
  return m ? [m[1], m[2]] : [tierId, ''];
};

/** A quest: its name, series and start point (the first is the row's text). */
export const questSearchFields = (q: { name: string; series?: string }, start?: string | null): string[] =>
  [q.name, q.series ?? '', start ?? ''];

/** A diary task: its text, then its area and tier. */
export const diaryTaskSearchFields = (t: { description: string; tierId: string }): string[] =>
  [t.description, ...diaryAreaAndTier(t.tierId)];

/** A Combat Achievement task: its name (or text), its text, the boss and the tier. */
export const caTaskSearchFields = (t: { name?: string; description: string; monster: string; tierId: string }): string[] =>
  [t.name ?? t.description, t.name ? t.description : '', t.monster, t.tierId];
