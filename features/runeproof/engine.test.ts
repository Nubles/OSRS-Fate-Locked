import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../../types';
import type { GuidePack, GuideStep } from './model';
import { answerQuestion, completeStep, evaluateGuide, freshProgress, setInventory, undoStep, validatePack } from './engine';

const unlocks = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [], arcana: [], housing: [],
  merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {}, ...overrides,
});
const step = (id: string, changes: Partial<GuideStep> = {}): GuideStep => ({ id, title: id, text: `Do ${id}.`, after: [], requires: [], ...changes });
const pack = (steps: GuideStep[], changes: Partial<GuidePack> = {}): GuidePack => ({
  id: 'test-guide', version: 1, intro: 'Test guide', difficulty: 'Novice', coverage: 'complete',
  items: [{ id: 'flour', label: 'Flour', quantity: 1, note: '' }, { id: 'cake', label: 'Cake', quantity: 1, note: '' }],
  questions: [], steps, sources: [{ label: 'Reviewed source', path: 'source.java', revision: 'revision' }], ...changes,
});

describe('RuneProof guide engine', () => {
  it('rejects unfamiliar imported requirement types instead of silently passing them', () => {
    const guide = pack([step('new-source-action')]);
    guide.steps[0].requires = [{ kind: 'future-source-gate' }] as unknown as GuideStep['requires'];
    expect(validatePack(guide)).toContain('Step new-source-action has an unsupported requirement type.');
    const progress = freshProgress(guide);
    expect(evaluateGuide(guide, progress, unlocks()).steps[0].state).toBe('unsupported');
    expect(completeStep(guide, progress, 'new-source-action', unlocks())).toBe(progress);
  });
  it('starts without assuming checklist items are held and blocks missing consume effects', () => {
    const guide = pack([step('bake', { consume: { flour: 1 }, produce: { cake: 1 } })]);
    const progress = freshProgress(guide);
    expect(progress.inventory).toEqual({});
    expect(evaluateGuide(guide, progress, unlocks()).steps[0]).toMatchObject({ state: 'blocked', reasons: ['Bring 1 Flour (0 recorded).'] });
    expect(completeStep(guide, progress, 'bake', unlocks())).toBe(progress);
    const reuse = pack([step('reuse', { consume: { flour: 2 }, produce: { flour: 1 } })]);
    expect(evaluateGuide(reuse, freshProgress(reuse), unlocks()).steps[0].state).toBe('blocked');
  });

  it('applies observed inventory effects and rewinds later actions with their inventory', () => {
    const guide = pack([step('bake', { consume: { flour: 1 }, produce: { cake: 1 } }), step('deliver', { after: ['bake'], consume: { cake: 1 } })]);
    const initial = setInventory(guide, freshProgress(guide), 'flour', 2);
    const baked = completeStep(guide, initial, 'bake', unlocks());
    const delivered = completeStep(guide, baked, 'deliver', unlocks());
    expect(delivered.inventory).toEqual({ flour: 1, cake: 0 });
    expect(evaluateGuide(guide, delivered, unlocks()).complete).toBe(true);
    expect(undoStep(guide, delivered, 'deliver')).toEqual(baked);
    expect(undoStep(guide, delivered, 'bake')).toEqual(initial);
    expect(initial.inventory).toEqual({ flour: 2 });
  });

  it('keeps entire branches separate, asks before choosing and allows explicit branch skips at a merge', () => {
    const guide = pack([
      step('north', { branch: { question: 'route', answer: 'north' }, produce: { cake: 1 } }),
      step('south', { branch: { question: 'route', answer: 'south' } }),
      step('merge', { after: ['north', 'south'] }),
    ], { questions: [{ id: 'route', prompt: 'Which route?', options: [{ id: 'north', label: 'North' }, { id: 'south', label: 'South' }] }] });
    const initial = freshProgress(guide);
    expect(evaluateGuide(guide, initial, unlocks()).steps.map(entry => entry.state)).toEqual(['question', 'question', 'waiting']);
    let progress = answerQuestion(guide, initial, 'route', 'north');
    expect(evaluateGuide(guide, progress, unlocks()).steps.map(entry => entry.state)).toEqual(['available', 'skipped', 'waiting']);
    progress = completeStep(guide, progress, 'north', unlocks());
    progress = completeStep(guide, progress, 'merge', unlocks());
    expect(evaluateGuide(guide, progress, unlocks()).complete).toBe(true);
    expect(completeStep(guide, progress, 'south', unlocks())).toBe(progress);
    const changed = answerQuestion(guide, progress, 'route', 'south');
    expect(changed).toEqual({ ...freshProgress(guide), answers: { route: 'south' } });
    expect(answerQuestion(guide, changed, 'route', 'invalid')).toBe(changed);
  });

  it('never treats an unreviewed or unknown permission step as a skipped dependency', () => {
    const guide = pack([
      step('unknown', { requires: [{ kind: 'permission', predicate: { kind: 'unknown', key: 'route', label: 'Route not reviewed' } }] }),
      step('later', { after: ['unknown'] }),
    ]);
    const progress = freshProgress(guide);
    expect(evaluateGuide(guide, progress, unlocks()).steps.map(entry => entry.state)).toEqual(['unsupported', 'waiting']);
    expect(completeStep(guide, progress, 'later', unlocks())).toBe(progress);
  });

  it('uses actual skill levels independently of unlocked method tiers', () => {
    const guide = pack([
      step('level', { requires: [{ kind: 'permission', predicate: { kind: 'skill', skill: 'Cooking', level: 50 } }] }),
      step('method', { requires: [{ kind: 'permission', predicate: { kind: 'method', skill: 'Cooking', tier: 5 } }] }),
      step('invalid-method', { requires: [{ kind: 'permission', predicate: { kind: 'method', skill: 'Imaginary', tier: 5 } }] }),
    ]);
    expect(evaluateGuide(guide, freshProgress(guide), unlocks({ skills: { Cooking: 1 }, levels: { Cooking: 50 } })).steps.map(entry => entry.state))
      .toEqual(['available', 'blocked', 'unsupported']);
  });

  it('checks exact Chunked ownership while retaining Standard logical destination access', () => {
    const guide = pack([step('enter', { location: { label: 'Keldagrim entrance', cx: 42, cy: 58, areas: ['Keldagrim'] } })]);
    const state = unlocks({ regions: ['Keldagrim'], chunks: ['42,57'] });
    expect(evaluateGuide(guide, freshProgress(guide), state).steps[0].state).toBe('available');
    expect(evaluateGuide(guide, freshProgress(guide), state, 'chunked').steps[0].state).toBe('blocked');
    const completed = completeStep(guide, freshProgress(guide), 'enter', state);
    expect(evaluateGuide(guide, completed, unlocks()).steps[0].state).toBe('done');
    expect(state.quests).toEqual([]);
  });

  it('asks the specific authored question instead of passing an unanswered requirement', () => {
    const guide = pack([step('enter', { requires: [{ kind: 'answer', id: 'built', value: 'yes' }] })], {
      questions: [{ id: 'built', prompt: 'Have you built the boat?', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] }],
    });
    expect(evaluateGuide(guide, freshProgress(guide), unlocks()).steps[0]).toMatchObject({ state: 'question', reasons: ['Have you built the boat?'] });
  });

  it('does not claim partial coverage is a complete quest or accept invalid inventory quantities', () => {
    const guide = pack([step('first')], { coverage: 'partial', coverageNote: 'Only first step reviewed.' });
    const progress = freshProgress(guide);
    for (const value of [-1, 1.5, Infinity, NaN, 1000001, Number.MAX_SAFE_INTEGER + 1]) expect(setInventory(guide, progress, 'flour', value)).toBe(progress);
    expect(setInventory(guide, progress, 'flour', 1000000).inventory.flour).toBe(1000000);
    expect(setInventory(guide, progress, 'unlisted', 1)).toBe(progress);
    expect(evaluateGuide(guide, completeStep(guide, progress, 'first', unlocks()), unlocks()).complete).toBe(false);
  });

  it('prevents inventory overflow on completion', () => {
    const guide = pack([step('get', { produce: { cake: 1 } })]);
    const progress = setInventory(guide, freshProgress(guide), 'cake', 1000000);
    expect(completeStep(guide, progress, 'get', unlocks())).toBe(progress);
  });

  it('preserves prepared supplies when choosing a route before any observed action', () => {
    const guide = pack([step('north', { branch: { question: 'route', answer: 'north' } })], {
      questions: [{ id: 'route', prompt: 'Which route?', options: [{ id: 'north', label: 'North' }, { id: 'south', label: 'South' }] }],
    });
    const prepared = setInventory(guide, freshProgress(guide), 'flour', 20);
    const chosen = answerQuestion(guide, prepared, 'route', 'north');
    expect(chosen.inventory).toEqual({ flour: 20 });
    expect(answerQuestion(guide, chosen, 'route', 'south').inventory).toEqual({ flour: 20 });
    const done = completeStep(guide, chosen, 'north', unlocks());
    expect(answerQuestion(guide, done, 'route', 'south').inventory).toEqual({});
    expect(answerQuestion(guide, { ...chosen, history: [{ stepId: 'north', inventory: {} }] }, 'route', 'south').inventory).toEqual({});
  });

  it('validates dependency cycles, unknown references, effects, sources and branch answers', () => {
    expect(validatePack(pack([step('a')]))).toEqual([]);
    const invalid = pack([
      step('a', { after: ['b'], consume: { missing: 1 } }),
      step('b', { after: ['a'], branch: { question: 'absent', answer: 'no' }, produce: { cake: -1 } }),
      step('a', { after: ['missing'] }),
    ], { sources: [] });
    const errors = validatePack(invalid).join(' ');
    expect(errors).toContain('duplicate');
    expect(errors).toContain('dependencies');
    expect(errors).toContain('inventory effect');
    expect(errors).toContain('source');
    expect(errors).toContain('branch answer');
    const cycle = pack([step('a', { after: ['b'] }), step('b', { after: ['a'] })]);
    expect(validatePack(cycle)).toContain('Guide dependencies contain a cycle.');
    expect(evaluateGuide(cycle, freshProgress(cycle), unlocks()).steps.every(entry => entry.state === 'unsupported')).toBe(true);
  });
});
