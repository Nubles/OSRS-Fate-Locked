// Rewrites public/discord-area-guide.json, the Discord bot's /area data.
// scripts/discordAreaGuide.test.ts does the work; this sets its write mode in a
// way that also works in Windows shells.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['vitest', 'run', 'scripts/discordAreaGuide.test.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, FATE_DISCORD_AREAS: 'write' },
});
process.exit(result.status ?? 1);
