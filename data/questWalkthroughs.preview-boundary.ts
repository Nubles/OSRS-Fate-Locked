import { reviewedQuestRequirements } from './questItemRequirements';
import { runeProofCatalogueFor } from './runeProofQuestCatalogue';
import { questWalkthroughReleaseFor } from './questWalkthroughRelease';
import { questWalkthroughCatalogue } from './questWalkthroughs';
import {
  questStrategyFromWalkthrough,
  type QuestStrategyDefinition,
} from '../utils/questStrategies/model';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const compileQuestStrategyCatalogue = (): readonly QuestStrategyDefinition[] => (
  questWalkthroughCatalogue.flatMap((walkthrough) => {
    const catalogue = runeProofCatalogueFor(walkthrough.questId);
    const roots = reviewedQuestRequirements(walkthrough.questId);
    const release = questWalkthroughReleaseFor(walkthrough.questId);
    if (!catalogue || !roots || !release || release.revision !== walkthrough.revision) return [];

    const strategy = questStrategyFromWalkthrough(walkthrough, {
      catalogue,
      rootRequirements: roots.items,
    });
    return strategy ? [strategy] : [];
  })
);

export const questStrategyCatalogue: readonly QuestStrategyDefinition[] = deepFreeze(
  compileQuestStrategyCatalogue(),
);

export const questStrategyFor = (questId: string): QuestStrategyDefinition | undefined =>
  questStrategyCatalogue.find(strategy => strategy.questId === questId);
