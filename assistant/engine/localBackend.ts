/**
 * LocalBackend — a zero-download intent router used as the assistant's default
 * "brain". It maps a natural-language message to one of the grounded tools with
 * extracted arguments, deterministically (so it's unit-testable and needs no
 * model weights). The on-device Gemma backend plugs into the same interface and
 * can replace this once a browser-runnable build is wired (see webgpuBackend).
 *
 * This is intentionally simple pattern-matching, not real NLU — it's the
 * prototype's safe, instant fallback, clearly labelled as such in the UI.
 */
import type { InferenceBackend, Tool, ToolCall, AssistantContext } from '../types';

const clean = (s: string) => s.trim().replace(/[?.!]+$/, '').trim();

/** Ordered rules: first match wins. Each extracts a tool + args from the text. */
const RULES: { re: RegExp; tool: string; arg: string }[] = [
  // navigation
  { re: /^(?:go to|take me to|jump to|navigate to)\s+(.+)/i, tool: 'go_to_place', arg: 'place' },
  { re: /^(?:open|show|switch to)\s+(?:the\s+)?(.+?)\s+tab$/i, tool: 'open_tab', arg: 'tab' },
  // why locked
  { re: /^why\s+(?:is|can'?t i do|cant i do)?\s*(.+?)\s+(?:locked|blocked|unavailable)/i, tool: 'why_quest_locked', arg: 'quest' },
  { re: /^what (?:do i need|are the requirements)\s+(?:for|to do)\s+(.+)/i, tool: 'why_quest_locked', arg: 'quest' },
  // what can I do here
  { re: /^what(?:'?s| is| can i do)?\s+(?:in|at|around|near)\s+(.+)/i, tool: 'what_can_i_do_here', arg: 'place' },
  // where to find  (kept after the others so "where ... tab" etc don't leak in)
  { re: /^where\s+(?:can i (?:find|get|mine|catch|chop|kill)|is|are)\s+(?:a |an |the |some )?(.+)/i, tool: 'where_to_find', arg: 'entity' },
  { re: /^(?:find|locate)\s+(?:a |an |the |some )?(.+)/i, tool: 'where_to_find', arg: 'entity' },
];

export const parseIntent = (message: string): ToolCall[] => {
  const text = clean(message);
  for (const { re, tool, arg } of RULES) {
    const m = text.match(re);
    if (m && m[1]) return [{ tool, args: { [arg]: clean(m[1]) } }];
  }
  return [];
};

export class LocalBackend implements InferenceBackend {
  id = 'local';
  label = 'Built-in responder (no download)';
  async status() { return 'ready'; }
  async plan(message: string, _tools: Tool[], _ctx: AssistantContext): Promise<ToolCall[]> {
    return parseIntent(message);
  }
}
