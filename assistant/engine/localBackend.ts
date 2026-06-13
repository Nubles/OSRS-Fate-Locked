/**
 * LocalBackend — the assistant's zero-download "brain": it maps a natural
 * language message to one of the grounded tools with extracted arguments,
 * deterministically (no model weights, so it's instant and unit-testable).
 *
 * It is NOT a language model — it's intent matching — but it's intentionally
 * permissive: it strips filler, accepts many phrasings, and as a last resort
 * recognises any known quest or place name mentioned anywhere in the sentence.
 * The on-device Gemma backend plugs into the same interface and replaces this
 * once a browser-runnable build is wired (see webgpuBackend).
 */
import type { InferenceBackend, Tool, ToolCall, AssistantContext } from '../types';
import { QUEST_DATA } from '../../data/questData';
import { SUB_AREA_CHUNKS } from '../../data/subAreaChunks';
import { REGION_CHUNKS } from '../../data/regionChunks';

// ── text normalisation ──────────────────────────────────────────────────────
const FILLER_LEAD = /^(?:(?:hey|hi|ok|okay|so|please|can you|could you|would you|i (?:want|need|would like) to|i wanna|help me|let'?s|um|well|tell me|do you know)[,\s]+)+/i;
const FILLER_TAIL = /\b(?:please|for me|right now|currently|at the moment|in osrs|on the map|near(?:by| me)?|thanks?(?: you)?)\b/gi;

// Clean filler/punctuation but PRESERVE case, so extracted args keep their
// original capitalisation (nicer for display + wiki lookups). Matching is done
// with case-insensitive regexes below.
const clean = (raw: string): string =>
  raw.trim()
    .replace(FILLER_LEAD, '')
    .replace(FILLER_TAIL, '')
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Trim articles/leading filler from an extracted argument. */
const tidyArg = (s: string): string =>
  s.replace(/^(?:a |an |the |some |any |my )/i, '')
    .replace(/\b(?:located|found|please)\b/gi, '')
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ── known-name dictionaries (for the fallback matcher) ──────────────────────
const QUEST_NAMES = Object.values(QUEST_DATA).map(q => q.name);
const PLACE_NAMES = [...Object.keys(SUB_AREA_CHUNKS), ...Object.keys(REGION_CHUNKS)];

/** Longest known name from `names` that appears as a word-bounded substring. */
const longestNameIn = (text: string, names: string[]): string | null => {
  let best: string | null = null;
  for (const name of names) {
    const n = name.toLowerCase();
    if (text.includes(n) && (!best || n.length > best.length)) best = name;
  }
  return best;
};

const TAB_WORDS = /\b(world|map|character|stats|skills?|activit\w*|utility|journal|quests?|diar\w*|collection|clog|log)\b/i;

// ── ordered intent rules ────────────────────────────────────────────────────
// Each returns a ToolCall or null. First non-null wins. All regexes are
// case-insensitive; args are extracted from the original-case text.
type Matcher = (text: string) => ToolCall | null;

const RULES: Matcher[] = [
  // open a main tab: a nav verb (or "... tab") + a tab keyword
  (t) => {
    const navVerb = /\b(open|show|switch to|take me to|go to|bring up|jump to)\b/i.test(t);
    const tabWord = t.match(TAB_WORDS);
    if (!tabWord) return null;
    const explicitTab = /\btab\b/i.test(t);
    if (navVerb || explicitTab) return { tool: 'open_tab', args: { tab: tabWord[1] } };
    return null;
  },

  // why is X locked / what do I need for X / how do I unlock X
  (t) => {
    const m = t.match(/^(?:why (?:is|can'?t i (?:do|start|access))\s+)(.+?)(?:\s+(?:locked|blocked|unavailable|greyed out))?$/i)
      || t.match(/^(?:what (?:do i need|are the requirements?|level do i need)\s+(?:for|to (?:do|start|unlock)))\s+(.+)/i)
      || t.match(/^(?:how do i (?:unlock|start|do|get))\s+(.+)/i)
      || t.match(/^(?:requirements?\s+(?:for|to do)\s+)(.+)/i)
      || t.match(/^(?:can i (?:do|start))\s+(.+)/i);
    return m ? { tool: 'why_quest_locked', args: { quest: tidyArg(m[1]) } } : null;
  },

  // what can I do in/at/around X · what's in X · tell me about X
  (t) => {
    const m = t.match(/^what(?:'?s| is| can i do| else can i do)?\s+(?:in|at|around|near|about)\s+(.+)/i)
      || t.match(/^tell me about\s+(.+)/i)
      || t.match(/^(?:what'?s|whats) (?:there )?(?:in|at) (.+)/i);
    return m ? { tool: 'what_can_i_do_here', args: { place: tidyArg(m[1]) } } : null;
  },

  // navigate to a place: go/take/show/head/travel/navigate me to X (not a tab)
  (t) => {
    const m = t.match(/^(?:go to|take me to|navigate to|head (?:to|over to)|travel to|bring me to|show me)\s+(.+)/i)
      || t.match(/^(?:where is|how do i get to)\s+(.+?)(?:\s+on the world map)?$/i);
    if (!m) return null;
    const arg = tidyArg(m[1]);
    if (TAB_WORDS.test(arg)) return null; // handled by the tab rule
    return { tool: 'go_to_place', args: { place: arg } };
  },

  // where can I find/get/mine/etc X · nearest X · find X · locate X
  (t) => {
    const m = t.match(/^where\s+(?:can i |i can |do i |to )?(?:find|get|buy|mine|catch|chop|kill|fight|pickpocket|steal(?: from)?)\s+(.+)/i)
      || t.match(/^where(?:'?s| is| are)\s+(.+)/i)
      || t.match(/^(?:find|locate|nearest|closest|show me where (?:to find|i can find))\s+(.+)/i);
    return m ? { tool: 'where_to_find', args: { entity: tidyArg(m[1]) } } : null;
  },
];

/** Last-resort matcher: spot a known quest or place name anywhere in the text. */
const fallbackByName = (text: string): ToolCall | null => {
  const lower = text.toLowerCase();
  const quest = longestNameIn(lower, QUEST_NAMES);
  const place = longestNameIn(lower, PLACE_NAMES);
  // Prefer the longer, more specific match.
  if (quest && (!place || quest.length >= place.length)) {
    return { tool: 'why_quest_locked', args: { quest } };
  }
  if (place) {
    const travel = /\b(go|travel|take|head|map|visit|teleport)\b/i.test(text);
    return travel
      ? { tool: 'go_to_place', args: { place } }
      : { tool: 'what_can_i_do_here', args: { place } };
  }
  return null;
};

export const parseIntent = (message: string): ToolCall[] => {
  const text = clean(message);
  if (!text) return [];
  for (const rule of RULES) {
    const call = rule(text);
    if (call && call.args[Object.keys(call.args)[0]]) return [call];
  }
  const fb = fallbackByName(text);
  return fb ? [fb] : [];
};

export class LocalBackend implements InferenceBackend {
  id = 'local';
  label = 'Built-in responder (no download)';
  async status() { return 'ready'; }
  async plan(message: string, _tools: Tool[], _ctx: AssistantContext): Promise<ToolCall[]> {
    return parseIntent(message);
  }
}
