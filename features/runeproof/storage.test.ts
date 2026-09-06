import { describe, expect, it } from 'vitest';
import type { GuidePack } from './model';
import { freshProgress, setInventory } from './engine';
import { GUIDE_PACKS } from './packs';
import { decodeGuide, guideKey, readGuide, validProgress, writeGuide, type GuideSave, type GuideStorage } from './storage';

const pack: GuidePack = {
  id: 'storage-test', version: 1, intro: 'Test', difficulty: 'Novice', coverage: 'complete',
  items: [{ id: 'item', label: 'Item', quantity: 1, note: '' }],
  questions: [{ id: 'route', prompt: 'Which route?', options: [{ id: 'north', label: 'North' }, { id: 'south', label: 'South' }] }],
  steps: [
    { id: 'first', title: 'First', text: 'First action', after: [], requires: [] },
    { id: 'later', title: 'Later', text: 'Later action', after: ['first'], requires: [] },
    { id: 'north', title: 'North', text: 'North action', after: ['first'], requires: [], branch: { question: 'route', answer: 'north' } },
  ], sources: [{ label: 'Reviewed source', path: 'source.java', revision: 'revision' }],
};
const envelope = (progress = freshProgress(pack)): GuideSave => ({ schema: 1, runId: 'run-a', questId: pack.id, packVersion: pack.version, revision: 1, progress });
const memoryStorage = () => {
  const values = new Map<string, string>();
  const storage: GuideStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  return { values, storage };
};

it('rejects imported handovers whose recorded inventory could not supply the items', () => {
  const cook = GUIDE_PACKS.find(guide => guide.id === "Cook's Assistant")!;
  const progress = {...freshProgress(cook), completed: ['help-cook', 'deliver-ingredients'], history: [
    {stepId: 'help-cook', inventory: {}}, {stepId: 'deliver-ingredients', inventory: {}},
  ]};
  expect(validProgress(progress, cook)).toBe(false);
  expect(validProgress({...progress, history: [progress.history[0], {stepId: 'deliver-ingredients', inventory: {
    egg: 1, 'bucket-of-milk': 1, 'pot-of-flour': 1,
  }}]}, cook)).toBe(true);
});

describe('RuneProof guide storage', () => {
  it('rejects an oversized valid history before changing either primary or backup', () => {
    const longPack: GuidePack = {
      ...pack,
      items: Array.from({ length: 50 }, (_, index) => ({ id: `supply-${index}`, label: `Supply ${index}`, quantity: 1, note: '' })),
      questions: [],
      steps: Array.from({ length: 1000 }, (_, index) => ({
        id: `step-${index}`, title: `Step ${index}`, text: 'Recorded action',
        after: index ? [`step-${index - 1}`] : [], requires: [],
      })),
    };
    const { storage, values } = memoryStorage();
    const first = writeGuide(storage, readGuide(storage, 'run-a', longPack), freshProgress(longPack), longPack);
    const previous = writeGuide(storage, first, setInventory(longPack, first.save.progress, 'supply-0', 1), longPack);
    const before = new Map(values);
    const inventory = Object.fromEntries(longPack.items.map(item => [item.id, 100]));
    const oversized = {
      ...freshProgress(longPack), inventory,
      completed: longPack.steps.map(step => step.id),
      history: longPack.steps.map(step => ({ stepId: step.id, inventory: { ...inventory } })),
    };
    expect(validProgress(oversized, longPack)).toBe(true);
    const token = JSON.stringify({ ...previous.save, progress: oversized });
    expect(token.length).toBeGreaterThan(500000);
    expect(decodeGuide(token, longPack, 'run-a')).toBeNull();
    const writes: string[] = [];
    const observed: GuideStorage = {
      getItem: storage.getItem,
      setItem: (key, value) => { writes.push(key); storage.setItem(key, value); },
    };
    expect(() => writeGuide(observed, previous, oversized, longPack)).toThrow('too large');
    expect(writes).toEqual([]);
    expect(values).toEqual(before);
    expect(readGuide(storage, 'run-a', longPack)).toEqual(previous);
    expect(previous.save.progress.completed).toEqual([]);
  });

  it('round trips an isolated run save and does not load another run', () => {
    const { storage } = memoryStorage();
    const initial = readGuide(storage, 'run-a', pack);
    const progress = setInventory(pack, initial.save.progress, 'item', 3);
    const saved = writeGuide(storage, initial, progress, pack);
    expect(saved.save.revision).toBe(1);
    expect(readGuide(storage, 'run-a', pack)).toEqual(saved);
    expect(readGuide(storage, 'run-b', pack).save.progress).toEqual(freshProgress(pack));
    expect(guideKey('a:b', 'c')).not.toBe(guideKey('a', 'b:c'));
  });

  it('rejects mismatched run, quest, schema, pack version and progress version', () => {
    const original = envelope();
    for (const changed of [
      { ...original, runId: 'run-b' }, { ...original, questId: 'other' }, { ...original, schema: 2 },
      { ...original, packVersion: 2 }, { ...original, progress: { ...original.progress, version: 2 } },
      { ...original, revision: -1 }, { ...original, revision: 0.5 },
    ]) expect(decodeGuide(JSON.stringify(changed), pack, 'run-a')).toBeNull();
    expect(decodeGuide('{', pack, 'run-a')).toBeNull();
  });

  it('does not report a saved change when quota prevents the primary write', () => {
    const { storage, values } = memoryStorage();
    const initial = readGuide(storage, 'run-a', pack);
    const failing: GuideStorage = { getItem: storage.getItem, setItem: () => { throw new Error('Quota exceeded'); } };
    expect(() => writeGuide(failing, initial, setInventory(pack, initial.save.progress, 'item', 1), pack)).toThrow('Quota');
    expect(values.size).toBe(0);
    expect(initial.save.progress.inventory).toEqual({});
  });

  it('detects silently dropped writes instead of returning a fake saved token', () => {
    const dropping: GuideStorage = { getItem: () => null, setItem: () => {} };
    const initial = readGuide(dropping, 'run-a', pack);
    expect(() => writeGuide(dropping, initial, setInventory(pack, initial.save.progress, 'item', 1), pack)).toThrow('verification');
  });

  it('recovers valid backup data from a corrupt primary and can save the recovered state', () => {
    const { storage, values } = memoryStorage();
    const key = guideKey('run-a', pack.id);
    const backup = envelope(setInventory(pack, freshProgress(pack), 'item', 4));
    values.set(key, '{bad'); values.set(`${key}:backup`, JSON.stringify(backup));
    const recovered = readGuide(storage, 'run-a', pack);
    expect(recovered.save).toEqual(backup);
    expect(recovered.warning).toContain('Recovered');
    expect(recovered.token).toBe('{bad');
    expect(recovered.blocked).not.toBe(true);
    const saved = writeGuide(storage, recovered, setInventory(pack, recovered.save.progress, 'item', 5), pack);
    expect(readGuide(storage, 'run-a', pack).save).toEqual(saved.save);
  });

  it('blocks unreadable or inaccessible storage from silently overwriting saves', () => {
    const { storage, values } = memoryStorage();
    values.set(guideKey('run-a', pack.id), 'invalid');
    const corrupt = readGuide(storage, 'run-a', pack);
    expect(corrupt.blocked).toBe(true);
    expect(() => writeGuide(storage, corrupt, freshProgress(pack), pack)).toThrow('recovery');
    const unavailable: GuideStorage = { getItem: () => { throw new Error('Denied'); }, setItem: () => {} };
    expect(readGuide(unavailable, 'run-a', pack).blocked).toBe(true);
  });

  it('rejects a stale tab writer without replacing the newer save', () => {
    const { storage } = memoryStorage();
    const first = readGuide(storage, 'run-a', pack), second = readGuide(storage, 'run-a', pack);
    const saved = writeGuide(storage, first, setInventory(pack, first.save.progress, 'item', 2), pack);
    expect(() => writeGuide(storage, second, setInventory(pack, second.save.progress, 'item', 9), pack)).toThrow('another tab');
    expect(readGuide(storage, 'run-a', pack)).toEqual(saved);
  });

  it('rejects invalid imported completed IDs, history snapshots and inventory counts', () => {
    const initial = freshProgress(pack);
    const invalid: unknown[] = [
      { ...initial, completed: ['missing'], history: [{ stepId: 'missing', inventory: {} }] },
      { ...initial, completed: ['first', 'first'], history: [{ stepId: 'first', inventory: {} }, { stepId: 'first', inventory: {} }] },
      { ...initial, completed: ['first'], history: [] },
      { ...initial, completed: ['first'], history: [{ stepId: 'later', inventory: {} }] },
      { ...initial, completed: ['first'], history: [{ stepId: 'first', inventory: { item: -1 } }] },
      { ...initial, inventory: { item: -1 } }, { ...initial, inventory: { item: 0.5 } },
      { ...initial, inventory: { item: Number.MAX_SAFE_INTEGER + 1 } }, { ...initial, inventory: { missing: 1 } },
      { ...initial, answers: { route: 'missing' } },
    ];
    for (const value of invalid) expect(validProgress(value, pack)).toBe(false);
  });

  it('agrees with the engine inventory ceiling without losing accepted observations', () => {
    const initial = freshProgress(pack);
    const progress = setInventory(pack, initial, 'item', 1000000);
    expect(progress.inventory.item).toBe(1000000);
    expect(validProgress(progress, pack)).toBe(true);
    expect(setInventory(pack, initial, 'item', 1000001)).toBe(initial);
    expect(validProgress({ ...initial, inventory: { item: 1000001 } }, pack)).toBe(false);
  });

  it('rejects imports completing dependencies out of order or recording an unselected branch', () => {
    const initial = freshProgress(pack);
    expect(validProgress({ ...initial, completed: ['later'], history: [{ stepId: 'later', inventory: {} }] }, pack)).toBe(false);
    expect(validProgress({ ...initial, answers: { route: 'south' }, completed: ['first', 'north'],
      history: [{ stepId: 'first', inventory: {} }, { stepId: 'north', inventory: {} }] }, pack)).toBe(false);
  });

  it('refuses to write a different quest through a previous save handle', () => {
    const { storage } = memoryStorage();
    const previous = readGuide(storage, 'run-a', pack);
    const otherPack = { ...pack, id: 'other-guide' };
    expect(() => writeGuide(storage, previous, freshProgress(otherPack), otherPack)).toThrow();
    expect(storage.getItem(guideKey('run-a', otherPack.id))).toBeNull();
  });

  it('rejects revision overflow before replacing an otherwise valid save', () => {
    const { storage, values } = memoryStorage();
    const key = guideKey('run-a', pack.id);
    const token = JSON.stringify({ ...envelope(), revision: Number.MAX_SAFE_INTEGER });
    values.set(key, token);
    const loaded = readGuide(storage, 'run-a', pack);
    expect(loaded.blocked).not.toBe(true);
    expect(() => writeGuide(storage, loaded, setInventory(pack, loaded.save.progress, 'item', 1), pack)).toThrow();
    expect(storage.getItem(key)).toBe(token);
  });
});

