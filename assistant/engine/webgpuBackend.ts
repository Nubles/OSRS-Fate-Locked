/**
 * WebGpuBackend — the slot for on-device Gemma 4 E2B (WebGPU).
 *
 * Status of the world as of this prototype: Gemma 4 E2B ships only as BF16
 * safetensors — there is no official browser-runnable artifact (no ONNX / GGUF
 * / LiteRT / MediaPipe .task). Running it client-side therefore needs a
 * converted build loaded through MLC web-llm or MediaPipe LLM Inference.
 *
 * Rather than pretend, this backend:
 *   • detects WebGPU and reports honestly what's missing, and
 *   • until a converted model + runtime are wired at the marked point below,
 *     delegates planning to the deterministic LocalBackend so the assistant
 *     still works when this backend is selected.
 *
 * When a browser build is available, load the runtime lazily here (dynamic
 * import, so it never touches the main bundle) and replace `plan` with a real
 * tool-calling prompt over the passed-in tools.
 */
import type { InferenceBackend, Tool, ToolCall, AssistantContext } from '../types';
import { parseIntent } from './localBackend';

const hasWebGPU = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator;

export class WebGpuBackend implements InferenceBackend {
  id = 'gemma-webgpu';
  label = 'Gemma 4 E2B · on-device (WebGPU)';

  async status(): Promise<string> {
    if (!hasWebGPU()) return 'unsupported browser (no WebGPU) — using built-in responder';
    // TODO(phase 2): probe for a cached converted model in OPFS and report size.
    return 'WebGPU ready · Gemma browser build not bundled yet — using built-in responder';
  }

  async plan(message: string, _tools: Tool[], _ctx: AssistantContext): Promise<ToolCall[]> {
    // TODO(phase 2): if a converted Gemma model is loaded, run a tool-calling
    // prompt here. Until then, fall back to the deterministic router so the UX
    // is fully functional without the multi-GB download.
    return parseIntent(message);
  }
}
