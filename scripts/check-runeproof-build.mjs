import { readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRuneProofJavaScriptBudget } from './runeproof-source-generator.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDirectory = resolve(root, 'dist', 'assets');
const names = await readdir(assetsDirectory);
const assets = await Promise.all(names.map(async name => ({
  path: `assets/${name}`,
  bytes: (await stat(resolve(assetsDirectory, name))).size,
})));

assertRuneProofJavaScriptBudget(assets);
const largest = assets
  .filter(asset => asset.path.endsWith('.js'))
  .sort((left, right) => right.bytes - left.bytes)[0];
console.log(
  `verified RuneProof JavaScript budget: largest asset ${largest.path} `
    + `${largest.bytes} bytes`,
);
