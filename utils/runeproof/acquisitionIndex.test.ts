import { describe, expect, it, vi } from 'vitest';
import { chunkContentService } from '../../services/ChunkContentService';
import {
  buildAcquisitionIndex,
  compileAcquisitionSources,
  type AcquisitionCompilerInput,
} from './acquisitionIndex';
import { factId } from './model';

const sourceVersion = 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
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
    sourceVersion,
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

  it('preserves one-time repeatability and known output metadata', () => {
    const document = compileAcquisitionSources(compilerInput({
      productionRecipes: [{
        output: 'Quest token',
        outputQuantity: 3,
        sourceHost: 'Duke Horacio',
        locationId: 'surface:50,50',
        inputs: {},
        requirements: { op: 'ALL', terms: [] },
        repeatability: 'ONE_TIME',
        probability: 1,
        coverage: 'VERIFIED',
        provenanceIds: ['quest-reward-audit:quest-token@1'],
      }],
    }));
    const rule = document.rules.find(candidate => candidate.output.label === 'Quest token');

    expect(rule).toMatchObject({
      outputQuantity: 3,
      repeatability: 'ONE_TIME',
      probability: 1,
    });
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
        coverage: 'PARTIAL',
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
        'chunk:ba2fcebf8b26c84c74f8d9ab328a0ede802be926:12850',
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
          inputs: {},
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
          inputs: {},
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
      coverage: 'PARTIAL',
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

  it('downgrades unresolved VERIFIED claims to PARTIAL', () => {
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
      coverage: 'PARTIAL',
    }));
  });
});
describe('conflicting acquisition rules', () => {
  it('quarantines every variant of a three-way stable-ID conflict', () => {
    const base = {
      output: 'Oak plank',
      sourceHost: 'Sawmill',
      locationId: 'surface:50,50',
      inputs: {},
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