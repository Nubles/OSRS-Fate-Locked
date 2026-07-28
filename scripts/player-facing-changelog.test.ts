import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_PATH,
  evaluatePlayerFacingChangelog,
  isPlayerFacingPath,
  normalizeRepositoryPath,
} from './player-facing-changelog.mjs';

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
