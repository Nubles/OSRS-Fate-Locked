/** Shared types for the Fate Assistant prototype. */
import type { UnlockState } from '../types';

/** Snapshot the tools read from — never mutated (answer + navigate only). */
export interface AssistantContext {
  unlocks: UnlockState;
}

/** A side-effecting navigation the UI can offer as a button (and the model can trigger). */
export interface AssistantAction {
  kind: 'map' | 'tab' | 'journal' | 'modal';
  label: string;
  /** map: {cx,cy}; tab/modal: {target}; journal: {tab} */
  payload: Record<string, unknown>;
}

/** What a tool returns: a text answer plus optional follow-up actions. */
export interface ToolResult {
  text: string;
  actions?: AssistantAction[];
}

export interface Tool {
  name: string;
  /** One-line description used by the intent router + (later) the model prompt. */
  description: string;
  /** Loose arg schema for the model; the router fills these heuristically. */
  args: Record<string, string>;
  run: (args: Record<string, string>, ctx: AssistantContext) => ToolResult;
}

/** A parsed intent: which tool to run with which args. */
export interface ToolCall {
  tool: string;
  args: Record<string, string>;
}

/** A backend turns user text (+ tools) into one or more tool calls. */
export interface InferenceBackend {
  id: string;
  label: string;
  /** Human-readable readiness, e.g. 'ready', 'needs 2.4GB download', 'unsupported browser'. */
  status(): Promise<string>;
  /** Parse a user message into tool calls. Streaming/async to allow a real LLM later. */
  plan(message: string, tools: Tool[], ctx: AssistantContext): Promise<ToolCall[]>;
}
