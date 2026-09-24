import type { ReviewedQuestRequirements } from './questItemRequirements';
import { usablePickaxes } from './usablePickaxes';

// Reviewed item lists for quests only the runeproof-preview build offers. Every
// normal build resolves this module to questItemRequirements.preview-omitted
// (see vite.config.ts), so these lists never reach the public bundle.

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

export const previewReviewedQuests: Readonly<Record<string, ReviewedQuestRequirements>> = {
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
};
