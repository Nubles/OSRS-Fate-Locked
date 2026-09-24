import type { RuneProofAvailability } from '../utils/questRoutes/featureFlag';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import type { QuestWalkthroughDefinition } from '../utils/questWalkthroughs/model';
import { importWithRetry } from '../utils/lazyRetry';
import type { QuestWalkthroughRelease } from './questWalkthroughRelease';

type PreviewWalkthroughCatalogue = typeof import('./questWalkthroughs');
type PreviewStrategyCatalogue = typeof import('./questWalkthroughs.preview-boundary');
type PublicWalkthroughCatalogue = typeof import('./questWalkthroughs.public');

// Each catalogue is its own chunk. Retry a dropped fetch here so one blip does
// not empty RuneProof; importWithRetry rethrows the first chunk-load error.
const loadPublicCatalogue = (): Promise<PublicWalkthroughCatalogue> => (
  importWithRetry(() => import('./questWalkthroughs.public'))
);
const loadPreviewStrategyCatalogue = (): Promise<PreviewStrategyCatalogue> => (
  importWithRetry(() => import('./questWalkthroughs.preview-boundary'))
);
const loadPreviewWalkthroughCatalogue = (): Promise<PreviewWalkthroughCatalogue> => (
  importWithRetry(() => import('./questWalkthroughs'))
);

export const loadQuestWalkthroughFor = async (
  availability: RuneProofAvailability,
  release: QuestWalkthroughRelease,
): Promise<QuestWalkthroughDefinition | undefined> => {
  if (availability === 'PUBLIC') {
    const catalogue = await loadPublicCatalogue();
    const walkthrough = catalogue.questWalkthroughFor(release.questId);
    return walkthrough?.revision === release.revision && walkthrough.releaseStatus === 'APPROVED'
      ? walkthrough
      : undefined;
  }
  if (availability !== 'PREVIEW') return undefined;

  const preview = await loadPreviewStrategyCatalogue();
  const expanded = preview.questWalkthroughFor(release.questId);
  if (expanded?.revision === release.revision) return expanded;
  // Retain exact-revision access for existing private evidence consumers.
  const catalogue = await loadPreviewWalkthroughCatalogue();
  const walkthrough = catalogue.questWalkthroughFor(release.questId);

  return walkthrough?.revision === release.revision ? walkthrough : undefined;
};

export const loadQuestStrategyFor = async (
  availability: RuneProofAvailability,
  release: QuestWalkthroughRelease,
): Promise<QuestStrategyDefinition | undefined> => {
  if (availability === 'PUBLIC') {
    const catalogue = await loadPublicCatalogue();
    const strategy = catalogue.questStrategyFor(release.questId);
    return strategy?.revision === release.revision ? strategy : undefined;
  }
  if (availability !== 'PREVIEW') return undefined;

  const catalogue = await loadPreviewStrategyCatalogue();
  const strategy = catalogue.questStrategyFor(release.questId);

  return strategy?.revision === release.revision ? strategy : undefined;
};

export const loadQuestStrategyCatalogue = async (
  availability: RuneProofAvailability,
): Promise<readonly QuestStrategyDefinition[]> => {
  if (availability === 'PUBLIC') {
    const catalogue = await loadPublicCatalogue();
    return catalogue.questStrategyCatalogue;
  }
  if (availability !== 'PREVIEW') return [];

  const catalogue = await loadPreviewStrategyCatalogue();
  return catalogue.questStrategyCatalogue;
};
