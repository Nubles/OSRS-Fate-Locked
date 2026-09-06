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
const companionRepositoryPattern =
  /\b(?:this\s+(?:(?:companion|web(?:\s+app)?)\s+)?(?:repository|repo)|(?:the\s+)?(?:companion|web(?:\s+app)?)\s+(?:repository|repo))\b/i;
const pluginOwnershipActionPattern =
  /\b(?:build(?:s|ing)?|built|publish(?:es|ed|ing)?|releas(?:e|es|ed|ing)|download(?:s|ed|ing)?|mirror(?:s|ed|ing)?)\b/i;
const pluginOwnershipSubjectPattern = /\b(?:java|rune\s*lite|runelite|plugin|jar)\b/i;
const negatedPluginOwnershipActionPattern =
  /\b(?:do not|does not|don't|never|must not|cannot|can't|no)\b[^.!?]{0,100}\b(?:build(?:s|ing)?|built|publish(?:es|ed|ing)?|releas(?:e|es|ed|ing)|download(?:s|ed|ing)?|mirror(?:s|ed|ing)?)\b/i;
const jvmOrBuildArtifactPattern =
  /(?:^|\/)(?:[^/]+\.(?:java|kt|kts|class|jar)|(?:build|settings)\.gradle(?:\.kts)?|gradlew(?:\.bat)?|mvnw(?:\.cmd)?|pom\.xml|SOURCE_COMMIT|runelite-plugin\.properties|plugin-hub\.json)$|(?:^|\/)(?:\.gradle|gradle)(?:\/|$)/i;
const pluginMetadataPathPattern = /(?:^|\/)(?:runelite[-_.]?plugin|plugin)\.properties$/i;
const pluginDistributionSignaturePattern =
  /(?:\brune\s*lite(?:[-_\s]*(?:plugin|client))?\b|\brunelite(?:[-_\s]*(?:plugin|client))?\b|\bnet\.runelite\b|\b[\w-]*plugin[\w-]*\.(?:zip|jar|class)\b|\bplugin[-_\s]+(?:hub|manifest|metadata|distribution)\b)/i;
const distributionBehaviorPattern =
  /\b(?:build|fetch|download|release|mirror|publish|upload|curl|wget|gradle|mvn|setup-java)\b/i;
const jvmBinaryDistributionBehaviorPattern =
  /\b(?:build|fetch|download|release|mirror|publish|upload|distribution)\b/i;
const standalonePluginArtifactPattern = /\b[\w.-]*plugin[\w.-]*\.(?:zip|jar|class)\b/i;
const remoteJvmBinaryArtifactPattern = /\bhttps?:\/\/[^\s'"`]+\.(?:jar|class)\b/i;
const fateLockedPluginJvmContextPattern =
  /(?:\bfate[-_\s]?locked\b|\bfatelocked\b|\brune\s*lite\b|\brunelite\b|\bnet\.runelite\b|\b[\w.-]*plugin[\w.-]*\.(?:jar|class)\b|Nubles\/OSRS-Fate-Locked-Runelite)/i;
const jvmBinaryArtifactPattern = /\b[^\s'"`]+\.(?:jar|class)\b/i;
const yamlWorkflowPattern = /^\s*jobs\s*:/im;
const workflowPluginSignaturePattern =
  /(?:Nubles\/OSRS-Fate-Locked-Runelite|\bnet\.runelite\b|\brune\s*lite[-_\s]+(?:companion[-_\s]+)?plugin\b|\brunelite[-_\s]+(?:companion[-_\s]+)?plugin\b)/i;
const workflowJavaSetupPattern = /\bactions\/setup-java@/i;
const workflowJvmBuildCommandPattern =
  /^\s*(?:(?:-\s*)?run:\s*(?:[>|]\s*)?)?(?:\.?[\\/])?(?:gradlew(?:\.bat)?|gradle|mvnw(?:\.cmd)?|mvn)\b[^\r\n]*\b(?:clean|test|build|jar|shadowJar|package|install|deploy)\b/im;
const retainedWebAppIntegrationPaths = [
  'components/RunelitePairingDialog.tsx',
  'components/RuneLiteOnboarding.tsx',
  'components/RollInbox.tsx',
  'components/RollInboxDriver.tsx',
  'services/fateEventProtocol.ts',
  'services/fateEventRelay.ts',
  'services/relaySync.ts',
  'utils/runeliteBundle.ts',
  'utils/runeliteExport.ts',
  'utils/runelitePairing.ts',
  'utils/runeliteRulesManifest.ts',
  'workers/fate-relay/worker.js',
];

type CommandSurface = { relativePath: string; content: string };

const hasCompanionOwnedPluginInstruction = (content: string) =>
  content.split(/[.!?;](?:\s+|$)|\r?\n\s*\r?\n/).some(
    (instruction) =>
      companionRepositoryPattern.test(instruction) &&
      pluginOwnershipActionPattern.test(instruction) &&
      pluginOwnershipSubjectPattern.test(instruction) &&
      !negatedPluginOwnershipActionPattern.test(instruction),
  );
const hasProhibitedActiveOwnership = (content: string) =>
  staleMirrorOrSourcePinPattern.test(content) || hasCompanionOwnedPluginInstruction(content);
const hasSplitWorkflowPluginBuild = (content: string) =>
  yamlWorkflowPattern.test(content) &&
  workflowPluginSignaturePattern.test(content) &&
  workflowJavaSetupPattern.test(content) &&
  workflowJvmBuildCommandPattern.test(content);
const isProhibitedPluginDistribution = (content: string) =>
  content.split(/\r?\n/).some((commandLine) => {
    const remoteJvmBinary = remoteJvmBinaryArtifactPattern.test(commandLine);

    return (
      (remoteJvmBinary && fateLockedPluginJvmContextPattern.test(commandLine)) ||
      (!remoteJvmBinary &&
        jvmBinaryArtifactPattern.test(commandLine) &&
        jvmBinaryDistributionBehaviorPattern.test(commandLine)) ||
      (pluginDistributionSignaturePattern.test(commandLine) &&
        (distributionBehaviorPattern.test(commandLine) || standalonePluginArtifactPattern.test(commandLine)))
    );
  }) || hasSplitWorkflowPluginBuild(content);
const isProhibitedPluginSourceArtifact = (relativePath: string, content: string) =>
  jvmOrBuildArtifactPattern.test(relativePath) ||
  (pluginMetadataPathPattern.test(relativePath) && pluginDistributionSignaturePattern.test(content)) ||
  isProhibitedPluginDistribution(relativePath);
// Offline Quest Helper evidence tooling is not the Fate Locked companion plugin.
// Keep these exceptions exact: all other JVM source/distribution paths stay forbidden.
const questEvidenceExporter = 'scripts/quest-helper-export/RuneProofExportTest.java';
const questEvidenceReadme = 'scripts/quest-helper-export/README.md';
const trackedCommandSurfaces = (): CommandSurface[] => {
  const trackedCommandFiles = trackedFiles().filter(
    (relativePath) =>
      !archivedBoundaryReferencePath(relativePath) &&
      relativePath !== questEvidenceReadme &&
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
  it('limits the Quest Helper exception to an offline evidence test', () => {
    const source = readFileSync(atRoot(questEvidenceExporter), 'utf8');
    expect(source).toContain('package com.questhelper;');
    expect(source).toContain('class RuneProofExportTest extends MockedTest');
    expect(source).toContain('RUNEPROOF_EXPORT_OUT');
    expect(source).not.toMatch(/extends\s+Plugin\b|@PluginDescriptor|net\.runelite\.client\.plugins\.fatelocked/);
    expect(isProhibitedPluginDistribution(source)).toBe(false);
  });

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

  it.each([
    'README.md',
    'ROADMAP.md',
    '.claude/skills/fate-locked-workflow/SKILL.md',
  ])('documents approved standalone ownership in %s', (relativePath) => {
    const content = readFileSync(atRoot(relativePath), 'utf8');

    expect(content).toMatch(/(?:https:\/\/github\.com\/)?Nubles\/OSRS-Fate-Locked-Runelite\b/i);
    expect(content).toMatch(/\b(?:plugin source|builds?|releases?|Plugin Hub)\b/i);
    expect(content).toMatch(
      /(?:\b(?:only|exclusively)\b[\s\S]{0,240}\b(?:standalone repository|OSRS-Fate-Locked-Runelite)\b|\b(?:standalone repository|OSRS-Fate-Locked-Runelite)\b[\s\S]{0,240}\b(?:only|exclusively|owns)\b)/i,
    );
    expect(hasProhibitedActiveOwnership(content)).toBe(false);
  });

  it.each([
    'Build and publish the Java plugin from this companion repository.',
    'RuneLite plugin artifacts are released and downloaded from the web app repository.',
    'Mirror the plugin sources into this companion repo before publishing.',
  ])('rejects companion-owned plugin instructions: %s', (instruction) => {
    const content = [
      'Plugin source, builds, and releases live exclusively in the standalone repository:',
      'https://github.com/Nubles/OSRS-Fate-Locked-Runelite.',
      instruction,
    ].join('\n');

    expect(hasProhibitedActiveOwnership(content)).toBe(true);
  });
  it('allows an explicit prohibition on companion-owned plugin builds', () => {
    const content = [
      'Plugin source, builds, and releases live exclusively in the standalone repository:',
      'https://github.com/Nubles/OSRS-Fate-Locked-Runelite.',
      'Do not build or publish the Java plugin from this companion repository.',
    ].join('\n');

    expect(hasProhibitedActiveOwnership(content)).toBe(false);
  });

  it('allows companion web-app build prose that points the plugin elsewhere', () => {
    const content = [
      'Plugin source, builds, and releases live exclusively in the standalone repository:',
      'https://github.com/Nubles/OSRS-Fate-Locked-Runelite.',
      'This companion repository builds and releases the web app; the RuneLite plugin remains external.',
    ].join('\n');

    expect(hasProhibitedActiveOwnership(content)).toBe(false);
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
    [
      'scripts/release-prebuilt.ps1',
      'Invoke-WebRequest -Uri https://cdn.example/fatelocked-0.1.0-all.jar -OutFile fatelocked.jar',
    ],
    ['automation/release.yml', 'asset: https://cdn.example/fatelocked-0.1.0-all.JAR'],
  ])('rejects a generic-name JVM binary distribution command at %s', (_relativePath, content) => {
    expect(isProhibitedPluginDistribution(content)).toBe(true);
  });
  it('allows an unrelated remote PlantUML JAR reference', () => {
    const content =
      "const plantUmlJar = 'https://github.com/plantuml/plantuml/releases/download/v1.2026.5/plantuml.jar';";

    expect(isProhibitedPluginDistribution(content)).toBe(false);
  });
  it.each([
    ['build', 'build artifacts/fatelocked.jar'],
    ['fetch', 'fetch artifacts/fatelocked.jar'],
    ['download', 'download artifacts/fatelocked.jar'],
    ['release', 'release artifacts/fatelocked.jar'],
    ['mirror', 'mirror artifacts/fatelocked.jar'],
    ['publish', 'publish artifacts/fatelocked.jar'],
    ['upload', 'upload artifacts/fatelocked.jar'],
    ['distribution', 'distribution artifacts/fatelocked.jar'],
  ])('rejects a local JVM binary used by the %s behavior', (_behavior, content) => {
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
  it('rejects a split-step standalone plugin build workflow', () => {
    const content = [
      'jobs:',
      '  plugin:',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '        with:',
      '          repository: Nubles/OSRS-Fate-Locked-Runelite',
      '      - uses: actions/setup-java@v4',
      '      - run: gradle clean test jar --no-daemon',
    ].join('\n');

    expect(isProhibitedPluginDistribution(content)).toBe(true);
  });
  it('allows an unrelated setup-java Gradle workflow', () => {
    const content = [
      'jobs:',
      '  verify-java-service:',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - uses: actions/setup-java@v4',
      '      - run: gradle clean test jar --no-daemon',
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
        relativePath !== questEvidenceExporter &&
        isProhibitedPluginSourceArtifact(relativePath, readFileSync(atRoot(relativePath), 'utf8')),
    );

    expect(prohibitedArtifacts).toEqual([]);
  });

  it('rejects stale mirror and source-pin references in active tracked text', () => {
    const staleActiveReferences = trackedFiles().filter(
      (relativePath) =>
        !archivedBoundaryReferencePath(relativePath) &&
        textFilePattern.test(relativePath) &&
        hasProhibitedActiveOwnership(readFileSync(atRoot(relativePath), 'utf8')),
    );

    expect(staleActiveReferences).toEqual([]);
  });

  it.each(retainedWebAppIntegrationPaths)('retains the app-side RuneLite integration at %s', (relativePath) => {
    expect(existsSync(atRoot(relativePath))).toBe(true);
  });
});
