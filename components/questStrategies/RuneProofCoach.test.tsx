// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { questStrategyFor } from '../../data/questWalkthroughs.preview-boundary';
import type { ChunkKey, ItemRoute } from '../../utils/questRoutes/model';
import type { QuestPreparationRouteAnalysis, QuestRouteAnalysis } from '../../utils/questRoutes/analyzeQuest';
import {
  buildRuneProofCoachModel,
  buildRuneProofPackCoachModel,
  type RuneProofCoachCompletionTarget,
  type RuneProofCoachModel,
  type RuneProofPackCoachAction,
  type RuneProofPackCoachModel,
} from '../../utils/questStrategies/coach';
import type { QuestStrategyDefinition } from '../../utils/questStrategies/model';
import {
  branchOption,
  branchNeedsReviewPack,
  branchingPack,
  combatPack,
  emptyProgressFor,
  fullyConfirmedProgress,
  acquiredItemPack,
  initialItemModel,
  itemQuantityPack,
  readyRequirementSnapshot,
} from '../../utils/questStrategies/testFixtures';
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
      variant="LEGACY"
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
      variant="LEGACY"
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
    render(<RuneProofCoach variant="LEGACY" model={modelWithPotNext} onConfirmAction={() => undefined} />);

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
        variant="LEGACY"
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
        variant="LEGACY"
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
        variant="LEGACY"
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
          variant="LEGACY"
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

  it('promotes and persists the black bead through an unlocked legal Imp source', async () => {
    const user = userEvent.setup();
    const onPersistItem = vi.fn();
    render(<ImpCatcherLockedAlternativeHarness onPersistItem={onPersistItem} />);

    const nextAction = screen.getByRole('heading', { name: 'Next action' }).closest('section');
    if (!nextAction) throw new Error('Missing current Imp Catcher action section.');
    const alternatives = screen.getByRole('button', { name: 'Other legal sources' });

    expect(within(nextAction).getByText('Do now')).toBeTruthy();
    expect(within(nextAction).getByText('Kill imps in Lumbridge until you obtain a black bead.')).toBeTruthy();
    expect(within(nextAction).getByText('Chunk 50,50')).toBeTruthy();
    expect(within(nextAction).queryByRole('note')).toBeNull();

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
        <RuneProofCoach variant="LEGACY" model={modelWithPotNext} onConfirmAction={() => undefined} />
        <RuneProofCoach variant="LEGACY" model={modelWithPotNext} onConfirmAction={() => undefined} />
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
          variant="LEGACY"
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
    render(<RuneProofCoach variant="LEGACY" model={emptyRouteModel} onConfirmAction={() => undefined} />);

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
    render(<RuneProofCoach variant="LEGACY" model={completedModel} onConfirmAction={() => undefined} />);

    expect(screen.getByText('All reviewed actions are complete.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /on map/i })).toBeNull();
    expect(within(screen.getByRole('list', { name: "Cook's Assistant route" }))
      .getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders an empty route without treating it as a completed journey', () => {
    render(<RuneProofCoach variant="LEGACY" model={emptyRouteModel} onConfirmAction={() => undefined} />);

    expect(screen.getByText('No reviewed actions are available for this objective.')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: "Cook's Assistant route" }))
      .queryAllByRole('listitem')).toHaveLength(0);
  });

  it('explains empty proof arrays after opening the proof disclosure', async () => {
    const user = userEvent.setup();
    render(<RuneProofCoach variant="LEGACY" model={emptyRouteModel} onConfirmAction={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Proof and sources' }));

    expect(screen.getByText('No pinned source wording recorded.')).toBeTruthy();
    expect(screen.getByText('No route diagnostics recorded.')).toBeTruthy();
  });
});

const surfacePackAction: RuneProofPackCoachAction = {
  id: 'pack:surface',
  instruction: 'Cross the reviewed surface path.',
  state: 'COMPLETED',
  locationLabel: 'Surface path',
  mapChunks: ['47,51', '48,51'],
  preferredMethodLabel: 'Reviewed surface method',
  confirmationAllowed: false,
  current: false,
  completionTarget: { kind: 'CHECKPOINT', id: 'surface:checkpoint' },
  reviewedLocation: {
    kind: 'SURFACE',
    label: 'Surface path',
    plane: 0,
    mapChunks: ['47,51', '48,51'],
  },
  unblockActions: [],
  requirementAdvisories: [],
};

const instancePackAction = (
  completionTarget: RuneProofCoachCompletionTarget = { kind: 'ACTION', id: 'pack:guardian' },
  overrides: Partial<RuneProofPackCoachAction> = {},
): RuneProofPackCoachAction => ({
  id: 'pack:guardian',
  instruction: 'Defeat the guardian in its reviewed arena.',
  state: 'BLOCKED',
  locationLabel: 'Guardian arena',
  mapChunks: ['50,50', '51,50'],
  preferredMethodLabel: 'Evidence-backed guardian method',
  blockerText: 'Requires Mining level 99.',
  confirmationAllowed: false,
  current: true,
  completionTarget,
  reviewedLocation: {
    kind: 'INSTANCE',
    label: 'Guardian arena',
    instanceId: 'guardian-arena',
    plane: 1,
    entranceChunks: ['50,50', '51,50'],
    mapChunks: ['50,50', '51,50'],
  },
  unblockActions: ['Raise Mining to 99.'],
  requirementAdvisories: [
    'Transport ferry is one-way from 47,51 to 50,50; review a separate return route.',
  ],
  ...overrides,
});

const emptyProjection = () => ({
  actionIds: [] as string[],
  itemKeys: [] as string[],
  manualIds: [] as string[],
  checkpointIds: [] as string[],
});

const packCoachModel = (
  overrides: Partial<RuneProofPackCoachModel> = {},
): RuneProofPackCoachModel => {
  const doNow = instancePackAction();
  return {
    questId: 'Pack Quest',
    proofState: 'BLOCKED',
    branch: {
      selectedBranchId: 'local',
      recommendedBranchId: 'local',
      recommendationReason: 'The local route keeps reviewed unlock cost lowest.',
      pinned: true,
      options: [
        branchOption('local', { selected: true, recommended: true, pinned: true }),
        branchOption('remote', { state: 'BLOCKED' }),
      ],
    },
    progress: {
      completed: 1,
      total: 2,
      activeConfirmations: emptyProjection(),
      inactiveConfirmations: emptyProjection(),
    },
    doNow,
    actions: [surfacePackAction, doNow],
    initialItems: [initialItemModel({
      quantity: 2,
      evidenceIds: ['review:milk'],
      options: [
        { itemKey: 'bucket of milk', label: 'Bucket of milk', confirmed: false },
        { itemKey: 'milk substitute', label: 'Milk substitute', confirmed: false },
      ],
    })],
    manualConfirmations: [{
      id: 'manual:preflight',
      prompt: 'Confirm the reviewed preflight consequence.',
      scopes: ['PREFLIGHT'],
      evidenceIds: ['review:preflight'],
      confirmed: false,
    }],
    currentCombatCards: [{
      actionId: 'pack:guardian',
      id: 'combat:guardian',
      title: 'Guardian readiness',
      encounterSummary: 'One reviewed guardian encounter.',
      phases: ['Opening'],
      mandatoryMechanics: ['Avoid the marked tile.'],
      recommendedCapabilities: ['A reviewed damage option'],
      recommendedSupplies: ['Food'],
      deathEscapeReentryNotes: ['Escape through the entrance.', 'Re-enter there.'],
      deterministicBlockers: ['Requires Mining level 99.'],
      confirmationId: 'combat:guardian:ready',
      confirmed: false,
    }],
    reviewedAlternatives: [{
      id: 'alternative:tunnel',
      label: 'Reviewed tunnel method',
      state: 'CONFIRM',
      blockerReasons: [],
      unblockActions: [],
      evidenceIds: ['review:tunnel-method'],
      reviewedLocation: {
        kind: 'SURFACE',
        label: 'Tunnel entrance',
        plane: 0,
        mapChunks: ['49,50'],
      },
      manualConfirmations: [{
        id: 'manual:tunnel',
        prompt: 'Confirm the reviewed tunnel timing.',
        scopes: ['ALTERNATIVE'],
        evidenceIds: ['review:tunnel-method'],
        confirmed: false,
      }],
    }],
    alternativeSources: [],
    mainJourneyText: 'Cross the reviewed surface path. Defeat the guardian.',
    proof: {
      sources: branchingPack.sources,
      evidence: branchingPack.evidence,
      diagnostics: ['Maintainer pack diagnostic.'],
    },
    ...overrides,
  };
};

const packCallbacks = () => ({
  onSetCompletion: vi.fn(),
  onSelectBranch: vi.fn(),
  onSetItemConfirmed: vi.fn(),
  onSetManualConfirmed: vi.fn(),
});

describe('RuneProof PACK coach', () => {
  it('renders reviewed pack semantics in order and maps only the instance entrance', async () => {
    const user = userEvent.setup();
    const callbacks = packCallbacks();
    render(<RuneProofCoach variant="PACK" model={packCoachModel()} {...callbacks} />);

    const header = screen.getByRole('heading', { name: 'Pack Quest' });
    expect(screen.getByText('Proof state: Blocked')).toBeTruthy();
    expect(screen.getByText('1/2 complete')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Quest route' })).toBeTruthy();
    expect(screen.getByText('2 × Bucket of milk')).toBeTruthy();
    expect(screen.getByText('Confirm the reviewed preflight consequence.')).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Guardian readiness' })).toBeTruthy();

    const doNowHeading = screen.getByRole('heading', { name: 'Do now' });
    const doNow = doNowHeading.closest('section');
    if (!doNow) throw new Error('Missing Do now section.');
    expect(within(doNow).getByText('Instance: guardian-arena')).toBeTruthy();
    expect(within(doNow).getByText('Entrance chunks: 50,50 · 51,50')).toBeTruthy();
    expect(within(doNow).getByText('Plane: 1')).toBeTruthy();
    expect(within(doNow).getByText('Reviewed method: Evidence-backed guardian method'))
      .toBeTruthy();

    const timeline = screen.getByRole('list', { name: 'Pack Quest route' });
    expect(within(timeline).getByText('Surface chunks: 47,51 · 48,51')).toBeTruthy();
    expect(within(timeline).getByText('Plane: 0')).toBeTruthy();
    const guidance = screen.getByRole('region', { name: 'Current action guidance' });
    expect(within(guidance).getByText('Requires Mining level 99.')).toBeTruthy();
    expect(within(guidance).getByText('Raise Mining to 99.')).toBeTruthy();
    expect(within(guidance).getByText(
      'Transport ferry is one-way from 47,51 to 50,50; review a separate return route.',
    )).toBeTruthy();
    expect(screen.getByText('Reviewed tunnel method')).toBeTruthy();
    expect(screen.getAllByText('Needs confirmation').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/review:tunnel-method/).length).toBeGreaterThan(0);

    const initialItems = screen.getByRole('region', { name: 'Reviewed initial items' });
    const combat = screen.getByRole('article', { name: 'Guardian readiness' });
    const alternative = screen.getByRole('article', { name: 'Reviewed tunnel method' });
    const proof = screen.getByRole('button', { name: 'Proof and sources' });
    expect(header.compareDocumentPosition(initialItems) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(initialItems.compareDocumentPosition(combat) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(combat.compareDocumentPosition(doNow) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(doNow.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(timeline.compareDocumentPosition(guidance) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(guidance.compareDocumentPosition(alternative) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(alternative.compareDocumentPosition(proof) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(within(doNow).getByRole('button', {
      name: 'Show entrance for Defeat the guardian in its reviewed arena. on map',
    }));
    const map = screen.getByRole('dialog', {
      name: 'Temporary map for Entrance for Defeat the guardian in its reviewed arena.',
    });
    expect(within(map).getByText('Chunk 50,50')).toBeTruthy();
    expect(within(map).getByText(
      'Entrance: Guardian arena · Instance: guardian-arena · Plane: 1',
    )).toBeTruthy();
    expect(within(map).getByText(/Instance: guardian-arena/)).toBeTruthy();
    expect(within(map).getByText(/Plane: 1/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pack Quest' })).toBeTruthy();
    expect(within(map).queryByText('Chunk 51,50')).toBeNull();
    expect(within(map).queryByText('Chunk 47,51')).toBeNull();
  });

  it('routes branch, root-item, generic manual, combat, and alternative writes by exact ID', () => {
    const callbacks = packCallbacks();
    render(<RuneProofCoach variant="PACK" model={packCoachModel()} {...callbacks} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use Remote route' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Milk substitute' }));
    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Confirm the reviewed preflight consequence.',
    }));
    fireEvent.click(screen.getByRole('checkbox', {
      name: /I am ready to follow this reviewed guide/i,
    }));
    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Confirm the reviewed tunnel timing.',
    }));

    expect(callbacks.onSelectBranch).toHaveBeenCalledWith('remote');
    expect(callbacks.onSetItemConfirmed).toHaveBeenCalledWith('milk substitute', true);
    expect(callbacks.onSetManualConfirmed.mock.calls).toEqual([
      ['manual:preflight', true],
      ['combat:guardian:ready', true],
      ['manual:tunnel', true],
    ]);
  });

  it('clears a pending branch-focus request when the objective changes', () => {
    const callbacks = packCallbacks();
    const first = packCoachModel();
    const { rerender } = render(
      <RuneProofCoach variant="PACK" model={first} {...callbacks} />,
    );
    const remoteButton = screen.getByRole('button', { name: 'Use Remote route' });
    remoteButton.focus();
    fireEvent.click(remoteButton);

    const second = packCoachModel({
      questId: 'Another Pack Quest',
      branch: {
        ...first.branch,
        selectedBranchId: 'remote',
        options: first.branch.options.map(option => ({
          ...option,
          selected: option.id === 'remote',
        })),
      },
    });
    rerender(<RuneProofCoach variant="PACK" model={second} {...callbacks} />);

    expect(document.activeElement).not.toBe(
      screen.getByRole('article', { name: 'Remote route' }),
    );
  });

  it.each((() => {
    const readyPack = acquiredItemPack();
    const blockedPack = itemQuantityPack({ reviewedQuantity: 2, requiredQuantity: 2 });
    const needsReviewPack = branchNeedsReviewPack(combatPack, 'main');
    return [
      {
        expected: 'READY' as const,
        model: buildRuneProofPackCoachModel({
          pack: readyPack,
          progress: emptyProgressFor(readyPack, 'run-a'),
          requirementSnapshot: readyRequirementSnapshot(),
          completedQuestIds: new Set<string>(),
        }),
      },
      {
        expected: 'CONFIRM' as const,
        model: buildRuneProofPackCoachModel({
          pack: combatPack,
          progress: emptyProgressFor(combatPack, 'run-a'),
          requirementSnapshot: readyRequirementSnapshot(),
          completedQuestIds: new Set<string>(),
        }),
      },
      {
        expected: 'BLOCKED' as const,
        model: buildRuneProofPackCoachModel({
          pack: blockedPack,
          progress: emptyProgressFor(blockedPack, 'run-a'),
          requirementSnapshot: readyRequirementSnapshot(),
          completedQuestIds: new Set<string>(),
        }),
      },
      {
        expected: 'NEEDS_REVIEW' as const,
        model: buildRuneProofPackCoachModel({
          pack: needsReviewPack,
          progress: emptyProgressFor(needsReviewPack, 'run-a'),
          requirementSnapshot: readyRequirementSnapshot(),
          completedQuestIds: new Set<string>(),
        }),
      },
      {
        expected: 'COMPLETE' as const,
        model: buildRuneProofPackCoachModel({
          pack: readyPack,
          progress: fullyConfirmedProgress(readyPack, 'main'),
          requirementSnapshot: readyRequirementSnapshot(),
          completedQuestIds: new Set<string>(),
        }),
      },
    ];
  })())('keeps the single-branch $expected golden view free of a selector', ({ expected, model }) => {
    expect(model.proofState).toBe(expected);
    expect(model.branch.options).toHaveLength(1);
    render(<RuneProofCoach variant="PACK" model={model} {...packCallbacks()} />);
    expect(screen.queryByRole('group', { name: 'Quest route' })).toBeNull();
  });

  it.each([
    { kind: 'ACTION', id: 'target:id' },
    { kind: 'ITEM', id: 'target:id' },
    { kind: 'MANUAL', id: 'target:id' },
    { kind: 'CHECKPOINT', id: 'target:id' },
  ] as const)('writes and controls the exact $kind completion target', (target) => {
    const action = instancePackAction(target, {
      state: 'DO_NOW',
      blockerText: undefined,
      confirmationAllowed: true,
      unblockActions: [],
      requirementAdvisories: [],
    });
    const callbacks = packCallbacks();
    const base = packCoachModel({ doNow: action, actions: [action] });
    const wrongNamespace = emptyProjection();
    const wrongKey = target.kind === 'ACTION' ? 'itemKeys'
      : target.kind === 'ITEM' ? 'manualIds'
        : target.kind === 'MANUAL' ? 'checkpointIds'
          : 'actionIds';
    wrongNamespace[wrongKey].push(target.id);
    const { rerender } = render(
      <RuneProofCoach
        variant="PACK"
        model={{
          ...base,
          progress: { ...base.progress, activeConfirmations: wrongNamespace },
        }}
        {...callbacks}
      />,
    );
    const completion = screen.getByRole('checkbox', {
      name: 'Confirm Defeat the guardian in its reviewed arena.',
    }) as HTMLInputElement;
    expect(completion.checked).toBe(false);
    fireEvent.click(completion);
    fireEvent.click(completion);
    expect(callbacks.onSetCompletion.mock.calls).toEqual([
      [target, true],
      [target, true],
    ]);

    const active = emptyProjection();
    const exactKey = target.kind === 'ACTION' ? 'actionIds'
      : target.kind === 'ITEM' ? 'itemKeys'
        : target.kind === 'MANUAL' ? 'manualIds'
          : 'checkpointIds';
    active[exactKey].push(target.id);
    const confirmed = packCoachModel({
      doNow: action,
      actions: [action],
      progress: { ...base.progress, activeConfirmations: active },
    });
    rerender(<RuneProofCoach variant="PACK" model={confirmed} {...callbacks} />);
    const persisted = screen.getByRole('checkbox', {
      name: 'Confirm Defeat the guardian in its reviewed arena.',
    }) as HTMLInputElement;
    expect(persisted.checked).toBe(true);
    fireEvent.click(persisted);
    expect(callbacks.onSetCompletion).toHaveBeenLastCalledWith(target, false);
  });
});
