import fs from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const strings = value => (Array.isArray(value) ? value : [value]).filter(value => typeof value === 'string' && value.trim()).map(value => value.trim());
const ref = value => value && typeof value.$ref === 'string' ? value.$ref : undefined;
const field = (node, key) => node?.fields?.[key];
const unsupported = reason => ({ kind: 'unsupported', reason });
const truth = value => value ? { kind: 'all', conditions: [] } : { kind: 'not', condition: { kind: 'all', conditions: [] } };
const sourceSlug = id => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Build-time evidence conversion. No retired RuneProof runtime dependency. */
export function compileHelper(helper, revision) {
  const nodes = new Map();
  const diagnostics = new Set(helper.diagnostics ?? []);
  for (const node of helper.nodes ?? []) {
    if (!node?.id || nodes.has(node.id)) throw new Error(`Duplicate/invalid source node in ${helper.helperEnum}`);
    nodes.set(node.id, node);
  }
  const resolve = value => nodes.get(ref(value));
  const active = new Set();
  const condition = reference => {
    const node = resolve(reference);
    if (!node) return unsupported('A source condition reference is missing.');
    if (active.has(node.id)) return unsupported('The source condition contains a cycle.');
    active.add(node.id);
    try {
      const type = node.type.split('.').pop();
      if (type === 'Conditions') {
        if (field(node, 'ConditionForStep.onlyNeedToPassOnce')) return unsupported('This source condition remembers an earlier event; a reviewed observation is needed.');
        const refs = field(node, 'ConditionForStep.conditions');
        if (!Array.isArray(refs)) return unsupported('The source boolean group is missing.');
        const conditions = refs.map(value => value === null ? truth(true) : condition(value));
        const operation = field(node, 'Conditions.operation')?.name;
        if (operation) {
          const count = field(node, 'Conditions.quantity');
          const operations = { EQUAL: (a, b) => a === b, NOT_EQUAL: (a, b) => a !== b, GREATER_EQUAL: (a, b) => a >= b, LESS_EQUAL: (a, b) => a <= b, GREATER: (a, b) => a > b, LESS: (a, b) => a < b };
          if (!operations[operation] || !Number.isSafeInteger(count) || conditions.length > 8) return unsupported(`Source count comparison ${operation} requires reviewed conversion.`);
          const matches = [];
          for (let mask = 0; mask < 2 ** conditions.length; mask++) {
            const passed = conditions.reduce((sum, _, index) => sum + ((mask >> index) & 1), 0);
            if (operations[operation](passed, count)) matches.push({ kind: 'all', conditions: conditions.map((child, index) => ((mask >> index) & 1) ? child : { kind: 'not', condition: child }) });
          }
          return matches.length ? { kind: 'any', conditions: matches } : truth(false);
        }
        const logic = field(node, 'ConditionForStep.logicType')?.name;
        if (!['AND', 'OR', 'NOR', 'NAND'].includes(logic)) return unsupported(`Unsupported source boolean logic: ${logic}.`);
        const inner = conditions.length ? { kind: ['AND', 'NAND'].includes(logic) ? 'all' : 'any', conditions } : truth(['AND', 'NAND'].includes(logic));
        return ['NOR', 'NAND'].includes(logic) ? { kind: 'not', condition: inner } : inner;
      }
      if (type === 'ItemRequirement') {
        const id = field(node, 'ItemRequirement.id'), quantity = field(node, 'ItemRequirement.quantity');
        if (!Number.isSafeInteger(id) || id < 0 || !Number.isSafeInteger(quantity) || quantity <= 0
          || field(node, 'ItemRequirement.alternateItems')?.length || field(node, 'ItemRequirement.additionalOptions')
          || field(node, 'ItemRequirement.mustBeEquipped') || field(node, 'ItemRequirement.mustBeUnequipped')
          || field(node, 'ItemRequirement.shouldCheckBank') || field(node, 'ItemRequirement.isChargedItem')) return unsupported(`Review the exact possession rule for ${field(node, 'ItemRequirement.name') || node.id}.`);
        return { kind: 'item', id: String(id), quantity, label: field(node, 'ItemRequirement.name') || String(id) };
      }
      if (type === 'DialogRequirement' && strings(field(node, 'DialogRequirement.text')).length) {
        return { kind: 'observation', id: `${helper.helperEnum}:${node.id}`, prompt: `${field(node, 'DialogRequirement.mustBeActive') ? 'Is this dialogue currently shown' : 'Have you seen this dialogue'}: ${strings(field(node, 'DialogRequirement.text')).join(' / ')}?` };
      }
      return unsupported(`Source ${type} (${node.id}) needs a reviewed game-state observation.`);
    } finally { active.delete(node.id); }
  };
  const dialogue = reference => {
    const output = [], visited = new Set();
    const visit = value => {
      const node = resolve(value);
      if (!node || visited.has(node.id)) return;
      visited.add(node.id);
      output.push(...strings(field(node, 'WidgetChoiceStep.choice')));
      for (const child of field(node, 'DialogChoiceSteps.choices') ?? []) visit(child);
    };
    visit(reference);
    return [...new Set(output)];
  };
  const textFor = node => [...new Set([...strings(field(node, 'QuestStep.text')), ...strings(field(node, 'QuestStep.overlayText'))])];
  const referenceStep = node => {
    const custom = node.type.startsWith('com.questhelper.helpers.');
    const overlay = /highlight|overlay|marked tile/i.test(textFor(node).join(' '));
    return { id: `${helper.helperEnum}:${node.id}`, text: textFor(node), dialogue: dialogue(field(node, 'QuestStep.choices')),
      sourcePath: custom && node.sourcePath ? node.sourcePath : helper.sourcePath,
      ...(custom ? { externalDependency: true, note: overlay
        ? 'This step uses Quest Helper’s in-game overlay; these notes do not reproduce its highlights.'
        : 'This step uses custom in-game quest logic. Consult the original guide for the current puzzle or quest state.' } : {}),
    };
  };
  const shown = new Set();
  const stepsFor = references => {
    const result = [], visited = new Set();
    const emit = (node, role, parentId) => {
      if (textFor(node).length) {
        result.push({ ...referenceStep(node), role, ...(parentId ? { parentId } : {}) }); shown.add(node.id);
      }
    };
    // Main panel entries retain source order. Their related instructions are not
    // inserted into that sequence or upgraded to additional mandatory actions.
    for (const reference of references) {
      const node = resolve(reference);
      if (node?.kind === 'step' && !visited.has(node.id)) { visited.add(node.id); emit(node, 'main'); }
    }
    const visit = (reference, parentId) => {
      const node = resolve(reference);
      if (!node) { diagnostics.add(`Missing panel/step reference: ${ref(reference) || 'unclassified'}`); return; }
      if (visited.has(node.id)) return;
      visited.add(node.id);
      if (node.kind !== 'step') return;
      emit(node, 'related', parentId);
      // This is reference presentation, explicitly not mandatory action ordering.
      for (const child of field(node, 'QuestStep.substeps') ?? []) visit(child, parentId);
      for (const edge of node.conditionalEdges?.entries ?? []) visit(edge.value, parentId);
    };
    for (const reference of references) {
      const node = resolve(reference);
      if (!node) { visit(reference); continue; }
      const parentId = textFor(node).length ? `${helper.helperEnum}:${node.id}` : undefined;
      for (const child of field(node, 'QuestStep.substeps') ?? []) visit(child, parentId);
      for (const edge of node.conditionalEdges?.entries ?? []) visit(edge.value, parentId);
    }
    return result;
  };
  const sections = [];
  for (const reference of helper.panels ?? []) {
    const panel = resolve(reference);
    if (!panel) { diagnostics.add(`Missing panel ${ref(reference)}`); continue; }
    const steps = stepsFor(field(panel, 'PanelDetails.steps') ?? []);
    const gang = helper.helperEnum.includes('SHIELD') ? helper.helperEnum.includes('PHOENIX') ? 'Phoenix Gang · ' : helper.helperEnum.includes('BLACK') ? 'Black Arm Gang · ' : '' : '';
    if (steps.length) sections.push({ id: `${helper.helperEnum}:${panel.id}`, title: `${gang}${field(panel, 'PanelDetails.header') || 'Quest instructions'}`, steps });
    else diagnostics.add(`Panel has no exported instruction text: ${panel.id}`);
  }
  const additional = [...nodes.values()].filter(node => node.kind === 'step' && !shown.has(node.id) && textFor(node).length).map(node => ({ ...referenceStep(node), role: 'related' }));
  if (additional.length) sections.push({ id: `${helper.helperEnum}:additional`, title: 'Additional source instructions and alternatives', steps: additional });
  const compiledNodes = [];
  for (const node of nodes.values()) {
    if (node.kind !== 'step') continue;
    if (node.conditionalEdges) {
      const edges = node.conditionalEdges;
      const children = (edges.entries ?? []).map(edge => resolve(edge.value));
      const hasLocks = children.some(child => field(child, 'QuestStep.lockingCondition') || field(child, 'QuestStep.blocker') || field(child, 'QuestStep.isLockable'));
      if (!edges.ordered || hasLocks) {
        compiledNodes.push({ kind: 'conditional', id: node.id, branches: [{ condition: unsupported(hasLocks ? 'Source route locking/blocker semantics require review.' : 'Source branch priority is unavailable.'), nodeId: node.id }] });
      } else {
        compiledNodes.push({ kind: 'conditional', id: node.id, branches: edges.entries.filter(edge => edge.key !== null).map(edge => ({ condition: condition(edge.key), nodeId: ref(edge.value) || 'missing-source-node' })),
          ...(edges.entries.some(edge => edge.key === null) ? { defaultNodeId: ref(edges.entries.find(edge => edge.key === null).value) || 'missing-source-node' } : {}) });
      }
    } else {
      const text = textFor(node);
      if (!text.length) {
        compiledNodes.push({ kind: 'conditional', id: node.id, branches: [{ condition: unsupported('This source step has no exported instructions.'), nodeId: node.id }] });
        continue;
      }
      compiledNodes.push({ kind: 'action', id: node.id, title: text[0], text: text.join('\n'),
        // DetailedQuestStep requirements also highlight acquired items (e.g. an
        // egg on the ground). They are not proven possession prerequisites.
        requires: [unsupported('Fate-Locked permissions and supply prerequisites for this source action have not been reviewed.')], permissions: [] });
    }
  }
  return { helperEnum: helper.helperEnum, revision, sections, diagnostics: [...diagnostics].sort(),
    nodes: compiledNodes, graphs: (helper.roots ?? []).map(root => ({ state: root.state, entryNodeId: ref(root.node) })) };
}

export function compileSourceGuides(raw) {
  if (raw.formatVersion !== 1 || !raw.helperRevision || !Array.isArray(raw.catalog) || !Array.isArray(raw.helperGraphs)) throw new Error('Unsupported source graph export.');
  const helpers = new Map(raw.helperGraphs.map(helper => [helper.helperEnum, helper]));
  const compiled = new Map([...helpers].map(([id, helper]) => [id, compileHelper(helper, raw.helperRevision)]));
  const guides = raw.catalog.filter(entry => entry.helpers.length).map(entry => {
    const sections = [], diagnostics = [...(entry.diagnostics ?? [])], sources = [];
    for (const mapping of entry.helpers) {
      const helper = compiled.get(mapping.enum);
      if (!helper) { diagnostics.push(`Missing helper export: ${mapping.enum}`); continue; }
      sections.push(...helper.sections);
      diagnostics.push(...helper.diagnostics);
      sources.push({ label: 'Quest Helper source', path: mapping.sourcePath, revision: raw.helperRevision });
    }
    if (!sections.length) diagnostics.push('No instruction text was exported; consult the pinned source.');
    return { questId: entry.id, revision: raw.helperRevision, instructionCoverage: 'source-reference', permissionCoverage: 'unreviewed', sections, diagnostics: [...new Set(diagnostics)].sort(), sources };
  });
  return { guides, compiled: [...compiled.values()].map(({ sections, ...helper }) => helper) };
}

export function writeSourceGuides(rawPath, publicDirectory, compiledPath, supplementalPath) {
  const input = fs.readFileSync(rawPath);
  const raw = JSON.parse((rawPath.endsWith('.gz') ? gunzipSync(input) : input).toString('utf8'));
  const output = compileSourceGuides(raw);
  if (supplementalPath && fs.existsSync(supplementalPath)) {
    const supplemental = JSON.parse(fs.readFileSync(supplementalPath, 'utf8'));
    for (const guide of Array.isArray(supplemental) ? supplemental : supplemental.guides) {
      if (!raw.catalog.some(entry => entry.id === guide.questId) || output.guides.some(entry => entry.questId === guide.questId)) throw new Error(`Invalid or duplicate supplementary guide: ${guide.questId}`);
      if (!guide.sections?.some(section => section.steps?.some(step => strings(step.text).length))) throw new Error(`Supplementary guide has no source instructions: ${guide.questId}`);
      output.guides.push(guide);
    }
  }
  fs.mkdirSync(publicDirectory, { recursive: true });
  const index = [], used = new Set();
  for (const guide of output.guides) {
    const slug = sourceSlug(guide.questId);
    if (!slug || used.has(slug)) throw new Error(`Duplicate quest source slug: ${slug}`);
    used.add(slug);
    const content = `${JSON.stringify(guide)}\n`;
    const file = `${slug}-${createHash('sha256').update(content).digest('hex').slice(0, 12)}.json`;
    fs.writeFileSync(path.join(publicDirectory, file), content);
    index.push({ questId: guide.questId, file, sectionCount: guide.sections.length, stepCount: guide.sections.reduce((sum, section) => sum + section.steps.length, 0), revision: guide.revision });
  }
  fs.writeFileSync(path.join(publicDirectory, 'index.json'), `${JSON.stringify({ entries: index }, null, 2)}\n`);
  const currentFiles = new Set(index.map(entry => entry.file));
  for (const file of fs.readdirSync(publicDirectory)) {
    // Remove only obsolete compiler-owned, content-addressed files in this directory.
    if (!/^[a-z0-9-]+-[a-f0-9]{12}\.json$/.test(file) || currentFiles.has(file)) continue;
    const target = path.resolve(publicDirectory, file);
    if (path.dirname(target) !== path.resolve(publicDirectory)) throw new Error('Invalid generated guide path.');
    fs.unlinkSync(target);
  }
  const compiledBytes = Buffer.from(`${JSON.stringify({ revision: raw.helperRevision, helpers: output.compiled })}\n`);
  fs.writeFileSync(compiledPath, compiledPath.endsWith('.gz') ? gzipSync(compiledBytes, { level: 9 }) : compiledBytes);
  return index;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const index = writeSourceGuides(path.join(root, 'data/sources/runeproof-helper-graph.json.gz'), path.join(root, 'public/runeproof/source-guides'), path.join(root, 'data/sources/runeproof-compiled-graphs.json.gz'), path.join(root, 'scripts/quest-helper-export/wiki-source-guides.json'));
  console.log(`Compiled ${index.length} quest source references with ${index.reduce((sum, entry) => sum + entry.stepCount, 0)} displayed instructions.`);
}
