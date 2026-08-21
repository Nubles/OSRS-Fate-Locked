import { f2pQuestMembershipFor } from './f2pQuestMembership';
import { reviewedQuestRequirements } from './questItemRequirements';
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
    const membership = f2pQuestMembershipFor(walkthrough.questId);
    const roots = reviewedQuestRequirements(walkthrough.questId);
    const release = questWalkthroughReleaseFor(walkthrough.questId);
    if (!membership || !roots || !release || release.revision !== walkthrough.revision) return [];

    const strategy = questStrategyFromWalkthrough(walkthrough, {
      membership,
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
