import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.DISCORD_ASSET_CHROME
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const jobs = [
  ['server-icon.html', 'fate-locked-server-icon.png', 512, 512],
  ['community-header.html', 'fate-locked-community-header.png', 1920, 1080],
  ['future-server-banner.html', 'fate-locked-future-server-banner.png', 960, 540],
];

const source = resolve(root, 'docs/discord/assets/source');
const output = resolve(root, 'docs/discord/assets');
mkdirSync(output, { recursive: true });

for (const [input, name, width, height] of jobs) {
  const result = spawnSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1', `--window-size=${width},${height}`,
    `--screenshot=${resolve(output, name)}`,
    pathToFileURL(resolve(source, input)).href,
  ], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
