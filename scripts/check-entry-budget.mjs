/**
 * Fails the build when the eager entry chunk grows past its gzip budget.
 *
 * Everything in the entry chunk downloads and parses before the first render,
 * so a heavy module imported eagerly by mistake (instead of through
 * lazyWithRetry) shows up here first. When the budget is exceeded, look for
 * what should be lazy before raising it; raise it only on purpose.
 */
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// 232: the Void Altar's newer rituals live in the reducer (2026-10-15); their activity checks load lazily.
// 233: achievement rewards (free rituals, back pay) settle in the reducer; Vanilla minigame Key reserves load with the save.
// 234: activity Key boosts from achievements apply in every Key roll, so their small table loads with the game.
// 236: both of the above together with main's minigame reserves (235.5 on 2026-10-15).
// 241: the OSRS layout's switch, frame and shared Farm Keys model joined main's rewards (240.4 on 2026-10-15).
// 242: caches in the reachability, quest points and Skill Advisor checks that stop an unlock freezing the page (240.9 on 2026-10-16).
// 247: Chunked's fate rules (Breakthrough, Fate's Mercy, exploring rolls) and the chunk skill table its Key pool reads, about 3.2 kB of it (246.5 on 2026-10-17).
// 250: the Chunked review's fixes: exact-chunk checks for bosses, minigames, guilds, banks and Slayer masters, Mercy's Fate and quest checks, the tier-cap rule, free-draw reveals and chunk labels, and the Journal's exact-chunk hook (249.3 on 2026-10-17).
// 251: plus the walk-based Chunked frontier and sea reach, and the skill-training facts (courses, patches, altars, ports, quest gates) (250.1 on 2026-10-17).
// 253: the Chunked audit's fixes: exact levels and services in the chunk skill rows, entry-quest gates for places, the kept Cartographer offer, Mercy's patch and guild draws and its quiet-spell way out (252.5 on 2026-10-18).
// 255: Chunked's Fate's Thread and fate's marks in the game engine, which every save runs through (254.2 on 2026-10-18).
// 256: the build check behind chunk-error reloads, so a dropped connection doesn't reload onto the browser's error page (254.8 on 2026-10-18).
// 219: advisors, the Activities sub-panels, the RuneLite bundle builder and the content service behind the journal routes load on demand (216.1 on 2026-10-19); about 3 kB of headroom, so growth shows.
export const ENTRY_GZIP_BUDGET_KB = 219;

/** The entry script that dist/index.html loads, as a path inside distDir. */
export const entryScriptPath = (distDir, indexHtml) => {
  const match = indexHtml.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/);
  if (!match) throw new Error('dist/index.html has no module entry script.');
  return join(distDir, 'assets', basename(match[1]));
};

export const evaluateEntryBudget = (gzipBytes, budgetKb = ENTRY_GZIP_BUDGET_KB) => {
  const gzipKb = gzipBytes / 1000;
  return { ok: gzipKb <= budgetKb, gzipKb, budgetKb };
};

const main = () => {
  const distDir = resolve(process.argv[2] ?? 'dist');
  const entry = entryScriptPath(distDir, readFileSync(join(distDir, 'index.html'), 'utf8'));
  const result = evaluateEntryBudget(gzipSync(readFileSync(entry)).length);
  const summary = `${basename(entry)} is ${result.gzipKb.toFixed(1)} kB gzip (budget ${result.budgetKb} kB).`;
  if (!result.ok) {
    console.error(`Entry chunk over budget: ${summary}`);
    console.error('Load new screens and data through lazyWithRetry, or raise ENTRY_GZIP_BUDGET_KB in scripts/check-entry-budget.mjs on purpose.');
    process.exit(1);
  }
  console.log(`Entry chunk within budget: ${summary}`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
