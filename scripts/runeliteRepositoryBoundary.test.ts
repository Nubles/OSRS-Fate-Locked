import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const atRoot = (relativePath: string) => join(repositoryRoot, relativePath);
const trackedFiles = () =>
  String(execFileSync('git', ['ls-files', '-z'], { cwd: repositoryRoot, encoding: 'utf8' }))
    .split('\0')
    .filter(Boolean);

const archivedBoundaryReferencePath = (relativePath: string) =>
  relativePath.startsWith('docs/superpowers/plans/') ||
  relativePath.startsWith('docs/superpowers/specs/') ||
  relativePath === 'scripts/runeliteRepositoryBoundary.test.ts';
const textFilePattern = /\.(?:[cm]?[jt]sx?|json|md|ya?ml|toml|ini|properties|xml|txt)$/i;
const staleMirrorOrSourcePinPattern =
  /(?:\brunelite-plugin(?:\/|\b)|\bSOURCE_COMMIT\b|\brunelite:mirror-check\b|byte-for-byte (?:CRLF )?mirror|Nubles\/RS3-Fate-Locked-Runelite)/i;
const prohibitedPluginSourceArtifactPattern =
  /(?:^|\/)(?:[^/]+\.(?:java|jar)|(?:build|settings)\.gradle(?:\.kts)?|gradlew(?:\.bat)?|mvnw(?:\.cmd)?|pom\.xml|SOURCE_COMMIT|runelite-plugin\.properties|plugin-hub\.json)$|(?:^|\/)(?:\.gradle|gradle)(?:\/|$)/i;
const retainedWebAppIntegrationPaths = [
  'components/RuneLiteOnboarding.tsx',
  'components/RollInbox.tsx',
  'components/RollInboxDriver.tsx',
  'services/fateEventProtocol.ts',
  'services/fateEventRelay.ts',
  'services/relaySync.ts',
  'utils/runeliteBundle.ts',
  'utils/runeliteExport.ts',
  'utils/runeliteRulesManifest.ts',
  'workers/fate-relay/worker.js',
];

const workflowDirectory = atRoot('.github/workflows');
const prohibitedPluginWorkflowPattern =
  /(?:actions\/setup-java@|(?:^|[^\w])(?:\.\/)?gradlew?(?:\s|$)|\bmvnw?(?:\s|$)|\bjava\s+-jar\b|\brunelite(?:-plugin)?\b|\bplugin[\s-]?hub\b|\.jar\b|\b(?:java|plugin)[\s-](?:build|release|download)\b)/i;

const workflowFiles = () =>
  readdirSync(workflowDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => entry.name);

describe('RuneLite repository ownership boundary', () => {
  it.each([
    'runelite-plugin',
    '.github/workflows/runelite-plugin.yml',
    '.github/workflows/runelite-mirror.yml',
    'scripts/check-runelite-mirror.mjs',
    'scripts/check-runelite-mirror.test.ts',
  ])('does not keep plugin source or distribution machinery at %s', (relativePath) => {
    expect(existsSync(atRoot(relativePath))).toBe(false);
  });

  it('does not retain Java plugin build or distribution workflows under any filename', () => {
    const prohibitedWorkflows = workflowFiles().filter((fileName) =>
      prohibitedPluginWorkflowPattern.test(readFileSync(join(workflowDirectory, fileName), 'utf8')),
    );

    expect(prohibitedWorkflows).toEqual([]);
  });
  it('does not expose a mirror verification npm command', () => {
    const packageJson = JSON.parse(readFileSync(atRoot('package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts).not.toHaveProperty('runelite:mirror-check');
  });

  it('documents standalone ownership without companion mirror instructions', () => {
    const activeDocs = [
      'README.md',
      'ROADMAP.md',
      '.claude/skills/fate-locked-workflow/SKILL.md',
    ].map((relativePath) => readFileSync(atRoot(relativePath), 'utf8')).join('\n');

    expect(activeDocs).toContain('https://github.com/Nubles/OSRS-Fate-Locked-Runelite');
    expect(activeDocs).not.toMatch(/runelite-plugin\/SOURCE_COMMIT/);
    expect(activeDocs).not.toMatch(/byte-for-byte (?:CRLF )?mirror/i);
    expect(activeDocs).not.toContain('runelite:mirror-check');
    expect(activeDocs).not.toContain('Nubles/RS3-Fate-Locked-Runelite');
  });

  it('does not leave removed companion paths in active application source', () => {
    expect(readFileSync(atRoot('components/RegionMap.tsx'), 'utf8')).not.toMatch(/runelite-plugin(?:\/|\b)/i);
  });

  it('rejects tracked Java, Gradle, and RuneLite plugin-source artifacts under renamed paths', () => {
    const prohibitedArtifacts = trackedFiles().filter(
      (relativePath) =>
        !retainedWebAppIntegrationPaths.includes(relativePath) &&
        prohibitedPluginSourceArtifactPattern.test(relativePath),
    );

    expect(prohibitedArtifacts).toEqual([]);
  });

  it('rejects stale mirror and source-pin references in active tracked text', () => {
    const staleActiveReferences = trackedFiles().filter(
      (relativePath) =>
        !archivedBoundaryReferencePath(relativePath) &&
        textFilePattern.test(relativePath) &&
        staleMirrorOrSourcePinPattern.test(readFileSync(atRoot(relativePath), 'utf8')),
    );

    expect(staleActiveReferences).toEqual([]);
  });

  it.each(retainedWebAppIntegrationPaths)('retains the app-side RuneLite integration at %s', (relativePath) => {
    expect(existsSync(atRoot(relativePath))).toBe(true);
  });
});
