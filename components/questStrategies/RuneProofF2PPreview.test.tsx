// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { questStrategyFor, questWalkthroughFor } from '../../data/questWalkthroughs.preview-boundary';
import { materializeRuneProofAccount } from '../../utils/questRoutes/goalPlannerRuneProof';
import { analyzeQuest, type QuestRouteAnalysisSnapshot } from '../../utils/questRoutes/analyzeQuest';
import { buildRuneProofCoachModel } from '../../utils/questStrategies/coach';
import type { UnlockState } from '../../types';
import { RuneProofCoach } from './RuneProofCoach';

afterEach(cleanup);
const show = (questId: string) => {
  const unlocks: UnlockState = { equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
    quests: [], guilds: [], merchants: [], minigames: [], mobility: [], slayerUnlocks: [],
    arcana: [], housing: [], bosses: [], storage: [], farming: [], diaries: [], cas: [], completedTasks: [], collectionLog: {} };
  const snapshot: QuestRouteAnalysisSnapshot = { ...materializeRuneProofAccount(unlocks, 'vanilla'),
    chunkDataVersion: 1, itemSourceRecords: [], recipes: [], entityLocations: [], stationRequirements: [], sourceCoverage: [], connectGraph: {} };
  const model = buildRuneProofCoachModel({ strategy: questStrategyFor(questId)!,
    analysis: analyzeQuest(questId, snapshot, questWalkthroughFor(questId)!), account: snapshot,
    confirmedActionIds: new Set(), confirmedItemKeys: new Set(), completedQuestIds: new Set() });
  render(<RuneProofCoach model={model} onConfirmAction={vi.fn()} />);
  return model;
};

describe('expanded F2P guide UI in Vanilla', () => {
  it('shows the Dragon Slayer QP gate with its quest image and prevents starting below 32 QP', () => {
    const model = show('Dragon Slayer I');
    expect(model.nextAction?.confirmationAllowed).toBe(false);
    expect(screen.getByText('Quest Points 32', { selector: 'strong' })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /Quest/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Test guide/)).toBeTruthy();
  });
  it('shows both Black Knights disguise slot images beside remaining unlocks', () => {
    show("Black Knights' Fortress");
    expect(screen.getByRole('img', { name: 'Head equipment slot' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Body equipment slot' })).toBeTruthy();
    expect(screen.queryByText(/WorldPoint|a52646118f0e5ea63a6b/)).toBeNull();
  });
  it('includes the updated Prince Ali furnace step in the guide', () => {
    const model = show('Prince Ali Rescue');
    expect(model.actions.some(action => /furnace/i.test(action.instruction))).toBe(true);
    expect(screen.getByRole('heading', { name: 'Prince Ali Rescue' })).toBeTruthy();
  });
  it('labels Tutorial Island as a reference and does not invent map links', () => {
    show('Learning the Ropes');
    expect(screen.getByText(/not a replayable quest route/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /on map/ })).toBeNull();
  });
});
