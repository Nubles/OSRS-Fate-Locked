import { execFileSync } from 'node:child_process';
import {
  CHANGELOG_PATH,
  evaluatePlayerFacingChangelog,
} from './player-facing-changelog.mjs';

const baseRef =
  process.argv[2]?.trim() ||
  process.env.CHANGELOG_BASE_REF?.trim() ||
  'origin/main';

const gitLines = (args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

let changedPaths;

try {
  changedPaths = [
    ...gitLines([
      'diff',
      '--name-only',
      '--diff-filter=ACMRT',
      `${baseRef}...HEAD`,
    ]),
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMRT']),
    ...gitLines([
      'diff',
      '--cached',
      '--name-only',
      '--diff-filter=ACMRT',
    ]),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ];
} catch (error) {
  const detail = error?.stderr?.toString().trim() || error?.message || String(error);
  console.error(`Unable to compare player-facing changes with ${baseRef}.`);
  console.error(detail);
  process.exitCode = 2;
}

if (changedPaths) {
  const decision = evaluatePlayerFacingChangelog(changedPaths);

  if (!decision.satisfied) {
    console.error(
      `Player-facing files changed without updating ${CHANGELOG_PATH}:`,
    );
    for (const path of decision.playerFacingPaths) {
      console.error(`- ${path}`);
    }
    console.error(`Add a newest-first What's New release before publishing.`);
    process.exitCode = 1;
  } else if (decision.required) {
    console.log(
      `What's New verified for ${decision.playerFacingPaths.length} player-facing file(s).`,
    );
  } else {
    console.log(`No player-facing files require a What's New entry.`);
  }
}
