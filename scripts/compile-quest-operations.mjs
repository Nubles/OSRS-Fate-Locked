import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Keep source evidence out of the player bundle; only evaluated clauses ship. */
export function compileQuestOperations(source) {
  return Object.fromEntries(Object.entries(source.entries).map(([id, row]) => [id,
    ['required', 'quest-provided', 'none'].includes(row.status) && Array.isArray(row.checks)
      ? row.checks.map(check => check.label) : null,
  ]));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'data/sources/quest-operational-items.json'), 'utf8'));
  const target = path.join(root, 'data/questOperationalChecks.json');
  const output = JSON.stringify(compileQuestOperations(source)) + '\n';
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Quest operational runtime data is stale; run node scripts/compile-quest-operations.mjs');
    console.log('Quest operational runtime data matches its source snapshot.');
  } else fs.writeFileSync(target, output);
}
