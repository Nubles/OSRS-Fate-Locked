import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_PATH,
  evaluatePlayerFacingChangelog,
  isPlayerFacingPath,
  normalizeRepositoryPath,
} from './player-facing-changelog.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verifyScript = resolve(
  repositoryRoot,
  'scripts/verify-player-facing-changelog.mjs',
);
const contentSyncDocumentation = readFileSync(
  resolve(repositoryRoot, 'docs/CONTENT_SYNC.md'),
  'utf8',
);
const packageJson = JSON.parse(readFileSync(
  resolve(repositoryRoot, 'package.json'),
  'utf8',
)) as { scripts: Record<string, string> };

const runGit = (cwd: string, args: string[]) =>
  execFileSync('git', args, { cwd, stdio: 'ignore' });

const createGateRepository = () => {
  const cwd = mkdtempSync(join(tmpdir(), 'fate-changelog-gate-'));
  mkdirSync(join(cwd, 'data'));
  writeFileSync(join(cwd, 'App.tsx'), 'export const App = () => null;\n');
  writeFileSync(join(cwd, 'data/changelog.ts'), 'export const releases = [];\n');
  runGit(cwd, ['init']);
  runGit(cwd, ['config', 'user.email', 'gate@example.invalid']);
  runGit(cwd, ['config', 'user.name', 'Changelog Gate']);
  runGit(cwd, ['add', '.']);
  runGit(cwd, ['commit', '-m', 'fixture']);
  return cwd;
};

const runGate = (cwd: string) =>
  spawnSync(process.execPath, [verifyScript, 'HEAD'], {
    cwd,
    encoding: 'utf8',
  });

describe('player-facing changelog path classification', () => {
  it.each([
    'App.tsx',
    'constants.ts',
    'index.html',
    'index.tsx',
    'styles.css',
    'types.ts',
    'components/RuneLiteOnboarding.tsx',
    'data/changelog.ts',
    'hooks/useOnlineSync.ts',
    'public/manifest.webmanifest',
    'services/relaySync.ts',
    'utils/runelitePairing.ts',
    'workers/relay/src/index.ts',
  ])('treats %s as player-facing production code', (path) => {
    expect(isPlayerFacingPath(path)).toBe(true);
  });

  it.each([
    'App.lifecycle.test.tsx',
    'components/RuneLiteOnboarding.test.tsx',
    'data/changelog.test.ts',
    'utils/__tests__/saveSchema.ts',
    'fixtures/player-state.ts',
    'README.md',
    'docs/RELEASE_CHECKLIST.md',
    'scripts/sync-chunk-content.mjs',
    '.github/workflows/ci.yml',
    'package.json',
    'vite.config.ts',
  ])('does not require a release entry for %s by itself', (path) => {
    expect(isPlayerFacingPath(path)).toBe(false);
  });

  it('normalizes Windows and repository-relative path separators', () => {
    expect(normalizeRepositoryPath('.\\components\\RuneLiteOnboarding.tsx'))
      .toBe('components/RuneLiteOnboarding.tsx');
    expect(isPlayerFacingPath('components\\RuneLiteOnboarding.tsx')).toBe(true);
  });
});

describe('player-facing changelog gate decision', () => {
  it('fails a player-facing change without the authored changelog', () => {
    expect(evaluatePlayerFacingChangelog(['App.tsx'])).toEqual({
      required: true,
      satisfied: false,
      playerFacingPaths: ['App.tsx'],
    });
  });

  it('passes a player-facing change accompanied by the authored changelog', () => {
    expect(evaluatePlayerFacingChangelog([
      'services/relaySync.ts',
      CHANGELOG_PATH,
      'components/RuneLiteOnboarding.tsx',
    ])).toEqual({
      required: true,
      satisfied: true,
      playerFacingPaths: [
        'components/RuneLiteOnboarding.tsx',
        'services/relaySync.ts',
      ],
    });
  });

  it('passes test, documentation, workflow, and maintainer-only changes', () => {
    expect(evaluatePlayerFacingChangelog([
      'README.md',
      'App.lifecycle.test.tsx',
      'scripts/ci-contract.test.ts',
      '.github/workflows/ci.yml',
    ])).toEqual({
      required: false,
      satisfied: true,
      playerFacingPaths: [],
    });
  });

  it('does not require another release entry for a changelog-only edit', () => {
    expect(evaluatePlayerFacingChangelog([CHANGELOG_PATH])).toEqual({
      required: false,
      satisfied: true,
      playerFacingPaths: [],
    });
  });
});

describe('player-facing changelog Git comparison', () => {
  it('requires a release entry when player-facing code is deleted', () => {
    const cwd = createGateRepository();

    try {
      rmSync(join(cwd, 'App.tsx'));
      const result = runGate(cwd);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('- App.tsx');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }, 15_000);

  it('requires a release entry when player-facing code moves outside product paths', () => {
    const cwd = createGateRepository();

    try {
      mkdirSync(join(cwd, 'docs'));
      runGit(cwd, ['mv', 'App.tsx', 'docs/App.tsx']);
      const result = runGate(cwd);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('- App.tsx');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }, 15_000);
});

describe('quest and chunk audit release contracts', () => {
  it('documents every source-review command and its network boundary', () => {
    expect(contentSyncDocumentation).toMatch(
      /chunks:source-check[\s\S]{0,250}networked[\s\S]{0,250}informational/i,
    );
    expect(contentSyncDocumentation).toMatch(
      /chunks:verify[\s\S]{0,250}offline[\s\S]{0,250}deterministic/i,
    );
    expect(contentSyncDocumentation).toMatch(
      /quests:source-refresh[\s\S]{0,250}networked[\s\S]{0,250}(revision|drift)/i,
    );
    expect(contentSyncDocumentation).toMatch(
      /quests:verify[\s\S]{0,250}offline[\s\S]{0,250}deterministic/i,
    );
    expect(contentSyncDocumentation).toMatch(
      /content:verify[\s\S]{0,250}offline[\s\S]{0,250}(aggregate|aggregates)/i,
    );
  });

  it('documents the pinned sources, reviewed ledgers, and compatibility policy', () => {
    expect(contentSyncDocumentation).toContain('data/sources/chunk-content-source.json');
    expect(contentSyncDocumentation).toContain('data/sources/chunk-content-transform-audit.json');
    expect(contentSyncDocumentation).toContain('data/sources/quest-list.json');
    expect(contentSyncDocumentation).toContain('data/sources/quest-requirement-audit.json');
    expect(contentSyncDocumentation).toMatch(/oldid/i);
    expect(contentSyncDocumentation).toMatch(/Recipe for Disaster|RFD/i);
    expect(contentSyncDocumentation).toMatch(/normal CI[\s\S]{0,250}offline/i);
  });

  it('runs quest verification once in the offline aggregate release order', () => {
    const contentVerify = packageJson.scripts['content:verify'];

    expect(contentVerify).toBe(
      'npm run diary:verify && npm run chunks:verify && npm run quests:verify && vitest run data/contentBaseline.test.ts data/tasksConsistency.test.ts utils/taskIdMigrations.test.ts utils/caProgress.test.ts',
    );
    expect(contentVerify).not.toContain('data/questRequirementAudit.test.ts');
    expect(packageJson.scripts['release:verify']).toBe(
      'npm run changelog:verify && npm test && npm run typecheck && npm run content:verify && npm run build',
    );
  });
});
