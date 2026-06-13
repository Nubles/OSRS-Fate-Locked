/**
 * Dispatcher — the assistant's turn loop: take a user message, ask the active
 * backend which grounded tool(s) to call, run them against the live unlock
 * snapshot, and compose a reply (text + any navigation actions).
 */
import { ALL_TOOLS, toolByName } from '../tools';
import type { InferenceBackend, AssistantContext, AssistantAction } from '../types';

export interface AssistantReply {
  text: string;
  actions: AssistantAction[];
}

const FALLBACK = [
  "I can help with the world data. Try:",
  '• “where can I find coal?”',
  '• “why is Dragon Slayer II locked?”',
  '• “what can I do in Falador?”',
  '• “go to Varrock” / “open the Journal tab”',
].join('\n');

export const runTurn = async (
  message: string,
  backend: InferenceBackend,
  ctx: AssistantContext,
): Promise<AssistantReply> => {
  const calls = await backend.plan(message, ALL_TOOLS, ctx);
  if (!calls.length) return { text: FALLBACK, actions: [] };

  const texts: string[] = [];
  const actions: AssistantAction[] = [];
  for (const call of calls) {
    const tool = toolByName(call.tool);
    if (!tool) continue;
    const result = tool.run(call.args, ctx);
    texts.push(result.text);
    if (result.actions) actions.push(...result.actions);
  }
  return { text: texts.join('\n\n') || FALLBACK, actions };
};
