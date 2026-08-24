import { describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../../types';
import { questWalkthroughFor } from '../../data/questWalkthroughs';
import { analyzeQuest } from './analyzeQuest';
import { preflightSnapshot } from '../questStrategies/preflight';
import {
  materializeQuestRouteSnapshot,
  materializeRuneProofAccount,
  type RuneProofContentService,
} from './goalPlannerRuneProof';

const unlocks: UnlockState = {
  equipment: {},
  skills: { Mining: 2 },
  levels: { Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10, Mining: 99 },
  regions: ['Misthalin'],
  chunks: ['50,50'],
  mobility: ['Canoe'],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  banks: [],
  quests: ["Cook's Assistant"],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
};

describe('RuneProof preflight account snapshot', () => {
  it('materializes a detached preflight account snapshot', () => {
    const before = structuredClone(unlocks);
    const snapshot = preflightSnapshot(unlocks, 'chunked');
    expect(snapshot.completedQuestIds).toEqual(new Set(["Cook's Assistant"]));
    expect(snapshot.transportIds).toEqual(new Set(['Canoe']));
    expect(snapshot.chunks).toContain('50,50');
    expect(snapshot.levels.Mining).toBe(20);
    expect(snapshot.regions).toContain('Lumbridge');
    expect(unlocks).toEqual(before);
  });

  it('keeps mutable planner evidence detached from canonical run state', () => {
    const account = structuredClone(unlocks);
    const snapshot = preflightSnapshot(account, 'chunked');

    account.quests.push('Rune Mysteries');
    (snapshot.completedQuestIds as Set<string>).add('The Restless Ghost');

    expect(snapshot.completedQuestIds.has('Rune Mysteries')).toBe(false);
    expect(account.quests).not.toContain('The Restless Ghost');
  });

  it('maps every canonical unlock namespace without display-label conversion', () => {
    const snapshot = preflightSnapshot({
      ...structuredClone(unlocks),
      equipment: { Weapon: 1, Shield: 0 },
      mobility: ['mobility-id'],
      arcana: ['arcana-id'],
      housing: ['housing-id'],
      guilds: ['guild-id'],
      merchants: ['merchant-id'],
      minigames: ['minigame-id'],
      bosses: ['boss-id'],
      storage: ['storage-id'],
      farming: ['farming-id'],
      slayerUnlocks: ['slayer-id'],
      banks: ['12850'],
      diaries: ['diary-id'],
      cas: ['ca-id'],
      completedTasks: ['task-id'],
      collectionLog: { 4151: 1, 995: 0 },
    }, undefined);

    expect(snapshot.canonicalUnlocks).toEqual({
      equipment: new Set(['Weapon']),
      mobility: new Set(['mobility-id']),
      arcana: new Set(['arcana-id']),
      housing: new Set(['housing-id']),
      guilds: new Set(['guild-id']),
      merchants: new Set(['merchant-id']),
      minigames: new Set(['minigame-id']),
      bosses: new Set(['boss-id']),
      storage: new Set(['storage-id']),
      farming: new Set(['farming-id']),
      slayer: new Set(['slayer-id']),
      banks: new Set(['12850']),
      diaries: new Set(['diary-id']),
      combatAchievements: new Set(['ca-id']),
      tasks: new Set(['task-id']),
      collectionItems: new Set(['4151']),
    });
  });
});

describe('RuneProof deep-analysis requirement injection', () => {
  it('uses and freezes injected reviewed requirements for an ID outside the global eight', () => {
    const baseWalkthrough = questWalkthroughFor("Cook's Assistant");
    if (!baseWalkthrough) throw new Error('Missing walkthrough fixture.');
    const reviewedRequirements = {
      questId: 'A members quest without legacy roots',
      wikiRevision: '15300000',
      reviewedAt: '2026-08-22',
      items: [{
        item: { key: 'example item', name: 'Example item' },
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED' as const,
        alternatives: [{ key: 'alternate example item', name: 'Alternate example item' }],
        note: 'Complete injected requirement fixture.',
      }],
    };
    const selectedWalkthrough = {
      ...baseWalkthrough,
      questId: reviewedRequirements.questId,
      revision: 'members-pack-v1',
    };
    const itemSourceRecords = vi.fn(() => []);
    const contentService: RuneProofContentService = {
      init: async () => true,
      itemSourceRecords,
      itemSourceCoverage: () => 'COMPLETE',
      entityLocations: () => null,
      taskRequirements: () => [],
      chunkEntryRequirements: () => [],
      connectGraph: () => ({}),
    };
    const snapshot = materializeQuestRouteSnapshot(
      reviewedRequirements.questId,
      materializeRuneProofAccount(unlocks, 'chunked'),
      contentService,
      1,
      selectedWalkthrough,
      reviewedRequirements,
    );

    expect(itemSourceRecords).toHaveBeenCalledWith('Example item');
    expect(itemSourceRecords).toHaveBeenCalledWith('Alternate example item');
    expect(snapshot.reviewedRequirements).toEqual(reviewedRequirements);
    expect(snapshot.reviewedRequirements).not.toBe(reviewedRequirements);
    expect(Object.isFrozen(snapshot.reviewedRequirements)).toBe(true);
    expect(Object.isFrozen(snapshot.reviewedRequirements.items)).toBe(true);
    expect(Object.isFrozen(snapshot.reviewedRequirements.items[0].item)).toBe(true);
    expect(Object.isFrozen(snapshot.reviewedRequirements.items[0].alternatives)).toBe(true);
    expect(Object.isFrozen(snapshot.reviewedRequirements.items[0].alternatives?.[0])).toBe(true);
    expect(() => analyzeQuest(
      reviewedRequirements.questId,
      snapshot,
      selectedWalkthrough,
    )).not.toThrow();
  });
});
