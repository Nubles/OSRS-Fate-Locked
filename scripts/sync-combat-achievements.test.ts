import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_CA_PROVENANCE,
  renderCombatAchievementTasks,
  validateCombatAchievementSnapshot,
} from './sync-combat-achievements.mjs';

const loadSnapshot = () => JSON.parse(readFileSync(
  new URL('../data/sources/combat-achievement-tasks.json', import.meta.url),
  'utf8',
));

const collectLeafPaths = (
  value: unknown,
  prefix: string[] = [],
): string[][] => {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) =>
      collectLeafPaths(nested, [...prefix, key]));
  }
  return [prefix];
};

const getParentForPath = (root: unknown, path: string[]) => {
  let current = root as Record<string, unknown>;
  for (const segment of path.slice(0, -1)) {
    current = current[segment] as Record<string, unknown>;
  }
  return { parent: current, key: path.at(-1)! };
};

const getValueAtPath = (root: unknown, path: string[]) => {
  let current = root as Record<string, unknown>;
  for (const segment of path) {
    current = current[segment] as Record<string, unknown>;
  }
  return current;
};

const provenanceLeafPaths = collectLeafPaths(EXPECTED_CA_PROVENANCE)
  .map(path => [path.join('.'), path] as const);

describe('Combat Achievement offline generator', () => {
  it('pins official source revisions and the exact current tier distribution', () => {
    const snapshot = loadSnapshot();
    const validated = validateCombatAchievementSnapshot(snapshot);

    expect(snapshot.source.url).toBe(
      'https://oldschool.runescape.wiki/w/Combat_Achievements',
    );
    expect(snapshot.source.revision).toBe(15272408);
    expect(snapshot.verifiedAt).toBe('2026-07-23');
    expect(snapshot.source.retrievedAt).toMatch(/^2026-07-23T/);
    expect(snapshot.source.authoritativeGlobals.thresholds).toEqual([
      41, 161, 419, 1075, 1945, 2671,
    ]);
    expect(snapshot.source.discrepancy).toMatch(/overview.*637.*live.*646/i);
    expect(validated.counts).toEqual({
      Easy: 41,
      Medium: 60,
      Hard: 86,
      Elite: 164,
      Master: 174,
      Grandmaster: 121,
    });
    expect(validated.tasks).toHaveLength(646);
  });

  it('matches the single exact expected provenance fixture', () => {
    const snapshot = loadSnapshot();
    expect({
      verifiedAt: snapshot.verifiedAt,
      source: snapshot.source,
    }).toEqual(EXPECTED_CA_PROVENANCE);
  });

  it.each(provenanceLeafPaths)(
    'rejects provenance leaf removal at %s',
    (_label, path) => {
      const snapshot = loadSnapshot();
      const { parent, key } = getParentForPath(snapshot, path);
      delete parent[key];
      expect(() => validateCombatAchievementSnapshot(snapshot))
        .toThrow(/provenance/i);
    },
  );

  it.each(provenanceLeafPaths)(
    'rejects provenance leaf changes at %s',
    (_label, path) => {
      const snapshot = loadSnapshot();
      const { parent, key } = getParentForPath(snapshot, path);
      const current = parent[key];
      parent[key] = typeof current === 'number'
        ? current + 1
        : `${String(current)}#drift`;
      expect(() => validateCombatAchievementSnapshot(snapshot))
        .toThrow(/provenance/i);
    },
  );

  it.each([
    ['source', ['source']],
    ['task query', ['source', 'taskTableQuery']],
    ['Globals query', ['source', 'globalsQuery']],
    ['tier source', ['source', 'tierSources', '0']],
  ])('rejects unexpected fields in the %s provenance shape', (_label, path) => {
    const snapshot = loadSnapshot();
    const target = getValueAtPath(snapshot, path);
    target.unexpected = 'drift';
    expect(() => validateCombatAchievementSnapshot(snapshot))
      .toThrow(/provenance/i);
  });

  it('documents the offline render, network drift check, and explicit refresh workflow', () => {
    const docs = readFileSync(
      new URL('../docs/CONTENT_SYNC.md', import.meta.url),
      'utf8',
    );

    expect(docs).toMatch(
      /`ca:sync` renders the committed, reviewed snapshot\s+without network access/,
    );
    expect(docs).toMatch(
      /`content:check` uses the network to detect upstream drift/,
    );
    expect(docs).toMatch(
      /fetch the official API data, review and\s+update the snapshot, then run\s+`npm run ca:sync`/,
    );
    expect(docs).not.toContain('fully **auto-synced**');
  });

  it('renders byte-identically from the same committed snapshot', () => {
    const snapshot = loadSnapshot();

    expect(renderCombatAchievementTasks(structuredClone(snapshot)))
      .toBe(renderCombatAchievementTasks(snapshot));
  });

  it('rejects duplicate ids and count drift before rendering', () => {
    const duplicate = loadSnapshot();
    duplicate.tasks[1].id = duplicate.tasks[0].id;
    expect(() => renderCombatAchievementTasks(duplicate)).toThrow(/duplicate/i);

    const short = loadSnapshot();
    short.tasks.pop();
    expect(() => renderCombatAchievementTasks(short)).toThrow(/count|646/i);
  });
});
