import { readdirSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { describe, expect, it } from 'vitest';

// Windows editors can save a stray Windows-1252 dash (0x96/0x97) into an
// otherwise UTF-8 file. The build then shows a replacement character in
// player-facing text, so every app source and data file must be strict UTF-8.
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const checkedExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.ts', '.tsx']);
const skippedDirectories = new Set([
  '.git', '.superpowers', '.worktrees', 'dist', 'dist-runeproof-preview',
  'dist-ssr', 'node_modules', 'osrs-cache', 'output',
]);

const collectFiles = (directory: string): string[] =>
  readdirSync(resolve(projectRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const entryPath = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return skippedDirectories.has(entry.name) ? [] : collectFiles(entryPath);
    }
    return checkedExtensions.has(extname(entry.name)) ? [entryPath] : [];
  });

describe('app source encoding', () => {
  const files = collectFiles('');

  it('covers the app, its data and its generators', () => {
    expect(files).toEqual(expect.arrayContaining([
      'App.tsx',
      'components/AutoRollPanel.tsx',
      'config/gameModes.ts',
      'data/changelog.ts',
      'scripts/gen-banks.mjs',
      'workers/fate-relay/worker.js',
    ]));
  });

  it('keeps every source and data file valid UTF-8 without replacement characters', () => {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const diagnostics: string[] = [];

    for (const file of files) {
      try {
        const text = decoder.decode(readFileSync(resolve(projectRoot, file)));
        if (text.includes('\uFFFD')) diagnostics.push(`${file}: contains U+FFFD replacement character`);
      } catch {
        diagnostics.push(`${file}: invalid UTF-8`);
      }
    }

    expect(diagnostics).toEqual([]);
  });
});
