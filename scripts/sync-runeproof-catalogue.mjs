#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { generateRuneProofCatalogue, stableJson } from './runeproof-catalogue-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUEST_LIST_PATH = resolve(ROOT, 'data', 'sources', 'quest-list.json');
const AUDIT_PATH = resolve(ROOT, 'data', 'sources', 'quest-requirement-audit.json');
const F2P_PATH = resolve(ROOT, 'data', 'sources', 'f2p-quest-membership.json');
const OVERRIDES_PATH = resolve(ROOT, 'data', 'sources', 'runeproof-complexity-overrides.json');
const QUEST_DATA_PATH = resolve(ROOT, 'data', 'questData.ts');
const OUTPUT_PATH = resolve(ROOT, 'data', 'sources', 'runeproof-quest-catalogue.json');

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

const readRuntimeQuestData = () => {
  const source = readFileSync(QUEST_DATA_PATH, 'utf8').replace(
    /import\s+\{\s*DropSource\s*\}\s+from\s+['"]\.\.\/types['"];?/,
    'const DropSource = new Proxy({}, { get: (_target, property) => String(property) });',
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: QUEST_DATA_PATH,
    reportDiagnostics: true,
  });
  const diagnostics = output.diagnostics ?? [];
  if (diagnostics.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
    throw new Error(`Unable to load questData.ts: ${diagnostics
      .map(diagnostic => diagnostic.messageText).join('; ')}`);
  }
  const module = { exports: {} };
  Function('exports', 'module', output.outputText)(module.exports, module);
  return module.exports.QUEST_DATA;
};

const output = generateRuneProofCatalogue({
  questList: readJson(QUEST_LIST_PATH),
  audit: readJson(AUDIT_PATH),
  f2p: readJson(F2P_PATH),
  overrides: readJson(OVERRIDES_PATH),
  questData: readRuntimeQuestData(),
});
const serialized = stableJson(output);

if (process.argv.includes('--check')) {
  const committed = readFileSync(OUTPUT_PATH, 'utf8').replace(/\r\n?/g, '\n');
  if (committed !== serialized.replace(/\r\n?/g, '\n')) {
    throw new Error('RuneProof catalogue is out of sync; run npm run runeproof:catalogue:sync');
  }
} else {
  writeFileSync(OUTPUT_PATH, serialized);
}
