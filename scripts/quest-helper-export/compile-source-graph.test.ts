import { describe, expect, it } from 'vitest';
import { compileHelper, compileSourceGuides } from './compile-source-graph.mjs';
import { evaluateSourceCondition } from '../../features/runeproof/sourceGraph';
import type { UnlockState } from '../../types';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseSourceGuide } from '../../features/runeproof/sourceGuide';

const ref = (id: string) => ({ $ref: id });
const node = (id: string, type: string, fields: Record<string, unknown>, extra = {}) => ({ id, type: `com.questhelper.${type}`, kind: type === 'PanelDetails' ? 'support' : type.endsWith('Step') ? 'step' : 'requirement', fields, ...extra });
const helper = (extraNodes: unknown[] = []) => ({ helperEnum: 'TEST', sourcePath: 'src/main/java/Quest.java', roots: [{ state: 0, node: ref('route') }], panels: [ref('panel')], diagnostics: [], nodes: [
  node('panel', 'PanelDetails', { 'PanelDetails.header': 'First section', 'PanelDetails.steps': [ref('action')] }),
  node('action', 'NpcStep', { 'QuestStep.text': ['Talk to the cook.'], 'QuestStep.choices': ref('choices'), 'QuestStep.substeps': [ref('child')], 'DetailedQuestStep.requirements': [ref('item')] }),
  node('child', 'NpcStep', { 'QuestStep.text': ['Choose the northern route.'] }),
  node('choices', 'DialogChoiceSteps', { 'DialogChoiceSteps.choices': [ref('choice')] }),
  node('choice', 'DialogChoiceStep', { 'WidgetChoiceStep.choice': 'Can I help?' }),
  node('item', 'ItemRequirement', { 'ItemRequirement.id': 1, 'ItemRequirement.quantity': 2, 'ItemRequirement.name': 'Flour' }),
  node('seen', 'DialogRequirement', { 'DialogRequirement.text': ['Thank you.'] }),
  node('route', 'ConditionalStep', {}, { conditionalEdges: { ordered: true, entries: [{ key: null, value: ref('child') }, { key: ref('seen'), value: ref('action') }] } }),
  ...extraNodes,
] });

describe('Quest Helper source compiler', () => {
  it('publishes a distinct, valid, content-addressed reference for all 210 catalogue entries', () => {
    const directory = path.resolve('public/runeproof/source-guides');
    const index = JSON.parse(fs.readFileSync(path.join(directory, 'index.json'), 'utf8'));
    expect(index.entries).toHaveLength(210);
    expect(new Set(index.entries.map((entry: any) => entry.questId)).size).toBe(210);
    for (const entry of index.entries) {
      const content = fs.readFileSync(path.join(directory, entry.file), 'utf8');
      expect(entry.file).toContain(createHash('sha256').update(content).digest('hex').slice(0, 12));
      expect(parseSourceGuide(JSON.parse(content), entry.questId), entry.questId).not.toBeNull();
    }
  });
  it('preserves actual panel and substep text, dialogue and quest-definition provenance', () => {
    const compiled = compileHelper(helper(), 'pinned');
    expect(compiled.sections[0]).toMatchObject({ title: 'First section', steps: [
      { text: ['Talk to the cook.'], dialogue: ['Can I help?'], sourcePath: 'src/main/java/Quest.java', role: 'main' },
      { text: ['Choose the northern route.'], role: 'related', parentId: 'TEST:action' },
    ] });
    expect(compiled.nodes.find((entry: any) => entry.id === 'route')).toMatchObject({ kind: 'conditional', branches: [{ condition: { kind: 'observation' }, nodeId: 'action' }], defaultNodeId: 'child' });
  });
  it('keeps main panel ordering separate from related source instructions', () => {
    const raw: any = helper([node('last', 'NpcStep', { 'QuestStep.text': ['Finish the quest.'] })]);
    raw.nodes.find((entry: any) => entry.id === 'panel').fields['PanelDetails.steps'].push(ref('last'));
    expect(compileHelper(raw, 'pinned').sections[0].steps.map((step: any) => [step.id, step.role])).toEqual([
      ['TEST:action', 'main'], ['TEST:last', 'main'], ['TEST:child', 'related'],
    ]);
    raw.helperEnum = 'SHIELD_OF_ARRAV_PHOENIX_GANG';
    expect(compileHelper(raw, 'pinned').sections[0].title).toBe('Phoenix Gang · First section');
  });
  it('links custom puzzle code and labels unavailable in-game overlays without inventing highlights', () => {
    const raw: any = helper([node('puzzle', 'helpers.quests.example.MapPuzzle', { 'QuestStep.text': ['Drag to swap the highlighted tiles.'] },
      { kind: 'step', sourcePath: 'src/main/java/com/questhelper/helpers/quests/example/MapPuzzle.java' })]);
    raw.nodes.find((entry: any) => entry.id === 'panel').fields['PanelDetails.steps'].push(ref('puzzle'));
    const steps = compileHelper(raw, 'pinned').sections[0].steps;
    expect(steps.find((step: any) => step.id === 'TEST:puzzle')).toMatchObject({
      text: ['Drag to swap the highlighted tiles.'], externalDependency: true,
      sourcePath: 'src/main/java/com/questhelper/helpers/quests/example/MapPuzzle.java', note: expect.stringContaining('do not reproduce'),
    });
    expect(steps.find((step: any) => step.id === 'TEST:action').externalDependency).toBeUndefined();
  });
  it('keeps all compiled actions permission-unreviewed and never infers inventory effects', () => {
    const compiled = compileHelper(helper(), 'pinned');
    const action = compiled.nodes.find((entry: any) => entry.id === 'action');
    expect(action.requires).toEqual([{ kind: 'unsupported', reason: expect.stringContaining('permissions') }]);
    expect(action.consume).toBeUndefined();
    expect(action.location).toBeUndefined();
  });
  it('interprets explicit item branch conditions without making display-highlight items prerequisites', () => {
    const raw: any = helper();
    raw.nodes.find((entry: any) => entry.id === 'route').conditionalEdges.entries[1].key = ref('item');
    const compiled = compileHelper(raw, 'pinned');
    expect(compiled.nodes.find((entry: any) => entry.id === 'route').branches[0].condition).toEqual({ kind: 'item', id: '1', quantity: 2, label: 'Flour' });
    expect(compiled.nodes.find((entry: any) => entry.id === 'action').requires.some((requirement: any) => requirement.kind === 'item')).toBe(false);
  });
  it('preserves NOR and exact boolean-count comparisons', () => {
    const raw = helper([node('logic', 'Conditions', { 'ConditionForStep.conditions': [ref('seen')], 'ConditionForStep.logicType': { name: 'NOR' } })]);
    (raw.nodes.find((entry: any) => entry.id === 'route') as any).conditionalEdges.entries[1].key = ref('logic');
    expect(compileHelper(raw, 'pinned').nodes.find((entry: any) => entry.id === 'route').branches[0].condition).toMatchObject({ kind: 'not', condition: { kind: 'any' } });
    const group: any = raw.nodes.find((entry: any) => entry.id === 'logic');
    group.fields['Conditions.operation'] = { name: 'EQUAL' };
    group.fields['Conditions.quantity'] = 0;
    const condition = compileHelper(raw, 'pinned').nodes.find((entry: any) => entry.id === 'route').branches[0].condition;
    const context = { unlocks: {} as UnlockState, inventory: {}, observations: { 'TEST:seen': false } };
    expect(evaluateSourceCondition(condition, context).state).toBe('met');
    expect(evaluateSourceCondition(condition, { ...context, observations: {} }).state).toBe('unknown');
  });
  it('does not turn remembered state, unsupported item alternatives or step locks into passable conditions', () => {
    const raw: any = helper();
    raw.nodes.find((entry: any) => entry.id === 'item').fields['ItemRequirement.alternateItems'] = [2];
    raw.nodes.find((entry: any) => entry.id === 'action').fields['QuestStep.lockingCondition'] = ref('seen');
    const compiled = compileHelper(raw, 'pinned');
    expect(compiled.nodes.find((entry: any) => entry.id === 'route').branches[0].condition.kind).toBe('unsupported');
    expect(compiled.nodes.find((entry: any) => entry.id === 'action').requires[0].kind).toBe('unsupported');
  });
  it('reports missing panel references and never presents empty generated instructions', () => {
    const raw: any = helper([node('empty', 'NpcStep', { 'QuestStep.text': [''] })]);
    raw.panels.push(ref('missing'));
    const compiled = compileHelper(raw, 'pinned');
    expect(compiled.diagnostics).toContain('Missing panel missing');
    expect(compiled.sections.flatMap((section: any) => section.steps).some((step: any) => step.id === 'TEST:empty')).toBe(false);
    expect(compiled.nodes.find((entry: any) => entry.id === 'empty').kind).toBe('conditional');
  });
  it('joins multiple helpers under one catalogue quest and declares reference-only coverage', () => {
    const raw = { formatVersion: 1, helperRevision: 'pinned', catalog: [{ id: 'Quest', helpers: [{ enum: 'TEST', sourcePath: 'src/main/java/Quest.java' }] }], helperGraphs: [helper()] };
    expect(compileSourceGuides(raw).guides[0]).toMatchObject({ questId: 'Quest', revision: 'pinned', instructionCoverage: 'source-reference', permissionCoverage: 'unreviewed' });
  });
});
