import type { RuneProofAvailability } from '../utils/questRoutes/featureFlag';
import type { QuestWalkthroughDefinition } from '../utils/questWalkthroughs/model';
import type { QuestWalkthroughRelease } from './questWalkthroughRelease';

type PreviewCatalogue = typeof import('./questWalkthroughs.preview-boundary');

export const loadQuestWalkthroughFor = async (
  availability: RuneProofAvailability,
  release: QuestWalkthroughRelease,
): Promise<QuestWalkthroughDefinition | undefined> => {
  if (availability !== 'PREVIEW') return undefined;
  const catalogue: PreviewCatalogue = await import('./questWalkthroughs.preview-boundary');
  const definition = catalogue.questWalkthroughFor(release.questId);
  return definition?.revision === release.revision ? definition : undefined;
};
