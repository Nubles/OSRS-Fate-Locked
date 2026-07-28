#!/usr/bin/env node
/** Regenerate Chunk Picker runtime data only from the reviewed local source pin. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPinnedChunkSource } from './chunk-source.mjs';
import { assertChunkTransform, transformChunkContent } from './chunk-content-transform.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUTS = [
  [resolve(ROOT, 'public', 'chunk-content.json'), (result) => JSON.stringify(result.full)],
  [resolve(ROOT, 'data', 'chunkContentLite.ts'), (result) => result.liteSource],
  [resolve(ROOT, 'data', 'sources', 'chunk-content-transform-audit.json'), (result) => `${JSON.stringify(result.audit, null, 2)}\n`],
];

function expectedFiles(result) {
  return OUTPUTS.map(([path, serialize]) => [path, serialize(result)]);
}

function check(expected) {
  const stale = expected.filter(([path, bytes]) => !existsSync(path) || readFileSync(path, 'utf8') !== bytes).map(([path]) => path);
  if (stale.length) throw new Error(`Chunk content outputs are stale:\n${stale.map((path) => `  ${path}`).join('\n')}`);
}

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check')) throw new Error('Usage: node scripts/sync-chunk-content.mjs [--check]');
const checkOnly = args.includes('--check');
const { manifest, data } = await readPinnedChunkSource();
const result = transformChunkContent(data, manifest);
assertChunkTransform(result, manifest);
const expected = expectedFiles(result);

if (checkOnly) {
  check(expected);
  console.log(`Chunk content outputs match reviewed source ${manifest.commit}.`);
} else {
  for (const [path, bytes] of expected) writeFileSync(path, bytes);
  console.log(`Wrote chunk content outputs from reviewed source ${manifest.commit}: ${Object.keys(result.full.chunks).length} chunks with content.`);
}