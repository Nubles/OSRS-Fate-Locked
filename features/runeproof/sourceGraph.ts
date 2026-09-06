import type { UnlockState } from '../../types';
import { evaluatePredicate, type RequirementPredicate } from '../../utils/requirementPredicates';

/** Observations describe game state. They never supply canonical permission confirmations. */
export type SourceCondition =
  | { kind: 'all' | 'any'; conditions: SourceCondition[] }
  | { kind: 'not'; condition: SourceCondition }
  | { kind: 'observation'; id: string; prompt: string }
  | { kind: 'permission'; predicate: RequirementPredicate }
  | { kind: 'item'; id: string; quantity: number; label?: string }
  | { kind: 'unsupported'; reason: string };

export interface SourceAction {
  kind: 'action'; id: string; title: string; text: string;
  requires?: SourceCondition[];
  /** Always ANDed with requirements; route answers cannot override these gates. */
  permissions?: RequirementPredicate[];
}
export interface SourceConditional {
  kind: 'conditional'; id: string;
  /** Source priority order, not interchangeable alternatives. */
  branches: { condition: SourceCondition; nodeId: string }[];
  defaultNodeId?: string;
}
export interface SourceGraph { entryNodeId: string; nodes: (SourceAction | SourceConditional)[] }
export interface SourceGraphContext {
  unlocks: UnlockState; gameModeId?: string;
  observations: Readonly<Record<string, boolean | undefined>>;
  inventory: Readonly<Record<string, number | undefined>>;
}
export interface SourceConditionResult {
  state: 'met' | 'unmet' | 'unknown'; reasons: string[];
  questions: { id: string; prompt: string }[];
}
export interface SourceGraphResult {
  state: 'action' | 'blocked' | 'unknown'; action?: SourceAction;
  reasons: string[]; questions: { id: string; prompt: string }[]; path: string[];
}

const result = (state: SourceConditionResult['state'], reasons: string[] = [], questions: SourceConditionResult['questions'] = []): SourceConditionResult => ({ state, reasons, questions });
const unknown = (reason: string) => result('unknown', [reason]);
const validText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const merge = (state: SourceConditionResult['state'], values: SourceConditionResult[]): SourceConditionResult => result(state,
  [...new Set(values.flatMap(value => value.reasons))],
  [...new Map(values.flatMap(value => value.questions).map(question => [question.id, question])).values()]);

/** Strong three-valued logic: false AND unknown is false; true OR unknown is true. */
export function evaluateSourceCondition(condition: SourceCondition, context: SourceGraphContext): SourceConditionResult {
  const active = new Set<SourceCondition>();
  const evaluate = (value: SourceCondition): SourceConditionResult => {
    if (!value || typeof value !== 'object') return unknown('The source condition is invalid.');
    if (active.has(value)) return unknown('The source condition contains a cycle.');
    active.add(value);
    try {
      switch (value.kind) {
        case 'all': case 'any': {
          if (!Array.isArray(value.conditions)) return unknown('The source condition group is invalid.');
          // An explicit empty conjunction is a true source default. Empty OR has no alternative.
          if (!value.conditions.length) return value.kind === 'all' ? result('met') : unknown('No source alternative is defined.');
          const values = value.conditions.map(evaluate);
          const decisive = value.kind === 'all' ? 'unmet' : 'met';
          if (values.some(entry => entry.state === decisive)) return merge(decisive, values.filter(entry => entry.state === decisive));
          if (values.some(entry => entry.state === 'unknown')) return merge('unknown', values.filter(entry => entry.state === 'unknown'));
          return merge(value.kind === 'all' ? 'met' : 'unmet', values);
        }
        case 'not': {
          const child = evaluate(value.condition);
          return { ...child, state: child.state === 'unknown' ? 'unknown' : child.state === 'met' ? 'unmet' : 'met' };
        }
        case 'observation': {
          if (!validText(value.id) || !validText(value.prompt)) return unknown('The source observation is invalid.');
          const answer = Object.hasOwn(context.observations, value.id) ? context.observations[value.id] : undefined;
          return typeof answer === 'boolean' ? result(answer ? 'met' : 'unmet', answer ? [] : [value.prompt])
            : result('unknown', [value.prompt], [{ id: value.id, prompt: value.prompt }]);
        }
        case 'permission': {
          // Deliberately omit confirmations: game-state observations cannot grant unlocks.
          const permission = evaluatePredicate(value.predicate, { unlocks: context.unlocks, gameModeId: context.gameModeId });
          return result(permission.status === 'READY' ? 'met' : permission.status === 'LOCKED' ? 'unmet' : 'unknown', permission.checks);
        }
        case 'item': {
          if (!validText(value.id) || !Number.isSafeInteger(value.quantity) || value.quantity <= 0) return unknown('The source item quantity is invalid.');
          const held = Object.hasOwn(context.inventory, value.id) ? context.inventory[value.id] : undefined;
          if (held === undefined) return unknown(`Record how many ${value.label || value.id} you hold.`);
          if (!Number.isSafeInteger(held) || held < 0) return unknown(`The recorded quantity for ${value.label || value.id} is invalid.`);
          return held >= value.quantity ? result('met') : result('unmet', [`Bring ${value.quantity} ${value.label || value.id} (${held} recorded).`]);
        }
        case 'unsupported': return unknown(validText(value.reason) ? value.reason : 'This source condition is not supported.');
        default: return unknown('This source condition is not supported.');
      }
    } finally { active.delete(value); }
  };
  return evaluate(condition);
}

/** Resolves one current instruction, preserving conditional priority and whole branches. */
export function resolveSourceGraph(graph: SourceGraph, context: SourceGraphContext): SourceGraphResult {
  const path: string[] = [];
  const failure = (reason: string): SourceGraphResult => ({ state: 'unknown', reasons: [reason], questions: [], path });
  if (!graph || !validText(graph.entryNodeId) || !Array.isArray(graph.nodes)) return failure('The source graph is invalid.');
  const nodes = new Map<string, SourceAction | SourceConditional>();
  for (const node of graph.nodes) {
    if (!node || !validText(node.id) || nodes.has(node.id)) return failure('The source graph has an invalid or duplicate node.');
    nodes.set(node.id, node);
  }
  let id = graph.entryNodeId;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(id)) return failure('The selected source route contains a cycle.');
    visited.add(id); path.push(id);
    const node = nodes.get(id);
    if (!node) return failure(`The source route references a missing instruction: ${id}.`);
    if (node.kind === 'action') {
      if (!validText(node.title) || !validText(node.text) || (node.requires !== undefined && !Array.isArray(node.requires))
        || (node.permissions !== undefined && !Array.isArray(node.permissions))) return failure('The source instruction is incomplete.');
      const gates = evaluateSourceCondition({ kind: 'all', conditions: [
        ...(node.requires ?? []), ...(node.permissions ?? []).map(predicate => ({ kind: 'permission' as const, predicate })),
      ] }, context);
      return { state: gates.state === 'met' ? 'action' : gates.state === 'unmet' ? 'blocked' : 'unknown',
        action: node, reasons: gates.reasons, questions: gates.questions, path };
    }
    if (node.kind !== 'conditional' || !Array.isArray(node.branches)) return failure('The source route is unsupported.');
    let next: string | undefined;
    for (const branch of node.branches) {
      if (!branch || !validText(branch.nodeId)) return failure('The source branch is invalid.');
      const verdict = evaluateSourceCondition(branch.condition, context);
      if (verdict.state === 'unknown') return { state: 'unknown', reasons: verdict.reasons, questions: verdict.questions, path };
      if (verdict.state === 'met') { next = branch.nodeId; break; }
    }
    next ??= node.defaultNodeId;
    if (!validText(next)) return failure('No source instruction matches the recorded quest state.');
    id = next;
  }
}
