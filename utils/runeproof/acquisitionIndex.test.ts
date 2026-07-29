import { describe, expect, it, vi } from 'vitest';
import { chunkContentService } from '../../services/ChunkContentService';
import { sha256Hex } from '../integrity';
import {
  buildAcquisitionIndex,
  compileAcquisitionSources,
  type AcquisitionCompilerInput,
} from './acquisitionIndex';
import { factId } from './model';

const location = {
  id: 'surface:50,50',
  label: 'Lumbridge starting chunk',
  surfaceChunk: '50,50',
  coverage: 'VERIFIED' as const,
};

function compilerInput(
  overrides: Partial<AcquisitionCompilerInput> = {},
): AcquisitionCompilerInput {
  return {
    sourceCommit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
    locationNodes: [location],
    chunks: {
      12850: {
        m: [['Goblin', 2]],
        s: ['Lumbridge General Store'],
        i: ['Bronze dagger'],
      },
    },
    shopItems: {
      'Lumbridge General Store': ['Pot'],
    },
    drops: {
      Goblin: ['Coins'],
    },
    taskUnlocks: {},
    questIds: [],
    transformEvents: [
      {
        category: 'shopItems',
        sourceKey: 'Lumbridge General Store',
        targetKeys: ['Lumbridge General Store'],
        terminal: true,
        disposition: 'imported',
      },
      {
        category: 'drops',
        sourceKey: 'Goblin#Drop table 1',
        targetKeys: ['Goblin'],
        terminal: true,
        disposition: 'normalized',
      },
    ],
    productionRecipes: [],
    reviewedSources: [],
    ...overrides,
  };
}

describe('compileAcquisitionSources', () => {
  it('resolves shop stock to the exact authored shop location', () => {
    const document = compileAcquisitionSources(compilerInput());
    const [rule] = document.rules.filter(candidate => candidate.sourceKind === 'SHOP');

    expect(rule).toMatchObject({
      id: 'acq:item-pot:shop-lumbridge-general-store-surface-50-50:575900f5',
      output: {
        id: factId('ITEM', 'Pot'),
        kind: 'ITEM',
        label: 'Pot',
      },
      sourceLabel: 'Lumbridge General Store',
      locationId: 'surface:50,50',
      outputQuantity: 1,
    });
  });

  it('resolves drops to the exact authored monster location', () => {
    const document = compileAcquisitionSources(compilerInput());
    const [rule] = document.rules.filter(candidate => candidate.sourceKind === 'DROP');

    expect(rule).toMatchObject({
      output: {
        id: factId('ITEM', 'Coins'),
        kind: 'ITEM',
        label: 'Coins',
      },
      sourceLabel: 'Goblin',
      locationId: 'surface:50,50',
    });
  });

  it('resolves floor spawns directly to their authored location', () => {
    const document = compileAcquisitionSources(compilerInput());
    const [rule] = document.rules.filter(candidate => candidate.sourceKind === 'SPAWN');

    expect(rule).toMatchObject({
      output: {
        id: factId('ITEM', 'Bronze dagger'),
        kind: 'ITEM',
        label: 'Bronze dagger',
      },
      sourceLabel: 'Bronze dagger floor spawn',
      locationId: 'surface:50,50',
      requirements: { op: 'ALL', terms: [] },
    });
  });

  it('records every production input quantity for recursive evaluation', () => {
    const document = compileAcquisitionSources(compilerInput({
      productionRecipes: [{
        output: 'Oak plank',
        outputQuantity: 2,
        sourceHost: 'Sawmill',
        locationId: 'surface:50,50',
        inputs: { Coins: 500, 'Oak logs': 2 },
        requirements: {
          op: 'FACT',
          fact: {
            id: factId('SKILL_LEVEL', 'Woodcutting'),
            kind: 'SKILL_LEVEL',
            label: 'Woodcutting',
            quantity: 15,
          },
        },
        repeatability: 'REPEATABLE',
        probability: null,
        coverage: 'VERIFIED',
        provenanceIds: ['recipe-audit:oak-plank@1'],
      }],
    }));
    const [rule] = document.rules.filter(candidate => candidate.sourceKind === 'PRODUCTION');

    expect(rule.outputQuantity).toBe(2);
    expect(rule.requirements).toEqual({
      op: 'ALL',
      terms: [
        {
          op: 'FACT',
          fact: {
            id: factId('ITEM', 'Coins'),
            kind: 'ITEM',
            label: 'Coins',
            quantity: 500,
          },
        },
        {
          op: 'FACT',
          fact: {
            id: factId('ITEM', 'Oak logs'),
            kind: 'ITEM',
            label: 'Oak logs',
            quantity: 2,
          },
        },
        {
          op: 'FACT',
          fact: {
            id: factId('SKILL_LEVEL', 'Woodcutting'),
            kind: 'SKILL_LEVEL',
            label: 'Woodcutting',
            quantity: 15,
          },
        },
      ],
    });
  });

  it('classifies empty-input one-time rewards as QUEST_REWARD, not production', () => {
    const document = compileAcquisitionSources(compilerInput({
      reviewedSources: [{
        output: 'Quest token',
        sourceKind: 'QUEST_REWARD',
        sourceHost: 'Duke Horacio',
        regions: ['Misthalin'],
        locationId: 'surface:50,50',
        outputQuantity: 3,
        requirements: { op: 'ALL', terms: [] },
        repeatability: 'ONE_TIME',
        probability: 1,
        coverage: 'VERIFIED',
        provenanceIds: ['resource-map:quest-token:0'],
      }],
      productionRecipes: [{
        output: 'Misclassified token', outputQuantity: 1, sourceHost: 'Duke Horacio',
        locationId: 'surface:50,50', inputs: {}, requirements: { op: 'ALL', terms: [] },
        repeatability: 'ONE_TIME', probability: 1, coverage: 'VERIFIED',
        provenanceIds: ['recipe-audit:misclassified-token'],
      }],
    }));

    expect(document.rules.find(rule => rule.output.label === 'Quest token')).toMatchObject({
      sourceKind: 'QUEST_REWARD', outputQuantity: 3, repeatability: 'ONE_TIME', probability: 1,
    });
    expect(document.unresolvedSources).toContainEqual(expect.objectContaining({
      output: 'Misclassified token', reason: 'INCOMPLETE_METADATA',
    }));
  });
  it.each(['Any', 'Misthalin'])(
    'refuses %s-only legacy locations as proof-grade evidence',
    (region) => {
      const document = compileAcquisitionSources(compilerInput({
        reviewedSources: [{
          output: 'Unbound item',
          sourceKind: 'DROP',
          sourceHost: 'Legacy monster',
          regions: [region],
          coverage: 'PARTIAL',
          provenanceIds: ['resource-map:unbound-item:0'],
        }],
      }));

      expect(document.rules.some(rule => rule.output.label === 'Unbound item')).toBe(false);
      expect(document.unresolvedSources).toContainEqual(expect.objectContaining({
        output: 'Unbound item',
        sourceHost: 'Legacy monster',
        coverage: 'UNKNOWN',
        reason: 'REGION_ONLY_LOCATION',
      }));
    },
  );

  it('carries rule provenance and conservative per-family coverage', () => {
    const document = compileAcquisitionSources(compilerInput());
    const shopRule = document.rules.find(rule => rule.sourceKind === 'SHOP');
    const index = buildAcquisitionIndex(document);

    expect(shopRule).toMatchObject({
      coverage: 'PARTIAL',
      provenanceIds: [
        'chunk:12850',
        'location:surface:50,50',
        'transform:shopItems:Lumbridge General Store',
      ],
    });
    expect(document.acquisitionCoverage).toBe('PARTIAL');
    expect(document.sourceFamilyCoverage).toMatchObject({
      SHOP: 'PARTIAL',
      DROP: 'PARTIAL',
      SPAWN: 'PARTIAL',
      PRODUCTION: 'UNKNOWN',
    });
    expect(index.rulesByOutput.get(factId('ITEM', 'Pot'))).toEqual([shopRule]);
  });

  it('binds sourceVersion to exact canonical document contents', async () => {
    const document = compileAcquisitionSources(compilerInput());
    const { sourceVersion: _sourceVersion, ...contents } = document;
    const expected = `sha256-${await sha256Hex(canonicalTestJson(contents))}`;

    expect(document.sourceVersion).toBe(expected);
    expect(compileAcquisitionSources(compilerInput({
      shopItems: { 'Lumbridge General Store': ['Different item'] },
    })).sourceVersion).not.toBe(document.sourceVersion);
  });
  it('emits byte-stable ordering regardless of input map insertion order', () => {
    const forward = compileAcquisitionSources(compilerInput({
      shopItems: { Shop: ['Z item', 'A item'] },
      chunks: { 12850: { s: ['Shop'], i: ['Z spawn', 'A spawn'] } },
    }));
    const reversed = compileAcquisitionSources(compilerInput({
      shopItems: { Shop: ['A item', 'Z item'] },
      chunks: { 12850: { i: ['A spawn', 'Z spawn'], s: ['Shop'] } },
    }));

    expect(JSON.stringify(forward)).toBe(JSON.stringify(reversed));
  });
});

describe('complete raw source accounting', () => {
  it('keeps every host-output tuple searchable when no exact location is authored', () => {
    const document = compileAcquisitionSources(compilerInput({
      locationNodes: [],
      chunks: {
        13000: { s: ['Remote shop'], m: [['Remote monster', 1]], i: ['Remote spawn'] },
      },
      shopItems: { 'Remote shop': ['A', 'B'] },
      drops: { 'Remote monster': ['C', 'D'] },
      transformEvents: [],
    }));
    const raw = document.unresolvedSources.filter(source =>
      source.reason === 'NO_PROOF_GRADE_LOCATION');

    expect(raw).toHaveLength(5);
    expect(raw.map(source => [source.sourceKind, source.sourceHost, source.output]))
      .toEqual(expect.arrayContaining([
        ['DROP', 'Remote monster', 'C'],
        ['DROP', 'Remote monster', 'D'],
        ['SHOP', 'Remote shop', 'A'],
        ['SHOP', 'Remote shop', 'B'],
        ['SPAWN', 'Remote spawn floor spawn', 'Remote spawn'],
      ]));
    expect(raw.every(source => source.provenanceIds.includes('chunk:13000'))).toBe(true);
    expect(new Set(raw.map(source => JSON.stringify(source))).size).toBe(raw.length);
  });

  it('emits one deterministic exact rule per explicitly authored host surface', () => {
    const second = {
      id: 'surface:50,51', label: 'Adjacent chunk', surfaceChunk: '50,51',
      coverage: 'VERIFIED' as const,
    };
    const input = compilerInput({
      locationNodes: [second, location],
      chunks: {
        12851: { s: ['Shared shop'] },
        12850: { s: ['Shared shop'] },
      },
      shopItems: { 'Shared shop': ['Shared item'] },
      drops: {},
      transformEvents: [],
    });
    const document = compileAcquisitionSources(input);
    const rules = document.rules.filter(rule => rule.output.label === 'Shared item');

    expect(rules).toHaveLength(2);
    expect(rules.map(rule => rule.locationId)).toEqual(['surface:50,50', 'surface:50,51']);
    expect(new Set(rules.map(rule => rule.id)).size).toBe(2);
    expect(rules[0].provenanceIds).toContain('chunk:12850');
    expect(rules[1].provenanceIds).toContain('chunk:12851');
    expect(document.unresolvedSources.some(source => source.output === 'Shared item'))
      .toBe(false);
    expect(JSON.stringify(document)).toBe(JSON.stringify(compileAcquisitionSources({
      ...input,
      locationNodes: [location, second],
      chunks: {
        12850: { s: ['Shared shop'] },
        12851: { s: ['Shared shop'] },
      },
    })));
  });

  it('emits exact routes and preserves unbound locations as unresolved evidence', () => {
    const document = compileAcquisitionSources(compilerInput({
      chunks: {
        12850: { s: ['Mixed shop'] },
        12851: { s: ['Mixed shop'] },
      },
      shopItems: { 'Mixed shop': ['Mixed item'] },
      drops: {},
      transformEvents: [],
    }));
    const rules = document.rules.filter(rule => rule.output.label === 'Mixed item');
    const unresolved = document.unresolvedSources.filter(source =>
      source.output === 'Mixed item');

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      locationId: 'surface:50,50', provenanceIds: expect.arrayContaining(['chunk:12850']),
    });
    expect(rules[0].provenanceIds).not.toContain('chunk:12851');
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toMatchObject({
      regions: ['50,51'], provenanceIds: expect.arrayContaining(['chunk:12851']),
      reason: 'NO_PROOF_GRADE_LOCATION',
    });
  });

  it('publishes exact family counts and memberships derived from emitted evidence', () => {
    const document = compileAcquisitionSources(compilerInput());
    const shop = document.sourceFamilyAccounting.SHOP;

    expect(document.counts).toEqual({
      rules: document.rules.length,
      unresolvedSources: document.unresolvedSources.length,
    });
    expect(shop.ruleCount).toBe(shop.ruleIds.length);
    expect(shop.unresolvedCount).toBe(shop.unresolvedIds.length);
    expect(shop.ruleIds).toEqual(document.rules
      .filter(rule => rule.sourceKind === 'SHOP').map(rule => rule.id));
  });
});

describe('strict production validation', () => {
  const validRecipe = {
    output: 'Oak plank', outputQuantity: 1, sourceHost: 'Sawmill',
    locationId: 'surface:50,50', inputs: { 'Oak logs': 1 },
    requirements: { op: 'ALL' as const, terms: [] },
    repeatability: 'REPEATABLE' as const, probability: null,
    coverage: 'VERIFIED' as const, provenanceIds: ['recipe-audit:oak-plank'],
  };

  it.each([
    ['empty inputs', { inputs: {} }],
    ['zero input', { inputs: { Logs: 0 } }],
    ['fractional input', { inputs: { Logs: 1.5 } }],
    ['zero yield', { outputQuantity: 0 }],
    ['unknown repeatability', { repeatability: 'UNKNOWN' as const }],
    ['partial coverage', { coverage: 'PARTIAL' as const }],
    ['missing provenance', { provenanceIds: [] }],
    ['empty output', { output: ' ' }],
    ['empty source host', { sourceHost: ' ' }],
    ['invalid probability', { probability: 2 }],
  ])('rejects %s', (_label, override) => {
    const document = compileAcquisitionSources(compilerInput({
      productionRecipes: [{ ...validRecipe, ...override }],
    }));
    expect(document.rules.some(rule => rule.sourceKind === 'PRODUCTION'
      && rule.sourceLabel === ((override as { sourceHost?: string }).sourceHost ?? 'Sawmill')))
      .toBe(false);
    expect(document.unresolvedSources.some(source =>
      source.reason === 'INCOMPLETE_METADATA')).toBe(true);
  });

  it('rejects an otherwise valid production recipe at a non-verified location', () => {
    const document = compileAcquisitionSources(compilerInput({
      locationNodes: [{ ...location, coverage: 'PARTIAL' }],
      productionRecipes: [validRecipe],
    }));
    expect(document.rules.some(rule => rule.output.label === 'Oak plank')).toBe(false);
    expect(document.unresolvedSources).toContainEqual(expect.objectContaining({
      output: 'Oak plank', reason: 'INCOMPLETE_METADATA',
    }));
  });
  it('rejects PRODUCTION records routed through the reviewed-source shortcut', () => {
    const document = compileAcquisitionSources(compilerInput({
      reviewedSources: [{
        output: 'Shortcut plank', sourceKind: 'PRODUCTION', sourceHost: 'Sawmill',
        regions: ['Misthalin'], locationId: 'surface:50,50', outputQuantity: 1,
        requirements: { op: 'ALL', terms: [] }, repeatability: 'REPEATABLE',
        probability: null, coverage: 'VERIFIED', provenanceIds: ['resource-map:shortcut:0'],
      }],
    }));
    expect(document.rules.some(rule => rule.output.label === 'Shortcut plank')).toBe(false);
    expect(document.unresolvedSources).toContainEqual(expect.objectContaining({
      output: 'Shortcut plank', reason: 'INCOMPLETE_METADATA',
    }));
  });
});

describe('acquisition location validation', () => {
  it('rejects reviewed and production binding through a child on another surface', () => {
    const mismatchedChild = {
      id: 'interior:mismatched', label: 'Mismatched interior', surfaceChunk: '50,51',
      parentId: location.id, coverage: 'VERIFIED' as const,
    };
    const document = compileAcquisitionSources(compilerInput({
      locationNodes: [location, mismatchedChild],
      productionRecipes: [{
        output: 'Bad plank', outputQuantity: 1, sourceHost: 'Bad sawmill',
        locationId: mismatchedChild.id, inputs: { Logs: 1 },
        requirements: { op: 'ALL', terms: [] }, repeatability: 'REPEATABLE',
        probability: null, coverage: 'VERIFIED', provenanceIds: ['recipe-audit:bad'],
      }],
      reviewedSources: [{
        output: 'Bad reward', sourceKind: 'QUEST_REWARD', sourceHost: 'Bad NPC',
        regions: ['Misthalin'], locationId: mismatchedChild.id, outputQuantity: 1,
        requirements: { op: 'ALL', terms: [] }, repeatability: 'ONE_TIME',
        probability: 1, coverage: 'VERIFIED', provenanceIds: ['resource-map:bad:0'],
      }],
    }));

    expect(document.rules.some(rule =>
      rule.locationId === mismatchedChild.id)).toBe(false);
    expect(document.unresolvedSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ output: 'Bad plank', reason: 'UNKNOWN_LOCATION' }),
      expect.objectContaining({ output: 'Bad reward', reason: 'UNKNOWN_LOCATION' }),
    ]));
  });
  it.each([
    ['duplicate IDs', [location, { ...location }]],
    ['orphan child', [{ ...location, id: 'child', parentId: 'missing' }]],
    ['cyclic children', [
      { ...location, id: 'a', parentId: 'b' },
      { ...location, id: 'b', parentId: 'a' },
    ]],
    ['non-canonical surface chunk', [{ ...location, surfaceChunk: '050,50' }]],
    ['invalid coverage', [{ ...location, coverage: 'CERTAIN' }]],
    ['ambiguous surface owners', [location, { ...location, id: 'duplicate' }]],
  ])('rejects %s', (_label, locationNodes) => {
    const document = compileAcquisitionSources(compilerInput({
      locationNodes: locationNodes as AcquisitionCompilerInput['locationNodes'],
    }));
    expect(document.rules).toHaveLength(0);
    expect(document.unresolvedSources.some(source =>
      source.reason === 'NO_PROOF_GRADE_LOCATION')).toBe(true);
  });
});

describe('Resource Engine family coverage', () => {
  it('counts an exact reviewed non-core method under its source origin', () => {
    const document = compileAcquisitionSources(compilerInput({
      reviewedSources: [{
        output: 'Oak logs', sourceKind: 'GATHERING', sourceHost: 'Oak tree',
        regions: ['Misthalin'], locationId: 'surface:50,50', outputQuantity: 1,
        requirements: { op: 'ALL', terms: [] }, repeatability: 'REPEATABLE',
        probability: null, coverage: 'VERIFIED',
        provenanceIds: ['resource-map:oak-logs:0'],
      }],
    }));

    expect(document.sourceFamilyCoverage.RESOURCE_ENGINE).toBe('VERIFIED');
  });
});
describe('stable acquisition identities', () => {
  it('does not collapse punctuation-distinct output labels', () => {
    const document = compileAcquisitionSources(compilerInput({
      productionRecipes: [
        {
          output: 'Anti-venom',
          outputQuantity: 1,
          sourceHost: 'Herblore',
          locationId: 'surface:50,50',
          inputs: { Vial: 1 },
          requirements: { op: 'ALL', terms: [] },
          repeatability: 'REPEATABLE',
          probability: null,
          coverage: 'VERIFIED',
          provenanceIds: ['recipe-audit:anti-venom'],
        },
        {
          output: 'Anti-venom+',
          outputQuantity: 1,
          sourceHost: 'Herblore',
          locationId: 'surface:50,50',
          inputs: { Vial: 1 },
          requirements: { op: 'ALL', terms: [] },
          repeatability: 'REPEATABLE',
          probability: null,
          coverage: 'VERIFIED',
          provenanceIds: ['recipe-audit:anti-venom-plus'],
        },
      ],
    }));
    const rules = document.rules.filter(rule => rule.sourceKind === 'PRODUCTION');

    expect(rules).toHaveLength(0);
    expect(document.unresolvedSources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        output: 'Anti-venom',
        reason: 'CONFLICTING_OUTPUT_ID',
        coverage: 'UNKNOWN',
      }),
      expect.objectContaining({
        output: 'Anti-venom+',
        reason: 'CONFLICTING_OUTPUT_ID',
        coverage: 'UNKNOWN',
      }),
    ]));
  });
});
describe('proof-grade source rejection', () => {
  it('refuses Any-backed reviewed data even when a location ID is supplied', () => {
    const document = compileAcquisitionSources(compilerInput({
      reviewedSources: [{
        output: 'Legacy item',
        sourceKind: 'DROP',
        sourceHost: 'Legacy monster',
        regions: ['Any'],
        locationId: 'surface:50,50',
        outputQuantity: 1,
        requirements: { op: 'ALL', terms: [] },
        repeatability: 'REPEATABLE',
        probability: 0.5,
        coverage: 'VERIFIED',
        provenanceIds: ['resource-map:legacy-item:0'],
      }],
    }));

    expect(document.rules.some(rule => rule.output.label === 'Legacy item')).toBe(false);
    expect(document.unresolvedSources).toContainEqual(expect.objectContaining({
      output: 'Legacy item',
      reason: 'REGION_ONLY_LOCATION',
      coverage: 'UNKNOWN',
    }));
  });

  it('never copies surface hosts onto child locations sharing a surface chunk', () => {
    const child = {
      id: 'interior:lumbridge-cellar',
      label: 'Lumbridge cellar',
      surfaceChunk: '50,50',
      parentId: 'surface:50,50',
      coverage: 'VERIFIED' as const,
    };
    const document = compileAcquisitionSources(compilerInput({
      locationNodes: [location, child],
    }));

    expect(new Set(document.rules.map(rule => rule.locationId)))
      .toEqual(new Set(['surface:50,50']));
  });

  it('does not guess between duplicate surface owners', () => {
    const duplicate = {
      ...location,
      id: 'surface:lumbridge-duplicate',
    };
    const document = compileAcquisitionSources(compilerInput({
      locationNodes: [location, duplicate],
    }));

    expect(document.rules).toHaveLength(0);
  });

  it('downgrades unresolved VERIFIED claims to UNKNOWN', () => {
    const document = compileAcquisitionSources(compilerInput({
      reviewedSources: [{
        output: 'Legacy item',
        sourceKind: 'DROP',
        sourceHost: 'Legacy monster',
        regions: ['Misthalin'],
        coverage: 'VERIFIED',
        provenanceIds: ['resource-map:legacy-item:0'],
      }],
    }));

    expect(document.unresolvedSources).toContainEqual(expect.objectContaining({
      output: 'Legacy item',
      coverage: 'UNKNOWN',
    }));
  });
});
describe('conflicting acquisition rules', () => {
  it('quarantines every variant of a three-way stable-ID conflict', () => {
    const base = {
      output: 'Oak plank',
      sourceHost: 'Sawmill',
      locationId: 'surface:50,50',
      inputs: { Coins: 1 },
      requirements: { op: 'ALL' as const, terms: [] },
      repeatability: 'REPEATABLE' as const,
      probability: null,
      coverage: 'VERIFIED' as const,
    };
    const document = compileAcquisitionSources(compilerInput({
      productionRecipes: [1, 2, 3].map(quantity => ({
        ...base,
        outputQuantity: quantity,
        provenanceIds: [`recipe-audit:oak-plank:${quantity}`],
      })),
    }));
    const conflicts = document.unresolvedSources.filter(
      source => source.reason === 'CONFLICTING_RULE_ID',
    );

    expect(document.rules.filter(rule => rule.output.label === 'Oak plank')).toHaveLength(0);
    expect(conflicts).toHaveLength(3);
    expect(new Set(conflicts.map(source => source.id))).toHaveLength(3);
  });
});
describe('global acquisition coverage', () => {
  it('stays PARTIAL when valid unresolved legacy evidence is all that exists', () => {
    const document = compileAcquisitionSources(compilerInput({
      locationNodes: [],
      chunks: {},
      shopItems: {},
      drops: {},
      reviewedSources: [{
        output: 'Unbound item',
        sourceKind: 'DROP',
        sourceHost: 'Legacy monster',
        regions: ['Any'],
        coverage: 'UNKNOWN',
        provenanceIds: ['resource-map:unbound-item:0'],
      }],
    }));

    expect(document.acquisitionCoverage).toBe('PARTIAL');
  });
});
describe('ChunkContentService RuneProof source access', () => {
  it('returns an isolated audited subset instead of the private raw document', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 1,
        source: 'fixture',
        sourceMeta: {
          repository: 'source/repository',
          commit: 'source-commit',
          blobSha: 'blob',
          rawSha256: 'raw',
          policyVersion: 2,
        },
        chunks: { 12850: { i: ['Pot'] } },
        shopItems: { Shop: ['Pot'] },
        drops: { Goblin: ['Coins'] },
        taskUnlocks: {},
        questSections: {},
        locationNodes: [location],
        locationEdges: [],
        tags: { ignored: ['12850'] },
      }),
    }));

    await expect(chunkContentService.init()).resolves.toBe(true);
    const first = chunkContentService.runeProofSourceDocument();
    expect(first).toEqual({
      version: 1,
      source: 'fixture',
      sourceMeta: {
        repository: 'source/repository',
        commit: 'source-commit',
        blobSha: 'blob',
        rawSha256: 'raw',
        policyVersion: 2,
      },
      chunks: { 12850: { i: ['Pot'] } },
      shopItems: { Shop: ['Pot'] },
      drops: { Goblin: ['Coins'] },
      taskUnlocks: {},
      questSections: {},
      locationNodes: [location],
      locationEdges: [],
    });
    first!.chunks['12850'].i![0] = 'mutated';
    expect(chunkContentService.runeProofSourceDocument()!.chunks['12850'].i)
      .toEqual(['Pot']);
  });
});
function canonicalTestJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalTestJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalTestJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}