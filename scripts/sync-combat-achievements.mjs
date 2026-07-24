// Generates data/caTasks.ts from a committed, reviewed OSRS Wiki snapshot.
// The default sync is deliberately offline: source refreshes are explicit review work,
// while normal development and CI always render the same bytes.
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

export const CA_TIERS = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'];

const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
};

export const EXPECTED_CA_PROVENANCE = deepFreeze({
  verifiedAt: '2026-07-23',
  source: {
    url: 'https://oldschool.runescape.wiki/w/Combat_Achievements',
    revision: 15272408,
    revisionTimestamp: '2026-07-22T17:11:33Z',
    endpoint: 'https://oldschool.runescape.wiki/api.php',
    taskTableQuery: {
      action: 'parse',
      page: 'Combat Achievements/<tier>',
      prop: 'text',
      format: 'json',
    },
    globalsQuery: {
      action: 'parse',
      text: '{{Globals|ca <tier> tasks}} and {{Globals|ca <tier> points}}',
      contentmodel: 'wikitext',
      prop: 'text',
      format: 'json',
    },
    retrievedAt: '2026-07-23T19:13:36.119Z',
    overviewDeclaredRows: 637,
    officialRows: 646,
    authoritativeGlobals: {
      counts: {
        Easy: 41,
        Medium: 60,
        Hard: 86,
        Elite: 164,
        Master: 174,
        Grandmaster: 121,
      },
      thresholds: [41, 161, 419, 1075, 1945, 2671],
    },
    discrepancy: 'The overview revision still displays 637 rows; live official Globals and tier API tables return 646 after the Maggot King additions.',
    tierSources: [
      {
        tier: 'Easy',
        url: 'https://oldschool.runescape.wiki/w/Combat_Achievements/Easy',
        revision: 15272565,
        revisionTimestamp: '2026-07-22T19:56:56Z',
        officialRows: 41,
      },
      {
        tier: 'Medium',
        url: 'https://oldschool.runescape.wiki/w/Combat_Achievements/Medium',
        revision: 15135540,
        revisionTimestamp: '2026-02-25T18:48:27Z',
        officialRows: 60,
      },
      {
        tier: 'Hard',
        url: 'https://oldschool.runescape.wiki/w/Combat_Achievements/Hard',
        revision: 15272569,
        revisionTimestamp: '2026-07-22T19:58:23Z',
        officialRows: 86,
      },
      {
        tier: 'Elite',
        url: 'https://oldschool.runescape.wiki/w/Combat_Achievements/Elite',
        revision: 15272563,
        revisionTimestamp: '2026-07-22T19:55:28Z',
        officialRows: 164,
      },
      {
        tier: 'Master',
        url: 'https://oldschool.runescape.wiki/w/Combat_Achievements/Master',
        revision: 15272564,
        revisionTimestamp: '2026-07-22T19:55:46Z',
        officialRows: 174,
      },
      {
        tier: 'Grandmaster',
        url: 'https://oldschool.runescape.wiki/w/Combat_Achievements/Grandmaster',
        revision: 15025941,
        revisionTimestamp: '2025-11-13T02:26:22Z',
        officialRows: 121,
      },
    ],
  },
});

export const EXPECTED_CA_COUNTS =
  EXPECTED_CA_PROVENANCE.source.authoritativeGlobals.counts;
const EXPECTED_CA_TOTAL = Object.values(EXPECTED_CA_COUNTS)
  .reduce((total, count) => total + count, 0);

const SNAPSHOT = new URL('../data/sources/combat-achievement-tasks.json', import.meta.url);
const OUT = new URL('../data/caTasks.ts', import.meta.url);

const escapeTypeScript = value => value
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'");

export function validateCombatAchievementSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('CA snapshot is empty');

  const actualProvenance = {
    verifiedAt: snapshot.verifiedAt,
    source: snapshot.source,
  };
  if (!isDeepStrictEqual(actualProvenance, EXPECTED_CA_PROVENANCE)) {
    throw new Error(
      'CA snapshot provenance does not exactly match the reviewed official API baseline',
    );
  }

  if (!Array.isArray(snapshot.tasks) || snapshot.tasks.length !== EXPECTED_CA_TOTAL) {
    throw new Error(
      `CA snapshot task count must be ${EXPECTED_CA_TOTAL}, got ${snapshot.tasks?.length ?? 0}`,
    );
  }

  const counts = Object.fromEntries(CA_TIERS.map(tier => [tier, 0]));
  const ids = new Set();
  for (const task of snapshot.tasks) {
    if (!/^ca_\d+$/.test(task.id ?? '')) {
      throw new Error(`CA task has unstable official id: ${task.id ?? '<missing>'}`);
    }
    if (ids.has(task.id)) throw new Error(`duplicate CA task id: ${task.id}`);
    ids.add(task.id);
    if (!CA_TIERS.includes(task.tierId)) {
      throw new Error(`unknown CA tier: ${task.tierId ?? '<missing>'}`);
    }
    if (
      typeof task.monster !== 'string' || !task.monster.trim()
      || typeof task.name !== 'string' || !task.name.trim()
      || typeof task.description !== 'string' || !task.description.trim()
    ) {
      throw new Error(`CA task ${task.id} has incomplete official text`);
    }
    counts[task.tierId] += 1;
  }

  for (const tier of CA_TIERS) {
    if (counts[tier] !== EXPECTED_CA_COUNTS[tier]) {
      throw new Error(
        `CA ${tier} count drift: expected ${EXPECTED_CA_COUNTS[tier]}, got ${counts[tier]}`,
      );
    }
  }

  return { tasks: snapshot.tasks, counts };
}

export function renderCombatAchievementTasks(snapshot) {
  const { tasks } = validateCombatAchievementSnapshot(snapshot);
  const lines = [
    '',
    'export interface CATask {',
    '  id: string;',
    '  tierId: string;',
    '  monster: string;',
    '  /** Official in-game task name (e.g. "Noxious Foe"). */',
    '  name?: string;',
    '  description: string;',
    '}',
    '',
    '// Generated from data/sources/combat-achievement-tasks.json.',
    '// Source API snapshot retrieved ' + snapshot.source.retrievedAt + '.',
    '// Overview revision ' + snapshot.source.revision + ' is stale at 637; see snapshot metadata.',
    '// Verified: ' + snapshot.verifiedAt + '. Run npm run ca:sync; do not hand-edit.',
    'export const ALL_CA_TASKS: CATask[] = [',
  ];

  for (const tier of CA_TIERS) {
    const group = tasks
      .filter(task => task.tierId === tier)
      .sort((left, right) => Number(left.id.slice(3)) - Number(right.id.slice(3)));
    lines.push(`  // ${tier.toUpperCase()} TIER (${group.length})`);
    for (const task of group) {
      lines.push(
        `  { id: '${escapeTypeScript(task.id)}', tierId: '${tier}', monster: '${escapeTypeScript(task.monster)}', name: '${escapeTypeScript(task.name)}', description: '${escapeTypeScript(task.description)}' },`,
      );
    }
  }
  lines.push('];', '');
  return lines.join('\n');
}

export function main() {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8').replace(/^\uFEFF/, ''));
  const rendered = renderCombatAchievementTasks(snapshot);
  writeFileSync(OUT, rendered);
  const { counts } = validateCombatAchievementSnapshot(snapshot);
  for (const tier of CA_TIERS) console.log(`[ca:sync] ${tier}: ${counts[tier]}`);
  console.log('[ca:sync] wrote data/caTasks.ts: 646 tasks from the committed snapshot.');
}

if (
  import.meta.url === `file://${process.argv[1]}`
  || process.argv[1]?.endsWith('sync-combat-achievements.mjs')
) {
  try {
    main();
  } catch (error) {
    console.error('[ca:sync] failed:', error.message);
    process.exitCode = 1;
  }
}
