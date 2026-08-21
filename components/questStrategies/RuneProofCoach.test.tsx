// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { questStrategyFor } from '../../data/questWalkthroughs.preview-boundary';
import type { ChunkKey, ItemRoute } from '../../utils/questRoutes/model';
import type { QuestPreparationRouteAnalysis, QuestRouteAnalysis } from '../../utils/questRoutes/analyzeQuest';
import { buildRuneProofCoachModel, type RuneProofCoachModel } from '../../utils/questStrategies/coach';
import type { QuestStrategyDefinition } from '../../utils/questStrategies/model';
import { RuneProofCoach } from './RuneProofCoach';

afterEach(cleanup);

const proof: RuneProofCoachModel['proof'] = {
  source: {
    wikiTitle: "Cook's Assistant/Quick guide",
    wikiRevision: '123456',
    wikiRevisionTimestamp: '2026-08-20T00:00:00Z',
    wikiUrl: 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant/Quick_guide?oldid=123456',
    wikiLicence: 'CC BY-NC-SA 3.0',
    wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    chunkPickerRepository: 'source-chunk/chunk-picker-v2',
    chunkPickerCommit: 'abc123',
    chunkPickerLicenceStatus: 'PERMISSION_RECORDED',
    permissionReference: 'review-record-1',
  },
  sourceLines: [{
    id: 'cooks-assistant-1',
    section: 'Quick guide',
    sourceOrder: 1,
    rawText: 'Bring a pot, bucket, and egg to the Cook.',
  }],
  diagnostics: ['Route budget and source wording are retained for proof.'],
};

const potInstruction = 'Pick up the empty pot beside the Cook in Lumbridge Castle.';

const impStrategy = (): QuestStrategyDefinition => {
  const strategy = questStrategyFor('Imp Catcher');
  if (!strategy) throw new Error('Imp Catcher strategy fixture did not load.');
  return strategy;
};

const impAnalysisFor = (strategy: QuestStrategyDefinition): QuestPreparationRouteAnalysis => ({
  questId: strategy.questId,
  status: 'READY_NOW',
  items: [],
  generatedFrom: {
    chunkDataVersion: 1,
    questRevision: strategy.source.wikiRevision,
    accountFingerprint: 'runeproof-coach-ui-test-account',
  },
});

const unlockedBlackBeadAlternative = (): ItemRoute => ({
  id: 'other-legal-imp-source',
  item: { key: 'black bead', name: 'Black bead' },
  outputQuantity: 1,
  sourceKind: 'DROP',
  sourceLabel: 'Other legal Imps',
  chunks: ['50,50' as ChunkKey],
  steps: [],
  blockers: [],
  deterministic: false,
  probability: 0.25,
  recursiveCost: 0,
  consumedIngredientCost: 0,
  skillUnlockCost: 0,
  skillLevelCost: 0,
  travelCost: 0,
  hasDataGap: false,
});

const lockedImpAlternativeAnalysisFor = (
  strategy: QuestStrategyDefinition,
): QuestRouteAnalysis => {
  const actions = strategy.actions.map(action => {
    const chunks = action.mapChunks;
    const blocked = chunks.includes('47,51' as ChunkKey);
    return {
      definition: action,
      location: {
        confidence: 'REVIEWED' as const,
        evidenceKind: 'REVIEWED_ALIAS' as const,
        chunks,
        candidateChunks: [],
        explanation: action.location.kind === 'REVIEWED_ALIAS'
          ? action.location.alias
          : chunks.join(', '),
      },
      state: blocked ? 'CHUNK_LOCKED' as const : 'READY_HERE' as const,
      blockers: blocked ? [{
        kind: 'CHUNK' as const,
        chunk: '47,51' as ChunkKey,
        label: action.displayText,
      }] : [],
      itemPreparation: [],
    };
  });

  return {
    questId: strategy.questId,
    status: 'CANNOT_COMPLETE_YET',
    items: [{
      requirement: {
        item: { key: 'black bead', name: 'Black bead' },
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED',
      },
      state: 'OBTAINABLE_NOW',
      currentRoutes: [unlockedBlackBeadAlternative()],
      missingChunkRoutes: [],
      missingChunkOptions: [],
      dataNotes: [],
    }],
    generatedFrom: {
      chunkDataVersion: 1,
      questRevision: strategy.source.wikiRevision,
      walkthroughRevision: strategy.source.wikiRevision,
      accountFingerprint: 'runeproof-coach-locked-alternative-ui-test-account',
    },
    walkthrough: {
      questId: strategy.questId,
      releaseStatus: 'PREVIEW_ONLY',
      status: 'BLOCKED',
      actions,
      blockers: actions.flatMap(action => action.blockers),
      hasIncompleteEvidence: false,
      sourceLines: strategy.sourceLines,
      source: strategy.source,
    },
  };
};

const ImpCatcherYellowFirstHarness = ({
  onPersistItem,
}: {
  readonly onPersistItem: (questId: string, itemKey: string, confirmed: boolean) => void;
}) => {
  const strategy = impStrategy();
  const [confirmedItemKeys, setConfirmedItemKeys] = useState<ReadonlySet<string>>(() => new Set());
  const model = buildRuneProofCoachModel({
    strategy,
    analysis: impAnalysisFor(strategy),
    confirmedActionIds: new Set(),
    confirmedItemKeys,
    completedQuestIds: new Set(),
  });

  return (
    <RuneProofCoach
      model={model}
      onConfirmAction={actionId => {
        const action = strategy.actions.find(candidate => candidate.id === actionId);
        if (!action || action.coach.completion.kind !== 'ITEM_CONFIRMED') return;

        const itemKey = action.coach.completion.itemKey;
        onPersistItem(strategy.questId, itemKey, true);
        setConfirmedItemKeys(keys => new Set([...keys, itemKey]));
      }}
    />
  );
};

const ImpCatcherLockedAlternativeHarness = ({
  onPersistItem,
}: {
  readonly onPersistItem: (questId: string, itemKey: string, confirmed: boolean) => void;
}) => {
  const strategy = impStrategy();
  const [confirmedItemKeys, setConfirmedItemKeys] = useState<ReadonlySet<string>>(() => new Set());
  const model = buildRuneProofCoachModel({
    strategy,
    analysis: lockedImpAlternativeAnalysisFor(strategy),
    confirmedActionIds: new Set(),
    confirmedItemKeys,
    completedQuestIds: new Set(),
  });

  return (
    <RuneProofCoach
      model={model}
      onConfirmAction={actionId => {
        const action = strategy.actions.find(candidate => candidate.id === actionId);
        if (!action || action.coach.completion.kind !== 'ITEM_CONFIRMED') return;

        const itemKey = action.coach.completion.itemKey;
        onPersistItem(strategy.questId, itemKey, true);
        setConfirmedItemKeys(keys => new Set([...keys, itemKey]));
      }}
    />
  );
};

// This is intentionally a post-start model: visible-hierarchy assertions for
// the pot belong after cooks-assistant:start-quest is complete.
const modelWithPotNext: RuneProofCoachModel = {
  questId: "Cook's Assistant",
  recommendationReason: 'Recommended because this local quest is ready with your current unlocks.',
  progress: { completed: 1, total: 3 },
  nextAction: {
    id: 'cooks-assistant:take-pot',
    instruction: potInstruction,
    state: 'DO_NOW',
    locationLabel: 'Lumbridge Castle',
    mapChunks: ['50,50'],
    preferredMethodLabel: 'Pot',
    confirmationAllowed: false,
  },
  actions: [
    {
      id: 'cooks-assistant:start-quest',
      instruction: 'Talk to the Cook in Lumbridge Castle.',
      state: 'COMPLETED',
      mapChunks: ['50,50'],
      confirmationAllowed: true,
    },
    {
      id: 'cooks-assistant:take-pot',
      instruction: potInstruction,
      state: 'DO_NOW',
      locationLabel: 'Lumbridge Castle',
      mapChunks: ['50,50'],
      preferredMethodLabel: 'Pot',
      confirmationAllowed: false,
    },
    {
      id: 'cooks-assistant:take-bucket',
      instruction: 'Pick up the bucket from the Lumbridge Castle cellar.',
      state: 'AVAILABLE_NEXT',
      mapChunks: ['50,50'],
      confirmationAllowed: false,
    },
  ],
  alternativeSources: [{
    itemKey: 'pot of flour',
    itemName: 'Pot of flour',
    routes: [{
      variantCount: 4,
      id: 'black-knight-flour',
      label: 'Black Knight',
      sourceKind: 'Drop',
      outputQuantity: 1,
      isBest: true,
      requiresChunkUnlock: false,
      steps: [],
      blockers: [],
      deterministic: false,
      probabilityText: '50% chance',
    }],
  }],
  mainJourneyText: [
    'Talk to the Cook in Lumbridge Castle.',
    potInstruction,
    'Pick up the bucket from the Lumbridge Castle cellar.',
  ].join(' '),
  proof,
};

const freshModel: RuneProofCoachModel = {
  ...modelWithPotNext,
  progress: { completed: 0, total: 3 },
  nextAction: {
    id: 'cooks-assistant:start-quest',
    instruction: 'Talk to the Cook in Lumbridge Castle.',
    state: 'DO_NOW',
    locationLabel: 'Lumbridge Castle',
    mapChunks: ['50,50'],
    confirmationAllowed: true,
  },
  actions: [
    {
      id: 'cooks-assistant:start-quest',
      instruction: 'Talk to the Cook in Lumbridge Castle.',
      state: 'DO_NOW',
      locationLabel: 'Lumbridge Castle',
      mapChunks: ['50,50'],
      confirmationAllowed: true,
    },
    {
      ...modelWithPotNext.actions[1],
      state: 'AVAILABLE_NEXT',
    },
    ...modelWithPotNext.actions.slice(2),
  ],
};

const modelWithCurrentChunk = (chunk: string): RuneProofCoachModel => {
  if (!freshModel.nextAction) throw new Error('Fresh Cook model must have a current action.');
  return {
    ...freshModel,
    nextAction: {
      ...freshModel.nextAction,
      mapChunks: [chunk as ChunkKey],
    },
  };
};

const completedModel: RuneProofCoachModel = {
  ...modelWithPotNext,
  progress: { completed: 3, total: 3 },
  nextAction: undefined,
  actions: modelWithPotNext.actions.map(action => ({
    ...action,
    state: 'COMPLETED' as const,
    confirmationAllowed: false,
  })),
  alternativeSources: [],
};

const emptyRouteModel: RuneProofCoachModel = {
  ...completedModel,
  progress: { completed: 0, total: 0 },
  actions: [],
  proof: {
    ...proof,
    sourceLines: [],
    diagnostics: [],
  },
};

describe('RuneProofCoach', () => {
  it('keeps the selected route progress exposed in text and through a quest-scoped progressbar', () => {
    render(<RuneProofCoach model={modelWithPotNext} onConfirmAction={() => undefined} />);

    const progress = screen.getByRole(
      'progressbar',
      { name: "Cook's Assistant progress" },
    ) as HTMLProgressElement;
    expect(progress.value).toBe(1);
    expect(progress.max).toBe(3);
    expect(screen.getByText('1/3 complete')).toBeTruthy();
  });

  it('puts the reviewed objective and current pot action before the compact route', () => {
    render(
      <RuneProofCoach
        model={modelWithPotNext}
        onConfirmAction={() => undefined}
      />,
    );

    const objective = screen.getByRole('heading', { name: "Cook's Assistant" });
    const nextAction = screen.getByRole('heading', { name: 'Next action' });
    const route = screen.getByRole('list', { name: "Cook's Assistant route" });
    const nextActionSection = nextAction.closest('section');

    expect(objective).toBeTruthy();
    expect(screen.getByText('Recommended because this local quest is ready with your current unlocks.'))
      .toBeTruthy();
    expect(nextAction).toBeTruthy();
    expect(within(nextActionSection as HTMLElement).getByText(potInstruction)).toBeTruthy();
    expect(route).toBeTruthy();
    expect(screen.queryByText(/route budget/i)).toBeNull();
    expect(screen.queryByText(/Black Knight/i)).toBeNull();
    expect(nextAction.compareDocumentPosition(route) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const coach = objective.closest('section');
    expect(coach?.getAttribute('style') ?? '').not.toMatch(/width:\s*\d+px/i);
    expect(coach?.className).not.toMatch(/(?:^|\s)(?:w|min-w|max-w)-\[\d+px\]/);
    expect(screen.getAllByRole('button', { name: /on map/i })).toHaveLength(1);

    const routeRows = within(route).getAllByRole('listitem');
    expect(routeRows[0].querySelector('details')?.open).toBe(false);
    expect(routeRows[1].querySelector('details')?.open).toBe(true);
    expect(routeRows[2].querySelector('details')?.open).toBe(false);
  });

  it('keeps every compact route step tied to an explicit reviewed chunk', () => {
    const modelWithUnmappedFinalStep: RuneProofCoachModel = {
      ...modelWithPotNext,
      actions: modelWithPotNext.actions.map((action, index) => (
        index === 2 ? { ...action, mapChunks: [] } : action
      )),
    };
    render(
      <RuneProofCoach
        model={modelWithUnmappedFinalStep}
        onConfirmAction={() => undefined}
      />,
    );

    const rows = within(screen.getByRole('list', { name: "Cook's Assistant route" }))
      .getAllByRole('listitem');
    expect(within(rows[0]).getByText('Chunk 50,50')).toBeTruthy();
    expect(within(rows[1]).getByText('Chunk 50,50')).toBeTruthy();
    expect(within(rows[2]).getByText('Chunk needs review')).toBeTruthy();
  });

  it('keeps legal alternatives and proof outside the primary journey until opened', async () => {
    const user = userEvent.setup();
    render(
      <RuneProofCoach
        model={modelWithPotNext}
        onConfirmAction={() => undefined}
      />,
    );

    const alternatives = screen.getByRole('button', { name: 'Other legal sources' });
    const proofDrawer = screen.getByRole('button', { name: 'Proof and sources' });

    expect(alternatives.getAttribute('aria-expanded')).toBe('false');
    expect(proofDrawer.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Black Knight')).toBeNull();
    expect(screen.queryByText('Wiki revision: 123456')).toBeNull();
    expect(screen.queryByText('Route budget and source wording are retained for proof.')).toBeNull();

    await user.click(alternatives);
    expect(alternatives.getAttribute('aria-expanded')).toBe('true');
    const alternativesRegion = screen.getByRole('region', { name: 'Other legal sources' });
    expect(within(alternativesRegion).getAllByText('Black Knight')).toHaveLength(1);
    expect(within(alternativesRegion).getByText('4 route variants')).toBeTruthy();
    expect(within(alternativesRegion).getAllByRole('listitem')).toHaveLength(1);

    await user.click(proofDrawer);
    expect(proofDrawer.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Wiki revision: 123456')).toBeTruthy();
    expect(screen.getByText('Route budget and source wording are retained for proof.')).toBeTruthy();
  });

  it('opens a temporary focused map and returns focus to the same RuneProof action', async () => {
    const user = userEvent.setup();
    const onConfirmAction = vi.fn();
    const onHostClick = vi.fn();
    render(
      <div onClick={onHostClick}>
        <RuneProofCoach
          model={freshModel}
          onConfirmAction={onConfirmAction}
        />
      </div>,
    );

    const nextActionSection = screen.getByRole('heading', { name: 'Next action' }).closest('section');
    expect(within(nextActionSection as HTMLElement).getByText('Talk to the Cook in Lumbridge Castle.'))
      .toBeTruthy();
    expect(screen.getAllByRole('button', { name: /on map/i })).toHaveLength(1);

    const showMap = screen.getByRole('button', {
      name: 'Show Talk to the Cook in Lumbridge Castle. on map',
    });
    await user.click(showMap);

    const map = screen.getByRole('dialog', {
      name: 'Temporary map for Talk to the Cook in Lumbridge Castle.',
    });
    expect(within(map).getByText('Chunk 50,50')).toBeTruthy();
    expect(within(map).getByText('Lumbridge Castle')).toBeTruthy();
    expect(within(map).getByAltText('OSRS world map')).toBeTruthy();
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 500 });
    expect(map.parentElement?.dispatchEvent(wheel)).toBe(false);
    expect(wheel.defaultPrevented).toBe(true);

    const closeMap = within(map).getByRole('button', {
      name: 'Close map and return to RuneProof',
    });
    expect(document.activeElement).toBe(closeMap);
    onHostClick.mockClear();
    await user.click(closeMap);

    expect(screen.queryByRole('dialog', {
      name: 'Temporary map for Talk to the Cook in Lumbridge Castle.',
    })).toBeNull();
    expect(document.activeElement).toBe(showMap);
    expect(onHostClick).not.toHaveBeenCalled();

    await user.click(showMap);
    const reopenedMap = screen.getByRole('dialog', {
      name: 'Temporary map for Talk to the Cook in Lumbridge Castle.',
    });
    const backdrop = reopenedMap.parentElement;
    if (!backdrop) throw new Error('Missing temporary map backdrop.');
    onHostClick.mockClear();
    await user.click(backdrop);
    expect(screen.queryByRole('dialog', {
      name: 'Temporary map for Talk to the Cook in Lumbridge Castle.',
    })).toBeNull();
    expect(document.activeElement).toBe(showMap);
    expect(onHostClick).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Mark action complete' }));

    expect(onConfirmAction).toHaveBeenCalledWith('cooks-assistant:start-quest');
  });

  it('persists a yellow-first Imp Catcher confirmation from the route without enabling the dependent hand-off', async () => {
    const user = userEvent.setup();
    const onPersistItem = vi.fn();
    render(<ImpCatcherYellowFirstHarness onPersistItem={onPersistItem} />);

    const route = screen.getByRole('list', { name: 'Imp Catcher route' });
    const yellowInstruction = 'Kill imps south-east of Falador until you obtain a yellow bead.';
    const yellowRow = within(route).getByText(yellowInstruction).closest('li');
    if (!yellowRow) throw new Error('Missing yellow-bead route row.');

    await user.click(within(yellowRow).getByText(yellowInstruction));
    await user.click(within(yellowRow).getByRole('button', { name: 'Mark action complete' }));

    expect(onPersistItem).toHaveBeenCalledWith('Imp Catcher', 'yellow bead', true);
    expect((screen.getByRole('progressbar', { name: 'Imp Catcher progress' }) as HTMLProgressElement).value)
      .toBe(1);
    expect(within(yellowRow).getByText('Completed')).toBeTruthy();

    const mizgogInstruction = "Take all four beads to Wizard Mizgog on the top floor of the Wizards' Tower.";
    const mizgogRow = within(route).getByText(mizgogInstruction).closest('li');
    if (!mizgogRow) throw new Error('Missing Mizgog route row.');

    await user.click(within(mizgogRow).getByText(mizgogInstruction));
    expect(within(mizgogRow).queryByRole('button', { name: 'Mark action complete' })).toBeNull();
  });

  it('persists the black bead through an unlocked legal Imp alternative while the reviewed source stays blocked', async () => {
    const user = userEvent.setup();
    const onPersistItem = vi.fn();
    render(<ImpCatcherLockedAlternativeHarness onPersistItem={onPersistItem} />);

    const nextAction = screen.getByRole('heading', { name: 'Next action' }).closest('section');
    if (!nextAction) throw new Error('Missing current Imp Catcher action section.');
    const blocker = within(nextAction).getByRole('note');
    const alternatives = screen.getByRole('button', { name: 'Other legal sources' });

    expect(blocker.textContent).toContain('Unlock chunk 47,51 to use Imps south-east of Falador.');
    expect(blocker.compareDocumentPosition(alternatives) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(alternatives);
    expect(screen.getByText('Other legal Imps')).toBeTruthy();
    await user.click(within(nextAction).getByRole('button', { name: 'Mark action complete' }));

    expect(onPersistItem).toHaveBeenCalledWith('Imp Catcher', 'black bead', true);
    expect((screen.getByRole('progressbar', { name: 'Imp Catcher progress' }) as HTMLProgressElement).value)
      .toBe(1);
  });

  it('scopes objective, next-action, and route labels to each coach instance', () => {
    render(
      <>
        <RuneProofCoach model={modelWithPotNext} onConfirmAction={() => undefined} />
        <RuneProofCoach model={modelWithPotNext} onConfirmAction={() => undefined} />
      </>,
    );

    const coaches = screen.getAllByRole('heading', { name: "Cook's Assistant" })
      .map(heading => heading.closest('section'))
      .filter((coach): coach is HTMLElement => coach !== null);
    const labelledSections = (coach: HTMLElement): HTMLElement[] => [
      coach,
      ...Array.from(coach.querySelectorAll<HTMLElement>('section[aria-labelledby]')),
    ];
    const ids = coaches.flatMap(coach => labelledSections(coach)
      .map(section => section.getAttribute('aria-labelledby'))
      .filter((id): id is string => id !== null));

    expect(coaches).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
    coaches.forEach(coach => {
      labelledSections(coach).forEach(section => {
        const heading = document.getElementById(section.getAttribute('aria-labelledby') ?? '');
        expect(heading).toBeTruthy();
        expect(coach.contains(heading)).toBe(true);
      });
    });
  });

  it('withholds map controls for malformed, unsafe, and unmappable current chunks', () => {
    [
      '50,',
      ' 50,50',
      '050,50',
      '50,050',
      '5e1,50',
      '9007199254740992,50',
      '999,999',
    ].forEach(chunk => {
      const view = render(
        <RuneProofCoach
          model={modelWithCurrentChunk(chunk)}
          onConfirmAction={() => undefined}
        />,
      );

      expect(screen.queryByRole('button', { name: /on map/i })).toBeNull();
      expect(screen.getByText('Chunk needs review')).toBeTruthy();
      view.unmount();
    });
  });

  it('keeps an empty alternatives disclosure before proof in the coach sequence', async () => {
    const user = userEvent.setup();
    render(<RuneProofCoach model={emptyRouteModel} onConfirmAction={() => undefined} />);

    const alternatives = screen.getByRole('button', { name: 'Other legal sources' });
    const proofDrawer = screen.getByRole('button', { name: 'Proof and sources' });
    expect(alternatives.getAttribute('aria-expanded')).toBe('false');
    expect(alternatives.compareDocumentPosition(proofDrawer) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(alternatives);

    expect(alternatives.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('No other reviewed legal sources are available.')).toBeTruthy();
  });

  it('renders a completed route without a current action', () => {
    render(<RuneProofCoach model={completedModel} onConfirmAction={() => undefined} />);

    expect(screen.getByText('All reviewed actions are complete.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /on map/i })).toBeNull();
    expect(within(screen.getByRole('list', { name: "Cook's Assistant route" }))
      .getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders an empty route without treating it as a completed journey', () => {
    render(<RuneProofCoach model={emptyRouteModel} onConfirmAction={() => undefined} />);

    expect(screen.getByText('No reviewed actions are available for this objective.')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: "Cook's Assistant route" }))
      .queryAllByRole('listitem')).toHaveLength(0);
  });

  it('explains empty proof arrays after opening the proof disclosure', async () => {
    const user = userEvent.setup();
    render(<RuneProofCoach model={emptyRouteModel} onConfirmAction={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Proof and sources' }));

    expect(screen.getByText('No pinned source wording recorded.')).toBeTruthy();
    expect(screen.getByText('No route diagnostics recorded.')).toBeTruthy();
  });
});
