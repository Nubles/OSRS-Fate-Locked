import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const atRoot = (relativePath: string) => join(repositoryRoot, relativePath);

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

  it('does not expose a mirror verification npm command', () => {
    const packageJson = JSON.parse(readFileSync(atRoot('package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts).not.toHaveProperty('runelite:mirror-check');
  });

  it.each([
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
  ])('retains the app-side RuneLite integration at %s', (relativePath) => {
    expect(existsSync(atRoot(relativePath))).toBe(true);
  });
});
