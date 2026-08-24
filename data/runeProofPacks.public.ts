import { QUEST_DATA } from './questData';
import {
  publicRuneProofPackReleases,
} from './runeProofPackRelease.public';
import {
  runeProofCatalogueFor,
  runeProofCatalogueRevision,
} from './runeProofQuestCatalogue';
import { cloneAndFreezeRuneProofLegacyProjection } from './questWalkthroughLoader';
import type {
  RuneProofCatalogueSummary,
  RuneProofLoadedPack,
  RuneProofPlatformReviewHarness,
} from './questWalkthroughLoader';
import type { ReviewedQuestRequirements } from './questItemRequirements';
import type { RuneProofPackRelease } from './runeProofPackRelease';
import { requirementExpressionForQuestData } from '../utils/questStrategies/preflight';

const releaseByQuestId = new Map(
  publicRuneProofPackReleases.map(release => [release.questId, release]),
);

const publicReviewedRequirements = new Map<string, ReviewedQuestRequirements>([
  ["Cook's Assistant", {
    questId: "Cook's Assistant",
    wikiRevision: '15240921',
    reviewedAt: '2026-07-29',
    items: [
      { item: { key: 'egg', name: 'Egg' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: { key: 'bucket of milk', name: 'Bucket of milk' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: { key: 'pot of flour', name: 'Pot of flour' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
    ],
  }],
  ['Sheep Shearer', {
    questId: 'Sheep Shearer',
    wikiRevision: '15271780',
    reviewedAt: '2026-08-21',
    items: [{
      item: { key: 'ball of wool', name: 'Ball of wool' },
      quantity: 20,
      supplyPolicy: 'PLAYER_OBTAINED',
    }],
  }],
  ['The Restless Ghost', {
    questId: 'The Restless Ghost',
    wikiRevision: '15268042',
    reviewedAt: '2026-08-21',
    items: [],
  }],
  ['Rune Mysteries', {
    questId: 'Rune Mysteries',
    wikiRevision: '15275863',
    reviewedAt: '2026-08-21',
    items: [],
  }],
  ['Imp Catcher', {
    questId: 'Imp Catcher',
    wikiRevision: '15266902',
    reviewedAt: '2026-08-21',
    items: [
      { item: { key: 'black bead', name: 'Black bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: { key: 'red bead', name: 'Red bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: { key: 'white bead', name: 'White bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: { key: 'yellow bead', name: 'Yellow bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
    ],
  }],
]);

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
  publicRuneProofPackReleases.map((release) => {
    const catalogue = runeProofCatalogueFor(release.questId);
    const quest = QUEST_DATA[release.questId];
    if (!catalogue || !quest) {
      throw new Error(`Missing public RuneProof catalogue identity: ${release.questId}`);
    }
    return Object.freeze({
      ...catalogue,
      catalogueRevision: runeProofCatalogueRevision,
      packDisposition: 'RELEASED' as const,
      reviewStatus: release.lifecycle,
      lifecycle: release.lifecycle,
      packRevision: release.packRevision,
      preflight: requirementExpressionForQuestData(quest, catalogue),
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

  const [payload, adapter, compiler] = await Promise.all([
    import('./questWalkthroughs.public'),
    import('../utils/questStrategies/legacyPackAdapter'),
    import('../utils/questStrategies/packCompiler'),
  ]);
  const walkthrough = payload.questWalkthroughFor(release.questId);
  const strategy = payload.questStrategyFor(release.questId);
  const reviewedRequirements = publicReviewedRequirements.get(release.questId);
  const catalogue = runeProofCatalogueFor(release.questId);
  const quest = QUEST_DATA[release.questId];
  if (!walkthrough || !strategy || !reviewedRequirements || !catalogue || !quest
    || strategy.revision !== release.packRevision) {
    return undefined;
  }

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
): Promise<RuneProofPlatformReviewHarness | undefined> => undefined;
