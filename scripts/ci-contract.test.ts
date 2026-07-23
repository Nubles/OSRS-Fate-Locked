import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readRepositoryFile = (path: string) =>
  readFile(resolve(repositoryRoot, path), 'utf8');

const commandOrder = [
  'npm ci --no-audit --no-fund',
  'npm test',
  'npx tsc --noEmit',
  'npm run content:verify',
  'npm run build',
];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const indentation = (line: string) => line.match(/^\s*/)?.[0].length ?? 0;

const uncommentedYamlLines = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line));

const yamlBlock = (text: string, key: string, parentIndent = 0) => {
  const lines = uncommentedYamlLines(text);
  const keyPattern = new RegExp(
    `^\\s{${parentIndent}}${escapeRegExp(key)}:\\s*(?:#.*)?$`,
  );
  const start = lines.findIndex((line) => keyPattern.test(line));

  expect(start, `YAML key ${key} not found at indentation ${parentIndent}`).toBeGreaterThanOrEqual(0);

  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() && indentation(line) <= parentIndent) break;
    end += 1;
  }

  return lines.slice(start, end).join('\n');
};

const activeRunCommands = (text: string) =>
  uncommentedYamlLines(text)
    .map((line) => line.match(/^\s*run:\s*([^#\r\n]+?)\s*$/)?.[1]?.trim())
    .filter((command): command is string => Boolean(command));

const activeUses = (text: string) =>
  uncommentedYamlLines(text)
    .map((line) => line.match(/^\s*uses:\s*([^#\r\n]+?)\s*$/)?.[1]?.trim())
    .filter((action): action is string => Boolean(action));

const expectInOrder = (actualCommands: string[], commands: string[]) => {
  let cursor = -1;
  for (const command of commands) {
    const next = actualCommands.indexOf(command, cursor + 1);
    expect(next, `${command} missing or out of order`).toBeGreaterThan(cursor);
    cursor = next;
  }
};

const expectNoNpmInstall = (commands: string[]) => {
  expect(
    commands.some((command) => /^npm\s+install(?:\s|$)/.test(command)),
    'npm install must not be used; install from the lockfile with npm ci',
  ).toBe(false);
};

describe('CI workflow contract', () => {
  it('reads GitHub on as a top-level workflow key and ignores commented commands', () => {
    const fixture = [
      'name: Fixture',
      'on:',
      '  pull_request:',
      'jobs:',
      '  quality:',
      '    steps:',
      '      # run: npm test',
      '      - name: Install',
      '        run: npm ci --no-audit --no-fund',
    ].join('\n');

    expect(yamlBlock(fixture, 'on')).toContain('pull_request:');
    expect(activeRunCommands(fixture)).toEqual(['npm ci --no-audit --no-fund']);
  });

  it('defines the stable read-only pull-request quality check', async () => {
    const workflow = await readRepositoryFile('.github/workflows/ci.yml');
    const onBlock = yamlBlock(workflow, 'on');
    const permissionsBlock = yamlBlock(workflow, 'permissions');
    const concurrencyBlock = yamlBlock(workflow, 'concurrency');
    const jobsBlock = yamlBlock(workflow, 'jobs');
    const qualityJob = yamlBlock(jobsBlock, 'quality', 2);

    expect(workflow).toMatch(/^name:\s*CI\s*$/m);
    expect(onBlock).toMatch(/^\s{2}pull_request:\s*$/m);
    expect(onBlock).toMatch(/^\s{4}branches:\s*\[\s*main\s*,\s*master\s*\]\s*$/m);
    expect(onBlock).toMatch(/^\s{2}workflow_dispatch:\s*$/m);

    expect(permissionsBlock).toMatch(/^\s{2}contents:\s*read\s*$/m);
    expect(permissionsBlock).not.toMatch(/^\s{2}(?!contents:)[\w-]+:/m);
    expect(concurrencyBlock).toMatch(/^\s{2}cancel-in-progress:\s*true\s*$/m);
    expect(concurrencyBlock).toContain(
      'group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}',
    );

    expect(qualityJob).toMatch(/^\s{4}runs-on:\s*ubuntu-latest\s*$/m);
    expect(qualityJob).toMatch(/^\s{10}node-version:\s*22\s*$/m);
    expect(qualityJob).toMatch(/^\s{10}cache:\s*npm\s*$/m);
    expect(activeUses(qualityJob)).toEqual([
      'actions/checkout@v4',
      'actions/setup-node@v4',
    ]);

    const commands = activeRunCommands(qualityJob);
    expectInOrder(commands, commandOrder);
    expect(commands).toEqual(commandOrder);
    expectNoNpmInstall(commands);
    expect(qualityJob).toMatch(
      /- name: Build\n\s+run: npm run build\n\s+env:\n\s+VITE_BASE: \/\$\{\{ github\.event\.repository\.name \}\}\//,
    );
  });

  it('does not grant or invoke deployment behavior in pull-request CI', async () => {
    const workflow = uncommentedYamlLines(
      await readRepositoryFile('.github/workflows/ci.yml'),
    ).join('\n');

    expect(workflow).not.toMatch(/^\s*pull_request_target:\s*$/m);
    expect(workflow).not.toMatch(/^\s*[\w-]+:\s*write\s*$/m);
    expect(workflow).not.toMatch(/^\s*environment:\s*/m);
    expect(workflow).not.toMatch(/^\s*secrets:\s*/m);
    expect(workflow).not.toContain('${{ secrets.');
    expect(workflow).not.toContain('actions/upload-pages-artifact@');
    expect(workflow).not.toContain('actions/deploy-pages@');
    expect(workflow).not.toContain('actions/upload-artifact@');
  });
});

describe('Pages deployment workflow contract', () => {
  it('gates the existing Pages deployment behind the same quality commands', async () => {
    const workflow = await readRepositoryFile('.github/workflows/deploy.yml');
    const onBlock = yamlBlock(workflow, 'on');
    const permissionsBlock = yamlBlock(workflow, 'permissions');
    const jobsBlock = yamlBlock(workflow, 'jobs');
    const buildJob = yamlBlock(jobsBlock, 'build', 2);
    const deployJob = yamlBlock(jobsBlock, 'deploy', 2);

    expect(onBlock).toMatch(/^\s{2}push:\s*$/m);
    expect(onBlock).toMatch(/^\s{4}branches:\s*\[\s*main\s*,\s*master\s*\]/m);
    expect(onBlock).toMatch(/^\s{2}workflow_dispatch:\s*/m);

    expect(permissionsBlock).toMatch(/^\s{2}contents:\s*read\s*$/m);
    expect(permissionsBlock).toMatch(/^\s{2}pages:\s*write\s*$/m);
    expect(permissionsBlock).toMatch(/^\s{2}id-token:\s*write\s*$/m);

    expect(buildJob).toMatch(/^\s{4}runs-on:\s*ubuntu-latest\s*$/m);
    expect(buildJob).toMatch(/^\s{10}node-version:\s*22\s*$/m);
    expect(buildJob).toMatch(/^\s{10}cache:\s*npm\s*$/m);
    expect(activeUses(buildJob)).toEqual([
      'actions/checkout@v4',
      'actions/setup-node@v4',
      'actions/upload-pages-artifact@v3',
    ]);
    expect(buildJob).toMatch(
      /- name: Build\n\s+run: npm run build\n\s+env:\n\s+VITE_BASE: \/\$\{\{ github\.event\.repository\.name \}\}\/\n\s+BUILD_ID: \$\{\{ github\.sha \}\}/,
    );
    expect(buildJob).toMatch(
      /uses: actions\/upload-pages-artifact@v3\n\s+with:\n\s+path: \.\/dist/,
    );

    const commands = activeRunCommands(buildJob);
    expectInOrder(commands, commandOrder);
    expect(commands).toEqual(commandOrder);
    expectNoNpmInstall(commands);

    expect(deployJob).toMatch(/^\s{4}needs:\s*build\s*$/m);
    expect(deployJob).toMatch(/^\s{4}environment:\s*$/m);
    expect(deployJob).toContain(
      'url: ${{ steps.deployment.outputs.page_url }}',
    );
    expect(deployJob).toMatch(/^\s{8}id:\s*deployment\s*$/m);
    expect(activeUses(deployJob)).toEqual(['actions/deploy-pages@v4']);
  });
});

describe('local release command contract', () => {
  it('exposes deterministic content and aggregate release verification', async () => {
    const packageJson = JSON.parse(await readRepositoryFile('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['content:verify']).toBeTruthy();
    expect(packageJson.scripts?.['release:verify']).toBe(
      'npm test && npm run typecheck && npm run content:verify && npm run build',
    );
    expect(packageJson.scripts?.typecheck).toBe('tsc --noEmit');
  });
});
