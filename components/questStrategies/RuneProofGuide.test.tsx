// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { questStrategyFor, questWalkthroughFor } from '../../data/questWalkthroughs.public';
import type { UnlockState } from '../../types';
import { analyzeQuest, type QuestRouteAnalysisSnapshot } from '../../utils/questRoutes/analyzeQuest';
import { materializeRuneProofAccount } from '../../utils/questRoutes/goalPlannerRuneProof';
import { buildRuneProofCoachModel } from '../../utils/questStrategies/coach';
import { RuneProofCoach } from './RuneProofCoach';

afterEach(cleanup);
const ghostModel = (neck: number, confirmed: string[] = []) => {
  const unlocks: UnlockState = {
    equipment: { Neck: neck }, skills: {}, levels: {}, regions: [], chunks: [],
    quests: [], guilds: [], merchants: [], minigames: [], mobility: [], slayerUnlocks: [],
    arcana: [], housing: [], bosses: [], storage: [], farming: [], diaries: [],
    cas: [], completedTasks: [], collectionLog: {},
  };
  const snapshot: QuestRouteAnalysisSnapshot = {
    ...materializeRuneProofAccount(unlocks, 'vanilla'), chunkDataVersion: 1,
    itemSourceRecords: [], recipes: [], entityLocations: [], stationRequirements: [], sourceCoverage: [], connectGraph: {},
  };
  const strategy = questStrategyFor('The Restless Ghost')!;
  return buildRuneProofCoachModel({ strategy, analysis: analyzeQuest(strategy.questId, snapshot, questWalkthroughFor(strategy.questId)!),
    account: snapshot,
    confirmedActionIds: new Set(confirmed), confirmedItemKeys: new Set(), completedQuestIds: new Set() });
};

describe('Simple RuneProof guide in Vanilla', () => {
  it('keeps successful walking checks quiet and offers named paths inside step details', async () => {
    const user = userEvent.setup();
    const model = ghostModel(1);
    expect(model.actions.every(action => action.travel?.status === 'AVAILABLE' || action.travel?.status === 'START')).toBe(true);
    render(<RuneProofCoach model={model} onConfirmAction={vi.fn()} />);
    expect(screen.queryByText('Travel needs checking.')).toBeNull();
    expect(screen.queryByText('Walking route available.')).toBeNull();
    expect(screen.queryByText('Destination unlocked')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Destination chunks for this quest' })).toBeNull();
    const altar = screen.getByText(model.actions[3].instruction).closest('li')!;
    const detail = within(altar).getByText('Step details').closest('details')!;
    expect(detail.open).toBe(false);
    await user.click(within(altar).getByText('Step details'));
    expect(detail.open).toBe(true);
    const route = within(detail).getByLabelText('Walking route for step 4');
    expect(route.textContent).toContain('South Draynor');
    expect(route.textContent).not.toMatch(/\d+,\d+/);
    expect(within(altar).queryByRole('note')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Quest details and rewards' }));
    await user.click(screen.getByRole('button', { name: 'Show chunk coordinates' }));
    expect(route.textContent).toContain('South Draynor (48,50)');
    await user.click(screen.getByRole('button', { name: 'Show chunk coordinates' }));
    const showMap = within(altar).getByRole('button', { name: `Show ${model.actions[3].instruction} on map` });
    await user.click(showMap);
    const map = screen.getByRole('dialog');
    expect(map.textContent).toContain("Wizards' Tower");
    expect(map.textContent).not.toContain('48,49');
    await user.click(within(map).getByRole('button', { name: 'Close map and return to RuneProof' }));
    expect(document.activeElement).toBe(showMap);
  });

  it('withholds route-specific metadata from a different guide revision and preserves blocked alternatives', async () => {
    const user = userEvent.setup();
    const model = ghostModel(1);
    render(<RuneProofCoach model={{ ...model, guideRevision: 'private-preview-revision', alternativeSources: [{
      itemKey: 'example', itemName: 'Example supply', routes: [{
        id: 'blocked-source', label: 'A reviewed source', sourceKind: 'Spawn', outputQuantity: 1,
        isBest: false, requiresChunkUnlock: true, steps: [], deterministic: true, variantCount: 1,
        blockers: [{ category: 'Equipment', label: 'Weapon T1' }], dataNote: 'Station access is unverified.',
      }],
    }] }} onConfirmAction={vi.fn()} />);
    expect(screen.getByText(model.actions[0].instruction)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Other legal sources' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Quest details and rewards' }));
    expect(screen.queryByRole('table', { name: 'OSRS quest details' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Other legal sources' }));
    const sources = screen.getByRole('region', { name: 'Other legal sources' });
    expect(within(sources).getByText('Requires chunk unlock')).toBeTruthy();
    expect(within(sources).getByText('Equipment: Weapon T1')).toBeTruthy();
    expect(within(sources).getByText('Needs checking: Station access is unverified.')).toBeTruthy();
  });

  it('shows the Neck T1 warning at the affected step while allowing the player to start', async () => {
    const user = userEvent.setup();
    const model = ghostModel(0);
    expect(model.actions[0].confirmationAllowed).toBe(true);
    expect(model.actions[2].state).toBe('BLOCKED');
    render(<RuneProofCoach model={model} onConfirmAction={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('You can start this quest. Finishing requires Neck T1.');
    expect(screen.queryByRole('table', { name: 'OSRS quest details' })).toBeNull();
    const route = screen.getByRole('list', { name: 'The Restless Ghost route' });
    const wear = within(route).getByText(model.actions[2].instruction).closest('li')!;
    expect(within(wear).getByRole('note').textContent).toMatch(/Neck T1/);
    expect(within(wear).queryByRole('button', { name: 'Mark action complete' })).toBeNull();
    expect(within(route).queryByText('Blocked')).toBeNull();
    expect(within(route).queryByText('Do now')).toBeNull();
    expect(within(route).queryByText('Later step')).toBeNull();
    const first = screen.getByRole('heading', { name: 'Next action' }).closest('section')!;
    expect(first.getAttribute('aria-current')).toBe('step');
    expect(within(first).getByRole('button', { name: 'Mark action complete' })).toBeTruthy();
    const altar = within(route).getByText(model.actions[3].instruction).closest('li')!;
    expect(altar.querySelector('.rp-step-location')?.textContent).toMatch(/basement/i);
    await user.click(screen.getByRole('button', { name: 'Quest details and rewards' }));
    const details = screen.getByRole('table', { name: 'OSRS quest details' });
    expect(within(details).queryByText(/Neck T1/)).toBeNull();
    expect(within(details).getByText('None to bring.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Rewards' })).toBeTruthy();
  });

  it('allows preparation, rechecks the worn slot, and resumes at the enabled current step', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const confirmed = ['the-restless-ghost:start-with-aereck'];
    const view = render(<RuneProofCoach model={ghostModel(0, confirmed)} onConfirmAction={onConfirm} />);
    const current = () => screen.getByRole('heading', { name: 'Next action' }).closest('section')!;
    await user.click(within(current()).getByRole('button', { name: 'Mark action complete' }));
    expect(onConfirm).toHaveBeenCalledWith('the-restless-ghost:get-amulet');
    confirmed.push('the-restless-ghost:get-amulet');
    view.rerender(<RuneProofCoach model={ghostModel(0, confirmed)} onConfirmAction={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Continue at my next step ↓' }));
    expect(document.activeElement).toBe(current());
    expect(within(current()).getByRole('note').textContent).toMatch(/Neck T1/);
    expect(within(current()).queryByRole('button', { name: 'Mark action complete' })).toBeNull();
    view.rerender(<RuneProofCoach model={ghostModel(1, confirmed)} onConfirmAction={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Continue at my next step ↓' }));
    expect(within(current()).queryByRole('note')).toBeNull();
    expect(document.activeElement).toBe(within(current()).getByRole('button', { name: 'Mark action complete' }));
  });

  it('highlights each missing unlock once and links to the affected step without checking it off', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const model = ghostModel(0);
    const view = render(<RuneProofCoach model={model} onConfirmAction={onConfirm} />);
    const needs = screen.getByRole('region', { name: 'Still needed' });
    const list = within(needs).getByRole('list', { name: 'Remaining requirements' });
    const slotImage = within(needs).getByRole('img', { name: 'Neck equipment slot' });
    fireEvent.error(slotImage);
    expect(within(needs).queryByRole('img', { name: 'Neck equipment slot' })).toBeNull();
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Neck T1')).toBeTruthy();
    expect(within(list).getByText('Required')).toBeTruthy();
    expect(within(list).getByRole('link', { name: 'Neck T1 — go to step 3' }).textContent).toContain('Step 3');
    expect(needs.compareDocumentPosition(screen.getByRole('progressbar', { name: 'The Restless Ghost progress' }))
      & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(needs).queryByRole('link', { name: 'Neck T1 — go to step 7' })).toBeNull();
    await user.click(within(needs).getByRole('link', { name: 'Neck T1 — go to step 3' }));
    const wear = screen.getByText(model.actions[2].instruction).closest('section')!;
    expect(document.activeElement).toBe(wear);
    expect(within(wear).getByRole('note').textContent).toMatch(/Neck T1/);
    expect(within(wear).queryByRole('button', { name: 'Mark action complete' })).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect((screen.getByRole('progressbar', { name: 'The Restless Ghost progress' }) as HTMLProgressElement).value).toBe(0);

    view.rerender(<RuneProofCoach model={ghostModel(1)} onConfirmAction={onConfirm} />);
    expect(screen.queryByRole('region', { name: 'Still needed' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Neck equipment slot' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('You can start this quest.');
    expect(screen.queryByText(/quest is ready|all requirements met/i)).toBeNull();
  });

  it('keeps a remaining completion unlock visible when the earlier affected step is already checked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const checked = ghostModel(0).actions.slice(0, 3).map(action => action.id);
    const model = ghostModel(0, checked);
    expect(model.actions[2].state).toBe('COMPLETED');
    expect(model.actions[6].state).toBe('BLOCKED');
    render(<RuneProofCoach model={model} onConfirmAction={onConfirm} />);
    const needs = screen.getByRole('region', { name: 'Still needed' });
    expect(within(needs).getAllByRole('listitem')).toHaveLength(1);
    expect(within(needs).queryByRole('link', { name: 'Neck T1 — go to step 3' })).toBeNull();
    await user.click(within(needs).getByRole('link', { name: 'Neck T1 — go to step 7' }));
    const completion = screen.getByText(model.actions[6].instruction).closest('section')!;
    expect(document.activeElement).toBe(completion);
    expect(within(completion).getByRole('note').textContent).toMatch(/Neck T1/);
    expect(within(completion).queryByRole('button', { name: 'Confirm quest complete' })).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('distinguishes an unreviewed location from a missing unlock in the at-a-glance list', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const original = ghostModel(1);
    const model = {
      ...original,
      actions: original.actions.map((action, index) => index !== 3 ? action : {
        ...action,
        state: 'NEEDS_CONFIRMATION' as const,
        confirmationAllowed: false,
        chunkAccess: action.mapChunks.map(chunk => ({ chunk, status: 'UNKNOWN' as const })),
        blockers: [{ kind: 'LOCATION' as const, label: 'The basement altar location needs review.' }],
      }),
    };
    render(<RuneProofCoach model={model} onConfirmAction={onConfirm} />);
    const needs = screen.getByRole('region', { name: 'Still needed' });
    expect(within(needs).getAllByRole('listitem')).toHaveLength(1);
    expect(within(needs).getByText('Needs checking')).toBeTruthy();
    expect(within(needs).queryByText('Required')).toBeNull();
    expect(within(needs).queryByText(/unlock/i)).toBeNull();
    await user.click(within(needs).getByRole('link', { name: /go to step 4$/ }));
    expect(document.activeElement).toBe(screen.getByText(model.actions[3].instruction).closest('section'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps all numbered instructions visible without reading modes and exposes explicit undo', async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    const model = ghostModel(1);
    const { container } = render(<RuneProofCoach model={model} onConfirmAction={vi.fn()} canUndoLastCheck onUndoLastCheck={undo} />);
    for (const action of model.actions) expect(screen.getByText(action.instruction)).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'The Restless Ghost route' })).getAllByRole('listitem')).toHaveLength(7);
    expect(container.querySelectorAll('.rp-step-detail[open]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Detailed guide' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quick guide' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: /contents/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Rewards' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Undo last check' }));
    expect(undo).toHaveBeenCalledOnce();
  });

  it('opens rewards from the completed walkthrough without marking the Journal complete', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const model = ghostModel(1, questStrategyFor('The Restless Ghost')!.actions.map(action => action.id));
    expect(model.progress).toEqual({ completed: 7, total: 7 });
    render(<RuneProofCoach model={model} onConfirmAction={onConfirm} />);
    expect(screen.queryByRole('region', { name: 'Still needed' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Rewards' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue at my next step ↓' })).toBeNull();
    expect(screen.getAllByText('Completed')).toHaveLength(7);
    await user.click(screen.getByRole('button', { name: 'View rewards ↓' }));
    expect(screen.getByRole('heading', { name: 'Rewards' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'OSRS quest details' })).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
