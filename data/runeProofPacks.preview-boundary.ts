import { QUEST_DATA } from './questData';
import { previewRuneProofPackReleases } from './runeProofPackRelease.preview';
import {
  runeProofCatalogueFor,
  runeProofCatalogueRevision,
  runeProofQuestCatalogue,
} from './runeProofQuestCatalogue';
import { cloneAndFreezeRuneProofLegacyProjection } from './questWalkthroughLoader';
import type {
  RuneProofCatalogueSummary,
  RuneProofLoadedPack,
  RuneProofPlatformReviewHarness,
} from './questWalkthroughLoader';
import type { RuneProofPackRelease } from './runeProofPackRelease';
import { requirementExpressionForQuestData } from '../utils/questStrategies/preflight';

const releaseByQuestId = new Map(
  previewRuneProofPackReleases.map(release => [release.questId, release]),
);

const exactRelease = (
  supplied: RuneProofPackRelease,
): RuneProofPackRelease | undefined => {
  const expected = releaseByQuestId.get(supplied.questId);
  return expected
    && supplied.questId === expected.questId
    && supplied.packRevision === expected.packRevision
    && supplied.catalogueRevision === expected.catalogueRevision
    && supplied.lifecycle === expected.lifecycle
    ? expected
    : undefined;
};

export const runeProofCatalogueSummaries: readonly RuneProofCatalogueSummary[] = Object.freeze(
  runeProofQuestCatalogue.map((catalogue) => {
    const quest = QUEST_DATA[catalogue.questId];
    const release = releaseByQuestId.get(catalogue.questId);
    if (!quest) throw new Error(`Missing RuneProof QuestData identity: ${catalogue.questId}`);
    const common = {
      ...catalogue,
      catalogueRevision: runeProofCatalogueRevision,
      preflight: requirementExpressionForQuestData(quest, catalogue),
    };
    if (!release) {
      return Object.freeze({
        ...common,
        packDisposition: 'NO_PACK' as const,
        reviewStatus: 'NO_PACK' as const,
        proofState: 'NEEDS_REVIEW' as const,
        playable: false,
      });
    }
    return Object.freeze({
      ...common,
      packDisposition: 'RELEASED' as const,
      reviewStatus: release.lifecycle,
      lifecycle: release.lifecycle,
      packRevision: release.packRevision,
      proofState: 'READY' as const,
      playable: true,
    });
  }),
);

export const runeProofPackFor = async (
  supplied: RuneProofPackRelease,
): Promise<RuneProofLoadedPack | undefined> => {
  const release = exactRelease(supplied);
  if (!release) return undefined;

  const [payload, requirements, adapter, compiler] = await Promise.all([
    import('./questWalkthroughs.public'),
    import('./questItemRequirements'),
    import('../utils/questStrategies/legacyPackAdapter'),
    import('../utils/questStrategies/packCompiler'),
  ]);
  const walkthrough = payload.questWalkthroughFor(release.questId);
  const strategy = payload.questStrategyFor(release.questId);
  const reviewedRequirements = requirements.reviewedQuestRequirements(release.questId);
  const catalogue = runeProofCatalogueFor(release.questId);
  const quest = QUEST_DATA[release.questId];
  if (!walkthrough || !strategy || !reviewedRequirements || !catalogue || !quest
    || strategy.revision !== release.packRevision) return undefined;

  const definition = adapter.legacyStrategyToRuneProofPack(strategy, {
    catalogue,
    catalogueRevision: runeProofCatalogueRevision,
    preflight: requirementExpressionForQuestData(quest, catalogue),
    reviewedRoots: reviewedRequirements.items,
  });
  const compiled = compiler.compileRuneProofQuestPack(definition, {
    catalogue,
    expectedCatalogueRevision: runeProofCatalogueRevision,
  });
  return compiled.pack ? Object.freeze({
    pack: compiled.pack,
    legacyProjection: cloneAndFreezeRuneProofLegacyProjection({
      walkthrough,
      strategy,
      reviewedRequirements,
    }),
  }) : undefined;
};

export const loadRuneProofPlatformReviewHarness = async (
): Promise<RuneProofPlatformReviewHarness | undefined> => {
  const module = await import('./runeProofPlatformReviewHarness.preview');
  const harness = module.runeProofPlatformReviewHarness;
  return harness.marker === 'RUNEPROOF_PLATFORM_REVIEW_HARNESS_V1'
    ? harness
    : undefined;
};
