import { describe, expect, it } from 'vitest';
import type { EvaluatedStep, GuideEvaluation } from './model';
import { applyGuideTravel } from './travel';

const destination = (state: EvaluatedStep['state'] = 'available'): EvaluatedStep => ({
  step: { id: 'tower', title: 'Visit the tower', text: 'Speak to the wizard.', after: [], requires: [],
    location: { label: "Wizards' Tower", cx: 48, cy: 49, areas: ["Wizards' Tower"] } },
  state, reasons: state === 'blocked' ? ['Unlock the destination.'] : [],
});
const evaluation = (entries: EvaluatedStep[] = [destination()]): GuideEvaluation => ({
  steps: entries, next: entries[0], complete: false, inventory: { 'air-talisman': 1 },
});

describe('RuneProof travel adapter', () => {
  it('does not mistake an owned but stranded destination for an established route', () => {
    const original = evaluation();
    const result = applyGuideTravel(original, 'chunked', new Set(['48,49']));
    expect(result.steps[0]).toMatchObject({ state: 'unsupported', reasons: ["A route to Wizards' Tower has not been established with your current unlocks."] });
    expect(result.next).toBe(result.steps[0]);
    expect(result.complete).toBe(false);
    expect(original.steps[0].state).toBe('available');
  });

  it('allows a destination established by numeric region ID', () => {
    const original = evaluation();
    const result = applyGuideTravel(original, 'chunked', new Set([String(48 * 256 + 49)]));
    expect(result.next?.state).toBe('available');
    expect(result.steps[0]).toBe(original.steps[0]);
    expect(result.inventory).toBe(original.inventory);
  });

  it('waits for the travel graph and retains known blockers', () => {
    const blocked = destination('blocked');
    const result = applyGuideTravel(evaluation([destination(), blocked]), 'chunked', null);
    expect(result.steps[0]).toMatchObject({ state: 'unsupported', reasons: ['Checking the route to this destination.'] });
    expect(result.steps[1]).toBe(blocked);
  });

  it('chooses another available action before an unresolved travel step', () => {
    const local: EvaluatedStep = { ...destination(), step: { id: 'pack', title: 'Pack', text: 'Prepare supplies.', after: [], requires: [] } };
    const result = applyGuideTravel(evaluation([destination(), local]), 'chunked', new Set());
    expect(result.next).toBe(local);
  });

  it('preserves historical completion and every nonavailable state', () => {
    const states = ['done', 'waiting', 'blocked', 'question', 'unsupported', 'skipped'] as const;
    const original = evaluation(states.map(destination));
    const result = applyGuideTravel(original, 'chunked', null);
    result.steps.forEach((entry, index) => expect(entry).toBe(original.steps[index]));
    expect(result.next?.state).toBe('question');
    const completed = { ...evaluation([destination('done')]), next: undefined, complete: true };
    expect(applyGuideTravel(completed, 'chunked', null)).toMatchObject({ complete: true, next: undefined });
  });

  it.each([undefined, 'standard', 'xtreme'])('leaves %s mode unchanged', mode => {
    const original = evaluation();
    expect(applyGuideTravel(original, mode, null)).toBe(original);
  });
});
