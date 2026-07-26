import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
const jvmOrBuildArtifactPattern =
  /(?:^|\/)(?:[^/]+\.(?:java|kt|kts|class|jar)|(?:build|settings)\.gradle(?:\.kts)?|gradlew(?:\.bat)?|mvnw(?:\.cmd)?|pom\.xml|SOURCE_COMMIT|runelite-plugin\.properties|plugin-hub\.json)$|(?:^|\/)(?:\.gradle|gradle)(?:\/|$)/i;
const pluginMetadataPathPattern = /(?:^|\/)(?:runelite[-_.]?plugin|plugin)\.properties$/i;
const pluginDistributionSignaturePattern =
  /(?:\brune\s*lite(?:[-_\s]*(?:plugin|client))?\b|\brunelite(?:[-_\s]*(?:plugin|client))?\b|\bnet\.runelite\b|\b[\w-]*plugin[\w-]*\.(?:zip|jar|class)\b|\bplugin[-_\s]+(?:hub|manifest|metadata|distribution)\b)/i;
const distributionBehaviorPattern =
  /\b(?:build|fetch|download|release|mirror|publish|upload|curl|wget|gradle|mvn|setup-java)\b/i;
const jvmBinaryDistributionBehaviorPattern =
  /\b(?:fetch|download|release|mirror|publish|upload|curl|wget)\b/i;
const standalonePluginArtifactPattern = /\b[\w.-]*plugin[\w.-]*\.(?:zip|jar|class)\b/i;
const jvmBinaryArtifactPattern = /\b[^\s'"`]+\.(?:jar|class)\b/i;
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

type CommandSurface = { relativePath: string; content: string };

const isProhibitedPluginDistribution = (content: string) =>
  content.split(/\r?\n/).some((commandLine) =>
    (jvmBinaryArtifactPattern.test(commandLine) && jvmBinaryDistributionBehaviorPattern.test(commandLine)) ||
    (pluginDistributionSignaturePattern.test(commandLine) &&
      (distributionBehaviorPattern.test(commandLine) || standalonePluginArtifactPattern.test(commandLine))),
  );
const isProhibitedPluginSourceArtifact = (relativePath: string, content: string) =>
  jvmOrBuildArtifactPattern.test(relativePath) ||
  (pluginMetadataPathPattern.test(relativePath) && pluginDistributionSignaturePattern.test(content)) ||
  isProhibitedPluginDistribution(relativePath);
const trackedCommandSurfaces = (): CommandSurface[] => {
  const trackedCommandFiles = trackedFiles().filter(
    (relativePath) =>
      !archivedBoundaryReferencePath(relativePath) &&
      (relativePath.startsWith('scripts/') || /\.ya?ml$/i.test(relativePath)),
  );
  const packageJson = JSON.parse(readFileSync(atRoot('package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };

  return [
    ...trackedCommandFiles.map((relativePath) => ({
      relativePath,
      content: readFileSync(atRoot(relativePath), 'utf8'),
    })),
    ...Object.entries(packageJson.scripts ?? {}).map(([scriptName, command]) => ({
      relativePath: `package.json#scripts.${scriptName}`,
      content: command,
    })),
  ];
};

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

  it('does not retain plugin distribution commands in tracked scripts, packages, or workflows under renamed paths', () => {
    const prohibitedCommandSurfaces = trackedCommandSurfaces().filter(({ content }) =>
      isProhibitedPluginDistribution(content),
    );

    expect(prohibitedCommandSurfaces).toEqual([]);
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

  it.each([
    ['scripts/refresh-external.mjs', "await fetch('https://downloads.example.net/net.runelite.client-1.0.zip');"],
    ['scripts/ship-assets.mjs', "await download('https://cdn.example/fate-locked-plugin.zip');"],
    ['package.json', '{"scripts":{"package":"node scripts/create-release.mjs --publish plugin-bundle.zip"}}'],
    ['automation/release.yml', 'run: curl -LO https://cdn.example/fate-locked-plugin.zip'],
  ])('rejects a renamed plugin distribution command at %s', (_relativePath, content) => {
    expect(isProhibitedPluginDistribution(content)).toBe(true);
  });

  it.each([
    ['scripts/release-prebuilt.mjs', 'curl -LO https://cdn.example/fatelocked-0.1.0-all.jar'],
    ['automation/publish.yml', 'run: wget https://cdn.example/fatelocked-0.1.0.class'],
  ])('rejects a generic-name JVM binary distribution command at %s', (_relativePath, content) => {
    expect(isProhibitedPluginDistribution(content)).toBe(true);
  });
  it.each([
    ['renamed-source/GuardianPlugin.kt', 'package net.runelite.client.plugins;'],
    ['renamed-output/GuardianPlugin.class', ''],
    ['renamed-metadata/plugin.properties', 'displayName=RuneLite Companion Plugin'],
  ])('rejects a tracked JVM or RuneLite plugin metadata artifact at %s', (relativePath, content) => {
    expect(isProhibitedPluginSourceArtifact(relativePath, content)).toBe(true);
  });

  it('does not combine unrelated script lines into a plugin distribution command', () => {
    const content = [
      "await fetch('https://cdn.example/fate-locked-webapp.zip');",
      '// Builds the RuneLite bundle payload used by the web app.',
    ].join('\n');

    expect(isProhibitedPluginDistribution(content)).toBe(false);
  });
  it('allows a generic web-app release download without a RuneLite or plugin signature', () => {
    const content = "await download('https://cdn.example/fate-locked-webapp.zip');";

    expect(isProhibitedPluginDistribution(content)).toBe(false);
  });

  it('rejects tracked Java, Gradle, Kotlin, class, and RuneLite plugin-source artifacts under renamed paths', () => {
    const prohibitedArtifacts = trackedFiles().filter(
      (relativePath) =>
        !retainedWebAppIntegrationPaths.includes(relativePath) &&
        isProhibitedPluginSourceArtifact(relativePath, readFileSync(atRoot(relativePath), 'utf8')),
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
