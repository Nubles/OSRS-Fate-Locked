import { describe, expect, it } from 'vitest';
import { compileItemClauses, extractHelperItemIdentities } from '../../scripts/compile-runeproof-item-clauses.mjs';
import { classifyQuestItems } from '../../scripts/quest-operational-source.mjs';
import { getSourceClauseInterpretation } from './sourceClauses';
import source from '../../data/sources/quest-operational-items.json';
import reviews from '../../data/sources/runeproof-item-clause-reviews.json';

const known = new Set(['egg', 'bucket of milk', 'pot of flour', 'yellow dye', 'onion', 'coins']);
function fixture(raw: string) {
  return compileItemClauses({ entries: { Example: { ...classifyQuestItems(`{{Quest details|items=${raw}}}`), source: { page: 'Example', revisionId: 123, revisionTimestamp: '2026-09-05T00:00:00Z' } } } }, known).entries.Example;
}
describe('source clause interpretations', () => {
  it('preserves canonical linked item names and explicit quantities behind display plurals', () => {
    const row = fixture('* 25 [[egg|eggs]]')[0];
    expect(row).toMatchObject({ label: '25 eggs', structure: 'single', routes: [{ items: [{ name: 'egg', quantity: 25 }] }] });
    expect(row.source.revisionId).toBe(123);
    expect(fixture('* [[coins]]')[0].references[0].quantity).toBeNull();
    expect(fixture('* A [[egg]]')[0].references[0].quantity).toBe(1);
    expect(fixture('* 3 unnoted [[egg]]s')[0]).toMatchObject({ structure: 'single', references: [{ quantity: 3 }] });
  });
  it('preserves whole homogeneous choices and bundles but never splits mixed alternatives', () => {
    expect(fixture('* [[Egg]] or [[Bucket of milk]]')[0]).toMatchObject({ structure: 'choice', routes: [{ items: [{ name: 'Egg' }] }, { items: [{ name: 'Bucket of milk' }] }] });
    expect(fixture('* [[Egg]] and [[Bucket of milk]]')[0]).toMatchObject({ structure: 'bundle', routes: [{ items: [{ name: 'Egg' }, { name: 'Bucket of milk' }] }] });
    const mixed = fixture('* [[Yellow dye]] or 2 [[onion]] and 5 [[coins]]')[0];
    expect(mixed.structure).toBe('unreviewed');
    expect(mixed.routes).toEqual([]);
    expect(mixed.references).toHaveLength(3);
  });
  it('keeps acquisition qualifiers and conditional quantities as evidence', () => {
    expect(fixture('* [[Egg]] (obtainable during the quest)')[0]).toMatchObject({ structure: 'single', references: [{ availability: 'quest-available' }] });
    const conditional = fixture('* 2 or 4 [[egg|eggs]] (4 if taking the alternative route)')[0];
    expect(conditional.structure).toBe('unreviewed');
    expect(conditional.references[0].availability).toBe('conditional');
    expect(conditional.references[0].quantity).toBeNull();
  });
  it('does not promote linked NPCs, skills or item classes into an item route', () => {
    const row = fixture('* [[Magic]]')[0];
    expect(row).toMatchObject({ structure: 'unreviewed', routes: [], references: [{ name: 'Magic', quantity: null }] });
  });
  it('aligns headings and nested source links with the exact canonical clause', () => {
    const rows = fixture('* [[Egg]]\n** A [[pot of flour]] if preparing food\nObtainable during quest:\n* [[Bucket of milk]]');
    expect(rows[0].references.map((item: any) => item.name)).toEqual(['Egg', 'pot of flour']);
    expect(rows[1].references.map((item: any) => item.name)).toEqual(['Bucket of milk']);
    expect(rows[1].references[0].availability).toBe('quest-available');
    const repeated = fixture('* [[Egg|Item]]\n* [[coins|Item]]');
    expect(repeated[0].references[0].name).toBe('Egg');
    expect(repeated[1].references[0].name).toBe('coins');
  });
  it('invalidates lookups when label or identity changes', () => {
    const label = source.entries["Cook's Assistant"].checks[0].label;
    expect(getSourceClauseInterpretation("Cook's Assistant", 0, label)?.references[0].name.toLowerCase()).toBe('egg');
    expect(getSourceClauseInterpretation("Cook's Assistant", 0, `${label} changed`)).toBeNull();
    expect(getSourceClauseInterpretation('__proto__', 0, label)).toBeNull();
    expect(getSourceClauseInterpretation("Cook's Assistant", -1, label)).toBeNull();
  });
  it('covers every current clause without declaring complete legality or losing source revision', () => {
    for (const [questId, row] of Object.entries(source.entries)) for (const [index, check] of row.checks.entries()) {
      const interpreted = getSourceClauseInterpretation(questId, index, check.label);
      expect(interpreted, `${questId}:${index}`).not.toBeNull();
      expect(interpreted!.source.revisionId).toBe(row.source.revisionId);
      expect(interpreted!.unresolved.length).toBeGreaterThan(0);
    }
  });
  it('pins reviewed alternatives to both their entire clause and source revision', () => {
    expect(() => compileItemClauses(source, known, reviews.reviews)).not.toThrow();
    expect(() => compileItemClauses(source, known, [{ ...reviews.reviews[0], label: 'changed' }])).toThrow('Stale');
    expect(() => compileItemClauses(source, known, [{ ...reviews.reviews[0], revisionId: 1 }])).toThrow('Stale');
  });
  it('keeps reviewed whole item substitutions separate and never substitutes an empty pot for flour', () => {
    const tools = getSourceClauseInterpretation('Tower of Life', 0, source.entries['Tower of Life'].checks[0].label)!;
    expect(tools.structure).toBe('choice');
    expect(tools.routes.map(route => route.items.map(item => item.name))).toEqual([['Hammer'], ['Imcando hammer']]);
    const flour = getSourceClauseInterpretation("Cook's Assistant", 2, source.entries["Cook's Assistant"].checks[2].label)!;
    expect(flour.structure).toBe('unreviewed');
    expect(flour.routes).toEqual([]);
  });
  it('accepts only same-quest single item IDs as helper identity evidence', () => {
    const item = (name: string, id: number, alternatives: number[] = []) => ({ id: name + id, type: 'com.questhelper.requirements.item.ItemRequirement', fields: {
      'ItemRequirement.name': name, 'ItemRequirement.id': id, 'ItemRequirement.alternateItems': alternatives,
    } });
    const evidence = extractHelperItemIdentities({ helperRevision: 'pinned', catalog: [{ id: 'Example', helpers: [{ enum: 'EXAMPLE', sourcePath: 'Quest.java' }] }, { id: 'Other', helpers: [] }],
      helperGraphs: [{ helperEnum: 'EXAMPLE', nodes: [item('Ghostspeak amulet', 552), item('Pickaxe', 1265, [1267]), item('Ambiguous', 1), item('Ambiguous', 2)] }] });
    expect(evidence.Example['ghostspeak amulet']).toMatchObject({ itemId: 552, revision: 'pinned' });
    expect(evidence.Example.pickaxe).toBeUndefined();
    expect(evidence.Example.ambiguous).toBeUndefined();
    expect(evidence.Other).toEqual({});
    const raw = '* [[Ghostspeak amulet]]';
    const result = compileItemClauses({ entries: { Example: { ...classifyQuestItems(`{{Quest details|items=${raw}}}`), source: { revisionId: 123 } } } }, new Set(), [], evidence).entries.Example[0];
    expect(result).toMatchObject({ structure: 'single', references: [{ kind: 'item', identityEvidence: { itemId: 552 } }] });
  });
  it('gives specific reasons for variable quantities, assigned supplies and acquisition actions', () => {
    const row = fixture('* 2 or 4 [[egg|eggs]], randomly assigned; buy them if needed')[0];
    expect(row.unresolved.join(' ')).toContain('random assignment');
    expect(row.unresolved.join(' ')).toContain('quantity is variable');
    expect(row.unresolved.join(' ')).toContain('Acquisition or transformation');
  });
});
