import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import catalogue from '../data/sources/runeproof-quest-catalogue.json';
import validation from '../data/sources/runeproof-pack-validation.json';
import preview from '../data/sources/runeproof-pack-releases.preview.json';
import publicReleases from '../data/sources/runeproof-pack-releases.public.json';
import { loadRuneProofPackFor } from '../data/questWalkthroughLoader';
import { publicRuneProofPackReleases } from '../data/runeProofPackRelease.public';
import type { RequirementExpression } from '../utils/questStrategies/packModel';
import type {
  RuneProofCoverageDimensionId,
  RuneProofCoverageDisposition,
  RuneProofCoverageRow,
  RuneProofCoverageSummary,
} from './runeproof-coverage.types';
import {
  assertRuneProofCoverageComplete,
  COVERAGE_DIMENSIONS,
  generateRuneProofCoverage,
} from './runeproof-coverage.mjs';

const CONDITIONAL_DIMENSIONS = [
  'transport',
  'instances',
  'branches',
  'combatManual',
] as const;

const coverageScriptPath = fileURLToPath(new URL('./runeproof-coverage.mjs', import.meta.url));
const coverageOutputPath = fileURLToPath(
  new URL('../data/sources/runeproof-coverage.json', import.meta.url),
);

const runCoverageCli = (args: readonly string[]) => spawnSync(
  process.execPath,
  [coverageScriptPath, ...args],
  { encoding: 'utf8' },
);

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonicalValue(child)]));
  }
  return value;
};

const VALIDATED_DIMENSIONS = [
  'preflight',
  'coreRoute',
  'locations',
  'items',
  'combatManual',
  'evidence',
  'progressMigration',
  'completion',
] as const;

const PUBLIC_MANUAL_ACTION_COUNTS: Readonly<Record<string, number>> = {
  "Cook's Assistant": 5,
  'Sheep Shearer': 3,
  'The Restless Ghost': 6,
  'Rune Mysteries': 4,
  'Imp Catcher': 1,
};

const atomsIn = (expression: RequirementExpression): readonly RequirementExpression[] => (
  expression.kind === 'ALL' || expression.kind === 'ANY'
    ? expression.requirements.flatMap(atomsIn)
    : [expression]
);

const recomputeCoverageSummary = (
  rows: readonly RuneProofCoverageRow[],
): RuneProofCoverageSummary => {
  const dimensions = Object.fromEntries(COVERAGE_DIMENSIONS.map(dimension => [dimension, {
    required: 0,
    notRequired: 0,
    needsReview: 0,
    modelled: 0,
    validated: 0,
    previewApproved: 0,
    publicApproved: 0,
    findingCount: 0,
  }])) as unknown as RuneProofCoverageSummary['dimensions'];

  for (const row of rows) {
    for (const dimension of COVERAGE_DIMENSIONS) {
      const cell = row.dimensions[dimension];
      const summary = dimensions[dimension] as {
        required: number;
        notRequired: number;
        needsReview: number;
        modelled: number;
        validated: number;
        previewApproved: number;
        publicApproved: number;
        findingCount: number;
      };
      if (cell.applicability === 'REQUIRED') summary.required += 1;
      if (cell.applicability === 'NOT_REQUIRED') summary.notRequired += 1;
      if (cell.applicability === 'NEEDS_REVIEW') summary.needsReview += 1;
      if (cell.modelled) summary.modelled += 1;
      if (cell.validated) summary.validated += 1;
      if (cell.previewApproved) summary.previewApproved += 1;
      if (cell.publicApproved) summary.publicApproved += 1;
      summary.findingCount += cell.findingIds.length;
    }
  }

  return {
    totalObjectives: rows.length,
    quests: rows.filter(row => row.kind === 'quest').length,
    miniquests: rows.filter(row => row.kind === 'miniquest').length,
    f2p: rows.filter(row => row.membership === 'F2P').length,
    members: rows.filter(row => row.membership === 'MEMBERS').length,
    compilerValidPacks: rows.filter(row => row.compilerValid).length,
    previewApprovedPacks: rows.filter(row => row.previewApproved).length,
    publicApprovedPacks: rows.filter(row => row.publicApproved).length,
    dimensions,
  };
};

const coverageInputForDisposition = (
  dimension: Exclude<RuneProofCoverageDimensionId, 'identity'>,
  disposition: RuneProofCoverageDisposition,
) => {
  const catalogueRevision = 'catalogue-fixture-v1';
  const questId = 'Coverage Fixture 1';
  const packRevision = 'pack-fixture-v1';
  const semanticDisposition = Object.fromEntries(
    COVERAGE_DIMENSIONS
      .filter(candidate => candidate !== 'identity')
      .map(candidate => [candidate, candidate === dimension ? disposition : 'VALIDATED']),
  ) as Record<Exclude<RuneProofCoverageDimensionId, 'identity'>, RuneProofCoverageDisposition>;
  return {
    catalogue: {
      schemaVersion: 1,
      catalogueRevision,
      entries: [{
        questId,
        slug: 'coverage-fixture-1',
        kind: 'quest',
        membership: 'F2P',
        milestone: 1,
        progressionPriority: 1,
        requirementStatus: 'VERIFIED',
      }],
    },
    validation: {
      schemaVersion: 1,
      catalogueRevision,
      packs: [{
        questId,
        packRevision,
        blockingFindingIds: [],
        findingDimensions: {},
        semanticDisposition,
      }],
    },
    preview: {
      schemaVersion: 1,
      catalogueRevision,
      entries: disposition === 'NEEDS_REVIEW' ? [] : [{
        questId,
        packRevision,
        catalogueRevision,
        lifecycle: 'PREVIEW_VALIDATED',
      }],
    },
    publicReleases: {
      schemaVersion: 1,
      catalogueRevision,
      entries: [],
    },
  };
};

const makeSyntheticCompleteCoverageInput = (count: number) => {
  const catalogueRevision = 'catalogue-complete-v1';
  const entries = Array.from({ length: count }, (_, index) => ({
    questId: `Coverage Fixture ${index + 1}`,
    slug: `coverage-fixture-${index + 1}`,
    kind: index % 10 === 0 ? 'miniquest' as const : 'quest' as const,
    membership: index % 8 === 0 ? 'F2P' as const : 'MEMBERS' as const,
    milestone: ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5,
    progressionPriority: index + 1,
    requirementStatus: 'VERIFIED',
  }));
  const packs = entries.map((entry, index) => ({
    questId: entry.questId,
    packRevision: `pack-complete-${index + 1}`,
    blockingFindingIds: [] as string[],
    findingDimensions: {} as Record<string, RuneProofCoverageDimensionId[]>,
    semanticDisposition: Object.fromEntries(
      COVERAGE_DIMENSIONS
        .filter(dimension => dimension !== 'identity')
        .map(dimension => [
          dimension,
          CONDITIONAL_DIMENSIONS.includes(dimension as typeof CONDITIONAL_DIMENSIONS[number])
            ? 'NOT_REQUIRED'
            : 'VALIDATED',
        ]),
    ) as Record<Exclude<RuneProofCoverageDimensionId, 'identity'>, RuneProofCoverageDisposition>,
  }));
  const releases = entries.map((entry, index) => ({
    questId: entry.questId,
    packRevision: `pack-complete-${index + 1}`,
    catalogueRevision,
    lifecycle: 'PUBLIC_APPROVED',
  }));
  return {
    catalogue: { schemaVersion: 1, catalogueRevision, entries },
    validation: { schemaVersion: 1, catalogueRevision, packs },
    preview: { schemaVersion: 1, catalogueRevision, entries: structuredClone(releases) },
    publicReleases: { schemaVersion: 1, catalogueRevision, entries: releases },
  };
};

const completeCoverageSnapshot = () => structuredClone(
  generateRuneProofCoverage(makeSyntheticCompleteCoverageInput(210)),
);

const COMPLETE_ROW_KEYS = [
  'questId',
  'slug',
  'kind',
  'membership',
  'milestone',
  'progressionPriority',
  'packRevision',
  'compilerValid',
  'previewApproved',
  'publicApproved',
  'dimensions',
] as const;

const COMPLETE_CELL_KEYS = [
  'applicability',
  'modelled',
  'validated',
  'previewApproved',
  'publicApproved',
  'findingIds',
] as const;

describe('RuneProof coverage', () => {
  it('derives all aggregate counts from exactly 210 rows', () => {
    const snapshot = generateRuneProofCoverage({
      catalogue,
      validation,
      preview,
      publicReleases,
    });
    expect(snapshot.rows).toHaveLength(210);
    expect(new Set(snapshot.rows.map(row => row.questId)).size).toBe(210);
    expect(snapshot.rows.every(row => (
      Object.keys(row.dimensions).sort().join(',')
        === [...COVERAGE_DIMENSIONS].sort().join(',')
    ))).toBe(true);
    expect(snapshot.summary).toEqual(recomputeCoverageSummary(snapshot.rows));
    expect(snapshot.summary.compilerValidPacks).toBe(5);
    expect(snapshot.summary.previewApprovedPacks).toBe(5);
    expect(snapshot.summary.publicApprovedPacks).toBe(5);
  });

  it('reports the independently checked Milestone 1 totals', () => {
    const snapshot = generateRuneProofCoverage({
      catalogue,
      validation,
      preview,
      publicReleases,
    });
    expect(snapshot.summary).toEqual({
      totalObjectives: 210,
      quests: 191,
      miniquests: 19,
      f2p: 23,
      members: 187,
      compilerValidPacks: 5,
      previewApprovedPacks: 5,
      publicApprovedPacks: 5,
      dimensions: {
        identity: {
          required: 210, notRequired: 0, needsReview: 0,
          modelled: 210, validated: 210, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        preflight: {
          required: 207, notRequired: 0, needsReview: 3,
          modelled: 207, validated: 207, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        coreRoute: {
          required: 210, notRequired: 0, needsReview: 0,
          modelled: 5, validated: 5, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        locations: {
          required: 210, notRequired: 0, needsReview: 0,
          modelled: 5, validated: 5, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        transport: {
          required: 0, notRequired: 5, needsReview: 205,
          modelled: 5, validated: 5, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        instances: {
          required: 0, notRequired: 5, needsReview: 205,
          modelled: 5, validated: 5, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        items: {
          required: 210, notRequired: 0, needsReview: 0,
          modelled: 5, validated: 5, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        branches: {
          required: 0, notRequired: 5, needsReview: 205,
          modelled: 5, validated: 5, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        combatManual: {
          required: 5, notRequired: 0, needsReview: 205,
          modelled: 5, validated: 5, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        evidence: {
          required: 210, notRequired: 0, needsReview: 0,
          modelled: 5, validated: 5, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        progressMigration: {
          required: 210, notRequired: 0, needsReview: 0,
          modelled: 5, validated: 5, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
        completion: {
          required: 210, notRequired: 0, needsReview: 0,
          modelled: 5, validated: 5, previewApproved: 5, publicApproved: 5,
          findingCount: 0,
        },
      },
    });
  });

  it('does not turn absent packs into false not-required claims', () => {
    const snapshot = generateRuneProofCoverage({
      catalogue,
      validation,
      preview,
      publicReleases,
    });
    const absent = snapshot.rows.find(row => row.questId === "Daddy's Home")!;
    expect(absent.dimensions.coreRoute).toMatchObject({
      applicability: 'REQUIRED',
      modelled: false,
      validated: false,
    });
    for (const dimension of CONDITIONAL_DIMENSIONS) {
      expect(absent.dimensions[dimension].applicability).toBe('NEEDS_REVIEW');
    }
  });

  it('keeps unresolved requirements visibly under review', () => {
    const snapshot = generateRuneProofCoverage({
      catalogue,
      validation,
      preview,
      publicReleases,
    });
    for (const questId of ['Bear Your Soul', 'Desert Treasure I', 'The Enchanted Key']) {
      expect(snapshot.rows.find(row => row.questId === questId)?.dimensions.preflight)
        .toMatchObject({
          applicability: 'NEEDS_REVIEW',
          validated: false,
        });
    }
  });

  it('rejects stale manifest or validation revisions', () => {
    const changed = structuredClone(publicReleases);
    changed.entries[0].packRevision = 'stale';
    expect(() => generateRuneProofCoverage({
      catalogue,
      validation,
      preview,
      publicReleases: changed,
    })).toThrow(/stale pack revision/);
  });

  it.each([
    ['validation catalogue revision', (changed: ReturnType<typeof makeSyntheticCompleteCoverageInput>) => {
      changed.validation.catalogueRevision = 'stale-catalogue';
    }],
    ['validation pack revision', (changed: ReturnType<typeof makeSyntheticCompleteCoverageInput>) => {
      changed.validation.packs[0].packRevision = 'stale-pack';
    }],
  ])('rejects stale %s', (_label, mutate) => {
    const changed = makeSyntheticCompleteCoverageInput(210);
    mutate(changed);
    expect(() => generateRuneProofCoverage(changed)).toThrow(/stale/i);
  });

  it.each([
    ['VALIDATED', { applicability: 'REQUIRED', modelled: true, validated: true }],
    ['NOT_REQUIRED', { applicability: 'NOT_REQUIRED', modelled: true, validated: true }],
    ['NEEDS_REVIEW', { applicability: 'NEEDS_REVIEW', modelled: false, validated: false }],
  ] as const)('maps %s to one exact coverage cell', (disposition, expected) => {
    const snapshot = generateRuneProofCoverage(
      coverageInputForDisposition('transport', disposition),
    );
    expect(snapshot.rows[0].dimensions.transport).toMatchObject(expected);
  });

  it('rejects final-programme enforcement while any dimension needs review', () => {
    const completeLooking = makeSyntheticCompleteCoverageInput(210);
    completeLooking.validation.packs[0].semanticDisposition.transport = 'NEEDS_REVIEW';
    const snapshot = generateRuneProofCoverage(completeLooking);
    expect(snapshot.summary.compilerValidPacks).toBe(210);
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/transport.*NEEDS_REVIEW/i);
  });

  it('records the exact inspected dispositions for only the five public packs', () => {
    expect(validation.packs.map(pack => pack.questId)).toEqual([
      "Cook's Assistant",
      'Sheep Shearer',
      'The Restless Ghost',
      'Rune Mysteries',
      'Imp Catcher',
    ]);
    for (const pack of validation.packs) {
      for (const dimension of VALIDATED_DIMENSIONS) {
        expect(pack.semanticDisposition[dimension]).toBe('VALIDATED');
      }
      for (const dimension of ['transport', 'instances', 'branches'] as const) {
        expect(pack.semanticDisposition[dimension]).toBe('NOT_REQUIRED');
      }
    }
  });

  it('recomputes every validation record from the exact public compiled pack', async () => {
    expect(publicRuneProofPackReleases.map(release => ({
      questId: release.questId,
      packRevision: release.packRevision,
    }))).toEqual(validation.packs.map(pack => ({
      questId: pack.questId,
      packRevision: pack.packRevision,
    })));

    for (const release of publicRuneProofPackReleases) {
      const loaded = await loadRuneProofPackFor('PUBLIC', release);
      expect(loaded).toBeDefined();
      const pack = loaded!.pack;
      const actions = [
        ...pack.sharedActions,
        ...pack.branches.flatMap(branch => branch.actions),
      ];
      const requirements = [
        pack.preflight,
        ...pack.branches.map(branch => branch.requirements),
        ...actions.flatMap(action => [
          action.requirements,
          ...action.alternatives.map(alternative => alternative.requirements),
        ]),
      ].flatMap(atomsIn);
      const blockingFindingIds = pack.findings
        .filter(finding => finding.severity === 'BLOCKING')
        .map(finding => finding.id)
        .sort();
      const completionActionIds = new Set(
        Object.values(pack.completion.branchActionIds),
      );

      expect(pack.catalogueRevision).toBe(catalogue.catalogueRevision);
      expect(pack.revision).toBe(release.packRevision);
      expect(blockingFindingIds).toEqual([]);
      expect(pack.branches).toHaveLength(1);
      expect(pack.branches[0].actions.length).toBeGreaterThan(0);
      expect(pack.branches[0].actions.some(action => completionActionIds.has(action.id)))
        .toBe(true);
      expect(actions.every(action => (
        action.location.kind === 'SURFACE'
        && action.location.chunks.length > 0
        && action.location.evidenceIds.length > 0
      ))).toBe(true);
      expect(pack.sources.length).toBeGreaterThan(0);
      expect(pack.evidence.length).toBeGreaterThan(0);
      expect(pack.evidence.every(evidence => (
        pack.sources.some(source => source.id === evidence.sourceId)
      ))).toBe(true);
      expect(requirements.some(requirement => requirement.kind === 'TRANSPORT_ACCESS'))
        .toBe(false);
      expect(requirements.some(requirement => requirement.kind === 'INSTANCE_ACCESS'))
        .toBe(false);
      expect(requirements.some(requirement => requirement.kind === 'UNRESOLVED_EVIDENCE'))
        .toBe(false);
      expect(actions.some(action => action.location.kind === 'INSTANCE')).toBe(false);
      expect(actions.some(action => action.combat !== undefined)).toBe(false);
      expect(actions.filter(action => action.completion.kind === 'ACTION_CONFIRMED'))
        .toHaveLength(PUBLIC_MANUAL_ACTION_COUNTS[release.questId]);
      expect(loaded!.legacyProjection).toBeDefined();

      const derivedRecord = {
        questId: pack.questId,
        packRevision: pack.revision,
        blockingFindingIds,
        findingDimensions: {},
        semanticDisposition: {
          preflight: 'VALIDATED',
          coreRoute: 'VALIDATED',
          locations: 'VALIDATED',
          transport: 'NOT_REQUIRED',
          instances: 'NOT_REQUIRED',
          items: 'VALIDATED',
          branches: 'NOT_REQUIRED',
          combatManual: 'VALIDATED',
          evidence: 'VALIDATED',
          progressMigration: 'VALIDATED',
          completion: 'VALIDATED',
        },
      };
      expect(validation.packs.find(record => record.questId === pack.questId))
        .toEqual(derivedRecord);
    }
  });

  it.each([
    'preflight',
    'coreRoute',
    'locations',
    'items',
    'evidence',
    'progressMigration',
    'completion',
  ] as const)('rejects NOT_REQUIRED for intrinsic %s coverage', (dimension) => {
    expect(() => generateRuneProofCoverage(
      coverageInputForDisposition(dimension, 'NOT_REQUIRED'),
    )).toThrow(/NOT_REQUIRED.*conditional/i);
  });

  it('allocates each compiler finding to every named dimension and nowhere else', () => {
    const input = coverageInputForDisposition('transport', 'VALIDATED');
    input.validation.packs[0].blockingFindingIds = ['finding-a', 'finding-b'];
    input.validation.packs[0].findingDimensions = {
      'finding-a': ['transport', 'items'],
      'finding-b': ['items'],
    };
    const snapshot = generateRuneProofCoverage(input);

    expect(snapshot.rows[0].compilerValid).toBe(false);
    expect(snapshot.rows[0].dimensions.transport.findingIds).toEqual(['finding-a']);
    expect(snapshot.rows[0].dimensions.items.findingIds)
      .toEqual(['finding-a', 'finding-b']);
    expect(snapshot.rows[0].dimensions.instances.findingIds).toEqual([]);
    expect(snapshot.summary.dimensions.transport.findingCount).toBe(1);
    expect(snapshot.summary.dimensions.items.findingCount).toBe(2);
  });

  it.each([
    ['unsorted IDs', (input: ReturnType<typeof coverageInputForDisposition>) => {
      input.validation.packs[0].blockingFindingIds = ['finding-b', 'finding-a'];
      input.validation.packs[0].findingDimensions = {
        'finding-a': ['items'],
        'finding-b': ['items'],
      };
    }],
    ['duplicate IDs', (input: ReturnType<typeof coverageInputForDisposition>) => {
      input.validation.packs[0].blockingFindingIds = ['finding-a', 'finding-a'];
      input.validation.packs[0].findingDimensions = { 'finding-a': ['items'] };
    }],
    ['missing allocation', (input: ReturnType<typeof coverageInputForDisposition>) => {
      input.validation.packs[0].blockingFindingIds = ['finding-a'];
    }],
    ['extra allocation', (input: ReturnType<typeof coverageInputForDisposition>) => {
      input.validation.packs[0].findingDimensions = { 'finding-a': ['items'] };
    }],
    ['empty allocation', (input: ReturnType<typeof coverageInputForDisposition>) => {
      input.validation.packs[0].blockingFindingIds = ['finding-a'];
      input.validation.packs[0].findingDimensions = { 'finding-a': [] };
    }],
    ['duplicate dimensions', (input: ReturnType<typeof coverageInputForDisposition>) => {
      input.validation.packs[0].blockingFindingIds = ['finding-a'];
      input.validation.packs[0].findingDimensions = { 'finding-a': ['items', 'items'] };
    }],
    ['unknown dimension', (input: ReturnType<typeof coverageInputForDisposition>) => {
      input.validation.packs[0].blockingFindingIds = ['finding-a'];
      input.validation.packs[0].findingDimensions = { 'finding-a': ['unknown' as any] };
    }],
  ])('rejects invalid compiler-finding evidence: %s', (_label, mutate) => {
    const input = coverageInputForDisposition('transport', 'VALIDATED');
    mutate(input);
    expect(() => generateRuneProofCoverage(input)).toThrow(/finding/i);
  });

  it('uses code-point order for compiler finding IDs', () => {
    const input = coverageInputForDisposition('transport', 'VALIDATED');
    input.validation.packs[0].blockingFindingIds = ['z-finding', 'é-finding'];
    input.validation.packs[0].findingDimensions = {
      'z-finding': ['transport'],
      'é-finding': ['transport'],
    };
    expect(generateRuneProofCoverage(input).rows[0].dimensions.transport.findingIds)
      .toEqual(['z-finding', 'é-finding']);
  });

  it('fails closed on an approved manifest record with incomplete semantics', () => {
    const input = coverageInputForDisposition('transport', 'NEEDS_REVIEW');
    const release = {
      questId: input.catalogue.entries[0].questId,
      packRevision: input.validation.packs[0].packRevision,
      catalogueRevision: input.catalogue.catalogueRevision,
      lifecycle: 'PUBLIC_APPROVED',
    };
    input.preview.entries = [structuredClone(release)];
    input.publicReleases.entries = [release];
    const row = generateRuneProofCoverage(input).rows[0];
    expect(row.previewApproved).toBe(false);
    expect(row.publicApproved).toBe(false);
    expect(row.dimensions.transport).toMatchObject({
      applicability: 'NEEDS_REVIEW',
      previewApproved: false,
      publicApproved: false,
    });
  });

  it('rejects a public approval absent from the exact preview manifest', () => {
    const input = coverageInputForDisposition('transport', 'VALIDATED');
    input.preview.entries = [];
    input.publicReleases.entries = [{
      questId: input.catalogue.entries[0].questId,
      packRevision: input.validation.packs[0].packRevision,
      catalogueRevision: input.catalogue.catalogueRevision,
      lifecycle: 'PUBLIC_APPROVED',
    }];
    expect(() => generateRuneProofCoverage(input)).toThrow(/public.*preview/i);
  });

  it.each([
    ['preview top level', 'preview'],
    ['public top level', 'publicReleases'],
  ] as const)('rejects extra keys in the %s manifest schema', (_label, key) => {
    const input: any = coverageInputForDisposition('transport', 'VALIDATED');
    input[key].unexpected = true;
    expect(() => generateRuneProofCoverage(input)).toThrow(/exactly/i);
  });

  it.each([
    ['preview entry', 'preview'],
    ['public entry', 'publicReleases'],
  ] as const)('rejects extra keys in the %s schema', (_label, key) => {
    const input: any = coverageInputForDisposition('transport', 'VALIDATED');
    if (key === 'publicReleases') {
      input.publicReleases.entries = [{
        ...input.preview.entries[0],
        lifecycle: 'PUBLIC_APPROVED',
      }];
    }
    input[key].entries[0].unexpected = true;
    expect(() => generateRuneProofCoverage(input)).toThrow(/exactly/i);
  });

  it('ignores a fabricated aggregate summary when enforcing completion', () => {
    const snapshot = generateRuneProofCoverage(makeSyntheticCompleteCoverageInput(210));
    const changed = structuredClone(snapshot);
    changed.summary.compilerValidPacks = 0;
    expect(() => assertRuneProofCoverageComplete(changed)).not.toThrow();
  });

  it('rejects 211 otherwise complete rows', () => {
    const snapshot = generateRuneProofCoverage(makeSyntheticCompleteCoverageInput(211));
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/exactly 210/i);
  });

  it('rejects duplicate objective rows from final-programme enforcement', () => {
    const snapshot = structuredClone(
      generateRuneProofCoverage(makeSyntheticCompleteCoverageInput(210)),
    );
    snapshot.rows[1].questId = snapshot.rows[0].questId;
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/unique.*quest/i);
  });

  it('rejects a row whose exact dimension set is incomplete', () => {
    const snapshot = structuredClone(
      generateRuneProofCoverage(makeSyntheticCompleteCoverageInput(210)),
    );
    delete (snapshot.rows[0].dimensions as any).completion;
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/exact.*dimension/i);
  });

  it('rejects NOT_REQUIRED on an intrinsic dimension at final enforcement', () => {
    const snapshot = structuredClone(
      generateRuneProofCoverage(makeSyntheticCompleteCoverageInput(210)),
    );
    snapshot.rows[0].dimensions.coreRoute.applicability = 'NOT_REQUIRED';
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/coreRoute.*NOT_REQUIRED.*conditional/i);
  });

  it('rejects a compiler-valid row without an exact pack revision', () => {
    const snapshot = structuredClone(
      generateRuneProofCoverage(makeSyntheticCompleteCoverageInput(210)),
    );
    delete snapshot.rows[0].packRevision;
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/pack revision/i);
  });

  it.each(COMPLETE_ROW_KEYS)(
    'rejects a final-programme row missing its required %s field',
    (field) => {
      const snapshot = completeCoverageSnapshot();
      delete (snapshot.rows[0] as any)[field];
      expect(() => assertRuneProofCoverageComplete(snapshot))
        .toThrow(/row 0.*exactly/i);
    },
  );

  it('rejects an extra final-programme row field', () => {
    const snapshot = completeCoverageSnapshot();
    (snapshot.rows[0] as any).unexpected = true;
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/row 0.*exactly/i);
  });

  it.each(COMPLETE_CELL_KEYS)(
    'rejects a final-programme cell missing its required %s field',
    (field) => {
      const snapshot = completeCoverageSnapshot();
      delete (snapshot.rows[0].dimensions.items as any)[field];
      expect(() => assertRuneProofCoverageComplete(snapshot))
        .toThrow(/items.*exactly/i);
    },
  );

  it('rejects an extra final-programme cell field', () => {
    const snapshot = completeCoverageSnapshot();
    (snapshot.rows[0].dimensions.items as any).unexpected = true;
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/items.*exactly/i);
  });

  it.each([
    ['compilerValid', 'row'],
    ['previewApproved', 'row'],
    ['publicApproved', 'row'],
    ['modelled', 'cell'],
    ['validated', 'cell'],
    ['previewApproved', 'cell'],
    ['publicApproved', 'cell'],
  ] as const)('rejects a truthy string for the %s %s boolean', (field, target) => {
    const snapshot = completeCoverageSnapshot();
    const record: any = target === 'row'
      ? snapshot.rows[0]
      : snapshot.rows[0].dimensions.items;
    record[field] = 'true';
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/boolean/i);
  });

  it.each([
    ['blank slug', (row: any) => { row.slug = ''; }],
    ['unknown kind', (row: any) => { row.kind = 'activity'; }],
    ['unknown membership', (row: any) => { row.membership = 'UNKNOWN'; }],
    ['unknown milestone', (row: any) => { row.milestone = 6; }],
    ['fractional priority', (row: any) => { row.progressionPriority = 1.5; }],
  ])('rejects an invalid final-programme row value: %s', (_label, mutate) => {
    const snapshot = completeCoverageSnapshot();
    mutate(snapshot.rows[0]);
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/row 0/i);
  });

  it.each([
    ['string', 'finding-a'],
    ['sparse array', Object.assign(new Array(2), { 0: 'finding-a' })],
    ['unsorted IDs', ['finding-b', 'finding-a']],
    ['duplicate IDs', ['finding-a', 'finding-a']],
    ['blank ID', ['']],
    ['non-string ID', [1]],
  ])('rejects %s for final-programme findingIds', (_label, findingIds) => {
    const snapshot = completeCoverageSnapshot();
    (snapshot.rows[0].dimensions.items as any).findingIds = findingIds;
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/findingIds.*sorted unique strings/i);
  });

  it.each([
    ['own every hides a non-string', () => {
      const findingIds: any[] = [1];
      findingIds.every = () => true;
      return findingIds;
    }],
    ['own toJSON hides unsorted IDs', () => {
      const findingIds = ['finding-b', 'finding-a'];
      (findingIds as any).toJSON = () => ['finding-a', 'finding-b'];
      return findingIds;
    }],
    ['own Symbol.iterator mutates duplicate IDs while validating', () => {
      const findingIds = ['finding-a', 'finding-a'];
      Object.defineProperty(findingIds, Symbol.iterator, {
        value: function* () {
          yield findingIds[0];
          findingIds[1] = 'finding-b';
          yield findingIds[1];
        },
      });
      return findingIds;
    }],
  ])('rejects findingIds when %s', (_label, makeFindingIds) => {
    const snapshot = completeCoverageSnapshot();
    (snapshot.rows[0].dimensions.items as any).findingIds = makeFindingIds();
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/findingIds.*sorted unique strings/i);
  });

  it('accepts a dense code-point-sorted unique final findingIds array', () => {
    const snapshot = completeCoverageSnapshot();
    snapshot.rows[0].dimensions.items.findingIds = ['z-finding', 'é-finding'];
    expect(() => assertRuneProofCoverageComplete(snapshot)).not.toThrow();
  });

  it('accepts a frozen dense code-point-sorted unique final findingIds array', () => {
    const snapshot = completeCoverageSnapshot();
    (snapshot.rows[0].dimensions.items as any).findingIds = Object.freeze([
      'z-finding',
      'é-finding',
    ]);
    expect(() => assertRuneProofCoverageComplete(snapshot)).not.toThrow();
  });

  it.each([
    ['unknown string', 'MAYBE'],
    ['lowercase string', 'required'],
    ['array lookalike', ['REQUIRED']],
    ['boxed string', new String('REQUIRED')],
  ])('rejects an %s final-programme applicability', (_label, applicability) => {
    const snapshot = completeCoverageSnapshot();
    (snapshot.rows[0].dimensions.items as any).applicability = applicability;
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/known applicability/i);
  });

  it.each([
    ['row', (snapshot: ReturnType<typeof completeCoverageSnapshot>) => {
      Object.setPrototypeOf(snapshot.rows[0], { inherited: true });
    }],
    ['dimensions', (snapshot: ReturnType<typeof completeCoverageSnapshot>) => {
      Object.setPrototypeOf(snapshot.rows[0].dimensions, { inherited: true });
    }],
    ['cell', (snapshot: ReturnType<typeof completeCoverageSnapshot>) => {
      Object.setPrototypeOf(snapshot.rows[0].dimensions.items, { inherited: true });
    }],
  ])('rejects a prototype-backed final-programme %s', (_label, mutate) => {
    const snapshot = completeCoverageSnapshot();
    mutate(snapshot);
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/plain object/i);
  });

  it('rejects a prototype-backed final-programme rows array', () => {
    const snapshot = completeCoverageSnapshot();
    Object.setPrototypeOf(snapshot.rows, Object.create(Array.prototype));
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/plain array/i);
  });

  it('rejects a prototype-backed final-programme findingIds array', () => {
    const snapshot = completeCoverageSnapshot();
    Object.setPrototypeOf(
      snapshot.rows[0].dimensions.items.findingIds,
      Object.create(Array.prototype),
    );
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/findingIds.*sorted unique strings/i);
  });

  it.each([
    ['array', []],
    ['string', 'coverage-row'],
  ])('rejects a final-programme row %s lookalike', (_label, row) => {
    const snapshot = completeCoverageSnapshot();
    (snapshot.rows as any)[0] = row;
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/plain object/i);
  });

  it.each([
    ['array', []],
    ['string', 'coverage-cell'],
  ])('rejects a final-programme cell %s lookalike', (_label, cell) => {
    const snapshot = completeCoverageSnapshot();
    (snapshot.rows[0].dimensions as any).items = cell;
    expect(() => assertRuneProofCoverageComplete(snapshot)).toThrow(/plain object/i);
  });

  it('enforces public approval implies preview approval on a row', () => {
    const snapshot = completeCoverageSnapshot();
    snapshot.rows[0].previewApproved = false;
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/row.*publicApproved.*previewApproved/i);
  });

  it('enforces public approval implies preview approval on a cell', () => {
    const snapshot = completeCoverageSnapshot();
    snapshot.rows[0].dimensions.items.previewApproved = false;
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/items.*publicApproved.*previewApproved/i);
  });

  it('enforces preview approval implies validation on a cell', () => {
    const snapshot = completeCoverageSnapshot();
    snapshot.rows[0].dimensions.items.validated = false;
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/items.*previewApproved.*validated/i);
  });

  it('enforces validation implies modelling on a cell', () => {
    const snapshot = completeCoverageSnapshot();
    snapshot.rows[0].dimensions.items.modelled = false;
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/items.*validated.*modelled/i);
  });

  it('writes canonical deterministic JSON without wall-clock truth', () => {
    const bytes = readFileSync(coverageOutputPath, 'utf8');
    const parsed = JSON.parse(bytes);
    expect(bytes).toBe(`${JSON.stringify(canonicalValue(parsed), null, 2)}\n`);
    expect(bytes).not.toContain('\r');
    expect(bytes).not.toMatch(/generatedAt|createdAt|updatedAt/);
    expect(runCoverageCli(['--check'])).toMatchObject({ status: 0 });
  });

  it('imports the coverage module without running the CLI', () => {
    const before = statSync(coverageOutputPath, { bigint: true }).mtimeNs;
    const moduleUrl = pathToFileURL(coverageScriptPath).href;
    const result = spawnSync(process.execPath, [
      '--input-type=module',
      '--eval',
      `await import(${JSON.stringify(moduleUrl)})`,
    ], { encoding: 'utf8' });
    const after = statSync(coverageOutputPath, { bigint: true }).mtimeNs;
    expect(result.status).toBe(0);
    expect(after).toBe(before);
  });

  it('rejects unknown CLI flags', () => {
    const result = runCoverageCli(['--check', '--unknown']);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/unknown.*--unknown/i);
  });

  it('requires --check before final-programme enforcement without writing', () => {
    const before = statSync(coverageOutputPath, { bigint: true }).mtimeNs;
    const result = runCoverageCli(['--require-complete']);
    const after = statSync(coverageOutputPath, { bigint: true }).mtimeNs;
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--require-complete.*--check/i);
    expect(after).toBe(before);
  });
});
