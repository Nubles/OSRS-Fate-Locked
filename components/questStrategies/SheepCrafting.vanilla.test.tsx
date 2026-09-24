// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { questStrategyFor, questWalkthroughFor } from '../../data/questWalkthroughs.public';
import type { UnlockState } from '../../types';
import { analyzeQuest, type QuestRouteAnalysisSnapshot } from '../../utils/questRoutes/analyzeQuest';
import { materializeRuneProofAccount } from '../../utils/questRoutes/goalPlannerRuneProof';
import { buildRuneProofCoachModel } from '../../utils/questStrategies/coach';
import { RuneProofCoach } from './RuneProofCoach';

afterEach(cleanup);

const sheepModel = (owned = false) => {
  const unlocks: UnlockState = {
    equipment: {}, skills: {}, levels: { Crafting: 99 }, regions: [], chunks: [],
    quests: [], guilds: [], merchants: [], minigames: [], mobility: [], slayerUnlocks: [],
    arcana: [], housing: [], bosses: [], storage: [], farming: [], diaries: [],
    cas: [], completedTasks: [], collectionLog: {},
  };
  const snapshot: QuestRouteAnalysisSnapshot = {
    ...materializeRuneProofAccount(unlocks, 'vanilla'), chunkDataVersion: 1,
    itemSourceRecords: [], recipes: [], entityLocations: [], stationRequirements: [],
    sourceCoverage: [{ itemKey: 'ball of wool', direct: 'COMPLETE', transformation: 'COMPLETE' }],
    connectGraph: {},
  };
  return buildRuneProofCoachModel({
    strategy: questStrategyFor('Sheep Shearer')!,
    analysis: analyzeQuest('Sheep Shearer', snapshot, questWalkthroughFor('Sheep Shearer')!),
    account: snapshot, confirmedActionIds: new Set(), completedQuestIds: new Set(),
    confirmedItemKeys: new Set(owned ? ['ball of wool'] : []),
  });
};

describe('already owned wool in the Vanilla RuneProof guide', () => {
  it('offers an independent owned-supply confirmation while spinning is locked and removes it after confirmation', () => {
    const onConfirmAction = vi.fn();
    const onConfirmOwnedItem = vi.fn();
    const model = sheepModel();
    const spin = model.actions.find(action => action.id === 'sheep-shearer:spin-wool')!;
    const view = render(<RuneProofCoach model={model} onConfirmAction={onConfirmAction} onConfirmOwnedItem={onConfirmOwnedItem} />);
    const step = screen.getByText(spin.instruction).closest('li')!;
    expect(within(step).getByRole('note').textContent).toMatch(/Crafting/i);
    expect(within(step).queryByRole('button', { name: 'Mark action complete' })).toBeNull();
    fireEvent.click(within(step).getByRole('button', { name: 'I already have 20 × Ball of wool' }));
    expect(onConfirmOwnedItem).toHaveBeenCalledExactlyOnceWith(spin.id);
    expect(onConfirmAction).not.toHaveBeenCalled();

    view.rerender(<RuneProofCoach model={sheepModel(true)} onConfirmAction={onConfirmAction} onConfirmOwnedItem={onConfirmOwnedItem} />);
    expect(screen.queryByRole('button', { name: 'I already have 20 × Ball of wool' })).toBeNull();
    const completed = screen.getByText(spin.instruction).closest('li')!;
    expect(within(completed).getByText('Completed')).toBeTruthy();
    // The wool is covered, but the quest still starts with Fred.
    const start = screen.getByText('Ask Fred the Farmer, north of Lumbridge, for work.').closest('li')!;
    expect(within(start).getByRole('button', { name: 'Mark action complete' })).toBeTruthy();
    const handIn = screen.getByText('Take 20 unnoted balls of wool back to Fred.').closest('li')!;
    expect(within(handIn).queryByText('Completed')).toBeNull();
  });
});
