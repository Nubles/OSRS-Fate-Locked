import { questStrategyCatalogue as publicStrategies, questWalkthroughCatalogue as publicWalkthroughs } from './questWalkthroughs.public';
import { batchA } from './f2pGuidePacks/batchA';
import { batchB } from './f2pGuidePacks/batchB';
import { batchC } from './f2pGuidePacks/batchC';
import { compileF2PGuidePack } from './f2pGuidePacks/compile';

const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

const packs = [...batchA, ...batchB, ...batchC].map(compileF2PGuidePack);
export const questStrategyCatalogue = freeze([...publicStrategies, ...packs.map(pack => pack.strategy)]);
export const questWalkthroughCatalogue = freeze([...publicWalkthroughs, ...packs.map(pack => pack.walkthrough)]);
export const questStrategyFor = (questId: string) => questStrategyCatalogue.find(strategy => strategy.questId === questId);
export const questWalkthroughFor = (questId: string) => questWalkthroughCatalogue.find(walkthrough => walkthrough.questId === questId);
