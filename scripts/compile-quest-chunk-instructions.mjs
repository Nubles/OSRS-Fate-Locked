import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
const root = path.resolve(import.meta.dirname, '..');
const graph = JSON.parse(gunzipSync(fs.readFileSync(path.join(root, 'data/sources/runeproof-helper-graph.json.gz'))));
const helpers = new Map(graph.helperGraphs.map(helper => [helper.helperEnum, helper]));
const directory = path.join(root, 'public/runeproof/chunk-instructions');
if (!process.argv.includes('--check')) fs.mkdirSync(directory, { recursive: true });
const seen = new Set();
for (const quest of graph.catalog) {
  const file = quest.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';
  if (seen.has(file)) throw new Error('Duplicate instruction filename');
  seen.add(file);
  const chunks = {}, sources = [];
  for (const mapping of quest.helpers) {
    const helper = helpers.get(mapping.enum);
    if (!helper) continue;
    sources.push(mapping.sourcePath);
    const nodes = new Map(helper.nodes.map(node => [node.id, node]));
    for (const node of helper.nodes) {
      if (node.kind !== 'step') continue;
      const fields = node.fields ?? {};
      const point = nodes.get(fields['DetailedQuestStep.definedPoint']?.$ref)?.fields?.['DefinedPoint.worldPoint'];
      const texts = fields['QuestStep.text'];
      // Do not project dungeon/instance coordinates onto an invented surface entrance.
      if (!point || !Number.isInteger(point.x) || !Number.isInteger(point.y) || point.x < 960 || point.x >= 4032 || point.y < 2048 || point.y >= 4224 || !Array.isArray(texts)) continue;
      const key = `${Math.floor(point.x / 64)},${Math.floor(point.y / 64)}`;
      chunks[key] ??= [];
      for (const text of texts) if (typeof text === 'string' && text.trim() && !chunks[key].includes(text)) chunks[key].push(text);
    }
  }
  const output = JSON.stringify({ questId: quest.id, revision: graph.helperRevision, sources, chunks }) + '\n';
  const target = path.join(directory, file);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error(`Stale chunk instructions: ${quest.id}`);
  } else fs.writeFileSync(target, output);
}
console.log(`Verified chunk instruction files for ${seen.size} quests`);
