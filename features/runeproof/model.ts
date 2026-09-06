import type { RequirementPredicate } from '../../utils/requirementPredicates';

export type GuideRequirement =
  | { kind: 'permission'; predicate: RequirementPredicate }
  | { kind: 'item'; id: string; quantity: number }
  | { kind: 'answer'; id: string; value: string }
  | { kind: 'unreviewed'; reason: string };
export interface GuideLocation { label: string; cx: number; cy: number; areas: string[] }
export interface GuideStep {
  id: string; title: string; text: string; after: string[];
  requires: GuideRequirement[]; location?: GuideLocation;
  /** Reviewed inventory-only action with no mandatory travel destination. */
  portable?: boolean;
  branch?: { question: string; answer: string };
  consume?: Record<string, number>; produce?: Record<string, number>;
}
export interface GuidePack {
  id: string; version: number; intro: string; difficulty: string;
  coverage: 'complete' | 'partial'; coverageNote?: string;
  items: { id: string; label: string; quantity: number; note: string }[];
  questions: { id: string; prompt: string; options: { id: string; label: string }[] }[];
  steps: GuideStep[];
  sources: { label: string; path: string; revision: string }[];
}
export interface GuideProgress {
  version: number; completed: string[]; inventory: Record<string, number>;
  answers: Record<string, string>;
  history: { stepId: string; inventory: Record<string, number> }[];
}
export type StepState = 'done' | 'available' | 'waiting' | 'blocked' | 'question' | 'unsupported' | 'skipped';
export interface EvaluatedStep { step: GuideStep; state: StepState; reasons: string[] }
export interface GuideEvaluation { steps: EvaluatedStep[]; next?: EvaluatedStep; complete: boolean; inventory: Record<string, number> }
