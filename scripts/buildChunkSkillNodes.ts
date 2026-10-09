/** Regenerate data/chunkSkillNodes.ts. Run: npx tsx scripts/buildChunkSkillNodes.ts [--check] */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChunkSkillNodes, chunkSkillNodesSource } from '../utils/chunkSkillNodesBuild';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const doc = JSON.parse(readFileSync(resolve(ROOT, 'public', 'chunk-content.json'), 'utf8'));
const out = resolve(ROOT, 'data', 'chunkSkillNodes.ts');
const text = chunkSkillNodesSource(buildChunkSkillNodes(doc));
if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== text) throw new Error('data/chunkSkillNodes.ts is stale: run npx tsx scripts/buildChunkSkillNodes.ts');
} else writeFileSync(out, text);
