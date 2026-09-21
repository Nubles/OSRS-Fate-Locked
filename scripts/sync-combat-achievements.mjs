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
  "verifiedAt": "2026-09-21",
  "source": {
    "url": "https://oldschool.runescape.wiki/w/Combat_Achievements",
    "revision": 15347364,
    "revisionTimestamp": "2026-09-16T21:20:12Z",
    "endpoint": "https://oldschool.runescape.wiki/api.php",
    "taskTableQuery": {
      "action": "parse",
      "page": "Combat Achievements/<tier>",
      "prop": "text",
      "format": "json"
    },
    "globalsQuery": {
      "action": "parse",
      "text": "{{Globals|ca <tier> tasks}} and {{Globals|ca <tier> points}}",
      "contentmodel": "wikitext",
      "prop": "text",
      "format": "json"
    },
    "retrievedAt": "2026-09-21T16:32:10.000Z",
    "overviewDeclaredRows": 655,
    "officialRows": 655,
    "authoritativeGlobals": {
      "counts": {
        "Easy": 41,
        "Medium": 64,
        "Hard": 89,
        "Elite": 166,
        "Master": 173,
        "Grandmaster": 122
      },
      "thresholds": [
        41,
        169,
        436,
        1100,
        1965,
        2697
      ]
    },
    "discrepancy": "The six official tier task tables and authoritative Globals reconcile at 655 tasks; nine tasks were added since the August baseline.",
    "tierSources": [
      {
        "tier": "Easy",
        "url": "https://oldschool.runescape.wiki/w/Combat_Achievements/Easy",
        "revision": 15272565,
        "revisionTimestamp": "2026-07-22T19:56:56Z",
        "officialRows": 41
      },
      {
        "tier": "Medium",
        "url": "https://oldschool.runescape.wiki/w/Combat_Achievements/Medium",
        "revision": 15321194,
        "revisionTimestamp": "2026-08-26T17:04:05Z",
        "officialRows": 64
      },
      {
        "tier": "Hard",
        "url": "https://oldschool.runescape.wiki/w/Combat_Achievements/Hard",
        "revision": 15321192,
        "revisionTimestamp": "2026-08-26T17:03:25Z",
        "officialRows": 89
      },
      {
        "tier": "Elite",
        "url": "https://oldschool.runescape.wiki/w/Combat_Achievements/Elite",
        "revision": 15321189,
        "revisionTimestamp": "2026-08-26T17:02:37Z",
        "officialRows": 166
      },
      {
        "tier": "Master",
        "url": "https://oldschool.runescape.wiki/w/Combat_Achievements/Master",
        "revision": 15329081,
        "revisionTimestamp": "2026-09-02T23:22:12Z",
        "officialRows": 173
      },
      {
        "tier": "Grandmaster",
        "url": "https://oldschool.runescape.wiki/w/Combat_Achievements/Grandmaster",
        "revision": 15321195,
        "revisionTimestamp": "2026-08-26T17:04:58Z",
        "officialRows": 122
      }
    ]
  }
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
    '// ' + snapshot.source.discrepancy,
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
  console.log('[ca:sync] wrote data/caTasks.ts: 655 tasks from the committed snapshot.');
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
