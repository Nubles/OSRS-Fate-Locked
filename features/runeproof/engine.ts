import type { UnlockState } from '../../types';
import { evaluatePredicate } from '../../utils/requirementPredicates';
import type { EvaluatedStep, GuideEvaluation, GuidePack, GuideProgress, GuideStep } from './model';

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
// Keep input and item effects within the quantity accepted by guide storage.
const count = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;
const safeId = (value: unknown): value is string => text(value) && !['__proto__', 'constructor', 'prototype'].includes(value);

export function validatePack(pack: GuidePack): string[] {
  const errors: string[] = [];
  if (!safeId(pack.id) || !positive(pack.version)) errors.push('Guide identity or version is invalid.');
  if (!['complete', 'partial'].includes(pack.coverage)) errors.push('Guide coverage is invalid.');
  if (pack.coverage === 'partial' && !text(pack.coverageNote)) errors.push('Partial guide needs a coverage note.');
  if (!pack.sources?.length || pack.sources.some(source => !text(source.label) || !text(source.path) || !text(source.revision))) {
    errors.push('Guide source evidence is missing.');
  }
  const ids = (entries: { id: string }[], label: string) => {
    const seen = new Set<string>();
    for (const entry of entries) {
      if (!safeId(entry.id) || seen.has(entry.id)) errors.push(`${label} has an invalid or duplicate ID.`);
      seen.add(entry.id);
    }
    return seen;
  };
  const items = ids(pack.items ?? [], 'Items');
  const steps = ids(pack.steps ?? [], 'Steps');
  ids(pack.questions ?? [], 'Questions');
  const questions = new Map((pack.questions ?? []).map(question => [question.id, question]));
  if (!pack.steps?.length) errors.push('Guide has no steps.');
  for (const item of pack.items ?? []) if (!text(item.label) || !positive(item.quantity)) errors.push(`Item ${item.id} needs a label and positive quantity.`);
  for (const question of pack.questions ?? []) {
    ids(question.options ?? [], `Question ${question.id} options`);
    if (!text(question.prompt) || !question.options?.length || question.options.some(option => !text(option.label))) errors.push(`Question ${question.id} is incomplete.`);
  }
  const validAnswer = (id: string, value: string) => questions.get(id)?.options.some(option => option.id === value);
  for (const step of pack.steps ?? []) {
    if (!text(step.title) || !text(step.text)) errors.push(`Step ${step.id} needs instructions.`);
    if (!Array.isArray(step.after) || !Array.isArray(step.requires)) { errors.push(`Step ${step.id} has invalid requirements.`); continue; }
    if (new Set(step.after).size !== step.after.length || step.after.some(id => !steps.has(id))) errors.push(`Step ${step.id} has invalid dependencies.`);
    if (step.branch && !validAnswer(step.branch.question, step.branch.answer)) errors.push(`Step ${step.id} has an unknown branch answer.`);
    if (step.location && (!text(step.location.label) || !Number.isInteger(step.location.cx) || !Number.isInteger(step.location.cy)
      || step.location.cx < 0 || step.location.cy < 0 || step.location.cx > 255 || step.location.cy > 255
      || !step.location.areas?.length || !step.location.areas.every(text))) errors.push(`Step ${step.id} has an invalid location.`);
    for (const requirement of step.requires) {
      if (!requirement || !['item', 'answer', 'permission', 'unreviewed'].includes(requirement.kind)) {
        errors.push(`Step ${step.id} has an unsupported requirement type.`);
        continue;
      }
      if (requirement.kind === 'item' && (!items.has(requirement.id) || !positive(requirement.quantity))) errors.push(`Step ${step.id} has an invalid item requirement.`);
      else if (requirement.kind === 'answer' && !validAnswer(requirement.id, requirement.value)) errors.push(`Step ${step.id} has an unknown question answer.`);
      else if (requirement.kind === 'permission' && (!requirement.predicate || typeof requirement.predicate !== 'object')) errors.push(`Step ${step.id} has an invalid permission.`);
      else if (requirement.kind === 'unreviewed' && !text(requirement.reason)) errors.push(`Step ${step.id} needs an uncertainty reason.`);
      else if (!['item', 'answer', 'permission', 'unreviewed'].includes(requirement.kind)) errors.push(`Step ${step.id} has an unknown requirement.`);
    }
    for (const effects of [step.consume, step.produce]) {
      for (const [id, quantity] of Object.entries(effects ?? {})) {
        if (!items.has(id) || !positive(quantity)) errors.push(`Step ${step.id} has an invalid inventory effect.`);
      }
    }
  }
  const byId = new Map((pack.steps ?? []).map(step => [step.id, step]));
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) { errors.push('Guide dependencies contain a cycle.'); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const parent of byId.get(id)?.after ?? []) if (steps.has(parent)) visit(parent);
    visiting.delete(id); visited.add(id);
  };
  for (const id of steps) visit(id);
  return [...new Set(errors)];
}

export const freshProgress = (pack: GuidePack): GuideProgress => ({
  version: pack.version, completed: [], inventory: {}, answers: {}, history: [],
});

export function evaluateGuide(pack: GuidePack, progress: GuideProgress, unlocks: UnlockState, gameModeId?: string): GuideEvaluation {
  const invalid = validatePack(pack);
  if (progress.version !== pack.version) invalid.push('This guide has changed. Start a new guide to continue.');
  if (Object.entries(progress.inventory).some(([id, quantity]) => !pack.items.some(item => item.id === id) || !count(quantity))) invalid.push('Recorded inventory is invalid.');
  if (invalid.length) return { steps: pack.steps.map(step => ({ step, state: 'unsupported', reasons: invalid })), complete: false, inventory: { ...progress.inventory } };
  const byId = new Map(pack.steps.map(step => [step.id, step]));
  const states = new Map<string, EvaluatedStep>();
  const itemLabel = (id: string) => pack.items.find(item => item.id === id)!.label;
  const question = (id: string) => pack.questions.find(question => question.id === id)!;
  const evaluate = (step: GuideStep): EvaluatedStep => {
    const cached = states.get(step.id);
    if (cached) return cached;
    const result = (state: EvaluatedStep['state'], reasons: string[] = []): EvaluatedStep => {
      const entry = { step, state, reasons }; states.set(step.id, entry); return entry;
    };
    // Completed actions are observations of the past; later permission changes
    // do not erase them. Changing a branch answer explicitly resets observations.
    if (progress.completed.includes(step.id)) return result('done');
    if (step.branch) {
      const answer = progress.answers[step.branch.question];
      if (!question(step.branch.question).options.some(option => option.id === answer)) return result('question', [question(step.branch.question).prompt]);
      if (answer !== step.branch.answer) return result('skipped');
    }
    const pending = step.after.map(id => evaluate(byId.get(id)!)).filter(entry => entry.state !== 'done' && entry.state !== 'skipped');
    if (pending.length) return result('waiting', pending.map(entry => `Finish: ${entry.step.title}`));
    const blocked: string[] = [], unsupported: string[] = [], questions: string[] = [];
    const permission = (predicate: Parameters<typeof evaluatePredicate>[0]) => {
      const verdict = evaluatePredicate(predicate, { unlocks, gameModeId });
      if (verdict.status === 'LOCKED') blocked.push(...verdict.checks);
      else if (verdict.status !== 'READY') unsupported.push(...verdict.checks);
    };
    if (step.location) permission({ kind: 'location', label: step.location.label,
      areas: step.location.areas, chunks: [`${step.location.cx},${step.location.cy}`] });
    for (const requirement of step.requires) {
      if (requirement.kind === 'permission') permission(requirement.predicate);
      else if (requirement.kind === 'unreviewed') unsupported.push(requirement.reason);
      else if (requirement.kind === 'item') {
        if ((progress.inventory[requirement.id] ?? 0) < requirement.quantity) blocked.push(`Bring ${requirement.quantity} ${itemLabel(requirement.id)} (${progress.inventory[requirement.id] ?? 0} recorded).`);
      } else if (requirement.kind === 'answer') {
        const prompt = question(requirement.id);
        const answer = progress.answers[requirement.id];
        if (!prompt.options.some(option => option.id === answer)) questions.push(prompt.prompt);
        else if (answer !== requirement.value) blocked.push(`${prompt.prompt} — ${prompt.options.find(option => option.id === requirement.value)!.label}`);
      }
    }
    for (const [id, quantity] of Object.entries(step.consume ?? {})) {
      if ((progress.inventory[id] ?? 0) < quantity) blocked.push(`Bring ${quantity} ${itemLabel(id)} (${progress.inventory[id] ?? 0} recorded).`);
    }
    for (const [id, quantity] of Object.entries(step.produce ?? {})) {
      const remaining = (progress.inventory[id] ?? 0) - (step.consume?.[id] ?? 0);
      if (remaining >= 0 && !count(remaining + quantity)) unsupported.push(`Recorded quantity for ${itemLabel(id)} cannot be updated.`);
    }
    if (unsupported.length) return result('unsupported', [...new Set(unsupported)]);
    if (questions.length) return result('question', [...new Set(questions)]);
    if (blocked.length) return result('blocked', [...new Set(blocked)]);
    return result('available');
  };
  const steps = pack.steps.map(evaluate);
  const selected = steps.filter(entry => entry.state !== 'skipped');
  const next = steps.find(entry => entry.state === 'available') ?? steps.find(entry => entry.state === 'question')
    ?? steps.find(entry => entry.state !== 'done' && entry.state !== 'skipped');
  return { steps, next, complete: pack.coverage === 'complete' && selected.length > 0 && selected.every(entry => entry.state === 'done'), inventory: { ...progress.inventory } };
}

export function completeStep(pack: GuidePack, progress: GuideProgress, stepId: string, unlocks: UnlockState, gameModeId?: string): GuideProgress {
  const entry = evaluateGuide(pack, progress, unlocks, gameModeId).steps.find(entry => entry.step.id === stepId);
  if (entry?.state !== 'available') return progress;
  const inventory = { ...progress.inventory };
  for (const [id, quantity] of Object.entries(entry.step.consume ?? {})) inventory[id] = (inventory[id] ?? 0) - quantity;
  for (const [id, quantity] of Object.entries(entry.step.produce ?? {})) inventory[id] = (inventory[id] ?? 0) + quantity;
  return { ...progress, inventory, completed: [...progress.completed, stepId],
    history: [...progress.history, { stepId, inventory: { ...progress.inventory } }] };
}

export function undoStep(pack: GuidePack, progress: GuideProgress, stepId: string): GuideProgress {
  if (progress.version !== pack.version || !pack.steps.some(step => step.id === stepId)) return progress;
  const index = progress.history.findIndex(entry => entry.stepId === stepId);
  if (index < 0 || !progress.completed.includes(stepId)) return progress;
  const removed = new Set(progress.history.slice(index).map(entry => entry.stepId));
  return { ...progress, completed: progress.completed.filter(id => !removed.has(id)),
    inventory: { ...progress.history[index].inventory }, history: progress.history.slice(0, index) };
}

export function answerQuestion(pack: GuidePack, progress: GuideProgress, id: string, value: string): GuideProgress {
  if (progress.version !== pack.version || !pack.questions.some(question => question.id === id && question.options.some(option => option.id === value))) return progress;
  if (progress.answers[id] === value) return progress;
  if (!progress.completed.length && !progress.history.length) {
    return { ...progress, answers: { ...progress.answers, [id]: value } };
  }
  return { ...freshProgress(pack), answers: { ...progress.answers, [id]: value } };
}

export function setInventory(pack: GuidePack, progress: GuideProgress, id: string, quantity: number): GuideProgress {
  if (progress.version !== pack.version || !safeId(id) || !pack.items.some(item => item.id === id) || !count(quantity)) return progress;
  return { ...progress, inventory: { ...progress.inventory, [id]: quantity } };
}
