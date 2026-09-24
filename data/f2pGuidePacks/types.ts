import type { ChunkKey, QuestItemRequirement, RouteGate } from '../../utils/questRoutes/model';
import type { WalkthroughActionKind, WalkthroughItemRef } from '../../utils/questWalkthroughs/model';

/** Local test packs. Facts are reviewed; release approval is deliberately separate. */
export interface F2PGuidePack {
  questId: string;
  slug: string;
  wikiRevision: string;
  wikiTimestamp: string;
  startPoint: string;
  difficulty: string;
  length: string;
  requirements: string[];
  itemsRequired: string[];
  itemsObtained: string[];
  recommended: string[];
  enemies: string[];
  rewards: string[];
  rootItems: QuestItemRequirement[];
  /** Source limitations visible in the preview, never silently promoted to exact data. */
  notes?: string[];
  links?: { label: string; url: string }[];
  steps: {
    id: string;
    text: string;
    section: string;
    location: string;
    details?: string[];
    kind?: WalkthroughActionKind;
    chunks: ChunkKey[];
    /** Explain source coordinates or reviewed surface entrance, not merely a quest-wide region. */
    locationEvidence: string;
    gates?: RouteGate[];
    manualChecks?: string[];
    items?: WalkthroughItemRef[];
    consumes?: WalkthroughItemRef[];
    fulfils?: WalkthroughItemRef[];
  }[];
}

export const supply = (name: string, quantity = 1, questProvided = false): QuestItemRequirement => ({
  item: { key: name.toLocaleLowerCase('en-GB'), name }, quantity,
  supplyPolicy: questProvided ? 'QUEST_PROVIDED' : 'PLAYER_OBTAINED',
});
