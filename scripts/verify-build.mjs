import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const budgets = JSON.parse(fs.readFileSync(new URL('./build-budgets.json', import.meta.url)));
// Run Vite directly so Windows and CI exercise exactly the same warning check.
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { encoding: 'utf8' });
process.stdout.write(build.stdout || '');
process.stderr.write(build.stderr || '');
if (build.status !== 0) process.exit(build.status || 1);
const log = `${build.stdout}\n${build.stderr}`.replace(/\x1b\[[0-9;]*m/g, '').replaceAll('\\', '/');
const failures = [];
for (const [file, limit] of Object.entries(budgets.sourceArtifactGzipBytes)) {
  const bytes = gzipSync(fs.readFileSync(file)).length;
  if (bytes > limit) failures.push(`${file}: gzip ${bytes} > ${limit}`);
}
const warningLines = log.split('\n').filter(line => /\(!\)|warning:|deprecated/i.test(line));
const counts = new Map();
for (const line of warningLines) {
  let known = line.includes('Some chunks are larger than 500 kB after minification') ? 'legacy-size-warning' : undefined;
  for (const module of budgets.knownMixedImports) {
    if (line.includes(`${module} is dynamically imported by`) && line.includes('dynamic import will not move module into another chunk')) known = module;
  }
  if (!known) failures.push(`New build warning: ${line}`);
  else counts.set(known, (counts.get(known) || 0) + 1);
}
for (const [warning, count] of counts) if (count > 1) failures.push(`Repeated build warning: ${warning} (${count})`);

const assets = fs.readdirSync('dist/assets').filter(file => /\.(js|css)$/.test(file));
const sizes = new Map(assets.map(file => [file, gzipSync(fs.readFileSync(path.join('dist/assets', file))).length]));
const html = fs.readFileSync('dist/index.html', 'utf8');
const initial = [...new Set([...html.matchAll(/(?:src|href)="[^"\n]*\/assets\/([^"\n]+\.(?:js|css))"/g)].map(match => match[1]))];
const initialGzipBytes = initial.reduce((sum, file) => sum + (sizes.get(file) || 0), 0);
if (initial.length === 0) failures.push('No initial assets discovered');
for (const file of initial) if (!sizes.has(file)) failures.push(`Initial asset missing from output: ${file}`);
if (initialGzipBytes > budgets.initialGzipBytes) failures.push(`Initial gzip ${initialGzipBytes} > ${budgets.initialGzipBytes}`);
for (const [file, bytes] of sizes) {
  if (bytes > budgets.largestChunkGzipBytes) failures.push(`${file}: gzip ${bytes} > ${budgets.largestChunkGzipBytes}`);
  for (const [name, limit] of Object.entries(budgets.namedChunkGzipBytes)) {
    if (file.startsWith(`${name}-`) && file.endsWith('.js') && bytes > limit) failures.push(`${file}: gzip ${bytes} > ${limit}`);
  }
}
for (const name of budgets.mustStayLazy) {
  if (!assets.some(file => file.startsWith(`${name}-`) && file.endsWith('.js'))) failures.push(`${name} is no longer a separate lazy chunk`);
  if (initial.some(file => file.startsWith(`${name}-`))) failures.push(`${name} entered the initial bundle`);
}
console.log(JSON.stringify({ initialGzipBytes, initial, gzipBytes: Object.fromEntries(sizes), acceptedWarnings: Object.fromEntries(counts) }, null, 2));
if (failures.length) throw new Error(failures.join('\n'));
console.log('Compressed bundle and build-warning budgets passed.');
