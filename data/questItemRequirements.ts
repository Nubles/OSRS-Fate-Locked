import {
  type QuestItemRequirement,
  validateQuestRequirement,
} from '../utils/questRoutes/model';
// Normal builds resolve this to an empty record (see vite.config.ts), so the
// preview-only quests' item lists stay out of the public bundle.
import { previewReviewedQuests } from './questItemRequirements.preview';

export { usablePickaxes } from './usablePickaxes';

export interface ReviewedQuestRequirements {
  questId: string;
  wikiRevision: string;
  reviewedAt: string;
  items: QuestItemRequirement[];
}

const item = (key: string, name: string) => ({ key, name });

const PUBLIC_REVIEWED_QUESTS: Record<string, ReviewedQuestRequirements> = {
  "Cook's Assistant": {
    questId: "Cook's Assistant",
    wikiRevision: '15240921',
    reviewedAt: '2026-07-29',
    items: [
      { item: item('egg', 'Egg'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: item('bucket of milk', 'Bucket of milk'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: item('pot of flour', 'Pot of flour'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
    ],
  },
  'Sheep Shearer': {
    questId: 'Sheep Shearer',
    wikiRevision: '15271780',
    reviewedAt: '2026-08-21',
    items: [
      { item: item('ball of wool', 'Ball of wool'), quantity: 20, supplyPolicy: 'PLAYER_OBTAINED' },
    ],
  },
  'The Restless Ghost': {
    questId: 'The Restless Ghost',
    wikiRevision: '15268042',
    reviewedAt: '2026-08-21',
    items: [],
  },
  'Rune Mysteries': {
    questId: 'Rune Mysteries',
    wikiRevision: '15275863',
    reviewedAt: '2026-08-21',
    items: [],
  },
  'Imp Catcher': {
    questId: 'Imp Catcher',
    wikiRevision: '15266902',
    reviewedAt: '2026-08-21',
    items: [
      { item: item('black bead', 'Black bead'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: item('red bead', 'Red bead'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: item('white bead', 'White bead'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: item('yellow bead', 'Yellow bead'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
    ],
  },
};

const REVIEWED_QUESTS: Readonly<Record<string, ReviewedQuestRequirements>> = {
  ...PUBLIC_REVIEWED_QUESTS,
  ...previewReviewedQuests,
};

export const reviewedQuestRequirements = (
  questId: string,
): ReviewedQuestRequirements | null =>
  Object.hasOwn(REVIEWED_QUESTS, questId) ? REVIEWED_QUESTS[questId] : null;

export const isRuneProofQuestSupported = (questId: string): boolean =>
  reviewedQuestRequirements(questId) !== null;

export const validateReviewedQuestCatalogue = (): void => {
  Object.entries(REVIEWED_QUESTS).forEach(([questId, quest]) => {
    if (quest.questId !== questId) throw new Error(`catalogue quest id mismatch: ${questId}`);
    if (!quest.wikiRevision.trim()) throw new Error(`catalogue wiki revision must not be blank: ${questId}`);
    if (!/^\d{8}$/.test(quest.wikiRevision)) throw new Error(`catalogue wiki revision must be pinned: ${questId}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(quest.reviewedAt)) throw new Error(`catalogue reviewed date is invalid: ${questId}`);
    quest.items.forEach(validateQuestRequirement);
  });
};

if (import.meta.env.DEV) validateReviewedQuestCatalogue();
