// Rewrites contracts/golden-bundles from the app's current rules export.
// scripts/goldenBundles.test.ts does the work; this sets its write mode in a
// way that also works in Windows shells.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['vitest', 'run', 'scripts/goldenBundles.test.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, FATE_GOLDENS: 'write' },
});
process.exit(result.status ?? 1);
