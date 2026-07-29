import { describe, expect, it } from 'vitest';
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
  acquisitionRule('acq:item-coins:drop-goblin-surface-50-50:11111111', 'Coins', 'DROP', 'Goblin', 'fixture:drop'),
  acquisitionRule('acq:item-plank:production-sawmill-surface-50-50:22222222', 'Plank', 'PRODUCTION', 'Sawmill', 'fixture:recipe'),
  acquisitionRule('acq:item-pot:shop-store-surface-50-50:33333333', 'Pot', 'SHOP', 'Store', 'fixture:shop'),
  acquisitionRule('acq:item-knife:spawn-knife-floor-spawn-surface-50-50:44444444', 'Knife', 'SPAWN', 'Knife floor spawn', 'fixture:spawn'),
  acquisitionRule('acq:item-logs:gathering-oak-tree-surface-50-50:55555555', 'Logs', 'GATHERING', 'Oak tree', 'resource-map:logs:0'),
];

function acquisitionRule(
  _id: string, label: string, sourceKind: string, sourceLabel: string, provenance: string,
) {
  return {
    id: fixtureRuleId(label, sourceKind, sourceLabel),
    output: { id: `item:${label.toLowerCase()}`, kind: 'ITEM', label },
    outputQuantity: 1,
    sourceKind,
    sourceLabel,
    locationId: 'surface:50,50',
    requirements: { op: 'ALL', terms: [] },
    repeatability: 'REPEATABLE',
    probability: null,
    coverage: 'VERIFIED',
    provenanceIds: [provenance],
  };
}

function fixtureRuleId(label: string, sourceKind: string, sourceLabel: string): string {
  const locationId = 'surface:50,50';
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
function acquisitionDocument(
  rules = verifiedRules,
  unresolvedSources: Record<string, unknown>[] = [],
) {
  const accounting = Object.fromEntries(acquisitionFamilies.map(family => {
    const familyRules = rules.filter(rule => family === 'RESOURCE_ENGINE'
      ? rule.provenanceIds.some(id => id.startsWith('resource-map:'))
      : rule.sourceKind === family);
    const familyUnresolved = unresolvedSources.filter(source => family === 'RESOURCE_ENGINE'
      ? (source.provenanceIds as string[]).some(id => id.startsWith('resource-map:'))
      : source.sourceKind === family);
    const coverage = familyRules.length === 0 && familyUnresolved.length === 0
      ? 'UNKNOWN'
      : familyUnresolved.some(source => source.coverage === 'UNKNOWN')
        ? 'UNKNOWN'
        : familyUnresolved.length > 0 ? 'PARTIAL' : 'VERIFIED';
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
  return {
    schemaVersion: 1,
    sourceVersion: `sha256-${'a'.repeat(64)}`,
    counts: { rules: rules.length, unresolvedSources: unresolvedSources.length },
    acquisitionCoverage: unresolvedSources.length > 0 ? 'PARTIAL' : 'VERIFIED',
    sourceFamilyCoverage,
    sourceFamilyAccounting: accounting,
    rules,
    unresolvedSources,
  };
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
      acquisitionDocument(),
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
      coverage: 'PARTIAL',
      reason: 'NO_PROOF_GRADE_LOCATION',
      provenanceIds: ['resource-map:legacy:0'],
    }];
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      acquisitionDocument(verifiedRules, unresolved),
    );

    expect(audit.acquisitionCoverage).toBe('PARTIAL');
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
    const document = acquisitionDocument();
    forge(document);
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      completeChunkAudit(),
      document,
    );
    expect(audit.acquisitionCoverage).toBe('UNKNOWN');
  });
});

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