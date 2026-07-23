// Generates data/caTasks.ts from a committed, reviewed OSRS Wiki snapshot.
// The default sync is deliberately offline: source refreshes are explicit review work,
// while normal development and CI always render the same bytes.
import { readFileSync, writeFileSync } from 'node:fs';

export const CA_TIERS = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'];
export const EXPECTED_CA_COUNTS = {
  Easy: 41,
  Medium: 60,
  Hard: 86,
  Elite: 164,
  Master: 174,
  Grandmaster: 121,
};

const SNAPSHOT = new URL('../data/sources/combat-achievement-tasks.json', import.meta.url);
const OUT = new URL('../data/caTasks.ts', import.meta.url);

const escapeTypeScript = value => value
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'");

export function validateCombatAchievementSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('CA snapshot is empty');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.verifiedAt ?? '')) {
    throw new Error('CA snapshot verifiedAt must be YYYY-MM-DD');
  }
  if (snapshot.source?.url !== 'https://oldschool.runescape.wiki/w/Combat_Achievements') {
    throw new Error('CA snapshot has an unknown official source URL');
  }
  if (!Number.isInteger(snapshot.source?.revision) || snapshot.source.revision <= 0) {
    throw new Error('CA snapshot source revision is missing');
  }
  if (snapshot.source?.officialRows !== 646) {
    throw new Error('CA snapshot source must declare exactly 646 official rows');
  }

  if (
    snapshot.source?.endpoint !== 'https://oldschool.runescape.wiki/api.php'
    || !/^2026-07-23T/.test(snapshot.source?.retrievedAt ?? '')
  ) {
    throw new Error('CA snapshot official API retrieval metadata is missing');
  }
  const expectedThresholds = [41, 161, 419, 1075, 1945, 2671];
  if (
    JSON.stringify(snapshot.source?.authoritativeGlobals?.counts)
      !== JSON.stringify(EXPECTED_CA_COUNTS)
    || JSON.stringify(snapshot.source?.authoritativeGlobals?.thresholds)
      !== JSON.stringify(expectedThresholds)
  ) {
    throw new Error('CA snapshot authoritative Globals baseline drifted');
  }
  if (!/overview.*637.*live.*646/i.test(snapshot.source?.discrepancy ?? '')) {
    throw new Error('CA snapshot must document the stale overview discrepancy');
  }

  const tierSources = snapshot.source?.tierSources;
  if (!Array.isArray(tierSources) || tierSources.length !== CA_TIERS.length) {
    throw new Error('CA snapshot must pin all six official tier pages');
  }
  for (const tier of CA_TIERS) {
    const source = tierSources.find(candidate => candidate.tier === tier);
    if (!source || !Number.isInteger(source.revision) || source.revision <= 0) {
      throw new Error(`CA snapshot source revision is missing for ${tier}`);
    }
    if (source.officialRows !== EXPECTED_CA_COUNTS[tier]) {
      throw new Error(`CA snapshot source count drift for ${tier}`);
    }
  }

  if (!Array.isArray(snapshot.tasks) || snapshot.tasks.length !== 646) {
    throw new Error(`CA snapshot task count must be 646, got ${snapshot.tasks?.length ?? 0}`);
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
