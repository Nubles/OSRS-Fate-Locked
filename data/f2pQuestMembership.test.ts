import { describe, expect, it } from 'vitest';
import reviewedMembership from './sources/f2p-quest-membership.json';
import {
  f2pQuestMembership,
  f2pQuestMembershipBySlug,
  f2pQuestMembershipFor,
  validateF2PQuestMembership,
} from './f2pQuestMembership';

const EXPECTED = [
  "Cook's Assistant",
  "Sheep Shearer",
  "The Restless Ghost",
  "Rune Mysteries",
  "Imp Catcher",
  "X Marks the Spot",
  "Romeo & Juliet",
  "Demon Slayer",
  "Ernest the Chicken",
  "Doric's Quest",
  "Goblin Diplomacy",
  "Witch's Potion",
  "The Knight's Sword",
  "Black Knights' Fortress",
  "Vampyre Slayer",
  "Prince Ali Rescue",
  "Pirate's Treasure",
  "Misthalin Mystery",
  "Below Ice Mountain",
  "The Corsair Curse",
  "Shield of Arrav",
  "Dragon Slayer I",
  "Learning the Ropes",
  "The Ides of Milk"
] as const;

const EXPECTED_SLUGS = [
  "cooks-assistant",
  "sheep-shearer",
  "the-restless-ghost",
  "rune-mysteries",
  "imp-catcher",
  "x-marks-the-spot",
  "romeo-juliet",
  "demon-slayer",
  "ernest-the-chicken",
  "dorics-quest",
  "goblin-diplomacy",
  "witchs-potion",
  "the-knights-sword",
  "black-knights-fortress",
  "vampyre-slayer",
  "prince-ali-rescue",
  "pirates-treasure",
  "misthalin-mystery",
  "below-ice-mountain",
  "the-corsair-curse",
  "shield-of-arrav",
  "dragon-slayer-i",
  "learning-the-ropes",
  "the-ides-of-milk"
] as const;

type MembershipDocument = {
  schemaVersion: number;
  reviewedAt: string;
  evidenceFiles: string[];
  quests: Array<Record<string, unknown>>;
};

const validDocument = (): MembershipDocument => JSON.parse(JSON.stringify(reviewedMembership)) as MembershipDocument;

describe('authoritative F2P quest membership', () => {
  it('exposes the reviewed roster in progression order', () => {
    expect(f2pQuestMembership.map(entry => entry.questId)).toEqual(EXPECTED);
    expect(f2pQuestMembership.map(entry => entry.slug)).toEqual(EXPECTED_SLUGS);
    expect(f2pQuestMembership.every(entry => entry.kind === 'quest')).toBe(true);
    expect(f2pQuestMembership.map(entry => entry.wave)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5]);
    expect(f2pQuestMembership.map(entry => entry.progressionPriority)).toEqual(
      Array.from({ length: 24 }, (_value, index) => index + 1),
    );
    expect(f2pQuestMembership.map(entry => entry.wikiTitle)).toEqual(
      EXPECTED.map(questId => questId === 'Learning the Ropes' ? questId : `${questId}/Quick guide`),
    );
    expect(f2pQuestMembership.map(entry => entry.evidenceQuestId)).toEqual(EXPECTED);
  });

  it('contains only current F2P quests and excludes members miniquests', () => {
    expect(f2pQuestMembershipFor("Daddy's Home")).toBeUndefined();
    expect(f2pQuestMembership.filter(entry => entry.kind === 'miniquest').map(entry => entry.questId))
      .toEqual([]);
    expect(f2pQuestMembershipFor('Learning the Ropes')?.kind).toBe('quest');
    expect(f2pQuestMembershipFor('Elemental Workshop I')).toBeUndefined();
  });

  it('supports exact slug lookups', () => {
    expect(f2pQuestMembershipBySlug('cooks-assistant')?.questId).toBe("Cook's Assistant");
    expect(f2pQuestMembershipBySlug('daddys-home')).toBeUndefined();
    expect(f2pQuestMembershipBySlug('learning-the-ropes')?.questId).toBe('Learning the Ropes');
  });

  it('validates the reviewed document metadata', () => {
    expect(() => validateF2PQuestMembership(validDocument())).not.toThrow();
  });

  it('deep-freezes the exported snapshot and each entry', () => {
    expect(Object.isFrozen(f2pQuestMembership)).toBe(true);
    expect(Object.isFrozen(f2pQuestMembership[0])).toBe(true);
  });
});

const invalidCases: Array<{
  name: string;
  mutate: (document: MembershipDocument) => void;
  error: string;
}> = [
  {
    name: 'sparse evidence file arrays',
    mutate: document => { document.evidenceFiles = new Array(2); },
    error: 'evidenceFiles must be a dense array',
  },
  {
    name: 'sparse quest arrays',
    mutate: document => { document.quests = new Array(24); },
    error: 'quests must be a dense array',
  },
  {
    name: 'duplicate quest IDs',
    mutate: document => { document.quests[1].questId = document.quests[0].questId; },
    error: 'duplicate questId',
  },
  {
    name: 'duplicate slugs',
    mutate: document => { document.quests[1].slug = document.quests[0].slug; },
    error: 'duplicate slug',
  },
  {
    name: 'non-contiguous priorities',
    mutate: document => { document.quests[1].progressionPriority = 23; },
    error: 'progressionPriority must be contiguous',
  },
  {
    name: 'invalid waves',
    mutate: document => { document.quests[0].wave = 6; },
    error: 'wave must be one of 1, 2, 3, 4, or 5',
  },
  {
    name: 'missing evidence references',
    mutate: document => { delete document.quests[0].evidenceQuestId; },
    error: 'evidenceQuestId',
  },
  {
    name: 'unsupported kinds',
    mutate: document => { document.quests[0].kind = 'boss'; },
    error: 'kind must be quest or miniquest',
  },
];

describe('validateF2PQuestMembership', () => {
  for (const testCase of invalidCases) {
    it(`rejects ${testCase.name}`, () => {
      const document = validDocument();
      testCase.mutate(document);
      expect(() => validateF2PQuestMembership(document)).toThrow(testCase.error);
    });
  }
});
