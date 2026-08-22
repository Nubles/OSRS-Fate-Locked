import { questWalkthroughFor } from '../../data/questWalkthroughs';
import { describe, expect, it } from 'vitest';
import type { QuestRouteAnalysis } from './analyzeQuest';
import { remainingQuestRouteAnalysis } from './confirmedItems';

const analysis = {
  questId: "Doric's Quest",
  status: 'CANNOT_COMPLETE_YET',
  items: [
    {
      requirement: {
        item: { key: 'clay', name: 'Clay' },
        quantity: 6,
        supplyPolicy: 'PLAYER_OBTAINED',
      },
      state: 'NO_CURRENT_SOURCE',
      currentRoutes: [],
      missingChunkRoutes: [],
      missingChunkOptions: [],
      dataNotes: [],
    },
    {
      requirement: {
        item: { key: 'copper ore', name: 'Copper ore' },
        quantity: 4,
        supplyPolicy: 'PLAYER_OBTAINED',
      },
      state: 'OBTAINABLE_NOW',
      currentRoutes: [],
      missingChunkRoutes: [],
      missingChunkOptions: [],
      dataNotes: [],
    },
    {
      requirement: {
        item: { key: 'quest tool', name: 'Quest tool' },
        quantity: 1,
        supplyPolicy: 'QUEST_PROVIDED',
      },
      state: 'OBTAINABLE_NOW',
      currentRoutes: [],
      missingChunkRoutes: [],
      missingChunkOptions: [],
      dataNotes: [],
    },
  ],
  walkthrough: {
    questId: "Doric's Quest",
    releaseStatus: 'PREVIEW_ONLY',
    status: 'READY',
    actions: [],
    blockers: [],
    hasIncompleteEvidence: false,
    sourceLines: questWalkthroughFor("Doric's Quest")!.sourceLines,
    source: questWalkthroughFor("Doric's Quest")!.source,
  },
  generatedFrom: {
    chunkDataVersion: 1,
    questRevision: '15240932',
    accountFingerprint: 'account',
    walkthroughRevision: questWalkthroughFor("Doric's Quest")!.revision,
  },
} satisfies QuestRouteAnalysis;

describe('remainingQuestRouteAnalysis', () => {
  it('filters confirmed and quest-provided items without mutating the proof analysis', () => {
    const remaining = remainingQuestRouteAnalysis(analysis, new Set(['clay']));
    expect(remaining.items.map(item => item.requirement.item.key)).toEqual(['copper ore']);
    expect(remaining.status).toBe('READY_NOW');
    expect(analysis.items).toHaveLength(3);
    expect(analysis.status).toBe('CANNOT_COMPLETE_YET');
  });

  it('returns a ready empty view when every player-obtained item is confirmed', () => {
    const remaining = remainingQuestRouteAnalysis(
      analysis,
      new Set(['clay', 'copper ore']),
    );
    expect(remaining.items).toEqual([]);
    expect(remaining.status).toBe('READY_NOW');
  });
});
