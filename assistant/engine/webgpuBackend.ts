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
    'companion app, and extract its single argument. Tools:\n' + menu + '\n\n' +
    'Examples:\n' +
    'User: where can I get coal -> {"tool":"where_to_find","arg":"coal"}\n' +
    'User: take me to Varrock -> {"tool":"go_to_place","arg":"Varrock"}\n' +
    'User: why is Monkey Madness locked -> {"tool":"why_quest_locked","arg":"Monkey Madness"}\n' +
    'User: what can I do in Falador -> {"tool":"what_can_i_do_here","arg":"Falador"}\n' +
    'User: open my quests -> {"tool":"open_tab","arg":"journal"}\n\n' +
    'Reply with ONLY compact JSON: {"tool":"<tool_name>","arg":"<argument>"}. ' +
    'If no tool fits, use {"tool":"none","arg":""}. JSON only, no explanation.';
  return [
    { role: 'system', content: system },
    { role: 'user', content: message },
  ];
};

/**
 * A JSON schema that constrains the model's output so `tool` MUST be one of the
 * real tool names (or "none"). Without this, a 360M model invents tool names;
 * with it, the enum does the heavy lifting and even a tiny model stays valid.
 */
export const buildSchema = (tools: Tool[]): string =>
  JSON.stringify({
    type: 'object',
    properties: {
      tool: { type: 'string', enum: [...tools.map(t => t.name), 'none'] },
      arg: { type: 'string' },
    },
    required: ['tool', 'arg'],
  });

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
// The download is large (~376 MB), so it is triggered EXPLICITLY by the user
// (a Download button in the widget) with live progress — never silently on the
// first message. plan() only uses the model once it's ready; otherwise it falls
// back to the deterministic parser, so the assistant always answers instantly.
type Engine = { chat: { completions: { create: (o: any) => Promise<any> } } };
let engine: Engine | null = null;
let loadPromise: Promise<boolean> | null = null;
let lastError: string | null = null;

const startLoad = (onProgress: (pct: number, label: string) => void): Promise<boolean> => {
  if (engine) return Promise.resolve(true);
  if (!loadPromise) {
    loadPromise = (async () => {
      lastError = null;
      try {
        // @vite-ignore — resolved at runtime from the CDN, never bundled.
        const webllm: any = await import(/* @vite-ignore */ WEB_LLM_URL);
        onProgress(0, 'starting…');
        engine = await webllm.CreateMLCEngine(MODEL_ID, {
          initProgressCallback: (r: { text?: string; progress?: number }) =>
            onProgress(r.progress ?? 0, r.text ?? 'loading…'),
        });
        onProgress(1, 'ready');
        return true;
      } catch (e) {
        lastError = (e as Error).message ?? 'unknown error';
        loadPromise = null; // allow retry
        engine = null;
        return false;
      }
    })();
  }
  return loadPromise;
};

export class WebGpuBackend implements InferenceBackend {
  id = 'smollm-webgpu';
  label = 'SmolLM2-360M · on-device (WebGPU)';
  needsDownload = true;

  isSupported() { return hasWebGPU(); }
  isReady() { return engine != null; }
  lastError() { return lastError; }
  load(onProgress: (pct: number, label: string) => void) { return startLoad(onProgress); }

  async status(): Promise<string> {
    if (!hasWebGPU()) return 'This browser has no WebGPU — needs desktop Chrome/Edge. Using built-in.';
    if (engine) return 'Model loaded — answering on-device.';
    if (lastError) return `Load failed: ${lastError.slice(0, 80)}`;
    return 'Not downloaded yet (~376 MB). Built-in responder active until you download.';
  }

  async plan(message: string, tools: Tool[], _ctx: AssistantContext): Promise<ToolCall[]> {
    // Deterministic-first: the rule parser is fast and reliable for clear
    // phrasings. A 360M model is only worth invoking for the long tail it
    // misses — and even then it mis-picks the tool sometimes, so we constrain
    // its output to valid tool names (enum schema) and still validate it.
    const det = parseIntent(message);
    if (det.length || !engine) return det;
    try {
      const res = await engine.chat.completions.create({
        messages: buildMessages(message, tools),
        temperature: 0,
        max_tokens: 48,
        response_format: { type: 'json_object', schema: buildSchema(tools) },
      });
      return parseToolResponse(res?.choices?.[0]?.message?.content ?? '', tools);
    } catch {
      return [];
    }
  }
}
