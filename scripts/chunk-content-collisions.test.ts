import { describe, expect, it } from 'vitest';
import { transformChunkContent } from './chunk-content-transform.mjs';
import { readPinnedChunkSource } from './chunk-source.mjs';

const cleanName = (value: unknown) => String(value).split('#')[0].trim();
const stripWiki = (value: unknown) => String(value)
  .replace(/~\|/g, '')
  .replace(/\|~/g, '')
  .trim();

type DropRow = {
  rawKey: string;
  items: Record<string, unknown>;
};

type SkillRow = {
  rawSkill: string;
  rawMethod: string;
  skill: string;
  method: string;
  items: Record<string, Record<string, string>>;
};

const groupBy = <T>(rows: T[], keyOf: (row: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
};

const union = (sets: Set<string>[]) => new Set(sets.flatMap((set) => [...set]));
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const includesEvidence = (rateString: string, stage: string, rate: string) => new RegExp(
  `(?:^|, )${escapeRegExp(stage)} @ ${escapeRegExp(rate)}(?: \\(|, |$)`
).test(rateString);

describe('pinned normalized chunk-source collisions', () => {
  it('independently pins every drop collision and preserves every cleaned item', async () => {
    const { data, manifest } = await readPinnedChunkSource();
    const dropRows: DropRow[] = Object.entries(data.drops ?? {}).map(([rawKey, items]) => ({
      rawKey,
      items: items as Record<string, unknown>,
    }));
    const groups = groupBy(dropRows, (row) => cleanName(row.rawKey));
    const collisions = [...groups.entries()].filter(([, rows]) => rows.length > 1);
    const impacted = collisions.filter(([, rows]) => {
      const allItems = union(rows.map((row) =>
        new Set(Object.keys(row.items).map(cleanName))
      ));
      const lastItems = new Set(Object.keys(rows.at(-1)!.items).map(cleanName));
      return [...allItems].some((item) => !lastItems.has(item));
    });
    const lostItems = impacted.flatMap(([, rows]) => {
      const allItems = union(rows.map((row) =>
        new Set(Object.keys(row.items).map(cleanName))
      ));
      const lastItems = new Set(Object.keys(rows.at(-1)!.items).map(cleanName));
      return [...allItems].filter((item) => !lastItems.has(item));
    });

    expect(collisions).toHaveLength(59);
    expect(collisions.reduce((count, [, rows]) => count + rows.length, 0)).toBe(132);
    expect(impacted).toHaveLength(50);
    expect(impacted.reduce((count, [, rows]) => count + rows.length, 0)).toBe(113);
    expect(lostItems).toHaveLength(533);

    const result = transformChunkContent(data, manifest);
    const missing = dropRows.flatMap((row) => {
      const target = result.full.drops[cleanName(row.rawKey)] ?? [];
      return Object.keys(row.items)
        .map(cleanName)
        .filter((item) => !target.includes(item))
        .map((item) => `${row.rawKey} -> ${item}`);
    });
    expect(missing, `sample missing drops:\n${missing.slice(0, 8).join('\n')}`)
      .toHaveLength(0);

    const terminals = result.audit.events.filter((event) =>
      event.terminal && event.category === 'drops'
    );
    for (const [target, rows] of collisions) {
      for (const row of rows) {
        const matches = terminals.filter((event) => event.sourceKey === row.rawKey);
        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({
          disposition: 'normalized',
          reason: 'variant-collision-merged',
          targetKeys: [target],
        });
        expect(matches[0].detail).toContain(row.rawKey);
      }
    }
    expect(terminals.filter((event) =>
      collisions.some(([, rows]) => rows.some((row) => row.rawKey === event.sourceKey)) &&
      event.reason === 'base-record'
    )).toEqual([]);
  });

  it('independently pins skill collisions and preserves every item+stage+rate contribution', async () => {
    const { data, manifest } = await readPinnedChunkSource();
    const rows: SkillRow[] = [];
    for (const [rawSkill, methods] of Object.entries(data.skillItems ?? {})) {
      for (const [rawMethod, items] of Object.entries(methods as Record<string, unknown>)) {
        rows.push({
          rawSkill,
          rawMethod,
          skill: stripWiki(rawSkill),
          method: cleanName(stripWiki(rawMethod)),
          items: items as SkillRow['items'],
        });
      }
    }
    const groups = groupBy(rows, (row) => `${row.skill}\u0000${row.method}`);
    const collisions = [...groups.entries()].filter(([, methods]) => methods.length > 1);
    const itemSet = (row: SkillRow) => new Set(Object.keys(row.items).map(cleanName));
    const evidenceSet = (row: SkillRow) => new Set(Object.entries(row.items).flatMap(
      ([item, stages]) => Object.entries(stages).map(
        ([stage, rate]) => `${cleanName(item)}\u0000${stage}\u0000${rate}`
      )
    ));
    const impactedItems = collisions.filter(([, methods]) => {
      const allItems = union(methods.map(itemSet));
      const lastItems = itemSet(methods.at(-1)!);
      return [...allItems].some((item) => !lastItems.has(item));
    });
    const lostItems = impactedItems.flatMap(([, methods]) => {
      const allItems = union(methods.map(itemSet));
      const lastItems = itemSet(methods.at(-1)!);
      return [...allItems].filter((item) => !lastItems.has(item));
    });
    const impactedEvidence = collisions.filter(([, methods]) => {
      const allEvidence = union(methods.map(evidenceSet));
      const lastEvidence = evidenceSet(methods.at(-1)!);
      return [...allEvidence].some((value) => !lastEvidence.has(value));
    });
    const lostEvidence = impactedEvidence.flatMap(([, methods]) => {
      const allEvidence = union(methods.map(evidenceSet));
      const lastEvidence = evidenceSet(methods.at(-1)!);
      return [...allEvidence].filter((value) => !lastEvidence.has(value));
    });

    expect(collisions).toHaveLength(14);
    expect(collisions.reduce((count, [, methods]) => count + methods.length, 0)).toBe(31);
    expect(impactedItems).toHaveLength(12);
    expect(impactedItems.reduce((count, [, methods]) => count + methods.length, 0)).toBe(27);
    expect(lostItems).toHaveLength(138);
    expect(impactedEvidence).toHaveLength(14);
    expect(impactedEvidence.reduce((count, [, methods]) => count + methods.length, 0)).toBe(31);
    expect(lostEvidence).toHaveLength(288);

    const canonicalItems = [...groups.entries()].flatMap(([canonical, methods]) => {
      const byItem = new Map<string, Array<{ rawItem: string; stage: string; rate: string }>>();
      for (const row of methods) {
        for (const [rawItem, stages] of Object.entries(row.items)) {
          const item = cleanName(rawItem);
          const contributions = byItem.get(item) ?? [];
          for (const [stage, rate] of Object.entries(stages)) {
            contributions.push({ rawItem, stage, rate });
          }
          byItem.set(item, contributions);
        }
      }
      return [...byItem.entries()].map(([item, contributions]) => ({
        canonical,
        methods,
        item,
        contributions,
        rawItems: new Set(contributions.map(({ rawItem }) => rawItem)),
        evidence: new Set(contributions.map(({ stage, rate }) => `${stage}\u0000${rate}`)),
      }));
    });
    const hasRepeatedRateAcrossStages = ({ contributions }: typeof canonicalItems[number]) => {
      const stagesByRate = new Map<string, Set<string>>();
      for (const { stage, rate } of contributions) {
        const stages = stagesByRate.get(rate) ?? new Set<string>();
        stages.add(stage);
        stagesByRate.set(rate, stages);
      }
      return [...stagesByRate.values()].some((stages) => stages.size > 1);
    };
    const singletonItems = canonicalItems.filter(({ methods }) => methods.length === 1);
    const intraMethodItemCollisions = singletonItems.filter(({ rawItems }) => rawItems.size > 1);
    const rawContributions = rows.reduce((count, row) => count + Object.values(row.items)
      .reduce((itemCount, stages) => itemCount + Object.keys(stages).length, 0), 0);
    const canonicalContributions = canonicalItems.reduce((count, { contributions }) => count + new Set(
      contributions.map(({ rawItem, stage, rate }) => `${rawItem}\u0000${stage}\u0000${rate}`)
    ).size, 0);

    expect(rows).toHaveLength(565);
    expect(rawContributions).toBe(7_795);
    expect(canonicalContributions).toBe(7_747);
    expect(singletonItems.filter(({ evidence }) => evidence.size > 1)).toHaveLength(168);
    expect(singletonItems.filter(hasRepeatedRateAcrossStages)).toHaveLength(36);
    expect(canonicalItems.filter(({ evidence }) => evidence.size > 1)).toHaveLength(305);
    expect(canonicalItems.filter(hasRepeatedRateAcrossStages)).toHaveLength(54);
    expect(intraMethodItemCollisions.map(({ canonical, item, rawItems }) => ({
      canonical: canonical.replace('\u0000', '/'),
      item,
      rawItems: [...rawItems].sort(),
    }))).toEqual([{
      canonical: 'Nonskill/Bird nest (egg) loot',
      item: "Bird's egg",
      rawItems: ["Bird's egg#Blue", "Bird's egg#Green", "Bird's egg#Red"],
    }]);

    const result = transformChunkContent(data, manifest);
    const missing = canonicalItems.flatMap(({ canonical, item, contributions, rawItems, evidence }) => {
      const [skill, method] = canonical.split('\u0000');
      const output = result.full.skillItems[skill]?.[method] ?? [];
      const rateString = output.find(([name]) => name === item)?.[1] ?? '';
      const uniqueContributions = [...new Map(contributions.map((contribution) => [
        `${contribution.rawItem}\u0000${contribution.stage}\u0000${contribution.rate}`,
        contribution,
      ])).values()];
      if (rawItems.size === 1 && evidence.size === 1) {
        const [{ stage, rate }] = uniqueContributions;
        return rateString === rate || includesEvidence(rateString, stage, rate)
          ? []
          : [`${skill}/${method}/${item}: ${stage} @ ${rate}`];
      }
      return uniqueContributions
        .filter(({ rawItem, stage, rate }) => rawItems.size > 1
          ? !rateString.includes(`${stage} @ ${rate} (${rawItem})`)
          : !includesEvidence(rateString, stage, rate))
        .map(({ rawItem, stage, rate }) =>
          `${skill}/${method}/${item} via ${rawItem}: ${stage} @ ${rate}`
        );
    });
    expect(missing, `sample missing skill evidence:\n${missing.slice(0, 8).join('\n')}`)
      .toHaveLength(0);
    expect(result.full.skillItems.Nonskill['Bird nest (egg) loot']).toContainEqual([
      "Bird's egg",
      "1 @ 1/3 (Bird's egg#Blue), 1 @ 1/3 (Bird's egg#Green), 1 @ 1/3 (Bird's egg#Red)",
    ]);

    const terminals = result.audit.events.filter((event) =>
      event.terminal && event.category === 'skillItems'
    );
    for (const [target, methods] of collisions) {
      const [skill, method] = target.split('\u0000');
      for (const row of methods) {
        const sourceKey = `${row.rawSkill}/${row.rawMethod}`;
        const matches = terminals.filter((event) => event.sourceKey === sourceKey);
        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({
          disposition: 'normalized',
          reason: 'variant-collision-merged',
          targetKeys: [`${skill}/${method}`],
        });
        expect(matches[0].detail).toContain(row.rawMethod);
      }
    }
  });

  it('produces deterministic full and lite outputs from the same exact source pin', async () => {
    const { data, manifest } = await readPinnedChunkSource();
    const first = transformChunkContent(data, manifest);
    const second = transformChunkContent(data, manifest);

    expect(first.full).toEqual(second.full);
    expect(first.liteSource).toBe(second.liteSource);
    expect(first.full.sourceMeta).toMatchObject({
      commit: manifest.commit,
      blobSha: manifest.blobSha,
      rawSha256: manifest.rawSha256,
    });
  });
});
