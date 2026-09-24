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

export const ENTRY_GZIP_BUDGET_KB = 225;

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
