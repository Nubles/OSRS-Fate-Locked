import { describe, expect, it } from 'vitest';
import {
  isRuneProofQuestSupported,
  reviewedQuestRequirements,
  validateReviewedQuestCatalogue,
} from './questItemRequirements';

describe('reviewed quest item requirements', () => {
  it("records Daddy's Home planks as player-obtained and its hammer as quest-provided", () => {
    const quest = reviewedQuestRequirements("Daddy's Home")!;

    expect(quest.items).toContainEqual(expect.objectContaining({
      item: { key: 'plank', name: 'Plank' },
      quantity: 10,
      supplyPolicy: 'PLAYER_OBTAINED',
    }));
    expect(quest.items).toContainEqual(expect.objectContaining({
      item: { key: 'hammer', name: 'Hammer' },
      supplyPolicy: 'QUEST_PROVIDED',
    }));
  });

  it("does not merge clay with soft clay for Doric's Quest", () => {
    const quest = reviewedQuestRequirements("Doric's Quest")!;

    expect(quest.items.find((entry) => entry.item.key === 'clay')?.note).toContain('not Soft clay');
  });

  it('returns null for an unreviewed quest', () => {
    expect(reviewedQuestRequirements('Dragon Slayer I')).toBeNull();
    expect(isRuneProofQuestSupported('Dragon Slayer I')).toBe(false);
  });

  it("keeps Cook's Assistant root requirements to its three player-obtained outputs", () => {
    const quest = reviewedQuestRequirements("Cook's Assistant")!;

    expect(quest).toMatchObject({ wikiRevision: '15240921', reviewedAt: '2026-07-29' });
    expect(quest.items).toEqual([
      expect.objectContaining({ item: { key: 'egg', name: 'Egg' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }),
      expect.objectContaining({ item: { key: 'bucket of milk', name: 'Bucket of milk' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }),
      expect.objectContaining({ item: { key: 'pot of flour', name: 'Pot of flour' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }),
    ]);
  });

  it("models Daddy's Home nails as only the reviewed concrete construction nails", () => {
    const nails = reviewedQuestRequirements("Daddy's Home")!.items.find((entry) => entry.item.key === 'nails')!;

    expect(nails).toMatchObject({ quantity: 16, supplyPolicy: 'PLAYER_OBTAINED' });
    expect(nails.alternatives?.map((item) => item.name)).toEqual([
      'Bronze nails', 'Iron nails', 'Steel nails', 'Black nails', 'Mithril nails', 'Adamantite nails', 'Rune nails',
    ]);
    expect(nails.alternatives).not.toContainEqual({ key: 'nail beast nails', name: 'Nail beast nails' });
    expect(nails.note).toContain('extra nails');
  });

  it('models Elemental Workshop I pickaxes as only the reviewed exact pickaxes', () => {
    const pickaxe = reviewedQuestRequirements('Elemental Workshop I')!.items.find((entry) => entry.item.key === 'pickaxe')!;

    expect(pickaxe).toMatchObject({ quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' });
    expect(pickaxe.alternatives?.map((item) => item.name)).toEqual([
      'Bronze pickaxe', 'Iron pickaxe', 'Steel pickaxe', 'Black pickaxe', 'Mithril pickaxe', 'Adamant pickaxe',
      'Rune pickaxe', 'Dragon pickaxe', 'Gilded pickaxe', '3rd age pickaxe', 'Infernal pickaxe', 'Crystal pickaxe',
    ]);
    expect(pickaxe.alternatives).not.toContainEqual({ key: 'dragon pickaxe upgrade kit', name: 'Dragon pickaxe upgrade kit' });
  });

  it('pins the remaining pilot quest source revisions and supply boundaries', () => {
    expect(reviewedQuestRequirements("Daddy's Home")).toMatchObject({ wikiRevision: '15233724', reviewedAt: '2026-07-29' });
    expect(reviewedQuestRequirements("Doric's Quest")).toMatchObject({ wikiRevision: '15240932', reviewedAt: '2026-07-29' });
    expect(reviewedQuestRequirements('Elemental Workshop I')).toMatchObject({ wikiRevision: '15271177', reviewedAt: '2026-07-29' });
    expect(reviewedQuestRequirements('Elemental Workshop I')!.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ item: { key: 'thread', name: 'Thread' }, supplyPolicy: 'PLAYER_OBTAINED' }),
      expect.objectContaining({ item: { key: 'knife', name: 'Knife' }, supplyPolicy: 'QUEST_PROVIDED' }),
      expect.objectContaining({ item: { key: 'needle', name: 'Needle' }, supplyPolicy: 'QUEST_PROVIDED' }),
      expect.objectContaining({ item: { key: 'leather', name: 'Leather' }, supplyPolicy: 'QUEST_PROVIDED' }),
    ]));
  });

  it('records the reviewed Wave 1 root requirements in source order', () => {
    expect(reviewedQuestRequirements('Sheep Shearer')).toMatchObject({
      wikiRevision: '15271780',
      reviewedAt: '2026-08-21',
      items: [{
        item: { key: 'ball of wool', name: 'Ball of wool' },
        quantity: 20,
        supplyPolicy: 'PLAYER_OBTAINED',
      }],
    });
    expect(reviewedQuestRequirements('The Restless Ghost')?.items).toEqual([]);
    expect(reviewedQuestRequirements('Rune Mysteries')?.items).toEqual([]);
    expect(reviewedQuestRequirements('Imp Catcher')?.items).toEqual([
      expect.objectContaining({ item: { key: 'black bead', name: 'Black bead' }, quantity: 1 }),
      expect.objectContaining({ item: { key: 'red bead', name: 'Red bead' }, quantity: 1 }),
      expect.objectContaining({ item: { key: 'white bead', name: 'White bead' }, quantity: 1 }),
      expect.objectContaining({ item: { key: 'yellow bead', name: 'Yellow bead' }, quantity: 1 }),
    ]);
    expect(reviewedQuestRequirements('The Restless Ghost')).toMatchObject({
      wikiRevision: '15268042',
      reviewedAt: '2026-08-21',
    });
    expect(reviewedQuestRequirements('Rune Mysteries')).toMatchObject({
      wikiRevision: '15275863',
      reviewedAt: '2026-08-21',
    });
    expect(reviewedQuestRequirements('Imp Catcher')).toMatchObject({
      wikiRevision: '15266902',
      reviewedAt: '2026-08-21',
    });
  });

  it('validates every reviewed requirement at the catalogue boundary', () => {
    expect(() => validateReviewedQuestCatalogue()).not.toThrow();
  });
});
