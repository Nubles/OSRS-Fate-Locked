// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reviewedQuestRequirements } from '../../data/questItemRequirements';
import { questWalkthroughFor } from '../../data/questWalkthroughs';
import type {
  EvaluatedWalkthroughAction,
  QuestWalkthroughAnalysis,
  QuestWalkthroughDefinition,
} from '../../utils/questWalkthroughs/model';
import { evaluateQuestWalkthrough } from '../../utils/questWalkthroughs/evaluator';
import { resolveQuestWalkthroughLocations } from '../../utils/questWalkthroughs/locationResolver';
import type {
  QuestRouteAnalysis,
  QuestRouteAnalysisSnapshot,
} from '../../utils/questRoutes/analyzeQuest';
import type { ItemRoute, QuestItemRequirement } from '../../utils/questRoutes/model';
import { presentQuestAnalysis } from '../../utils/questRoutes/presenter';
import {
  buildQuestRequirementChecklist,
  type QuestRequirementChecklistRow,
} from '../../utils/questRoutes/requirementChecklist';
import { QuestRoutePanel } from './QuestRoutePanel';

const requirement = (
  name: string,
  quantity = 1,
  supplyPolicy: QuestItemRequirement['supplyPolicy'] = 'PLAYER_OBTAINED',
): QuestItemRequirement => ({
  item: { key: name.toLocaleLowerCase('en-GB').replace(/\s+/g, '-'), name },
  quantity,
  supplyPolicy,
});

const route = (
  id: string,
  sourceLabel: string,
  overrides: Partial<ItemRoute> = {},
): ItemRoute => ({
  id,
  item: { key: 'egg', name: 'Egg' },
  outputQuantity: 1,
  sourceKind: 'SPAWN',
  sourceLabel,
  chunks: ['19,57'],
  steps: [{ id: `${id}:source`, label: sourceLabel, chunk: '19,57', gates: [], quantity: 1, requiresChunkUnlock: false, hasDataGap: false }],
  blockers: [],
  deterministic: true,
  recursiveCost: 0,
  consumedIngredientCost: 0,
  skillUnlockCost: 0,
  skillLevelCost: 0,
  travelCost: 0,
  hasDataGap: false,
  ...overrides,
});

const evaluatedAction = (
  definition: QuestWalkthroughDefinition['actions'][number],
  overrides: Partial<EvaluatedWalkthroughAction> = {},
): EvaluatedWalkthroughAction => {
  const authoritative = definition.confidence === 'EXACT' || definition.confidence === 'REVIEWED';
  const sourceEntity = definition.entities[0];
  return {
    definition,
    location: {
      confidence: authoritative ? definition.confidence : 'UNMAPPED',
      evidenceKind: authoritative ? 'EXACT_ENTITY' : 'NONE',
      chunks: authoritative ? ['50,50'] : [],
      candidateChunks: authoritative ? [] : ['42,50'],
      explanation: authoritative
        ? 'The reviewed fixture resolves this action exactly.'
        : 'This fixture deliberately leaves the action unresolved.',
      sourceEntity,
    },
    state: definition.kind === 'INFORMATION'
      ? 'INFORMATION'
      : authoritative
        ? 'READY_HERE'
        : 'LOCATION_NEEDS_REVIEW',
    blockers: [],
    itemPreparation: definition.items
      .filter(item => item.supplyPolicy === 'PLAYER_OBTAINED')
      .map(item => ({
        itemKey: item.item.key,
        analysisState: 'OBTAINABLE_NOW',
        obtainableNow: true,
      })),
    ...overrides,
  };
};

const walkthroughAnalysisFor = (questId: string): QuestWalkthroughAnalysis => {
  const definition = questWalkthroughFor(questId);
  if (!definition) throw new Error(`Missing fixture for ${questId}`);
  const actions = definition.actions.map(candidate => evaluatedAction(candidate));
  return {
    questId,
    releaseStatus: definition.releaseStatus,
    status: actions.some(candidate => candidate.state === 'LOCATION_NEEDS_REVIEW')
      ? 'INCOMPLETE'
      : 'READY',
    actions,
    blockers: [],
    hasIncompleteEvidence: actions.some(candidate => candidate.state === 'LOCATION_NEEDS_REVIEW'),
    sourceLines: definition.sourceLines,
    source: definition.source,
  };
};

const mixedAnalysis: QuestRouteAnalysis = {
  questId: "Cook's Assistant",
  status: 'CANNOT_COMPLETE_YET',
  items: [
    {
      requirement: requirement('Egg', 2),
      state: 'OBTAINABLE_NOW',
      currentRoutes: [
        route('coop', 'Lumbridge chicken coop', {
          steps: [
            { id: 'coop:source', label: 'Lumbridge chicken coop', chunk: '19,57', gates: [], quantity: 2, requiresChunkUnlock: false, hasDataGap: false },
            { id: 'coop:return', label: 'Return to the castle kitchen', chunk: '20,57', gates: [], requiresChunkUnlock: false, hasDataGap: false },
          ],
          travelCost: 1,
          travelCostEstimated: true,
        }),
        route('farmer', 'Fred the Farmer', {
          chunks: ['21,57'],
          steps: [{ id: 'farmer:source', label: 'Fred the Farmer', chunk: '21,57', gates: [], requiresChunkUnlock: false, hasDataGap: false }],
        }),
      ],
      missingChunkRoutes: [],
      missingChunkOptions: [{ chunks: ['21,57'], routeIds: ['farmer'], remainingGates: [] }],
      dataNotes: [],
    },
    {
      requirement: requirement('Bucket of milk'),
      state: 'ROUTE_BLOCKED',
      currentRoutes: [route('dairy', 'Lumbridge dairy cow', {
        chunks: ['19,58'],
        steps: [{
          id: 'dairy:source',
          label: 'Lumbridge dairy cow',
          chunk: '19,58',
          gates: [],
          quantity: 1,
          requiresChunkUnlock: false,
          hasDataGap: false,
          blockers: [
            { type: 'SKILL', skill: 'Cooking', level: 25, label: '25 Cooking' },
            { type: 'QUEST', questId: 'priest-in-peril', label: 'Priest in Peril' },
            { type: 'UNLOCK', category: 'merchants', id: 'dairy-access', label: 'Dairy access' },
            { type: 'UNRESOLVED', label: 'Access to the dairy pen', raw: 'internal raw gate' },
          ],
        }],
        blockers: [
          { type: 'SKILL', skill: 'Cooking', level: 25, label: '25 Cooking' },
          { type: 'QUEST', questId: 'priest-in-peril', label: 'Priest in Peril' },
          { type: 'UNLOCK', category: 'merchants', id: 'dairy-access', label: 'Dairy access' },
          { type: 'UNRESOLVED', label: 'Access to the dairy pen', raw: 'internal raw gate' },
        ],
      })],
      missingChunkRoutes: [],
      missingChunkOptions: [],
      dataNotes: [],
    },
    {
      requirement: requirement('Pot of flour'),
      state: 'NO_CURRENT_SOURCE',
      currentRoutes: [],
      missingChunkRoutes: [route('mill', 'Mill Lane Mill', {
        chunks: ['21,48'],
        steps: [{ id: 'mill:source', label: 'Mill Lane Mill', chunk: '21,48', gates: [], requiresChunkUnlock: true, hasDataGap: false }],
      })],
      missingChunkOptions: [{
        chunks: ['21,48'],
        routeIds: ['mill'],
        remainingGates: [{ type: 'QUEST', questId: 'restless-ghost', label: 'The Restless Ghost' }],
      }],
      dataNotes: [],
    },
    {
      requirement: requirement('Bowl of hot water'),
      state: 'DATA_INCOMPLETE',
      currentRoutes: [route('range', 'Castle kitchen range', {
        chunks: ['20,48'],
        steps: [{ id: 'range:source', label: 'Castle kitchen range', chunk: '20,48', gates: [], requiresChunkUnlock: false, hasDataGap: true }],
        hasDataGap: true,
      })],
      missingChunkRoutes: [],
      missingChunkOptions: [],
      dataNotes: ['Range access evidence has not been reviewed.'],
    },
    {
      requirement: requirement('Empty pot', 1, 'QUEST_PROVIDED'),
      state: 'OBTAINABLE_NOW',
      currentRoutes: [],
      missingChunkRoutes: [],
      missingChunkOptions: [],
      dataNotes: [],
    },
  ],
  walkthrough: walkthroughAnalysisFor("Cook's Assistant"),
  generatedFrom: {
    chunkDataVersion: 17,
    questRevision: '15240921',
    accountFingerprint: 'account',
    walkthroughRevision: questWalkthroughFor("Cook's Assistant")!.revision,
  },
};

const panelProps = (analysis: QuestRouteAnalysis) => ({
  questId: analysis.questId,
  analysis,
  checklistRows: [] as readonly QuestRequirementChecklistRow[],
  confirmedItemKeys: new Set<string>(),
  onSetItemConfirmed: () => undefined,
});

const renderPanel = (): string => renderToStaticMarkup(
  <QuestRoutePanel {...panelProps(mixedAnalysis)} />,
);

const ChecklistHarness = ({
  analysis = mixedAnalysis,
}: {
  analysis?: QuestRouteAnalysis | null;
}) => {
  const [confirmed, setConfirmed] = React.useState<Set<string>>(new Set());
  const rows = buildQuestRequirementChecklist(
    {
      targetKind: 'quest',
      targetId: "Cook's Assistant",
      targetLabel: "Cook's Assistant",
      alreadyReachable: false,
      alreadyDone: false,
      needsConfirmation: false,
      manualSteps: [],
      questSteps: [],
      regionSteps: [],
      skillSteps: [],
      alternativeSteps: [],
      steps: [],
      remaining: 0,
    },
    reviewedQuestRequirements("Cook's Assistant")!,
    confirmed,
  );
  return (
    <QuestRoutePanel
      questId="Cook's Assistant"
      analysis={analysis}
      checklistRows={rows}
      confirmedItemKeys={confirmed}
      onSetItemConfirmed={(_questId, itemKey, checked) => {
        setConfirmed(current => {
          const next = new Set(current);
          if (checked) next.add(itemKey);
          else next.delete(itemKey);
          return next;
        });
      }}
    />
  );
};

const statusChecklistRows = (automaticChecked: boolean): QuestRequirementChecklistRow[] => [{
  id: 'skill:Cooking',
  label: 'Cooking',
  detail: 'Level 1',
  statusText: 'Met automatically',
  mode: 'ACCOUNT',
  checked: automaticChecked,
  disabled: true,
}, ...mixedAnalysis.items
  .filter(item => item.requirement.supplyPolicy === 'PLAYER_OBTAINED')
  .map(item => ({
    id: `item:${item.requirement.item.key}`,
    label: `${item.requirement.quantity} ${item.requirement.item.name}`,
    statusText: 'Confirm possession',
    mode: 'MANUAL_ITEM' as const,
    checked: true,
    disabled: false,
    itemKey: item.requirement.item.key,
  }))];

const requirementCard = (name: string | RegExp): HTMLElement => {
  const heading = screen.getByRole('heading', { level: 3, name });
  const card = heading.closest('article');
  if (!card) throw new Error(`Missing requirement card for ${name}`);
  return card;
};

const withSingleChunk = (
  item: QuestRouteAnalysis['items'][number],
  chunk: `${number},${number}`,
): QuestRouteAnalysis['items'][number] => ({
  ...item,
  currentRoutes: item.currentRoutes.map((itemRoute, routeIndex) => ({
    ...itemRoute,
    chunks: [chunk],
    steps: itemRoute.steps.map((step, stepIndex) => ({
      ...step,
      id: `${itemRoute.id}:${routeIndex}:${stepIndex}:${chunk}`,
      chunk,
    })),
  })),
  missingChunkRoutes: item.missingChunkRoutes.map((itemRoute, routeIndex) => ({
    ...itemRoute,
    chunks: [chunk],
    steps: itemRoute.steps.map((step, stepIndex) => ({
      ...step,
      id: `${itemRoute.id}:missing:${routeIndex}:${stepIndex}:${chunk}`,
      chunk,
    })),
  })),
});

const withWalkthroughLocations = (
  analysis: QuestRouteAnalysis,
  mode: 'READY' | 'UNMAPPED',
  questId = analysis.questId,
): QuestRouteAnalysis => ({
  ...analysis,
  questId,
  status: mode === 'READY' ? 'READY_NOW' : 'ANALYSIS_INCOMPLETE',
  walkthrough: {
    ...analysis.walkthrough,
    questId,
    status: mode === 'READY' ? 'READY' : 'INCOMPLETE',
    blockers: [],
    hasIncompleteEvidence: mode === 'UNMAPPED',
    actions: analysis.walkthrough.actions.map(action => ({
      ...action,
      state: action.definition.kind === 'INFORMATION'
        ? 'INFORMATION'
        : mode === 'READY'
          ? 'READY_HERE'
          : 'LOCATION_NEEDS_REVIEW',
      location: {
        ...action.location,
        confidence: mode === 'READY' ? 'EXACT' : 'UNMAPPED',
        evidenceKind: mode === 'READY' ? 'EXPLICIT_CHUNK' : 'NONE',
        chunks: mode === 'READY' ? ['50,50'] : [],
        candidateChunks: [],
        explanation: mode === 'READY'
          ? 'Exact fixture location.'
          : 'Fixture location intentionally outside the supported map.',
      },
    })),
  },
});

const evaluatedCookAnalysisWithMissingItems = (
  missingItemKeys: readonly string[] = ['egg'],
): QuestRouteAnalysis => {
  const definition = questWalkthroughFor("Cook's Assistant");
  if (!definition) throw new Error("Missing Cook's Assistant fixture");
  const readyItems: QuestRouteAnalysis['items'] = [
    {
      ...mixedAnalysis.items[0],
      missingChunkRoutes: [],
      missingChunkOptions: [],
    },
    {
      ...mixedAnalysis.items[1],
      requirement: { ...mixedAnalysis.items[1].requirement, item: { key: 'bucket of milk', name: 'Bucket of milk' } },
      state: 'OBTAINABLE_NOW',
      currentRoutes: [route('dairy-ready', 'Lumbridge dairy cow')],
      missingChunkRoutes: [],
      missingChunkOptions: [],
    },
    {
      ...mixedAnalysis.items[2],
      requirement: { ...mixedAnalysis.items[2].requirement, item: { key: 'pot of flour', name: 'Pot of flour' } },
      state: 'OBTAINABLE_NOW',
      currentRoutes: [route('mill-ready', 'Mill Lane Mill')],
      missingChunkRoutes: [],
      missingChunkOptions: [],
    },
  ];
  const missingItems = new Set(missingItemKeys);
  const items: QuestRouteAnalysis['items'] = readyItems.map(item => (
    missingItems.has(item.requirement.item.key)
      ? {
          ...item,
          state: 'NO_CURRENT_SOURCE',
          currentRoutes: [],
          missingChunkRoutes: [],
          missingChunkOptions: [],
        }
      : item
  ));
  const snapshot: QuestRouteAnalysisSnapshot = {
    chunkDataVersion: 17,
    unlockedChunks: ['50,50'],
    unlocks: {
      skills: {},
      levels: {},
      regions: [],
      chunks: [],
      quests: [],
      guilds: [],
      merchants: [],
      minigames: [],
      mobility: [],
      slayerUnlocks: [],
    },
    itemSourceRecords: [],
    recipes: [],
    entityLocations: [{
      name: 'Cook (Lumbridge)',
      kind: 'npc',
      locations: [{ cx: 50, cy: 50 }],
    }],
    stationRequirements: [],
    sourceCoverage: [],
    connectGraph: {},
  };
  const walkthrough = evaluateQuestWalkthrough(
    resolveQuestWalkthroughLocations(definition, snapshot),
    snapshot,
    items,
  );
  return {
    ...mixedAnalysis,
    status: 'CANNOT_COMPLETE_YET',
    items,
    walkthrough,
  };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('QuestRoutePanel', () => {
  it('renders one quest-level map above every item card', () => {
    const markup = renderPanel();

    expect((markup.match(/data-runeproof-route-map=/g) ?? [])).toHaveLength(1);
    expect(markup.indexOf('data-runeproof-route-map'))
      .toBeLessThan(markup.indexOf('data-runeproof-requirement'));
  });

  it('keeps a checked requirement above the map while removing and restoring its route card', async () => {
    render(<ChecklistHarness />);
    const checklist = screen.getByRole('region', { name: 'Quest requirements' });
    const map = screen.getByRole('region', { name: "Cook's Assistant main path map" });
    const egg = within(checklist).getByRole('checkbox', { name: '1 Egg' });
    expect(checklist.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: '2 × Egg' })).toBeTruthy();

    await userEvent.click(egg);
    expect((egg as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('heading', { level: 3, name: '2 × Egg' })).toBeNull();

    await userEvent.click(egg);
    expect(screen.getByRole('heading', { level: 3, name: '2 × Egg' })).toBeTruthy();
  });

  it('renders the checklist and localized unavailable message without route analysis', () => {
    render(<ChecklistHarness analysis={null} />);
    expect(screen.getByRole('region', { name: 'Quest requirements' })).toBeTruthy();
    expect(screen.getByText('Analysis unavailable')).toBeTruthy();
  });

  it('reports confirmed items without claiming unmet automatic requirements are ready', () => {
    const checklistRows = statusChecklistRows(false);
    const confirmedItemKeys = new Set(checklistRows.flatMap(row => row.itemKey ? [row.itemKey] : []));
    const readyAnalysis = withWalkthroughLocations(mixedAnalysis, 'READY');

    render(
      <QuestRoutePanel
        {...panelProps(readyAnalysis)}
        checklistRows={checklistRows}
        confirmedItemKeys={confirmedItemKeys}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Required items confirmed' })).toBeTruthy();
  });

  it('reports the quest ready when every checklist requirement is met', () => {
    const checklistRows = statusChecklistRows(true);
    const confirmedItemKeys = new Set(checklistRows.flatMap(row => row.itemKey ? [row.itemKey] : []));
    const readyAnalysis = withWalkthroughLocations(mixedAnalysis, 'READY');

    render(
      <QuestRoutePanel
        {...panelProps(readyAnalysis)}
        checklistRows={checklistRows}
        confirmedItemKeys={confirmedItemKeys}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Quest requirements ready' })).toBeTruthy();
  });

  it('keeps a shared map chunk until every item using it is confirmed', async () => {
    const sharedChunkAnalysis: QuestRouteAnalysis = {
      ...mixedAnalysis,
      items: [
        withSingleChunk({
          ...mixedAnalysis.items[0],
          requirement: requirement('Egg'),
        }, '19,57'),
        withSingleChunk({
          ...mixedAnalysis.items[1],
          requirement: {
            ...mixedAnalysis.items[1].requirement,
            item: { key: 'bucket of milk', name: 'Bucket of milk' },
          },
        }, '19,57'),
      ],
    };
    render(<ChecklistHarness analysis={sharedChunkAnalysis} />);
    const checklist = screen.getByRole('region', { name: 'Quest requirements' });

    await userEvent.click(within(checklist).getByRole('checkbox', { name: '1 Egg' }));
    expect(screen.getByRole('region', { name: "Cook's Assistant main path map" })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: '1 × Bucket of milk' })).toBeTruthy();

    await userEvent.click(within(checklist).getByRole('checkbox', { name: /1 Bucket of milk/ }));
    expect(screen.getByRole('region', { name: "Cook's Assistant main path map" })).toBeTruthy();
    expect(screen.getByText('All required items confirmed — no item routes remain.')).toBeTruthy();
  });

  it('keeps chunk evidence internal instead of repeating coordinates in route prose', () => {
    const coordinateAnalysis: QuestRouteAnalysis = {
      ...mixedAnalysis,
      items: [{
        ...mixedAnalysis.items[0],
        requirement: requirement('Egg'),
        currentRoutes: [route('egg-coordinate', 'Chicken coop')],
        missingChunkRoutes: [],
      }],
    };

    render(<QuestRoutePanel {...panelProps(coordinateAnalysis)} />);

    expect(screen.queryByText('Chunk 19,57')).toBeNull();
    expect(screen.queryByText('· 19,57')).toBeNull();
    expect(requirementCard('1 × Egg').textContent).not.toContain('19,57');
    expect(requirementCard(/1 .* Egg/).textContent).toContain('Egg');
    expect(within(requirementCard(/1 .* Egg/)).getByText('1 needed')).toBeTruthy();
    expect(presentQuestAnalysis(coordinateAnalysis).items[0].routes[0].steps[0].chunk)
      .toBe('19,57');
  });

  it('renders usable, blocked, missing-chunk, and incomplete items together', () => {
    const markup = renderPanel();

    expect(markup).toContain('Obtainable now');
    expect(markup).toContain('Route exists — requirement missing');
    expect(markup).toContain('No source in current chunks');
    expect(markup).toContain('Route data incomplete');
    expect(markup.match(/data-runeproof-requirement=/g)).toHaveLength(4);
  });

  it('does not repeat missing chunk options in requirement cards', () => {
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);

    expect(screen.queryByText('Missing chunk unlocks')).toBeNull();
    expect(screen.queryByText('Unlock chunk 21,48 to gain a known route.')).toBeNull();
    expect(presentQuestAnalysis(mixedAnalysis).items[2].missingChunkOptions).toHaveLength(1);
  });

  it('offers map actions only for requirements with supported map geometry', () => {
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);

    expect(screen.getByRole('button', { name: 'Show Egg on map' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show Empty pot on map' })).toBeNull();
  });

  it('forwards the selected map chunk without substituting an item location', async () => {
    const user = userEvent.setup();
    const onOpenWorldChunk = vi.fn();
    render(
      <QuestRoutePanel
        {...panelProps(mixedAnalysis)}
        onOpenWorldChunk={onOpenWorldChunk}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Preparation' }));
    await user.click(screen.getByRole('button', { name: /Route chunk 21,48/ }));
    await user.click(screen.getByRole('button', {
      name: 'Open chunk 21,48 on world map',
    }));

    expect(onOpenWorldChunk).toHaveBeenCalledWith(21, 48);
  });
  it('moves the map tray to the requested requirement', async () => {
    const user = userEvent.setup();
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);

    expect(screen.getByRole('button', { name: 'Quest path' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Show Egg on map' }));

    const tray = screen.getByRole('region', { name: 'Selected route chunk details' });
    expect(within(tray).getByText('Egg')).toBeTruthy();
    expect(within(tray).queryByText('Bucket of milk')).toBeNull();
  });

  it('moves Show on map focus to the selected state-labelled marker', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);

    await user.click(screen.getByRole('button', { name: 'Show Egg on map' }));

    const marker = screen.getByRole('button', {
      name: /Route chunk 19,57.*Usable now/,
    });
    const tray = screen.getByRole('region', { name: 'Selected route chunk details' });
    expect(document.activeElement).toBe(marker);
    expect(marker.getAttribute('aria-controls')).toBe(tray.id);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });
  it('scrolls smoothly to and focuses the stable requirement anchor from the map', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);
    await user.click(screen.getByRole('button', { name: 'Show Egg on map' }));
    const heading = screen.getByRole('heading', { level: 3, name: '2 × Egg' });
    const focus = vi.spyOn(heading, 'focus');

    await user.click(screen.getByRole('button', { name: 'View requirement for Egg' }));

    expect(heading.id).toBe('runeproof-item-1-egg');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('uses immediate requirement scrolling when reduced motion is requested', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);
    await user.click(screen.getByRole('button', { name: 'Show Egg on map' }));

    await user.click(screen.getByRole('button', { name: 'View requirement for Egg' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });

  it('clears an old focus request when a new quest remounts the map', async () => {
    const user = userEvent.setup();
    const view = render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);
    await user.click(screen.getByRole('button', { name: 'Show Egg on map' }));
    expect(within(screen.getByRole('region', { name: 'Selected route chunk details' }))
      .getByText('Egg')).toBeTruthy();

    const unsupportedAnalysis = withWalkthroughLocations({
      ...mixedAnalysis,
      items: [
        withSingleChunk(mixedAnalysis.items[0], '14,32'),
        withSingleChunk(mixedAnalysis.items[1], '63,65'),
      ],
    }, 'UNMAPPED', 'No Supported Map Quest');
    view.rerender(<QuestRoutePanel {...panelProps(unsupportedAnalysis)} />);
    expect(screen.queryByRole('region', { name: 'No Supported Map Quest main path map' }))
      .toBeNull();

    view.rerender(
      <QuestRoutePanel {...panelProps({ ...mixedAnalysis, questId: 'Recipe for Disaster' })} />,
    );
    await user.click(screen.getByRole('button', { name: 'Preparation' }));
    const remountedTray = screen.getByRole('region', { name: 'Selected route chunk details' });

    expect(within(remountedTray).getByText('Bucket of milk')).toBeTruthy();
    expect(within(remountedTray).queryByText('Egg')).toBeNull();
  });

  it('keeps the best route open and makes every other known route available', () => {
    const markup = renderPanel();

    expect(markup).toContain('aria-label="Best route for Egg"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('Lumbridge chicken coop');
    expect(markup).toContain('aria-label="Other known routes for Egg"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Fred the Farmer');
  });

  it('renders exact source evidence, named blocker categories, and travel estimates', () => {
    const markup = renderPanel();

    expect(markup).toContain('Lumbridge chicken coop');
    expect(markup).toContain('Travel: 1 chunk (geometric estimate)');
    expect(markup).toContain('Skill: 25 Cooking');
    expect(markup).toContain('Quest: Priest in Peril');
    expect(markup).toContain('Unlock: Dairy access');
    expect(markup).toContain('Access / station: Access to the dairy pen');
    expect(markup).not.toContain('priest-in-peril');
    expect(markup).not.toContain('internal raw gate');
  });

  it('uses logical headings, native controls, and no nested modal semantics', () => {
    const markup = renderPanel();

    expect(markup).toMatch(/<h2[^>]*>.*Cannot complete yet.*<\/h2>/);
    expect(markup).toMatch(/<h3[^>]*>.*2 × Egg.*<\/h3>/);
    expect(markup).toContain('id="runeproof-item-1-egg"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('<h4');
    expect(markup).toContain('<button');
    expect(markup).toContain('aria-controls=');
    expect(markup).not.toContain('role="dialog"');
    expect(markup).not.toContain('aria-modal=');
  });

  it('keeps incomplete notes beside only the affected requirement and route', () => {
    const markup = renderPanel();
    const incompleteStart = markup.indexOf('runeproof-item-4-bowl-of-hot-water');
    const nextRequirement = markup.indexOf('runeproof-item-5-empty-pot');
    const incompleteCard = markup.slice(incompleteStart, nextRequirement);
    const precedingMarkup = markup.slice(0, incompleteStart);

    expect(incompleteCard).toContain('Range access evidence has not been reviewed.');
    expect(incompleteCard).toContain('Route data incomplete for this route.');
    expect(precedingMarkup).not.toContain('Range access evidence has not been reviewed.');
  });

  it('keeps unsupported-map notes on only affected items while valid siblings map', () => {
    const analysis: QuestRouteAnalysis = {
      ...mixedAnalysis,
      items: [
        mixedAnalysis.items[0],
        withSingleChunk(mixedAnalysis.items[1], '63,65'),
        {
          requirement: requirement('Unlocated salt'),
          state: 'NO_CURRENT_SOURCE',
          currentRoutes: [],
          missingChunkRoutes: [],
          missingChunkOptions: [],
          dataNotes: ['No reviewed location evidence.'],
        },
      ],
    };
    render(<QuestRoutePanel {...panelProps(analysis)} />);
    const note = 'This route location is outside the supported map image.';

    expect(screen.getByRole('region', { name: "Cook's Assistant main path map" })).toBeTruthy();
    expect(within(requirementCard('1 × Bucket of milk')).getByText(note)).toBeTruthy();
    expect(within(requirementCard('2 × Egg')).queryByText(note)).toBeNull();
    expect(within(requirementCard('1 × Unlocated salt')).queryByText(note)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show Bucket of milk on map' })).toBeNull();
  });

  it('omits an all-invalid map while retaining exact item-local failure notes', () => {
    const analysis = withWalkthroughLocations({
      ...mixedAnalysis,
      items: [
        withSingleChunk(mixedAnalysis.items[0], '14,32'),
        withSingleChunk(mixedAnalysis.items[1], '63,65'),
        {
          requirement: requirement('Unlocated salt'),
          state: 'NO_CURRENT_SOURCE',
          currentRoutes: [],
          missingChunkRoutes: [],
          missingChunkOptions: [],
          dataNotes: [],
        },
      ],
    }, 'UNMAPPED');
    render(<QuestRoutePanel {...panelProps(analysis)} />);
    const note = 'This route location is outside the supported map image.';

    expect(screen.queryByRole('region', { name: "Cook's Assistant main path map" })).toBeNull();
    expect(screen.getAllByText(note)).toHaveLength(2);
    expect(within(requirementCard('2 × Egg')).getByText(note)).toBeTruthy();
    expect(within(requirementCard('1 × Bucket of milk')).getByText(note)).toBeTruthy();
    expect(within(requirementCard('1 × Unlocated salt')).queryByText(note)).toBeNull();
  });

  it('orders the header, checklist, layered map, walkthrough, and item cards', () => {
    const { container } = render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);
    const header = container.querySelector('header');
    const checklist = screen.getByRole('region', { name: 'Quest requirements' });
    const map = container.querySelector('[data-runeproof-route-map]');
    const walkthrough = screen.getByRole('region', { name: 'Quest walkthrough' });
    const itemCard = container.querySelector('[data-runeproof-requirement]');
    if (!header || !map || !itemCard) throw new Error('Missing integrated panel section');

    expect(header.compareDocumentPosition(checklist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(checklist.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(map.compareDocumentPosition(walkthrough) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(walkthrough.compareDocumentPosition(itemCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quest path' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the established preparation map when the walkthrough is withheld', () => {
    render(
      <QuestRoutePanel
        {...panelProps(mixedAnalysis)}
        walkthroughVisible={false}
        walkthroughNotice="Private walkthrough withheld."
      />,
    );

    expect(screen.queryByRole('region', { name: 'Quest walkthrough' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quest path' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Preparation' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: "Cook's Assistant main path map" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show Egg on map' })).toBeTruthy();
    expect(screen.getByText('Private walkthrough withheld.')).toBeTruthy();
  });

  it('uses one generic focus request for walkthrough actions and item routes', async () => {
    const user = userEvent.setup();
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);
    const start = questWalkthroughFor("Cook's Assistant")!.actions
      .find(action => action.id === 'cooks-assistant:start-quest')!;

    await user.click(screen.getByRole('button', { name: `Show ${start.displayText} on map` }));
    expect(screen.getByRole('button', { name: 'Quest path' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Quest path chunk 50,50/ }));

    await user.click(screen.getByRole('button', { name: 'Show Egg on map' }));
    expect(screen.getByRole('button', { name: 'Preparation' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(screen.getByRole('region', { name: 'Selected route chunk details' }))
      .getByText('Egg')).toBeTruthy();
  });

  it('returns a map tray action to its exact walkthrough row', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);
    const action = questWalkthroughFor("Cook's Assistant")!.actions
      .find(candidate => candidate.id === 'cooks-assistant:start-quest')!;
    const row = document.getElementById(action.id);
    if (!row) throw new Error('Missing action row');
    const focus = vi.spyOn(row, 'focus');

    await user.click(screen.getByRole('button', {
      name: `View quest step ${action.sourceOrder}: ${action.displayText}`,
    }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('confirmation re-presents a real evaluated pilot and clears item-derived blockers only', async () => {
    const user = userEvent.setup();
    render(<ChecklistHarness analysis={evaluatedCookAnalysisWithMissingItems()} />);
    const checklist = screen.getByRole('region', { name: 'Quest requirements' });
    const eggAction = questWalkthroughFor("Cook's Assistant")!.actions
      .find(action => action.id === 'cooks-assistant:take-egg')!;
    const returnAction = questWalkthroughFor("Cook's Assistant")!.actions
      .find(action => action.id === 'cooks-assistant:return-to-cook')!;
    const completeAction = questWalkthroughFor("Cook's Assistant")!.actions
      .find(action => action.id === 'cooks-assistant:complete')!;
    const actionRow = document.getElementById(eggAction.id);
    const returnRow = document.getElementById(returnAction.id);
    const completeRow = document.getElementById(completeAction.id);
    if (!actionRow || !returnRow || !completeRow) throw new Error('Missing Cook action');
    expect(eggAction.displayText).toBe('Pick up the egg at the chicken farm beside the cow field.');
    expect(screen.getByRole('heading', { level: 2, name: 'Cannot complete yet' })).toBeTruthy();
    expect(screen.getByText('2 known blockers')).toBeTruthy();
    expect(within(actionRow).getByText('Chunk locked')).toBeTruthy();
    expect(within(actionRow).getAllByText(eggAction.displayText)).toHaveLength(2);
    expect(within(actionRow).getByText(/Location evidence: reviewed alias/)).toBeTruthy();
    expect(within(returnRow).getByText('Requirement missing')).toBeTruthy();
    expect(within(returnRow).getByText(eggAction.displayText)).toBeTruthy();
    expect(within(completeRow).getByText('Requirement missing')).toBeTruthy();
    expect(within(completeRow).getByText(returnAction.displayText)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Preparation' }));
    expect(screen.getByRole('button', { name: /Route chunk 19,57/ })).toBeTruthy();
    await user.click(within(checklist).getByRole('checkbox', { name: '1 Egg' }));

    expect((within(checklist).getByRole('checkbox', { name: '1 Egg' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('heading', { level: 3, name: /2 .* Egg/ })).toBeNull();
    const preparationTray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    expect(within(preparationTray).queryByText('Egg')).toBeNull();
    expect(within(preparationTray).getByText('Bucket of milk')).toBeTruthy();
    expect(within(preparationTray).getByText('Pot of flour')).toBeTruthy();
    expect(document.getElementById(eggAction.id)).toBeTruthy();
    expect(within(document.getElementById(eggAction.id)!).getByText('Chunk locked')).toBeTruthy();
    expect(within(document.getElementById(eggAction.id)!).getByText(/Location evidence: reviewed alias/)).toBeTruthy();
    expect(within(document.getElementById(eggAction.id)!).queryByText('Requirement missing')).toBeNull();
    expect(within(document.getElementById(eggAction.id)!).queryByText('Ready here')).toBeNull();
    expect(within(returnRow).getByText('Requirement missing')).toBeTruthy();
    expect(within(returnRow).getByText(eggAction.displayText)).toBeTruthy();
    expect(within(completeRow).getByText('Requirement missing')).toBeTruthy();
    expect(within(completeRow).getByText(returnAction.displayText)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Cannot complete yet' })).toBeTruthy();
    expect(screen.getByText('1 known blocker')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Analysis incomplete' })).toBeNull();
  });

  it('counts each real missing Cook ingredient once across dependency surfaces', () => {
    render(<QuestRoutePanel {...panelProps(evaluatedCookAnalysisWithMissingItems([
      'egg', 'bucket of milk', 'pot of flour',
    ]))} />);

    expect(screen.getByText('4 known blockers')).toBeTruthy();
    expect(screen.queryByText('5 known blockers')).toBeNull();
  });

  it('keeps the full walkthrough usable when the map image fails', () => {
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);
    const definition = questWalkthroughFor("Cook's Assistant")!;

    fireEvent.error(screen.getByRole('img', { name: 'OSRS world map' }));

    expect(screen.getByText('Map unavailable')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Quest walkthrough' })).getAllByRole('listitem'))
      .toHaveLength(definition.actions.length);
  });

  it('isolates a missing walkthrough location from mapped item routes', () => {
    const actions = [...mixedAnalysis.walkthrough.actions];
    actions[0] = {
      ...actions[0],
      state: 'LOCATION_NEEDS_REVIEW',
      location: {
        confidence: 'UNMAPPED',
        evidenceKind: 'NONE',
        chunks: [],
        candidateChunks: [],
        explanation: 'Location missing only for this action.',
      },
    };
    const analysis = {
      ...mixedAnalysis,
      walkthrough: { ...mixedAnalysis.walkthrough, status: 'INCOMPLETE' as const, actions },
    };
    render(<QuestRoutePanel {...panelProps(analysis)} />);

    expect(screen.getAllByText('Location needs review').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Show Egg on map' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preparation' })).toBeTruthy();
  });

  it('isolates a no-current-source item from mapped quest locations', () => {
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);

    expect(screen.getByRole('heading', { level: 3, name: /1 .* Pot of flour/ })).toBeTruthy();
    expect(screen.getByText('No source in current chunks')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Quest path chunk 50,50/ })).toBeTruthy();
  });

  it('keeps shared quest chunks selectable with every numbered action distinct', async () => {
    const user = userEvent.setup();
    render(<QuestRoutePanel {...panelProps(mixedAnalysis)} />);
    const definition = questWalkthroughFor("Cook's Assistant")!;
    const mappedQuestActions = definition.actions.filter(action => (
      action.section === 'QUEST'
      && (action.confidence === 'EXACT' || action.confidence === 'REVIEWED')
    ));

    await user.click(screen.getByRole('button', { name: /Quest path chunk 50,50/ }));
    const tray = screen.getByRole('region', { name: 'Selected route chunk details' });
    expect(within(tray).getAllByRole('listitem')).toHaveLength(mappedQuestActions.length);
    for (const action of mappedQuestActions) {
      expect(within(tray).getByText(action.displayText)).toBeTruthy();
      expect(within(tray).getByText(`Step ${action.sourceOrder}`)).toBeTruthy();
    }
  });

  it('keeps the Elemental Workshop entry action incomplete when the battered key step is unmapped', () => {
    const definition = questWalkthroughFor('Elemental Workshop I')!;
    const actionIds = new Set([
      'elemental-workshop-i:find-battered-book',
      'elemental-workshop-i:make-battered-key',
      'elemental-workshop-i:enter-workshop',
    ]);
    const actions = definition.actions.filter(action => actionIds.has(action.id));
    const sourceLineIds = new Set(
      actions.flatMap(action => action.rawWikiLineIds),
    );
    const pilotDefinition: QuestWalkthroughDefinition = {
      ...definition,
      actions,
      sourceLines: definition.sourceLines.filter(line => sourceLineIds.has(line.id)),
    };
    const snapshot: QuestRouteAnalysisSnapshot = {
      chunkDataVersion: 17,
      unlockedChunks: ['42,54'],
      unlocks: {
        skills: {},
        levels: {},
        regions: [],
        chunks: [],
        quests: [],
        guilds: [],
        merchants: [],
        minigames: [],
        mobility: [],
        slayerUnlocks: [],
      },
      itemSourceRecords: [],
      recipes: [],
      entityLocations: [],
      stationRequirements: [],
      sourceCoverage: [],
      connectGraph: {},
    };
    const walkthrough = evaluateQuestWalkthrough(
      resolveQuestWalkthroughLocations(pilotDefinition, snapshot),
      snapshot,
      [],
    );
    render(
      <QuestRoutePanel
        {...panelProps({
          ...mixedAnalysis,
          questId: 'Elemental Workshop I',
          status: 'ANALYSIS_INCOMPLETE',
          items: [],
          walkthrough,
        })}
      />,
    );
    const makeKeyRow = document.getElementById('elemental-workshop-i:make-battered-key');
    const enterRow = document.getElementById('elemental-workshop-i:enter-workshop');
    if (!makeKeyRow || !enterRow) throw new Error('Missing battered-key dependency rows');

    expect(within(makeKeyRow).getByText('Location needs review')).toBeTruthy();
    expect(within(enterRow).getByText('Location needs review')).toBeTruthy();
    expect(within(enterRow).queryByText('Read the battered book, slash it with a knife to get the battered key, and keep the book.')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Analysis incomplete' })).toBeTruthy();
    expect(screen.queryByText(/known blockers/)).toBeNull();
  });
  it.each([
    "Cook's Assistant",
    "Daddy's Home",
    "Doric's Quest",
    'Elemental Workshop I',
  ])('renders complete source-line and action coverage for %s', (questId) => {
    cleanup();
    const definition = questWalkthroughFor(questId)!;
    const analysis: QuestRouteAnalysis = {
      ...mixedAnalysis,
      questId,
      status: walkthroughAnalysisFor(questId).status === 'INCOMPLETE'
        ? 'ANALYSIS_INCOMPLETE'
        : 'READY_NOW',
      items: [],
      walkthrough: walkthroughAnalysisFor(questId),
      generatedFrom: {
        ...mixedAnalysis.generatedFrom,
        walkthroughRevision: definition.revision,
      },
    };
    render(<QuestRoutePanel {...panelProps(analysis)} />);
    const walkthrough = screen.getByRole('region', { name: 'Quest walkthrough' });

    expect(within(walkthrough).getAllByRole('listitem')).toHaveLength(definition.actions.length);
    for (const sourceLine of definition.sourceLines) {
      const sourceAction = definition.actions.find(action => (
        action.rawWikiLineIds.includes(sourceLine.id)
      ));
      const disclosure = sourceAction
        ? document.getElementById(sourceAction.id)?.querySelector('details')
        : null;
      if (!disclosure) throw new Error(`Missing source disclosure for ${sourceLine.id}`);
      expect(within(disclosure).getByText(sourceLine.rawText)).toBeTruthy();
      expect(disclosure.textContent?.split(sourceLine.rawText)).toHaveLength(2);
    }
  });

  it('deduplicates structural blockers and gives known blockers precedence over incomplete evidence', () => {
    const itemBlocker = { kind: 'ITEM' as const, itemKey: 'egg', label: 'Obtain 2 Egg.' };
    const chunkBlocker = { kind: 'CHUNK' as const, chunk: '50,50' as const, label: 'Unlock the Cook chunk.' };
    const first = mixedAnalysis.walkthrough.actions[0];
    const analysis: QuestRouteAnalysis = {
      ...mixedAnalysis,
      status: 'ANALYSIS_INCOMPLETE',
      items: [{
        ...mixedAnalysis.items[0],
        state: 'NO_CURRENT_SOURCE',
        currentRoutes: [],
        missingChunkRoutes: [],
      }],
      walkthrough: {
        ...mixedAnalysis.walkthrough,
        status: 'INCOMPLETE',
        blockers: [itemBlocker, chunkBlocker],
        hasIncompleteEvidence: true,
        actions: [
          { ...first, blockers: [itemBlocker, chunkBlocker] },
          ...mixedAnalysis.walkthrough.actions.slice(1),
        ],
      },
    };
    render(<QuestRoutePanel {...panelProps(analysis)} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Cannot complete yet' })).toBeTruthy();
    expect(screen.getByText('2 known blockers')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Analysis incomplete' })).toBeNull();
  });

  it('shows Analysis incomplete only when no known blocker outranks it', () => {
    const analysis: QuestRouteAnalysis = {
      ...mixedAnalysis,
      status: 'ANALYSIS_INCOMPLETE',
      items: mixedAnalysis.items.filter(item => item.state === 'DATA_INCOMPLETE'),
      walkthrough: {
        ...mixedAnalysis.walkthrough,
        status: 'INCOMPLETE',
        blockers: [],
        hasIncompleteEvidence: true,
      },
    };
    render(<QuestRoutePanel {...panelProps(analysis)} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Analysis incomplete' })).toBeTruthy();
    expect(screen.queryByText(/known blockers/)).toBeNull();
  });
});
