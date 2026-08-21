import {
  type QuestItemRequirement,
  validateQuestRequirement,
} from '../utils/questRoutes/model';

export interface ReviewedQuestRequirements {
  questId: string;
  wikiRevision: string;
  reviewedAt: string;
  items: QuestItemRequirement[];
}

const item = (key: string, name: string) => ({ key, name });

const constructionNails = [
  item('bronze nails', 'Bronze nails'),
  item('iron nails', 'Iron nails'),
  item('steel nails', 'Steel nails'),
  item('black nails', 'Black nails'),
  item('mithril nails', 'Mithril nails'),
  item('adamantite nails', 'Adamantite nails'),
  item('rune nails', 'Rune nails'),
];

export const usablePickaxes = [
  item('bronze pickaxe', 'Bronze pickaxe'),
  item('iron pickaxe', 'Iron pickaxe'),
  item('steel pickaxe', 'Steel pickaxe'),
  item('black pickaxe', 'Black pickaxe'),
  item('mithril pickaxe', 'Mithril pickaxe'),
  item('adamant pickaxe', 'Adamant pickaxe'),
  item('rune pickaxe', 'Rune pickaxe'),
  item('dragon pickaxe', 'Dragon pickaxe'),
  item('gilded pickaxe', 'Gilded pickaxe'),
  item('3rd age pickaxe', '3rd age pickaxe'),
  item('infernal pickaxe', 'Infernal pickaxe'),
  item('crystal pickaxe', 'Crystal pickaxe'),
];

const REVIEWED_QUESTS: Record<string, ReviewedQuestRequirements> = {
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
  "Daddy's Home": {
    questId: "Daddy's Home",
    wikiRevision: '15233724',
    reviewedAt: '2026-07-29',
    items: [
      { item: item('plank', 'Plank'), quantity: 10, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: item('bolt of cloth', 'Bolt of cloth'), quantity: 5, supplyPolicy: 'PLAYER_OBTAINED' },
      {
        item: item('nails', 'Nails'),
        quantity: 16,
        supplyPolicy: 'PLAYER_OBTAINED',
        alternatives: constructionNails,
        note: 'Bring extra nails as recommended; Nail beast nails and Dragon nails are not valid construction nails.',
      },
      { item: item('hammer', 'Hammer'), quantity: 1, supplyPolicy: 'QUEST_PROVIDED' },
      { item: item('saw', 'Saw'), quantity: 1, supplyPolicy: 'QUEST_PROVIDED' },
      { item: item('waxwood logs', 'Waxwood logs'), quantity: 3, supplyPolicy: 'QUEST_PROVIDED' },
    ],
  },
  "Doric's Quest": {
    questId: "Doric's Quest",
    wikiRevision: '15240932',
    reviewedAt: '2026-07-29',
    items: [
      { item: item('clay', 'Clay'), quantity: 6, supplyPolicy: 'PLAYER_OBTAINED', note: 'Clay only; not Soft clay.' },
      { item: item('copper ore', 'Copper ore'), quantity: 4, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: item('iron ore', 'Iron ore'), quantity: 2, supplyPolicy: 'PLAYER_OBTAINED' },
    ],
  },
  'Elemental Workshop I': {
    questId: 'Elemental Workshop I',
    wikiRevision: '15271177',
    reviewedAt: '2026-07-29',
    items: [
      {
        item: item('pickaxe', 'Pickaxe'),
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED',
        alternatives: usablePickaxes,
        note: 'A slash weapon can be used instead of a knife; this is a reviewed quest alternative, not an item alias.',
      },
      { item: item('thread', 'Thread'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: item('hammer', 'Hammer'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: item('coal', 'Coal'), quantity: 4, supplyPolicy: 'PLAYER_OBTAINED' },
      { item: item('knife', 'Knife'), quantity: 1, supplyPolicy: 'QUEST_PROVIDED' },
      { item: item('needle', 'Needle'), quantity: 1, supplyPolicy: 'QUEST_PROVIDED' },
      { item: item('leather', 'Leather'), quantity: 1, supplyPolicy: 'QUEST_PROVIDED' },
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
