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

type YamlEntry = {
  key: string;
  value: string;
  path: string[];
};

const stripYamlComment = (line: string) => {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const characterCode = line.charCodeAt(index);
    const previousCode = index > 0 ? line.charCodeAt(index - 1) : undefined;

    if (characterCode === 34 && !inSingleQuote && previousCode !== 92) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (characterCode === 39 && !inDoubleQuote) {
      if (inSingleQuote && line.charCodeAt(index + 1) === 39) {
        index += 1;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (
      characterCode === 35 &&
      !inSingleQuote &&
      !inDoubleQuote &&
      (index === 0 || /\s/.test(line[index - 1]))
    ) {
      return line.slice(0, index).trimEnd();
    }
  }

  return line;
};

const uncommentedYamlLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map(stripYamlComment)
    .filter((line) => line.trim().length > 0);

const yamlEntries = (text: string): YamlEntry[] => {
  const entries: YamlEntry[] = [];
  const stack: Array<{ indent: number; key: string }> = [];

  for (const line of uncommentedYamlLines(text)) {
    const indent = indentation(line);
    const content = line.trimStart();
    if (content.startsWith('- ')) continue;

    const match = content.match(/^(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+)):(?:\s*(.*))?$/);
    if (!match) continue;

    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const key = match[1] ?? match[2] ?? match[3];
    const value = (match[4] ?? '').trim();
    const path = [...stack.map((entry) => entry.key), key];
    entries.push({ key, value, path });

    if (!value) stack.push({ indent, key });
  }

  return entries;
};

const unquoteYamlScalar = (value: string) => {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if (
    trimmed.length >= 2 &&
    (quote === '"' || quote === "'") &&
    trimmed[trimmed.length - 1] === quote
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

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
    .map((line) => line.match(/^\s*(?:-\s*)?run:\s*([^#\r\n]+?)\s*$/)?.[1])
    .filter((command): command is string => Boolean(command))
    .map(unquoteYamlScalar);

const activeUses = (text: string) =>
  uncommentedYamlLines(text)
    .map((line) => line.match(/^\s*(?:-\s*)?uses:\s*([^#\r\n]+?)\s*$/)?.[1])
    .filter((action): action is string => Boolean(action))
    .map(unquoteYamlScalar);

const activeStepOperations = (text: string) =>
  uncommentedYamlLines(text).flatMap((line) => {
    const command = activeRunCommands(line)[0];
    if (command) return [`run:${command}`];

    const action = activeUses(line)[0];
    return action ? [`uses:${action}`] : [];
  });

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

const expectCiSecurityContract = (workflowText: string) => {
  const entries = yamlEntries(workflowText);
  const rootOn = entries.find(
    (entry) => entry.path.length === 1 && entry.key === 'on',
  );
  const pullRequestTarget = entries.find(
    (entry) =>
      entry.path.length === 2 &&
      entry.path[0] === 'on' &&
      entry.key === 'pull_request_target',
  );
  expect(
    Boolean(pullRequestTarget) ||
      Boolean(rootOn?.value.includes('pull_request_target')),
    'pull_request_target must never be configured',
  ).toBe(false);

  const topPermissions = entries.filter(
    (entry) => entry.path.length === 1 && entry.key === 'permissions',
  );
  expect(topPermissions, 'exactly one top-level permissions block is required')
    .toHaveLength(1);
  expect(
    topPermissions[0]?.value,
    'top-level permissions must use a block map',
  ).toBe('');

  const permissionChildren = entries
    .filter(
      (entry) =>
        entry.path.length === 2 && entry.path[0] === 'permissions',
    )
    .map(({ key, value }) => ({ key, value }));
  expect(
    permissionChildren,
    'pull-request permissions must contain only contents: read',
  ).toEqual([{ key: 'contents', value: 'read' }]);

  const jobPermissions = entries.find(
    (entry) =>
      entry.path.length === 3 &&
      entry.path[0] === 'jobs' &&
      entry.key === 'permissions',
  );
  const flowJobPermissions = entries.find(
    (entry) =>
      entry.path[0] === 'jobs' &&
      entry.value.startsWith('{') &&
      /(?:^|[{,])\s*(?:"permissions"|'permissions'|permissions)\s*:/.test(
        entry.value,
      ),
  );
  expect(
    jobPermissions ?? flowJobPermissions,
    'pull-request jobs must not override workflow permissions',
  ).toBeUndefined();

  const environment = entries.find((entry) => entry.key === 'environment');
  expect(environment, 'pull-request CI must not declare an environment')
    .toBeUndefined();
  const secrets = entries.find((entry) => entry.key === 'secrets');
  expect(secrets, 'pull-request CI must not declare secrets').toBeUndefined();

  const activeWorkflow = uncommentedYamlLines(workflowText).join('\n');
  expect(activeWorkflow).not.toContain('${{ secrets.');

  const forbiddenActions = activeUses(workflowText).filter((action) =>
    /^actions\/(?:upload-pages-artifact|upload-artifact|deploy-pages)@/.test(
      action,
    ),
  );
  expect(
    forbiddenActions,
    'pull-request CI must not upload artifacts or deploy',
  ).toEqual([]);
};

const expectDeployBuildOperations = (buildJob: string) => {
  const commands = activeRunCommands(buildJob);
  expectInOrder(commands, commandOrder);
  expect(commands).toEqual(commandOrder);
  expectNoNpmInstall(commands);

  const expectedOperations = [
    'uses:actions/checkout@v4',
    'uses:actions/setup-node@v4',
    ...commandOrder.map((command) => `run:${command}`),
    'uses:actions/upload-pages-artifact@v3',
  ];
  expect(
    activeStepOperations(buildJob),
    'deploy build steps must keep every gate before artifact upload',
  ).toEqual(expectedOperations);
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
    expectCiSecurityContract(
      await readRepositoryFile('.github/workflows/ci.yml'),
    );
  });
});

describe('workflow contract mutation coverage', () => {
  const forbiddenCiMutations: Array<[string, (workflow: string) => string]> = [
    [
      'an empty pull_request_target event',
      (workflow) => workflow.replace(/on:\r?\n/, 'on:\n  pull_request_target:\n'),
    ],
    [
      'a flow-map pull_request_target event',
      (workflow) => workflow.replace(/on:\r?\n/, 'on:\n  pull_request_target: {}\n'),
    ],
    [
      'a mapped pull_request_target event',
      (workflow) =>
        workflow.replace(
          /on:\r?\n/ ,
          'on:\n  pull_request_target:\n    branches: [main]\n',
        ),
    ],
    [
      'top-level permissions write-all',
      (workflow) =>
        workflow.replace(
          /permissions:\r?\n  contents: read/ ,
          'permissions: write-all',
        ),
    ],
    [
      'a top-level inline write permission',
      (workflow) =>
        workflow.replace(
          /permissions:\r?\n  contents: read/ ,
          'permissions: { contents: read, issues: write }',
        ),
    ],
    [
      'an additional top-level block write permission',
      (workflow) =>
        workflow.replace(
          /permissions:\r?\n  contents: read/ ,
          'permissions:\n  contents: read\n  issues: write',
        ),
    ],
    [
      'job-level permissions write-all',
      (workflow) =>
        workflow.replace(
          /  quality:\r?\n/ ,
          '  quality:\n    permissions: write-all\n',
        ),
    ],
    [
      'a job-level inline write permission',
      (workflow) =>
        workflow.replace(
          /  quality:\r?\n/ ,
          '  quality:\n    permissions: { contents: read, actions: write }\n',
        ),
    ],
    [
      'any job-level permissions override',
      (workflow) =>
        workflow.replace(
          /  quality:\r?\n/ ,
          '  quality:\n    permissions:\n      contents: read\n',
        ),
    ],
    [
      'a quoted pull_request_target event',
      (workflow) =>
        workflow.replace(
          /on:\r?\n/ ,
          'on:\n  "pull_request_target": {}\n',
        ),
    ],
    [
      'a flow-style on map containing pull_request_target',
      (workflow) =>
        workflow.replace(
          /on:\r?\n  pull_request:\r?\n    branches: \[main, master\]\r?\n  workflow_dispatch:/,
          'on: { pull_request: {}, pull_request_target: {} }',
        ),
    ],
    [
      'a quoted inline upload action',
      (workflow) =>
        workflow.replace(
          /    steps:\r?\n/ ,
          '    steps:\n      - uses: "actions/upload-pages-artifact@v3"\n',
        ),
    ],
  ];

  it.each(forbiddenCiMutations)('rejects %s', async (_name, mutate) => {
    const workflow = await readRepositoryFile('.github/workflows/ci.yml');
    const mutated = mutate(workflow);
    expect(mutated).not.toBe(workflow);
    expect(() => expectCiSecurityContract(mutated)).toThrow();
  });

  it('rejects a Pages artifact upload moved ahead of the quality gates', async () => {
    const workflow = await readRepositoryFile('.github/workflows/deploy.yml');
    const uploadPattern =
      /      - name: Upload artifact\r?\n        uses: actions\/upload-pages-artifact@v3\r?\n        with:\r?\n          path: \.\/dist\r?\n?/;
    const uploadStep = workflow.match(uploadPattern)?.[0];
    expect(uploadStep, 'upload step fixture missing').toBeTruthy();

    const withoutUpload = workflow.replace(uploadPattern, '');
    const mutated = withoutUpload.replace(
      /      - name: Run tests/ ,
      uploadStep!.trimEnd() + '\n\n      - name: Run tests',
    );
    const buildJob = yamlBlock(yamlBlock(mutated, 'jobs'), 'build', 2);

    expect(mutated).not.toBe(workflow);
    expect(() => expectDeployBuildOperations(buildJob)).toThrow();
  });
});
describe('Pages deployment workflow contract', () => {
  it('does not expose privileged manual or alternate-branch deployment triggers', async () => {
    const workflow = await readRepositoryFile('.github/workflows/deploy.yml');
    const onBlock = yamlBlock(workflow, 'on');

    expect(onBlock.replace(/\r\n/g, '\n').trim()).toBe(
      'on:\n  push:\n    branches: [main]',
    );
  });

  it('gates the existing Pages deployment behind the same quality commands', async () => {
    const workflow = await readRepositoryFile('.github/workflows/deploy.yml');
    const onBlock = yamlBlock(workflow, 'on');
    const permissionsBlock = yamlBlock(workflow, 'permissions');
    const jobsBlock = yamlBlock(workflow, 'jobs');
    const buildJob = yamlBlock(jobsBlock, 'build', 2);
    const deployJob = yamlBlock(jobsBlock, 'deploy', 2);

    expect(onBlock).toMatch(/^\s{2}push:\s*$/m);
    expect(onBlock).toMatch(/^\s{4}branches:\s*\[\s*main\s*\]/m);
    expect(onBlock).not.toMatch(/^\s{2}workflow_dispatch:\s*/m);

    expect(permissionsBlock).toMatch(/^\s{2}contents:\s*read\s*$/m);
    expect(permissionsBlock).not.toMatch(/^\s{2}pages:\s*write\s*$/m);
    expect(permissionsBlock).not.toMatch(/^\s{2}id-token:\s*write\s*$/m);

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

    expectDeployBuildOperations(buildJob);

    expect(deployJob).toMatch(/^\s{4}needs:\s*build\s*$/m);
    expect(deployJob).toMatch(/^\s{6}pages:\s*write\s*$/m);
    expect(deployJob).toMatch(/^\s{6}id-token:\s*write\s*$/m);
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

describe('release documentation contract', () => {
  it('documents the exact maintainer release gate and handoff', async () => {
    const checklist = await readRepositoryFile('docs/RELEASE_CHECKLIST.md');

    expect(checklist).toMatch(
      /dependency metadata[\s\S]*npm ci --no-audit --no-fund/i,
    );
    expectInOrder(checklist.split(/\r?\n/).map((line) => line.trim()), [
      'npm test',
      'npx tsc --noEmit',
      'npm run content:verify',
      'npm run build',
    ]);
    expect(checklist).toContain('CI / quality');
    expect(checklist).toMatch(
      /repository maintainer[\s\S]*manually[\s\S]*branch protection/i,
    );
    expect(checklist).toMatch(
      /content:verify[\s\S]*offline[\s\S]*read-only/i,
    );
    expect(checklist).toMatch(/content:check[\s\S]*network-backed/i);
    expect(checklist).toMatch(
      /generated data[\s\S]*source snapshot[\s\S]*generator/i,
    );
    expect(checklist).toMatch(/Pages workflow[\s\S]*pushes to main[\s\S]*no manual dispatch/i);
    expect(checklist).toMatch(/write permissions[\s\S]*deploy job/i);
  });

  it('links the roadmap release section to the detailed checklist', async () => {
    const roadmap = await readRepositoryFile('ROADMAP.md');

    expect(roadmap).toContain(
      '[release verification checklist](docs/RELEASE_CHECKLIST.md)',
    );
  });
});
