import { describe, expect, it, vi } from 'vitest';
import {
  loadRuneProofCatalogue,
  loadRuneProofPackFor,
  loadRuneProofPlatformReviewHarness,
} from './questWalkthroughLoader';
import { publicRuneProofPackReleases } from './runeProofPackRelease.public';
import { evaluateRequirementExpression } from '../utils/questStrategies/requirements';

const compatibilityPayload = vi.hoisted(() => ({ imports: 0 }));
const selectedCompilation = vi.hoisted(() => ({ adapterImports: 0, compilerImports: 0 }));

vi.mock('./questWalkthroughs.public', async (importOriginal) => {
  compatibilityPayload.imports += 1;
  return importOriginal<typeof import('./questWalkthroughs.public')>();
});

vi.mock('../utils/questStrategies/legacyPackAdapter', async (importOriginal) => {
  selectedCompilation.adapterImports += 1;
  return importOriginal<typeof import('../utils/questStrategies/legacyPackAdapter')>();
});

vi.mock('../utils/questStrategies/packCompiler', async (importOriginal) => {
  selectedCompilation.compilerImports += 1;
  return importOriginal<typeof import('../utils/questStrategies/packCompiler')>();
});

describe('RuneProof pack loaders', () => {
  it('shows 210 audit summaries without evaluating action payloads or inventing lifecycle', async () => {
    const before = compatibilityPayload.imports;
    const compilationBefore = { ...selectedCompilation };
    const summaries = await loadRuneProofCatalogue('PREVIEW');
    expect(summaries).toHaveLength(210);
    expect(summaries.filter(summary => summary.playable)).toHaveLength(5);
    const daddy = summaries.find(summary => summary.questId === "Daddy's Home");
    expect(daddy).toMatchObject({
      packDisposition: 'NO_PACK',
      reviewStatus: 'NO_PACK',
      proofState: 'NEEDS_REVIEW',
      playable: false,
    });
    expect(daddy?.lifecycle).toBeUndefined();
    expect(daddy?.packRevision).toBeUndefined();
    expect(compatibilityPayload.imports).toBe(before);
    expect(selectedCompilation).toEqual(compilationBefore);
  });

  it('keeps public loading to the five explicit approvals without evaluating payloads', async () => {
    const before = compatibilityPayload.imports;
    const compilationBefore = { ...selectedCompilation };
    const summaries = await loadRuneProofCatalogue('PUBLIC');
    expect(summaries.map(summary => summary.questId))
      .toEqual(publicRuneProofPackReleases.map(release => release.questId));
    expect(compatibilityPayload.imports).toBe(before);
    expect(selectedCompilation).toEqual(compilationBefore);
  });

  it('compares all four release fields before importing the selected payload', async () => {
    const release = publicRuneProofPackReleases[0];
    const before = compatibilityPayload.imports;
    const compilationBefore = { ...selectedCompilation };
    for (const changed of [
      { ...release, questId: 'Sheep Shearer' },
      { ...release, packRevision: 'stale' },
      { ...release, catalogueRevision: 'stale-catalogue' },
      { ...release, lifecycle: 'MILESTONE_APPROVED' as const },
    ]) {
      expect(await loadRuneProofPackFor('PUBLIC', changed)).toBeUndefined();
      expect(compatibilityPayload.imports).toBe(before);
      expect(selectedCompilation).toEqual(compilationBefore);
    }

    const loaded = await loadRuneProofPackFor('PUBLIC', release);
    expect(loaded?.pack).toMatchObject({
      questId: release.questId,
      revision: release.packRevision,
    });
    expect(loaded?.legacyProjection).toMatchObject({
      walkthrough: { questId: release.questId, revision: release.packRevision },
      strategy: { questId: release.questId, revision: release.packRevision },
      reviewedRequirements: { questId: release.questId },
    });
    expect(compatibilityPayload.imports).toBe(before + 1);
    expect(selectedCompilation).toEqual({
      adapterImports: compilationBefore.adapterImports + 1,
      compilerImports: compilationBefore.compilerImports + 1,
    });
  });

  it.each(['PUBLIC', 'PREVIEW'] as const)(
    'returns an isolated deeply frozen %s legacy requirement projection',
    async (availability) => {
      const release = publicRuneProofPackReleases[0];
      const first = await loadRuneProofPackFor(availability, release);
      const original = structuredClone(first?.legacyProjection?.reviewedRequirements);
      const exposed = first?.legacyProjection?.reviewedRequirements as any;
      try { exposed.wikiRevision = 'mutated-revision'; } catch { /* frozen */ }
      try { exposed.items[0].item.name = 'Mutated item'; } catch { /* frozen */ }
      try {
        exposed.items[0].alternatives = [{ key: 'mutated', name: 'Mutated' }];
      } catch { /* frozen */ }
      try {
        exposed.items.push({
          item: { key: 'mutated', name: 'Mutated' },
          quantity: 1,
          supplyPolicy: 'PLAYER_OBTAINED',
        });
      } catch { /* frozen */ }

      const next = await loadRuneProofPackFor(availability, release);
      expect(next?.legacyProjection?.reviewedRequirements).toEqual(original);
      expect(Object.isFrozen(first?.legacyProjection)).toBe(true);
      expect(Object.isFrozen(first?.legacyProjection?.reviewedRequirements)).toBe(true);
      expect(Object.isFrozen(first?.legacyProjection?.reviewedRequirements.items)).toBe(true);
      expect(Object.isFrozen(first?.legacyProjection?.reviewedRequirements.items[0])).toBe(true);
      expect(Object.isFrozen(first?.legacyProjection?.reviewedRequirements.items[0].item)).toBe(true);
    },
  );

  it('does not admit draft-only walkthroughs as preview packs', async () => {
    const summaries = await loadRuneProofCatalogue('PREVIEW');
    for (const questId of ["Daddy's Home", "Doric's Quest", 'Elemental Workshop I']) {
      expect(summaries.find(summary => summary.questId === questId)).toMatchObject({
        packDisposition: 'NO_PACK',
        reviewStatus: 'NO_PACK',
        playable: false,
      });
    }
  });

  it('exposes the synthetic review harness only in private preview', async () => {
    expect(await loadRuneProofPlatformReviewHarness('OFF')).toBeUndefined();
    expect(await loadRuneProofPlatformReviewHarness('PUBLIC')).toBeUndefined();
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    expect(harness).toMatchObject({ marker: 'RUNEPROOF_PLATFORM_REVIEW_HARNESS_V1' });
    expect(harness?.scenarios.map(scenario => scenario.id)).toEqual([
      'READY', 'CONFIRM', 'BLOCKED', 'NEEDS_REVIEW', 'COMPLETE',
    ]);
  });

  it('keeps every private review control represented by compiled harness data', async () => {
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    const ready = harness?.scenarios.find(scenario => scenario.id === 'READY');
    const blocked = harness?.scenarios.find(scenario => scenario.id === 'BLOCKED');
    const needsReview = harness?.scenarios.find(scenario => scenario.id === 'NEEDS_REVIEW');
    expect(ready?.pack.findings).toEqual([]);
    expect(ready?.pack.branches.map(branch => branch.id)).toEqual(['local', 'remote']);
    expect(ready?.pack.sharedActions[0]).toMatchObject({
      location: { kind: 'SURFACE', chunks: ['50,50'], plane: 0 },
      completion: { kind: 'ACTION_CONFIRMED' },
    });

    const local = ready?.pack.branches.find(branch => branch.id === 'local');
    const remote = ready?.pack.branches.find(branch => branch.id === 'remote');
    expect(local?.actions[0].requirements).toMatchObject({
      kind: 'MANUAL_CONFIRMATION',
      confirmationId: 'runeproof-harness:ready:local-route',
    });
    expect(local?.actions.some(action => action.completion.kind === 'BRANCH_CHECKPOINT'))
      .toBe(true);
    expect(local?.actions.filter(action => action.combat).map(action => action.id)).toEqual([
      'runeproof-harness:ready:local-combat',
      'runeproof-harness:ready:local-later-combat',
    ]);
    expect(local?.actions[0].alternatives[0]).toMatchObject({
      label: 'Reviewed alternative entrance',
      location: {
        kind: 'INSTANCE',
        instanceId: 'runeproof-review-instance',
        entranceChunks: ['51,50'],
        plane: 1,
      },
    });
    expect(remote?.actions[0].requirements).toMatchObject({
      kind: 'MANUAL_CONFIRMATION',
      confirmationId: 'runeproof-harness:ready:remote-route',
    });
    expect(remote?.actions[0].location).toMatchObject({
      kind: 'INSTANCE',
      instanceId: 'runeproof-review-instance',
      entranceChunks: ['51,50'],
      plane: 1,
    });
    expect(ready?.pack.initialItems[0].alternatives).toEqual([
      { key: 'reviewed tool alternative', name: 'Reviewed tool alternative' },
    ]);

    const blockedResult = blocked && evaluateRequirementExpression(
      blocked.pack.preflight,
      blocked.snapshot,
    );
    expect(blockedResult).toMatchObject({
      state: 'BLOCKED',
      reasons: ['Requires Mining 99; effective level is 1.'],
      unblockActions: ['Raise Mining to 99.'],
    });
    const needsReviewResult = needsReview && evaluateRequirementExpression(
      needsReview.pack.preflight,
      needsReview.snapshot,
    );
    expect(needsReviewResult).toMatchObject({
      state: 'NEEDS_REVIEW',
      reasons: ['No canonical level evidence is available for Review Skill.'],
    });
  });

  it('serves every harness scenario as the zero-blocker output of the real compiler', async () => {
    const { compileRuneProofQuestPack } = await import('../utils/questStrategies/packCompiler');
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    for (const scenario of harness?.scenarios ?? []) {
      const { catalogue, findings: _findings, ...definition } = structuredClone(scenario.pack);
      const compiled = compileRuneProofQuestPack(definition, {
        catalogue,
        expectedCatalogueRevision: scenario.pack.catalogueRevision,
      });
      expect(compiled.findings.filter(finding => finding.severity === 'BLOCKING'))
        .toEqual([]);
      expect(compiled.pack).toEqual(scenario.pack);
    }
  });
});
