import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../utils/integrity';
import { requireRuneProofSources } from '../utils/runeproof/sourceGate';
import chunkTransformAudit from './sources/chunk-content-transform-audit.json';
import questRequirementAudit from './sources/quest-requirement-audit.json';
import {
  buildRuneProofSourceAudit,
  loadRuneProofSourceAudit,
} from './runeProofSourceAudit';

const acquisitionFamilies = [
  'DROP', 'PRODUCTION', 'RESOURCE_ENGINE', 'SHOP', 'SPAWN',
] as const;

const verifiedRules = [
  acquisitionRule('Coins', 'DROP', 'Goblin', 'resource-map:coins:0'),
  acquisitionRule(
    'Plank', 'PRODUCTION', 'Sawmill', 'recipe-audit:plank', 'interior:sawmill',
  ),
  acquisitionRule('Pot', 'SHOP', 'Store', 'resource-map:pot:0', 'interior:store'),
  acquisitionRule('Knife', 'SPAWN', 'Knife floor spawn', 'resource-map:knife:0'),
];

function acquisitionRule(
  label: string, sourceKind: string, sourceLabel: string, provenance: string,
  locationId = 'surface:50,50',
) {
  return {
    id: fixtureRuleId(label, sourceKind, sourceLabel, locationId),
    output: { id: `item:${label.toLowerCase()}`, kind: 'ITEM', label },
    outputQuantity: 1,
    sourceKind,
    sourceLabel,
    locationId,
    requirements: sourceKind === 'PRODUCTION' ? {
      op: 'ALL',
      terms: [{
        op: 'FACT',
        fact: { id: 'item:logs', kind: 'ITEM', label: 'Logs', quantity: 1 },
      }],
    } : { op: 'ALL', terms: [] },
    repeatability: 'REPEATABLE',
    probability: null,
    coverage: 'VERIFIED',
    provenanceIds: [provenance, `location:${locationId}`],
  };
}

function fixtureRuleId(
  label: string, sourceKind: string, sourceLabel: string, locationId = 'surface:50,50',
): string {
  const normalize = (value: string) => value.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const values = [label, sourceKind, sourceLabel, locationId];
  let hash = 0x811c9dc5;
  for (const value of values.join('\u0000')) {
    hash ^= value.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `acq:${normalize(`item:${label}`)}:${[
    sourceKind, sourceLabel, locationId,
  ].map(normalize).join('-')}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function acquisitionDocument(
  rules: Record<string, any>[] = structuredClone(verifiedRules),
  unresolvedSources: Record<string, any>[] = [],
) {
  rules = structuredClone(rules);
  unresolvedSources = structuredClone(unresolvedSources);
  const payloadById = new Map<string, Record<string, any>>();
  for (const rule of rules) {
    const sourceIds = rule.provenanceIds.filter((id: string) =>
      id.startsWith('resource-map:') || id.startsWith('recipe-audit:'));
    if (sourceIds.length === 0) continue;
    const kind = rule.sourceKind === 'PRODUCTION' ? 'RECIPE_AUDIT' : 'RESOURCE_MAP';
    const payload = {
      type: 'RULE',
      output: rule.output.label,
      outputQuantity: rule.outputQuantity,
      sourceKind: rule.sourceKind,
      sourceLabel: rule.sourceLabel,
      locationId: rule.locationId,
      requirements: rule.requirements,
      repeatability: rule.repeatability,
      probability: rule.probability,
      declaredCoverage: rule.coverage,
      sourceIds: [...sourceIds].sort(),
    };
    const id = await catalogSourceId(kind, payload);
    rule.provenanceIds = rule.provenanceIds.map((provenanceId: string) =>
      sourceIds.includes(provenanceId) ? id : provenanceId);
    payloadById.set(id, payload);
  }
  for (const source of unresolvedSources) {
    const sourceIds = source.provenanceIds.filter((id: string) =>
      id.startsWith('resource-map:') || id.startsWith('recipe-audit:'));
    if (sourceIds.length === 0) continue;
    const kind = source.sourceKind === 'PRODUCTION' ? 'RECIPE_AUDIT' : 'RESOURCE_MAP';
    const payload = {
      type: 'UNRESOLVED',
      output: source.output,
      sourceKind: source.sourceKind,
      sourceLabel: source.sourceHost,
      regions: source.regions,
      reason: source.reason,
      declaredCoverage: source.coverage,
      sourceIds: [...sourceIds].sort(),
    };
    const id = await catalogSourceId(kind, payload);
    source.provenanceIds = source.provenanceIds.map((provenanceId: string) =>
      sourceIds.includes(provenanceId) ? id : provenanceId);
    payloadById.set(id, payload);
  }
  const accounting = Object.fromEntries(acquisitionFamilies.map(family => {
    const familyRules = rules.filter(rule => family === 'RESOURCE_ENGINE'
      ? rule.provenanceIds.some(id => id.startsWith('resource-map:'))
      : rule.sourceKind === family);
    const familyUnresolved = unresolvedSources.filter(source => family === 'RESOURCE_ENGINE'
      ? source.provenanceIds.some((id: string) => id.startsWith('resource-map:'))
      : source.sourceKind === family);
    const coverage = familyRules.length === 0 && familyUnresolved.length === 0
      ? 'UNKNOWN'
      : familyRules.some(rule => rule.coverage === 'UNKNOWN')
        || familyUnresolved.some(source => source.coverage === 'UNKNOWN')
        ? 'UNKNOWN'
        : familyUnresolved.length > 0
          || familyRules.some(rule => rule.coverage === 'PARTIAL')
          ? 'PARTIAL' : 'VERIFIED';
    return [family, {
      ruleCount: familyRules.length,
      unresolvedCount: familyUnresolved.length,
      ruleIds: familyRules.map(rule => rule.id),
      unresolvedIds: familyUnresolved.map(source => source.id),
      coverage,
    }];
  }));
  const sourceFamilyCoverage = Object.fromEntries(acquisitionFamilies.map(
    family => [family, accounting[family].coverage],
  ));
  const provenanceIds = new Set([...rules, ...unresolvedSources]
    .flatMap(source => source.provenanceIds));
  const provenanceCatalog = [...provenanceIds].sort().map(id => {
    const membership = {
      ruleIds: rules.filter(rule => rule.provenanceIds.includes(id)).map(rule => rule.id),
      unresolvedIds: unresolvedSources.filter(source => source.provenanceIds.includes(id))
        .map(source => source.id),
    };
    const locationMetadata: Record<string, {
      locationId: string; surfaceChunk: string; parentId: string | null;
    }> = {
      'location:surface:50,50': {
        locationId: 'surface:50,50', surfaceChunk: '50,50', parentId: null,
      },
      'location:interior:sawmill': {
        locationId: 'interior:sawmill', surfaceChunk: '50,50', parentId: 'surface:50,50',
      },
      'location:interior:store': {
        locationId: 'interior:store', surfaceChunk: '50,50', parentId: 'interior:sawmill',
      },
    };
    return id.startsWith('location:')
      ? {
        id, kind: 'LOCATION', coverage: 'VERIFIED', ...locationMetadata[id], ...membership,
      }
      : {
        id,
        kind: id.startsWith('resource-map:') ? 'RESOURCE_MAP'
          : id.startsWith('recipe-audit:') ? 'RECIPE_AUDIT' : 'UNKNOWN',
        coverage: payloadById.get(id)?.declaredCoverage
          ?? (id.startsWith('fixture:') ? 'UNKNOWN' : 'VERIFIED'),
        ...(payloadById.has(id) ? { payload: payloadById.get(id) } : {}),
        ...membership,
      };
  });
  const contents = {
    schemaVersion: 1,
    counts: { rules: rules.length, unresolvedSources: unresolvedSources.length },
    acquisitionCoverage: unresolvedSources.length > 0 ? 'PARTIAL' : 'VERIFIED',
    sourceFamilyCoverage,
    sourceFamilyAccounting: accounting,
    provenanceCatalog,
    rules,
    unresolvedSources,
  };
  return {
    ...contents,
    sourceVersion: `sha256-${await sha256Hex(canonicalJson(contents))}`,
  };
}

async function catalogSourceId(kind: string, payload: unknown): Promise<string> {
  const prefix = kind === 'RECIPE_AUDIT' ? 'recipe-audit:' : 'resource-map:';
  return `${prefix}sha256-${await sha256Hex(canonicalJson(payload))}`;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
describe('runeProofSourceAudit', () => {
  it('keeps current unresolved quest and transform evidence conservative', async () => {
    expect(questRequirementAudit.entries.filter(entry => entry.status === 'unresolved'))
      .toHaveLength(3);
    expect(chunkTransformAudit.events.filter(event => event.disposition === 'unresolved'))
      .toHaveLength(140);

    const audit = await loadRuneProofSourceAudit();
    expect(audit).toMatchObject({
      questCoverage: 'PARTIAL',
      chunkCoverage: 'PARTIAL',
      acquisitionCoverage: 'PARTIAL',
    });
    expect(() => requireRuneProofSources(audit))
      .toThrow('RuneProof requires verified quest coverage');
  });

  it('certifies fully complete synthetic audit evidence', async () => {
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 1,
            imported: 1,
            normalized: 0,
            excluded: 0,
            unresolved: 0,
          },
        },
        events: [{
          terminal: true,
          category: 'drops',
          sourceKey: 'drop-source',
          targetKeys: ['target'],
          disposition: 'imported',
        }],
      },
    );

    expect(audit).toMatchObject({
      questCoverage: 'VERIFIED',
      chunkCoverage: 'VERIFIED',
      acquisitionCoverage: 'PARTIAL',
    });
  });

  it('derives a deterministic SHA-256 version that changes with either audit', async () => {
    const quest = { schemaVersion: 1, entries: [{ status: 'verified' }] };
    const chunk = {
      schemaVersion: 1,
      sourceCommit: 'chunk-source',
      categoryTotals: {
        drops: {
          source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
        },
      },
      events: [{
        terminal: true,
        category: 'drops',
        sourceKey: 'drop-source',
        targetKeys: ['target'],
        disposition: 'imported',
      }],
    };

    const baseline = await buildRuneProofSourceAudit(quest, chunk);
    expect((await buildRuneProofSourceAudit(quest, chunk)).sourceVersion)
      .toBe(baseline.sourceVersion);
    expect(baseline.sourceVersion).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect((await buildRuneProofSourceAudit(
      { ...quest, entries: [{ status: 'verified-with-notes' }] }, chunk,
    )).sourceVersion).not.toBe(baseline.sourceVersion);
    expect((await buildRuneProofSourceAudit(
      quest, { ...chunk, sourceCommit: 'next-chunk-source' },
    )).sourceVersion).not.toBe(baseline.sourceVersion);
  });

  it('does not certify invalid transform accounting', async () => {
    expect((await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 2,
            imported: 1,
            normalized: 0,
            excluded: 0,
            unresolved: 0,
          },
        },
        events: [{
          terminal: true,
          category: 'drops',
          sourceKey: 'drop-source',
          targetKeys: ['target'],
          disposition: 'imported',
        }],
      },
    )).chunkCoverage).toBe('UNKNOWN');
  });

  it('does not ignore malformed non-terminal transform events', async () => {
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
          },
        },
        events: [
          {
            terminal: true,
            category: 'drops',
            sourceKey: 'drop-source',
            targetKeys: ['target'],
            disposition: 'imported',
          },
          {
            terminal: 'true',
            category: 'drops',
            sourceKey: 'malformed-extra',
            targetKeys: ['target'],
            disposition: 'imported',
          },
        ],
      },
    );

    expect(audit.chunkCoverage).toBe('UNKNOWN');
  });
  it('does not certify a terminal disposition distribution mismatch', async () => {
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
          },
        },
        events: [{
          terminal: true,
          category: 'drops',
          sourceKey: 'drop-source',
          targetKeys: ['target'],
          disposition: 'normalized',
        }],
      },
    );

    expect(audit.chunkCoverage).toBe('UNKNOWN');
  });

  it('certifies acquisition coverage only from complete family evidence', async () => {
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      await acquisitionDocument(),
    );

    expect(audit.acquisitionCoverage).toBe('VERIFIED');
  });

  it('derives partial coverage from internally accounted unresolved evidence', async () => {
    const unresolved = [{
      id: 'unresolved:legacy-drop:99999999',
      output: 'Legacy item',
      sourceKind: 'DROP',
      sourceHost: 'Legacy monster',
      regions: ['50,50'],
      coverage: 'UNKNOWN',
      reason: 'NO_PROOF_GRADE_LOCATION',
      provenanceIds: ['resource-map:legacy:0'],
    }];
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      await acquisitionDocument(undefined, unresolved),
    );

    expect(audit.acquisitionCoverage).toBe('PARTIAL');
  });

  it('rejects a valid-format sourceVersion after exact contents change', async () => {
    const document = await acquisitionDocument();
    document.rules[0].probability = 0.5;
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    );
    expect(audit.acquisitionCoverage).toBe('UNKNOWN');
  });

  it('does not let arbitrary catalogued provenance contribute VERIFIED', async () => {
    const document = await acquisitionDocument();
    const originalProvenance = document.rules[0].provenanceIds.find(
      (id: string) => id.startsWith('resource-map:'),
    )!;
    document.rules[0].provenanceIds = document.rules[0].provenanceIds.map(
      (id: string) => id === originalProvenance ? 'fixture:forged' : id,
    );
    document.provenanceCatalog = document.provenanceCatalog.filter(
      entry => entry.id !== originalProvenance,
    );
    document.provenanceCatalog.push({
      id: 'fixture:forged', kind: 'UNKNOWN', coverage: 'UNKNOWN',
      ruleIds: [document.rules[0].id], unresolvedIds: [],
    });
    document.provenanceCatalog.sort((left, right) => left.id.localeCompare(right.id));
    document.rules[0].coverage = 'UNKNOWN';
    document.sourceFamilyAccounting.DROP.coverage = 'UNKNOWN';
    document.sourceFamilyCoverage.DROP = 'UNKNOWN';
    document.sourceFamilyAccounting.RESOURCE_ENGINE.ruleIds =
      document.sourceFamilyAccounting.RESOURCE_ENGINE.ruleIds.filter(
        (id: string) => id !== document.rules[0].id,
      );
    document.sourceFamilyAccounting.RESOURCE_ENGINE.ruleCount -= 1;
    document.acquisitionCoverage = 'UNKNOWN';
    await rehashDocument(document);
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    );
    expect(audit.acquisitionCoverage).toBe('UNKNOWN');
  });

  it('rejects a non-canonical exact location entry with a recomputed hash', async () => {
    const document = await acquisitionDocument();
    const locationEntry = document.provenanceCatalog.find(
      entry => entry.kind === 'LOCATION',
    ) as { surfaceChunk: string };
    locationEntry.surfaceChunk = '050,50';
    await rehashDocument(document);
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    );
    expect(audit.acquisitionCoverage).toBe('UNKNOWN');
  });
  it('rejects forged provenance membership with a recomputed hash', async () => {
    const document = await acquisitionDocument();
    document.provenanceCatalog.find(entry => entry.kind === 'RESOURCE_MAP')!.ruleIds = [];
    await rehashDocument(document);
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    );
    expect(audit.acquisitionCoverage).toBe('UNKNOWN');
  });
  it('does not certify production without a positive ITEM input requirement', async () => {
    const document = await acquisitionDocument();
    const production = document.rules.find(rule => rule.sourceKind === 'PRODUCTION')!;
    production.requirements = { op: 'ALL', terms: [] };
    await rebindRulePayload(document, production);
    await rehashDocument(document);
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    );
    expect(audit.acquisitionCoverage).toBe('UNKNOWN');
  });

  it('rejects production whose mandatory ITEM input exists in only one ANY branch', async () => {
    const document = await acquisitionDocument();
    const production = document.rules.find(rule => rule.sourceKind === 'PRODUCTION')!;
    production.requirements = {
      op: 'ANY',
      terms: [
        {
          op: 'FACT',
          fact: { id: 'item:logs', kind: 'ITEM', label: 'Logs', quantity: 1 },
        },
        {
          op: 'FACT',
          fact: { id: 'quest:optional-quest', kind: 'QUEST', label: 'Optional quest' },
        },
      ],
    };
    await rebindRulePayload(document, production);
    await rehashDocument(document);

    expect((await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    )).acquisitionCoverage).toBe('UNKNOWN');
  });

  it.each([
    ['ALL with one required ITEM', {
      op: 'ALL',
      terms: [
        {
          op: 'FACT',
          fact: { id: 'item:logs', kind: 'ITEM', label: 'Logs', quantity: 1 },
        },
        {
          op: 'FACT',
          fact: { id: 'quest:helper-quest', kind: 'QUEST', label: 'Helper quest' },
        },
      ],
    }],
    ['ANY where every branch requires an ITEM', {
      op: 'ANY',
      terms: [
        {
          op: 'FACT',
          fact: { id: 'item:logs', kind: 'ITEM', label: 'Logs', quantity: 1 },
        },
        {
          op: 'ALL',
          terms: [
            {
              op: 'FACT',
              fact: { id: 'item:oak-logs', kind: 'ITEM', label: 'Oak logs', quantity: 1 },
            },
            {
              op: 'FACT',
              fact: { id: 'quest:helper-quest', kind: 'QUEST', label: 'Helper quest' },
            },
          ],
        },
      ],
    }],
  ])('accepts production requirements expressed as %s', async (_label, requirements) => {
    const document = await acquisitionDocument();
    const production = document.rules.find(rule => rule.sourceKind === 'PRODUCTION')!;
    production.requirements = requirements;
    await rebindRulePayload(document, production);
    await rehashDocument(document);

    expect((await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    )).acquisitionCoverage).toBe('VERIFIED');
  });

  it('rejects a forged recipe catalog ID after document rehashing', async () => {
    const document = await acquisitionDocument();
    const production = document.rules.find(rule => rule.sourceKind === 'PRODUCTION')!;
    const recipe = document.provenanceCatalog.find(
      entry => entry.kind === 'RECIPE_AUDIT',
    ) as Record<string, any>;
    const oldId = recipe.id;
    recipe.id = `recipe-audit:sha256-${'0'.repeat(64)}`;
    production.provenanceIds = production.provenanceIds.map(
      (id: string) => id === oldId ? recipe.id : id,
    );
    document.provenanceCatalog.sort((left, right) => left.id.localeCompare(right.id));
    await rehashDocument(document);

    expect((await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    )).acquisitionCoverage).toBe('UNKNOWN');
  });

  it('rejects a re-IDed recipe payload that does not match its rule semantics', async () => {
    const document = await acquisitionDocument();
    const production = document.rules.find(rule => rule.sourceKind === 'PRODUCTION')!;
    const recipe = document.provenanceCatalog.find(
      entry => entry.kind === 'RECIPE_AUDIT',
    ) as Record<string, any>;
    const oldId = recipe.id;
    recipe.payload.sourceLabel = 'Forged sawmill';
    recipe.id = await catalogSourceId('RECIPE_AUDIT', recipe.payload);
    production.provenanceIds = production.provenanceIds.map(
      (id: string) => id === oldId ? recipe.id : id,
    );
    document.provenanceCatalog.sort((left, right) => left.id.localeCompare(right.id));
    await rehashDocument(document);

    expect((await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    )).acquisitionCoverage).toBe('UNKNOWN');
  });

  it('rejects a re-IDed RESOURCE_MAP payload that does not match its rule semantics', async () => {
    const document = await acquisitionDocument();
    const drop = document.rules.find(rule => rule.sourceKind === 'DROP')!;
    const resource = document.provenanceCatalog.find(
      entry => entry.kind === 'RESOURCE_MAP' && entry.ruleIds.includes(drop.id),
    ) as Record<string, any>;
    const oldId = resource.id;
    resource.payload.output = 'Forged coins';
    resource.id = await catalogSourceId('RESOURCE_MAP', resource.payload);
    drop.provenanceIds = drop.provenanceIds.map(
      (id: string) => id === oldId ? resource.id : id,
    );
    document.provenanceCatalog.sort((left, right) => left.id.localeCompare(right.id));
    await rehashDocument(document);

    expect((await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    )).acquisitionCoverage).toBe('UNKNOWN');
  });

  it('rejects production without compiler recipe provenance', async () => {
    const document = await acquisitionDocument();
    const production = document.rules.find(rule => rule.sourceKind === 'PRODUCTION')!;
    production.provenanceIds = production.provenanceIds.filter(
      id => !id.startsWith('recipe-audit:'),
    );
    document.provenanceCatalog = document.provenanceCatalog.filter(
      entry => entry.kind !== 'RECIPE_AUDIT',
    );
    await rehashDocument(document);

    expect((await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    )).acquisitionCoverage).toBe('UNKNOWN');
  });

  it('accepts a valid nested LOCATION chain', async () => {
    const document = await acquisitionDocument();
    const locations = document.provenanceCatalog.filter(entry => entry.kind === 'LOCATION');
    expect(locations).toHaveLength(3);

    expect((await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    )).acquisitionCoverage).toBe('VERIFIED');
  });

  it.each([
    ['missing parent', (document: any) => {
      document.provenanceCatalog.find(
        (entry: any) => entry.id === 'location:interior:sawmill',
      ).parentId = 'interior:missing';
    }],
    ['cross-surface parent invalidating its otherwise valid descendant', (document: any) => {
      document.provenanceCatalog.find(
        (entry: any) => entry.id === 'location:interior:sawmill',
      ).surfaceChunk = '51,50';
    }],
    ['parent cycle', (document: any) => {
      document.provenanceCatalog.find(
        (entry: any) => entry.id === 'location:surface:50,50',
      ).parentId = 'interior:store';
    }],
    ['self-parent', (document: any) => {
      document.provenanceCatalog.find(
        (entry: any) => entry.id === 'location:interior:sawmill',
      ).parentId = 'interior:sawmill';
    }],
  ])('rejects a LOCATION graph with %s even after rehashing', async (_label, mutate) => {
    const document = await acquisitionDocument();
    mutate(document);
    await rehashDocument(document);

    expect((await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    )).acquisitionCoverage).toBe('UNKNOWN');
  });

  it.each([
    ['rule boundary', (document: any) => { document.rules[0].extra = true; }],
    ['rule output', (document: any) => { document.rules[0].output.extra = true; }],
    ['family entry', (document: any) => {
      document.sourceFamilyAccounting.SHOP.extra = true;
    }],
    ['requirement expression', (document: any) => {
      document.rules[0].requirements.extra = true;
    }],
    ['nested FactRef', (document: any) => {
      const production = document.rules.find((rule: any) => rule.sourceKind === 'PRODUCTION');
      production.requirements.terms[0].fact.extra = true;
    }],
    ['provenance entry', (document: any) => {
      document.provenanceCatalog[0].extra = true;
    }],
  ])('rejects an extra nested key on %s even with a recomputed hash', async (_label, mutate) => {
    const document = await acquisitionDocument();
    mutate(document);
    await rehashDocument(document);
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    );
    expect(audit.acquisitionCoverage).toBe('UNKNOWN');
  });
  it('rejects an extra unresolved-source key with a recomputed hash', async () => {
    const unresolved = [{
      id: 'unresolved:legacy-drop:99999999', output: 'Legacy item', sourceKind: 'DROP',
      sourceHost: 'Legacy monster', regions: ['Misthalin'], coverage: 'UNKNOWN',
      reason: 'NO_PROOF_GRADE_LOCATION', provenanceIds: ['resource-map:legacy:0'],
    }];
    const document = await acquisitionDocument(undefined, unresolved);
    document.unresolvedSources[0].extra = true;
    await rehashDocument(document);
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    );
    expect(audit.acquisitionCoverage).toBe('UNKNOWN');
  });
  it.each([
    ['extra family claim', (document: any) => {
      document.sourceFamilyAccounting.FORGED = document.sourceFamilyAccounting.SHOP;
    }],
    ['mismatched family membership', (document: any) => {
      document.sourceFamilyAccounting.SHOP.ruleIds = [];
    }],
    ['omitted family accounting', (document: any) => {
      delete document.sourceFamilyAccounting.SPAWN;
    }],
    ['forged global coverage', (document: any) => {
      document.rules = document.rules.slice(0, 1);
      document.counts.rules = 1;
    }],
    ['non-compact source version', (document: any) => {
      document.sourceVersion = 'working-tree';
    }],
    ['unknown schema field', (document: any) => {
      document.untrusted = true;
    }],
    ['non-compiler rule ID', (document: any) => {
      document.rules[0].id = 'acq:item-coins:drop-goblin-surface-50-50:00000000';
      document.sourceFamilyAccounting.DROP.ruleIds[0] = document.rules[0].id;
    }],
  ])('rejects %s', async (_label, forge) => {
    const document = await acquisitionDocument();
    forge(document);
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    );
    expect(audit.acquisitionCoverage).toBe('UNKNOWN');
  });
});

async function rebindRulePayload(
  document: Record<string, any>, rule: Record<string, any>,
): Promise<void> {
  const kind = rule.sourceKind === 'PRODUCTION' ? 'RECIPE_AUDIT' : 'RESOURCE_MAP';
  const entry = document.provenanceCatalog.find(
    (candidate: Record<string, any>) => candidate.kind === kind
      && candidate.ruleIds.includes(rule.id),
  );
  const oldId = entry.id;
  entry.payload = {
    ...entry.payload,
    output: rule.output.label,
    outputQuantity: rule.outputQuantity,
    sourceKind: rule.sourceKind,
    sourceLabel: rule.sourceLabel,
    locationId: rule.locationId,
    requirements: rule.requirements,
    repeatability: rule.repeatability,
    probability: rule.probability,
  };
  entry.id = await catalogSourceId(kind, entry.payload);
  rule.provenanceIds = rule.provenanceIds.map(
    (id: string) => id === oldId ? entry.id : id,
  );
  document.provenanceCatalog.sort(
    (left: Record<string, any>, right: Record<string, any>) => left.id.localeCompare(right.id),
  );
}

async function rehashDocument(document: Record<string, any>): Promise<void> {
  const { sourceVersion: _sourceVersion, ...contents } = document;
  document.sourceVersion = `sha256-${await sha256Hex(canonicalJson(contents))}`;
}
function completeChunkAudit() {
  return {
    schemaVersion: 1,
    sourceCommit: 'chunk-source',
    categoryTotals: {
      drops: { source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0 },
    },
    events: [{
      terminal: true,
      category: 'drops',
      sourceKey: 'drop-source',
      targetKeys: ['target'],
      disposition: 'imported',
    }],
  };
}