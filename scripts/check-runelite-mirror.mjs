import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPARED = [
  'build.gradle',
  'settings.gradle',
  'gradle.properties',
  'runelite-plugin.properties',
  'README.md',
  'CONTRIBUTING.md',
  'src/main/java',
  'src/main/resources',
];

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = process.env.RUNELITE_SOURCE_DIR
  ? resolve(process.env.RUNELITE_SOURCE_DIR)
  : null;
const mirrorRoot = resolve(
  process.env.RUNELITE_MIRROR_DIR || join(repositoryRoot, 'runelite-plugin'),
);
const pinPath = join(repositoryRoot, 'runelite-plugin', 'SOURCE_COMMIT');
const pin = existsSync(pinPath) ? readFileSync(pinPath, 'utf8').trim() : 'un-pinned source';

if (!sourceRoot) {
  console.error('RUNELITE_SOURCE_DIR must point to the standalone RuneLite plugin checkout.');
  process.exit(2);
}

function posixPath(root, path) {
  return relative(root, path).replaceAll('\\', '/');
}

function listComparedFiles(root) {
  const files = new Map();

  function visit(path) {
    if (!existsSync(path)) return;
    const stat = statSync(path);
    if (stat.isFile()) {
      files.set(posixPath(root, path), path);
      return;
    }
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isDirectory() || entry.isFile()) {
        visit(join(path, entry.name));
      }
    }
  }

  for (const comparedPath of COMPARED) {
    visit(join(root, comparedPath));
  }
  return files;
}

const sourceFiles = listComparedFiles(sourceRoot);
const mirrorFiles = listComparedFiles(mirrorRoot);
const allPaths = [...new Set([...sourceFiles.keys(), ...mirrorFiles.keys()])].sort();
const drift = [];

for (const path of allPaths) {
  const source = sourceFiles.get(path);
  const mirror = mirrorFiles.get(path);
  if (!source) {
    drift.push({ kind: 'removed', path });
  } else if (!mirror) {
    drift.push({ kind: 'added', path });
  } else if (!readFileSync(source).equals(readFileSync(mirror))) {
    drift.push({ kind: 'changed', path });
  }
}

if (drift.length > 0) {
  console.log(`RuneLite mirror drift from ${pin}:`);
  for (const entry of drift) {
    console.log(`${entry.kind}: ${entry.path}`);
  }
  process.exit(1);
}

console.log(`RuneLite mirror matches ${pin}.`);
