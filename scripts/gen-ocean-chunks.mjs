import { readFileSync, writeFileSync } from 'node:fs';
import { readPinnedChunkSource } from './chunk-source.mjs';
const { data, manifest } = await readPinnedChunkSource();
const regionSource = readFileSync(new URL('../data/regionChunks.ts', import.meta.url), 'utf8');
const land = new Set([...regionSource.matchAll(/cx: (\d+), cy: (\d+)/g)].map(([, x, y]) => `${x},${y}`));
if (land.size < 600) throw new Error('Region chunk parser lost the land baseline');
const keys = data.walkableChunks.map(Number).filter(id => !land.has(`${id >> 8},${id & 255}`));
for (const id of keys) {
  const name = data.chunks[id]?.Nickname ?? data.chunks[id]?.Name;
  if (name && name !== 'Ocean Chunk') throw new Error(`Unassigned named land chunk ${id}: ${name}`);
}
const text = JSON.stringify({ sourceCommit: manifest.commit, keys: keys.sort((a,b) => a-b).map(id => `${id >> 8},${id & 255}`) }, null, 2) + '\n';
const out = new URL('../data/oceanChunks.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== text) throw new Error('Ocean navigation data is stale');
} else writeFileSync(out, text);
console.log(`Ocean navigation: ${keys.length} chunks, excluded from the land roll pool.`);
