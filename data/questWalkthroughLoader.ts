import type { RuneProofAvailability } from '../utils/questRoutes/featureFlag';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import type { QuestWalkthroughDefinition } from '../utils/questWalkthroughs/model';
import type { QuestWalkthroughRelease } from './questWalkthroughRelease';

type PreviewWalkthroughCatalogue = typeof import('./questWalkthroughs');
type PreviewStrategyCatalogue = typeof import('./questWalkthroughs.preview-boundary');

export const loadQuestWalkthroughFor = async (
  availability: RuneProofAvailability,
  release: QuestWalkthroughRelease,
): Promise<QuestWalkthroughDefinition | undefined> => {
  if (availability !== 'PREVIEW') {
    return undefined;
  }

  const catalogue: PreviewWalkthroughCatalogue = await import('./questWalkthroughs');
  const walkthrough = catalogue.questWalkthroughFor(release.questId);

  return walkthrough?.revision === release.revision ? walkthrough : undefined;
};

export const loadQuestStrategyFor = async (
  availability: RuneProofAvailability,
  release: QuestWalkthroughRelease,
): Promise<QuestStrategyDefinition | undefined> => {
  if (availability !== 'PREVIEW') {
    return undefined;
  }

  const catalogue: PreviewStrategyCatalogue = await import('./questWalkthroughs.preview-boundary');
  const strategy = catalogue.questStrategyFor(release.questId);

  return strategy?.revision === release.revision ? strategy : undefined;
};

export const loadQuestStrategyCatalogue = async (
  availability: RuneProofAvailability,
): Promise<readonly QuestStrategyDefinition[]> => {
  if (availability !== 'PREVIEW') {
    return [];
  }

  const catalogue: PreviewStrategyCatalogue = await import('./questWalkthroughs.preview-boundary');
  return catalogue.questStrategyCatalogue;
};
