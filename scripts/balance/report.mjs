// Fate balance check report.
//
//   node scripts/balance/report.mjs                 print the report (Markdown)
//   node scripts/balance/report.mjs --out r.md      also write it to a file
//   node scripts/balance/report.mjs --json r.json   write the raw numbers too
//   node scripts/balance/report.mjs --write-baseline
//                                                   save today's numbers as the
//                                                   baseline the report compares to
//   RUNS=50 node scripts/balance/report.mjs         fewer runs, for a quick look
//
// It reads the live rules and content through Vite (scripts/balance/inputs.ts),
// simulates whole runs with the same seeds every time, and compares them with
// scripts/balance/baseline.json. It changes nothing in the game: a maintainer
// reads the report and decides. Run nightly by .github/workflows/balance-check.yml.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';
import { simulate, SCENARIOS, scenarioName, PROFILES } from './roll-sim.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BASELINE = join(HERE, 'baseline.json');
/** A median that moves more than this share from the baseline is flagged. */
export const DRIFT = 0.05;

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };

export const loadInputs = async () => {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscoverDependencies: true } });
  try {
    const mod = await server.ssrLoadModule('/scripts/balance/inputs.ts');
    return JSON.parse(JSON.stringify(mod.balanceInputs()));
  } finally {
    await server.close();
  }
};

export const runAll = (inputs, runs) =>
  Object.fromEntries(SCENARIOS.map(s => [scenarioName(s), simulate(inputs, s, runs)]));

/** Paths whose values differ between two plain JSON values. */
export const diffPaths = (a, b, path = '') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  const bothObjects = a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b);
  if (!bothObjects) return [{ path: path || '(all)', was: a, now: b }];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => diffPaths(a[k], b[k], path ? `${path}.${k}` : k));
};

const fmt = (n) => (n === undefined || n === null ? '–' : Math.round(n).toLocaleString('en-GB'));
const short = (v) => { const s = JSON.stringify(v); return s === undefined ? '–' : s.length > 60 ? `${s.slice(0, 57)}…` : s; };
const change = (now, was) => {
  if (was === undefined || was === null || was === 0) return { text: 'new', flagged: false };
  const d = (now - was) / was;
  const pct = `${d >= 0 ? '+' : ''}${(100 * d).toFixed(1)}%`;
  return { text: Math.abs(d) < 0.0005 ? 'same' : pct, flagged: Math.abs(d) > DRIFT };
};

export const renderReport = ({ inputs, results, runs, baseline, commit }) => {
  const lines = [];
  const flags = [];
  const sameRuns = baseline && baseline.runs === runs;
  lines.push('# Fate balance check', '');
  lines.push(`${runs} simulated runs per play style${commit ? ` on \`${commit.slice(0, 7)}\`` : ''}, the same seeds every time, so a change below comes from the rules or the content, not luck.`);
  if (!baseline) lines.push('', 'No baseline yet: run `node scripts/balance/report.mjs --write-baseline` and commit scripts/balance/baseline.json.');
  else if (!sameRuns) lines.push('', `The baseline used ${baseline.runs} runs, so small changes are noise this time.`);
  lines.push('', '| Play style | Unlocks | Rolls to 100% (10th to 90th) | vs baseline | Keys won | Pity Keys | Chaos Keys | Longest dry spell | Runs with 200+ misses in a row |');
  lines.push('|---|---:|---|---:|---:|---:|---:|---:|---:|');
  for (const [name, r] of Object.entries(results)) {
    const was = baseline?.results?.[name];
    const c = change(r.rollsAt100.med, was?.rollsAt100?.med);
    if (c.flagged && sameRuns) flags.push(`**${name}**: rolls to 100% went from ${fmt(was.rollsAt100.med)} to ${fmt(r.rollsAt100.med)} (${c.text}).`);
    lines.push(`| ${name} | ${fmt(r.unlocks)} | **${fmt(r.rollsAt100.med)}** (${fmt(r.rollsAt100.p10)} to ${fmt(r.rollsAt100.p90)}) | ${c.flagged ? `⚠️ ${c.text}` : c.text} | ${fmt(r.keysWon.med)} | ${fmt(r.pity.med)} | ${fmt(r.chaos.med)} | ${fmt(r.maxMiss.med)} | ${r.miss200}% |`);
  }
  lines.push('');
  if (baseline) {
    if (flags.length) lines.push('## Moved more than 5%', '', ...flags.map(f => `- ${f}`), '');
    else lines.push(`Nothing moved more than ${DRIFT * 100}% from the baseline.`, '');
    const changes = diffPaths(baseline.inputs, inputs);
    lines.push('## What changed since the baseline', '');
    if (!changes.length) lines.push('No rule or content numbers changed.');
    else {
      lines.push('| Number | Baseline | Now |', '|---|---|---|');
      for (const ch of changes.slice(0, 40)) lines.push(`| \`${ch.path}\` | ${short(ch.was)} | ${short(ch.now)} |`);
      if (changes.length > 40) lines.push(`| …and ${changes.length - 40} more | | |`);
    }
    lines.push('');
  }
  const main = results['vanilla/main'];
  if (main) {
    lines.push('## Where a Vanilla main run gets its Keys', '');
    lines.push(Object.entries(main.keysFrom).map(([g, p]) => `${g} ${p}%`).join(' · '), '');
  }
  lines.push('<details><summary>How the runs are played</summary>', '');
  for (const [id, p] of Object.entries(PROFILES)) lines.push(`- **${id}**: ${p.label}.`);
  lines.push('- Content comes in order of play: levels at their share of 99 XP, quests, diaries and Combat Achievements in windows by tier.',
    '- Content at a point in the run needs that share of all unlocks first; when the run is short, the player farms Slayer.',
    '- Bosses and minigames pay their Key reserves and then stop. Rituals are not cast, except Chaos in the `/chaos` row (every 25 Fate).',
    '- Not modelled: Saradomin\'s Ward and the other rituals, Chunked tier caps, Breakthrough rolls, Fate\'s Mercy, fated sites, omens and the Cartographer, and being stuck on one specific missing unlock.',
    '', '</details>');
  return { markdown: lines.join('\n'), flags };
};

const main = async () => {
  const runs = Number(process.env.RUNS ?? 1000);
  const inputs = await loadInputs();
  const results = runAll(inputs, runs);
  if (process.argv.includes('--write-baseline')) {
    writeFileSync(BASELINE, `${JSON.stringify({ runs, inputs, results }, null, 1)}\n`);
    console.log(`Baseline written to ${BASELINE}`);
    return;
  }
  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
  const { markdown, flags } = renderReport({ inputs, results, runs, baseline, commit: process.env.GITHUB_SHA });
  console.log(markdown);
  const out = arg('--out');
  if (out) writeFileSync(out, `${markdown}\n`);
  const json = arg('--json');
  if (json) writeFileSync(json, `${JSON.stringify({ runs, inputs, results }, null, 1)}\n`);
  // A GitHub warning on the run page; the job still passes, since this only reports.
  for (const f of flags) console.log(`::warning title=Fate balance moved::${f.replace(/\*\*/g, '')}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => { console.error(err); process.exit(1); });
}
