/**
 * WebGpuBackend — on-device SmolLM2-360M via @mlc-ai/web-llm (WebGPU).
 *
 * Role: the model ONLY parses — it picks one grounded tool and pulls out its
 * argument. Every factual answer still comes from our own code (the tools), so
 * the model can't hallucinate OSRS facts. That's why a 360M model is plenty:
 * it just has to choose a tool and extract a noun.
 *
 * web-llm is loaded from a CDN via a dynamic import (kept out of the main
 * bundle and out of package.json, so the whole assistant/ folder stays
 * self-contained and removable). Model weights (~376 MB, q4f16) are fetched by
 * web-llm from the HF CDN on first use and cached in the browser. If WebGPU is
 * unavailable, the model fails to load, or it answers unclearly, we fall back
 * to the deterministic LocalBackend parser — so this is never worse than the
 * built-in responder.
 */
import type { InferenceBackend, Tool, ToolCall, AssistantContext } from '../types';
import { parseIntent } from './localBackend';

const MODEL_ID = 'SmolLM2-360M-Instruct-q4f16_1-MLC';
const WEB_LLM_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.84';

const hasWebGPU = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator;

// ── pure helpers (unit-tested without the model) ────────────────────────────

/** System+user messages that ask the model for a single JSON tool call. */
export const buildMessages = (message: string, tools: Tool[]) => {
  const menu = tools
    .map(t => `- ${t.name}(${Object.keys(t.args)[0] ?? ''}): ${t.description}`)
    .join('\n');
  const system =
    'You route a user message to exactly ONE tool for an Old School RuneScape ' +
    'companion app. Available tools:\n' + menu + '\n\n' +
    'Reply with ONLY compact JSON: {"tool":"<tool_name>","arg":"<argument>"}. ' +
    'The arg is the single value the tool needs (a place, quest, entity, or tab). ' +
    'If no tool fits, reply {"tool":"none"}. Output JSON only, no explanation.';
  return [
    { role: 'system', content: system },
    { role: 'user', content: message },
  ];
};

/** Parse the model's JSON reply into a validated ToolCall (or [] if unusable). */
export const parseToolResponse = (raw: string, tools: Tool[]): ToolCall[] => {
  const m = raw.match(/\{[^{}]*\}/);
  if (!m) return [];
  let obj: { tool?: string; arg?: string };
  try { obj = JSON.parse(m[0]); } catch { return []; }
  const tool = tools.find(t => t.name === obj.tool);
  if (!tool || obj.tool === 'none') return [];
  const argKey = Object.keys(tool.args)[0];
  const arg = (obj.arg ?? '').toString().trim();
  if (!argKey || !arg) return [];
  return [{ tool: tool.name, args: { [argKey]: arg } }];
};

// ── engine lifecycle ────────────────────────────────────────────────────────
type Engine = { chat: { completions: { create: (o: any) => Promise<any> } } };
let engine: Engine | null = null;
let loadPromise: Promise<Engine | null> | null = null;
let progress = '';

const loadEngine = (): Promise<Engine | null> => {
  if (engine) return Promise.resolve(engine);
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        // @vite-ignore — resolved at runtime from the CDN, never bundled.
        const webllm: any = await import(/* @vite-ignore */ WEB_LLM_URL);
        progress = 'starting…';
        engine = await webllm.CreateMLCEngine(MODEL_ID, {
          initProgressCallback: (r: { text?: string; progress?: number }) => {
            progress = r.text ?? (r.progress != null ? `${Math.round(r.progress * 100)}%` : 'loading…');
          },
        });
        progress = 'ready';
        return engine;
      } catch (e) {
        progress = `failed to load (${(e as Error).message?.slice(0, 60) ?? 'error'})`;
        loadPromise = null; // allow retry
        return null;
      }
    })();
  }
  return loadPromise;
};

export class WebGpuBackend implements InferenceBackend {
  id = 'smollm-webgpu';
  label = 'SmolLM2-360M · on-device (WebGPU)';

  async status(): Promise<string> {
    if (!hasWebGPU()) return 'unsupported browser (no WebGPU) — falls back to built-in';
    if (engine) return 'model ready';
    if (progress) return `model: ${progress}`;
    return 'WebGPU ok · ~376 MB model downloads on first message';
  }

  async plan(message: string, tools: Tool[], _ctx: AssistantContext): Promise<ToolCall[]> {
    if (!hasWebGPU()) return parseIntent(message);
    const eng = await loadEngine();
    if (!eng) return parseIntent(message); // load failed → deterministic fallback
    try {
      const res = await eng.chat.completions.create({
        messages: buildMessages(message, tools),
        temperature: 0,
        max_tokens: 64,
      });
      const text: string = res?.choices?.[0]?.message?.content ?? '';
      const calls = parseToolResponse(text, tools);
      // If the model is unsure, fall back rather than answering nothing.
      return calls.length ? calls : parseIntent(message);
    } catch {
      return parseIntent(message);
    }
  }
}
