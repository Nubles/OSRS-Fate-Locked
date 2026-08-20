import type { QuestWalkthroughDefinition } from '../utils/questWalkthroughs/model';

// Public-safe catalogue boundary. Approved definitions belong here only after
// the release manifest records permission or independently reviewed mappings.
export const questWalkthroughFor = (
  _questId: string,
): QuestWalkthroughDefinition | undefined => undefined;
