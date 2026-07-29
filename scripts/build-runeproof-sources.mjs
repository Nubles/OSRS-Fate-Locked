import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  computeRuneProofSourceVersion,
  generatedOutputMatches,
  renderRuneProofSourceDocument,
  writeGeneratedOutput,
} from './runeproof-source-generator.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'public', 'runeproof-sources.json');
const check = process.argv.includes('--check');

const [chunkDocument, chunkAudit, questAudit] = await Promise.all([
  readJson(resolve(root, 'public', 'chunk-content.json')),
  readJson(resolve(root, 'data', 'sources', 'chunk-content-transform-audit.json')),
  readJson(resolve(root, 'data', 'sources', 'quest-requirement-audit.json')),
]);

const vite = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

let compileAcquisitionSources;
let resourceMap;
try {
  ({ compileAcquisitionSources } = await vite.ssrLoadModule(
    '/utils/runeproof/acquisitionIndex.ts',
  ));
  ({ RESOURCE_MAP: resourceMap } = await vite.ssrLoadModule(
    '/data/resourceData.ts',
  ));
} finally {
  await vite.close();
}

const reviewedSources = Object.entries(resourceMap)
  .sort(([left], [right]) => compare(left, right))
  .flatMap(([output, sources]) => sources.map((source, index) => ({
    output,
    sourceKind: sourceKind(source),
    sourceHost: source.name,
    regions: [...source.regions].sort(compare),
    coverage: source.regions.includes('Any') ? 'UNKNOWN' : 'PARTIAL',
    provenanceIds: [
      `resource-map:${normalizeId(output)}-${shortHash(output)}:${String(index).padStart(4, '0')}`,
    ],
  })));

const sourceInputs = {
  chunkSourceMeta: chunkDocument.sourceMeta ?? null,
  chunkAcquisition: {
    locationNodes: chunkDocument.locationNodes ?? [],
    chunks: chunkDocument.chunks ?? {},
    shopItems: chunkDocument.shopItems ?? {},
    drops: chunkDocument.drops ?? {},
    taskUnlocks: chunkDocument.taskUnlocks ?? {},
  },
  chunkAudit,
  questAudit,
  productionRecipes: [],
  reviewedSources,
};
const sourceVersion = computeRuneProofSourceVersion(sourceInputs);

const document = compileAcquisitionSources({
  sourceVersion,
  sourceCommit: chunkDocument.sourceMeta?.commit ?? 'unknown',
  locationNodes: chunkDocument.locationNodes ?? [],
  chunks: chunkDocument.chunks ?? {},
  shopItems: chunkDocument.shopItems ?? {},
  drops: chunkDocument.drops ?? {},
  taskUnlocks: chunkDocument.taskUnlocks ?? {},
  questIds: (questAudit.entries ?? []).map(entry => entry.id),
  transformEvents: chunkAudit.events ?? [],
  // No checked-in recipe currently carries exact facility, repeatability, and
  // provenance together. Legacy recipes remain searchable below, unresolved.
  productionRecipes: [],
  reviewedSources,
});
const bytes = renderRuneProofSourceDocument(document);

if (check) {
  if (!await generatedOutputMatches(outputPath, bytes)) {
    console.error('public/runeproof-sources.json is stale; run npm run runeproof:sources');
    process.exitCode = 1;
  } else {
    console.log(summary('verified', document));
  }
} else {
  await writeGeneratedOutput(outputPath, bytes);
  console.log(summary('wrote', document));
}

function sourceKind(source) {
  switch (source.type) {
    case 'DROP': return 'DROP';
    case 'SHOP': return 'SHOP';
    case 'MERCHANT': return source.inputs ? 'PRODUCTION' : 'SHOP';
    case 'SPAWN': return 'SPAWN';
    case 'SKILL': return source.inputs ? 'PRODUCTION' : 'GATHERING';
    case 'MINIGAME': return 'MINIGAME';
    case 'QUEST': return 'QUEST_REWARD';
    case 'PICKPOCKET': return 'PICKPOCKET';
    case 'CLUE': return 'CLUE';
    default: throw new Error(`Unsupported Resource Engine source type: ${source.type}`);
  }
}

function summary(action, result) {
  return [
    `${action} RuneProof sources:`,
    `${result.rules.length} exact rules,`,
    `${result.unresolvedSources.length} unresolved legacy sources,`,
    `coverage ${result.acquisitionCoverage}`,
  ].join(' ');
}

function shortHash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 8);
}
function normalizeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
