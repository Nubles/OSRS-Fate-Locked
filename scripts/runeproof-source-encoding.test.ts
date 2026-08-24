import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const sourceExtensions = new Set(['.mjs', '.ts', '.tsx']);
const sourceDirectories = [
  'components/questStrategies',
  'components/questRoutes',
  'utils/questStrategies',
  'utils/questRoutes',
  'utils/questWalkthroughs',
];
const sourceFiles = [
  'components/GoalPlannerModal.test.tsx',
  'components/GoalPlannerModal.tsx',
  'data/questItemRequirements.test.ts',
  'data/questItemRequirements.ts',
  'data/questRouteRecipes.test.ts',
  'data/questRouteRecipes.ts',
  'scripts/check-quest-route-data.mjs',
  'data/questWalkthroughs.generated.json',
  'data/questWalkthroughs.test.ts',
  'data/questWalkthroughs.ts',
  'data/sources/quest-walkthrough-review.json',
  'data/sources/quest-walkthrough-sources.json',
  'scripts/quest-walkthrough-source.test.ts',
  'scripts/quest-walkthrough-source.mjs',
  'scripts/sync-quest-walkthroughs.mjs',
  'scripts/check-quest-route-data.test.ts',
  'scripts/player-facing-changelog.test.ts',
  'scripts/runeproof-catalogue-source.mjs',
  'scripts/runeproof-catalogue-source.test.ts',
  'scripts/runeproof-coverage.mjs',
  'scripts/runeproof-coverage.test.ts',
  'scripts/runeproof-coverage.types.ts',
  'scripts/runeproof-source-encoding.test.ts',
  'scripts/sync-runeproof-catalogue.mjs',
  'services/ChunkContentService.test.ts',
  'services/ChunkContentService.ts',
];

const runeProofJsonFiles = readdirSync(
  resolve(projectRoot, 'data/sources'),
  { withFileTypes: true },
).filter(entry => (
  entry.isFile()
  && entry.name.startsWith('runeproof-')
  && entry.name.endsWith('.json')
)).map(entry => `data/sources/${entry.name}`);

const comparePaths = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

const collectSourceFiles = (directory: string): string[] => {
  const absoluteDirectory = resolve(projectRoot, directory);
  if (!existsSync(absoluteDirectory)) return [];
  return readdirSync(absoluteDirectory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        return collectSourceFiles(entryPath);
      }
      return sourceExtensions.has(extname(entry.name)) ? [entryPath] : [];
    });
};

const runeProofSourceFiles = [
  ...sourceDirectories.flatMap(collectSourceFiles),
  ...runeProofJsonFiles,
  ...sourceFiles.filter(sourceFile => existsSync(resolve(projectRoot, sourceFile))),
].filter((sourceFile, index, files) => files.indexOf(sourceFile) === index)
  .sort(comparePaths);

describe('RuneProof source encoding', () => {
  it('covers every production source-pipeline module', () => {
    expect(runeProofSourceFiles).toEqual(expect.arrayContaining([
      'scripts/quest-walkthrough-source.mjs',
      'scripts/sync-quest-walkthroughs.mjs',
    ]));
  });

  it('keeps every reviewed source valid UTF-8 without BOMs or replacement characters', () => {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const diagnostics: string[] = [];

    for (const sourceFile of runeProofSourceFiles) {
      const absolutePath = resolve(projectRoot, sourceFile);
      const displayPath = relative(projectRoot, absolutePath).replaceAll('\\', '/');
      const sourceBytes = readFileSync(absolutePath);

      if (
        sourceBytes.length >= 3
        && sourceBytes[0] === 0xEF
        && sourceBytes[1] === 0xBB
        && sourceBytes[2] === 0xBF
      ) {
        diagnostics.push(`${displayPath}: begins with a UTF-8 BOM`);
      }

      try {
        const sourceText = decoder.decode(sourceBytes);
        if (sourceText.includes('\uFEFF')) {
          diagnostics.push(`${displayPath}: contains literal U+FEFF byte-order mark`);
        }
        if (sourceText.includes('\uFFFD')) {
          diagnostics.push(`${displayPath}: contains literal U+FFFD replacement character`);
        }
        if (sourceText.includes('\r')) {
          diagnostics.push(`${displayPath}: contains a carriage-return line ending`);
        }
        if (!sourceText.endsWith('\n')) {
          diagnostics.push(`${displayPath}: is missing its final LF`);
        }
      } catch {
        diagnostics.push(`${displayPath}: invalid UTF-8`);
      }
    }

    expect(diagnostics).toEqual([]);
  });
});
