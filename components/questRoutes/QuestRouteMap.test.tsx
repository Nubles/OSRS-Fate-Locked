// @vitest-environment jsdom

import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render as testingRender,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildQuestRouteMapModel } from '../../utils/questRoutes/routeMapModel';
import type {
  QuestRouteMapChunk,
  QuestRouteMapModel,
  QuestRouteMapStep,
} from '../../utils/questRoutes/routeMapModel';
import type { PresentedQuestAnalysis } from '../../utils/questRoutes/presenter';
import type { PresentedQuestWalkthrough } from '../../utils/questWalkthroughs/presenter';
import {
  QuestRouteMap,
  type QuestRouteMapFocusRequest,
} from './QuestRouteMap';

const validLayerFocusRequest: QuestRouteMapFocusRequest = {
  layer: 'QUEST_PATH',
  targetId: 'doric:talk',
  nonce: 1,
};
// @ts-expect-error Legacy item-only focus requests are no longer supported.
const removedLegacyFocusRequest: QuestRouteMapFocusRequest = { itemId: 'egg', nonce: 1 };
const mixedFocusRequest: QuestRouteMapFocusRequest = {
  layer: 'PREPARATION',
  targetId: 'flour',
  // @ts-expect-error A focus request cannot mix generic and legacy targets.
  itemId: 'egg',
  nonce: 1,
};
// @ts-expect-error Generic focus requests require both layer and targetId.
const incompleteFocusRequest: QuestRouteMapFocusRequest = { layer: 'QUEST_PATH', nonce: 1 };
void [validLayerFocusRequest, removedLegacyFocusRequest, mixedFocusRequest, incompleteFocusRequest];

type PreparationMapStep = Extract<QuestRouteMapStep, { kind: 'PREPARATION' }>;
type QuestActionMapStep = Extract<QuestRouteMapStep, { kind: 'QUEST_ACTION' }>;

const emptyWalkthrough: PresentedQuestWalkthrough = {
  questId: 'Map fixture',
  prepareActions: [],
  questActions: [],
  actions: [],
  attribution: {
    wikiLabel: 'Wiki revision',
    wikiUrl: 'https://example.test/wiki',
    licenceLabel: 'CC BY-NC-SA 3.0',
    licenceUrl: 'https://example.test/licence',
    chunkPickerLabel: 'Chunk Picker',
    chunkPickerCommit: 'abc123',
    reuseStatusText: 'Private preview only.',
  },
};

const routeStep = (
  overrides: Partial<PreparationMapStep> & Pick<PreparationMapStep, 'id' | 'sequence' | 'targetId' | 'itemName'>,
): PreparationMapStep => ({
  kind: 'PREPARATION',
  id: overrides.id,
  targetId: overrides.targetId,
  sequence: overrides.sequence,
  label: 'Lumbridge source host',
  itemId: overrides.targetId,
  itemName: overrides.itemName,
  routeId: `${overrides.targetId}-route`,
  routeLabel: 'Lumbridge source host',
  sourceKind: 'Spawn',
  chunk: '19,57',
  state: 'USABLE',
  requiresChunkUnlock: false,
  blockers: [],
  targetAnchor: `requirement-${overrides.targetId}`,
  canOpenWorldChunk: true,
  ...overrides,
});

const questStep = (
  overrides: Partial<QuestActionMapStep> & Pick<QuestActionMapStep, 'id' | 'sequence' | 'targetId' | 'label'>,
): QuestActionMapStep => ({
  kind: 'QUEST_ACTION',
  id: overrides.id,
  targetId: overrides.targetId,
  sequence: overrides.sequence,
  label: overrides.label,
  chunk: '46,53',
  state: 'USABLE',
  statusText: 'Ready here',
  targetAnchor: `walkthrough-${overrides.targetId}`,
  canOpenWorldChunk: true,
  ...overrides,
});

const routeChunk = (
  chunk: QuestRouteMapChunk['chunk'],
  state: QuestRouteMapChunk['state'],
  steps: readonly QuestRouteMapStep[],
): QuestRouteMapChunk => ({ chunk, state, steps });

const mapModel: QuestRouteMapModel = {
  questId: 'Cook’s Assistant',
  defaultLayer: 'QUEST_PATH',
  layers: [{
    id: 'QUEST_PATH',
    label: 'Quest path',
    chunks: [],
    unmappedTargetIds: [],
  }, {
    id: 'PREPARATION',
    label: 'Preparation',
  chunks: [
    routeChunk('19,57', 'BLOCKED', [
      routeStep({
        id: 'egg-step',
        sequence: 1,
        targetId: 'egg',
        itemName: 'Egg',
        state: 'BLOCKED',
        blockers: [{ category: 'Skill', label: 'Cooking 5' }],
      }),
      routeStep({
        id: 'milk-step',
        sequence: 2,
        targetId: 'milk',
        itemName: 'Bucket of milk',
        state: 'BLOCKED',
        blockers: [{ category: 'Unlock', label: 'Lumbridge cow field' }],
      }),
    ]),
    routeChunk('21,48', 'USABLE', [
      routeStep({
        id: 'flour-step',
        sequence: 3,
        targetId: 'flour',
        itemName: 'Pot of flour',
        routeLabel: 'Mill Lane Mill',
        sourceKind: 'Processing',
        chunk: '21,48',
      }),
    ]),
    routeChunk('20,48', 'INCOMPLETE', [
      routeStep({
        id: 'water-step',
        sequence: 4,
        targetId: 'water',
        itemName: 'Bucket of water',
        chunk: '20,48',
        state: 'INCOMPLETE',
      }),
    ]),
  ],
    unmappedTargetIds: [],
  }],
};

const sharedChunkModel: QuestRouteMapModel = {
  questId: 'Cook’s Assistant',
  defaultLayer: 'QUEST_PATH',
  layers: [{
    id: 'QUEST_PATH',
    label: 'Quest path',
    chunks: [],
    unmappedTargetIds: [],
  }, {
    id: 'PREPARATION',
    label: 'Preparation',
  chunks: [
    routeChunk('19,57', 'INCOMPLETE', [
      routeStep({
        id: 'egg-step-1',
        sequence: 1,
        targetId: 'egg',
        itemName: 'Egg',
      }),
      routeStep({
        id: 'milk-step',
        sequence: 2,
        targetId: 'milk',
        itemName: 'Bucket of milk',
        state: 'BLOCKED',
        blockers: [{ category: 'Skill', label: 'Cooking 5' }],
      }),
      routeStep({
        id: 'flour-step',
        sequence: 3,
        targetId: 'flour',
        itemName: 'Pot of flour',
        state: 'INCOMPLETE',
      }),
    ]),
  ],
    unmappedTargetIds: [],
  }],
};

const layeredModel: QuestRouteMapModel = {
  questId: "Doric's Quest",
  defaultLayer: 'QUEST_PATH',
  layers: [{
    id: 'QUEST_PATH',
    label: 'Quest path',
    chunks: [routeChunk('46,53', 'USABLE', [
      questStep({
        id: 'doric-talk',
        targetId: 'doric:talk',
        sequence: 1,
        label: 'Talk to Doric.',
      }),
      questStep({
        id: 'doric-return',
        targetId: 'doric:return-ores',
        sequence: 2,
        label: 'Return the ores to Doric.',
      }),
    ])],
    unmappedTargetIds: ['doric:unmapped-note'],
  }, mapModel.layers[1]],
};

const render = (...args: Parameters<typeof testingRender>): ReturnType<typeof testingRender> => {
  const view = testingRender(...args);
  const questPath = screen.queryByRole('button', { name: 'Quest path' });
  const preparation = screen.queryByRole('button', { name: 'Preparation' });
  if (
    questPath?.getAttribute('aria-pressed') === 'true'
    && screen.queryAllByRole('button', { name: /Quest path chunk/ }).length === 0
    && preparation
  ) {
    fireEvent.click(preparation);
  }
  return view;
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('QuestRouteMap', () => {
  it('honours an empty Quest path as the default and returns to it for a new quest', async () => {
    const user = userEvent.setup();
    const view = testingRender(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Quest path' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(screen.getByRole('button', { name: 'Preparation' }).getAttribute('aria-pressed'))
      .toBe('false');
    expect(screen.queryByRole('button', { name: /Route chunk/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Selected route chunk details' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Preparation' }));
    view.rerender(
      <QuestRouteMap
        model={{ ...mapModel, questId: 'A different empty-path quest' }}
        onViewTarget={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Quest path' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(screen.queryByRole('button', { name: /Route chunk/ })).toBeNull();
  });

  it('renders accessible layer buttons and defaults to Quest path', () => {
    render(<QuestRouteMap model={layeredModel} onViewTarget={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Quest path' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(screen.getByRole('button', { name: 'Preparation' }).getAttribute('aria-pressed'))
      .toBe('false');
    expect(screen.getByRole('button', {
      name: 'Quest path chunk 46,53: Quest steps 1 and 2. Ready here',
    })).toBeTruthy();
  });

  it('switches layers and fits each layer independently', async () => {
    const user = userEvent.setup();
    render(<QuestRouteMap model={layeredModel} onViewTarget={vi.fn()} />);
    const viewport = screen.getByTestId('route-map-viewport');
    const questTransform = [
      viewport.getAttribute('data-map-scale'),
      viewport.getAttribute('data-map-x'),
      viewport.getAttribute('data-map-y'),
    ];

    await user.click(screen.getByRole('button', { name: 'Preparation' }));
    expect(screen.getByRole('button', { name: 'Preparation' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect([
      viewport.getAttribute('data-map-scale'),
      viewport.getAttribute('data-map-x'),
      viewport.getAttribute('data-map-y'),
    ]).not.toEqual(questTransform);

    await user.click(screen.getByRole('button', { name: 'Quest path' }));
    expect([
      viewport.getAttribute('data-map-scale'),
      viewport.getAttribute('data-map-x'),
      viewport.getAttribute('data-map-y'),
    ]).toEqual(questTransform);
  });

  it('switches to the requested layer and recentres generic quest and item targets', () => {
    const view = render(
      <QuestRouteMap
        model={layeredModel}
        focusRequest={{ layer: 'PREPARATION', targetId: 'flour', nonce: 1 }}
        onViewTarget={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Preparation' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(within(screen.getByRole('region', { name: 'Selected Preparation chunk details' }))
      .getByText('Pot of flour')).toBeTruthy();

    view.rerender(
      <QuestRouteMap
        model={layeredModel}
        focusRequest={{ layer: 'QUEST_PATH', targetId: 'doric:return-ores', nonce: 2 }}
        onViewTarget={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Quest path' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(within(screen.getByRole('region', { name: 'Selected Quest path chunk details' }))
      .getByText('Return the ores to Doric.')).toBeTruthy();
  });

  it('keeps same-chunk quest actions separate and views their exact targets', async () => {
    const user = userEvent.setup();
    const onViewTarget = vi.fn();
    render(<QuestRouteMap model={layeredModel} onViewTarget={onViewTarget} />);
    const tray = screen.getByRole('region', { name: 'Selected Quest path chunk details' });

    expect(within(tray).getByText('Talk to Doric.')).toBeTruthy();
    expect(within(tray).getByText('Return the ores to Doric.')).toBeTruthy();
    await user.click(within(tray).getByRole('button', {
      name: 'View quest step 2: Return the ores to Doric.',
    }));
    expect(onViewTarget).toHaveBeenCalledWith('walkthrough-doric:return-ores');
  });

  it('labels mapped Prepare first quest evidence without claiming it is usable', () => {
    const prepareFirstModel: QuestRouteMapModel = {
      ...layeredModel,
      layers: [{
        ...layeredModel.layers[0],
        chunks: [routeChunk('46,53', 'INCOMPLETE', [
          questStep({
            id: 'doric-return',
            targetId: 'doric:return-ores',
            sequence: 2,
            label: 'Return the ores to Doric.',
            state: 'INCOMPLETE',
            statusText: 'Prepare first',
          }),
        ])],
      }, layeredModel.layers[1]],
    };

    testingRender(<QuestRouteMap model={prepareFirstModel} onViewTarget={vi.fn()} />);

    expect(screen.getByRole('button', {
      name: 'Quest path chunk 46,53: Quest step 2. Prepare first',
    })).toBeTruthy();
    const tray = screen.getByRole('region', { name: 'Selected Quest path chunk details' });
    expect(within(tray).getByText('Prepare first')).toBeTruthy();
    expect(within(tray).queryByText('Usable now')).toBeNull();
  });

  it('ignores a malformed focus request that mixes generic and legacy targets', () => {
    const malformed = {
      layer: 'PREPARATION',
      targetId: 'flour',
      itemId: 'egg',
      nonce: 1,
    } as unknown as QuestRouteMapFocusRequest;

    testingRender(
      <QuestRouteMap
        model={layeredModel}
        focusRequest={malformed}
        onViewTarget={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Quest path' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(screen.getByRole('button', { name: 'Preparation' }).getAttribute('aria-pressed'))
      .toBe('false');
  });

  it('resets to Quest path when quest identity changes', async () => {
    const user = userEvent.setup();
    const view = render(<QuestRouteMap model={layeredModel} onViewTarget={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Preparation' }));

    view.rerender(
      <QuestRouteMap
        model={{ ...layeredModel, questId: 'A different quest' }}
        onViewTarget={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Quest path' }).getAttribute('aria-pressed'))
      .toBe('true');
  });

  it('keeps quest controls and textual actions when the map image fails', () => {
    render(<QuestRouteMap model={layeredModel} onViewTarget={vi.fn()} />);
    fireEvent.error(screen.getByRole('img', { name: 'OSRS world map' }));

    expect(screen.getByText('Map unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quest path' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preparation' })).toBeTruthy();
    expect(screen.getByText('Talk to Doric.')).toBeTruthy();
    expect(screen.getByText('Return the ores to Doric.')).toBeTruthy();
  });

  it('supports keyboard activation for the layer buttons', async () => {
    const user = userEvent.setup();
    render(<QuestRouteMap model={layeredModel} onViewTarget={vi.fn()} />);

    const preparation = screen.getByRole('button', { name: 'Preparation' });
    preparation.focus();
    await user.keyboard('{Enter}');
    expect(preparation.getAttribute('aria-pressed')).toBe('true');

    const questPath = screen.getByRole('button', { name: 'Quest path' });
    questPath.focus();
    await user.keyboard(' ');
    expect(questPath.getAttribute('aria-pressed')).toBe('true');
  });
  it('opens the exact selected shared-step chunk on the world map', async () => {
    const user = userEvent.setup();
    const onOpenWorldChunk = vi.fn();
    render(
      <QuestRouteMap
        model={mapModel}
        onViewTarget={vi.fn()}
        onOpenWorldChunk={onOpenWorldChunk}
      />,
    );

    await user.click(screen.getByRole('button', {
      name: 'Route chunk 19,57: Preparation steps 1 and 2. Blocked',
    }));
    await user.click(screen.getByRole('button', {
      name: 'Open chunk 19,57 on world map',
    }));

    expect(onOpenWorldChunk).toHaveBeenCalledOnce();
    expect(onOpenWorldChunk).toHaveBeenCalledWith(19, 57);
  });

  it('does not offer a World-map handoff without a navigation callback', () => {
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);

    expect(screen.queryByRole('button', {
      name: /Open chunk .* on world map/,
    })).toBeNull();
  });
  it('renders one accessible map with chunk, zoom, fit, and image controls', () => {
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Cook’s Assistant main path map' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Route chunk 19,57: Preparation steps 1 and 2. Blocked' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom route map in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom route map out' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fit complete route' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'OSRS world map' })).toBeTruthy();
    expect(document.querySelectorAll('[data-route-map-viewport]')).toHaveLength(1);
  });

  it('exposes every route state through text and a non-colour marker pattern', async () => {
    const user = userEvent.setup();
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);

    const cases = [
      { chunk: '19,57', state: 'BLOCKED', pattern: 'blocked', status: 'Blocked' },
      { chunk: '21,48', state: 'USABLE', pattern: 'usable', status: 'Usable now' },
      { chunk: '20,48', state: 'INCOMPLETE', pattern: 'incomplete', status: 'Route data incomplete' },
    ] as const;

    for (const entry of cases) {
      const button = screen.getByRole('button', { name: new RegExp(`Route chunk ${entry.chunk}`) });
      expect(button.getAttribute('data-route-state')).toBe(entry.state);
      expect(button.getAttribute('data-route-pattern')).toBe(entry.pattern);
      await user.click(button);
      expect(within(screen.getByRole('region', { name: 'Selected Preparation chunk details' }))
        .getAllByText(entry.status).length).toBeGreaterThan(0);
    }
  });

  it('renders incomplete chunks with a neutral dashed exact highlight', () => {
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    const marker = screen.getByRole('button', { name: /Route chunk 20,48/ });
    const highlight = marker.querySelector<HTMLElement>('[data-route-marker-highlight]');

    expect(highlight).not.toBeNull();
    expect(highlight?.className).toContain('border-dashed');
    expect(highlight?.className).toContain('border-slate-');
    expect(highlight?.className).not.toContain('border-cyan');
    expect(highlight?.className).not.toContain('radial-gradient');
  });

  it('labels marker state and programmatically associates the active marker with the tray', () => {
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    const marker = screen.getByRole('button', {
      name: 'Route chunk 19,57: Preparation steps 1 and 2. Blocked',
    });
    const tray = screen.getByRole('region', { name: 'Selected route chunk details' });
    expect(screen.getByRole('region', { name: 'Selected Preparation chunk details' }))
      .toBeTruthy();

    expect(marker.id).not.toBe('');
    expect(tray.id).not.toBe('');
    expect(marker.getAttribute('aria-controls')).toBe(tray.id);
    expect(tray.getAttribute('aria-live')).toBe('polite');
  });

  it('selects a shared chunk and lists every associated step and blocker', async () => {
    const user = userEvent.setup();
    render(<QuestRouteMap model={sharedChunkModel} onViewTarget={vi.fn()} />);

    await user.click(screen.getByRole('button', {
      name: 'Route chunk 19,57: Preparation steps 1, 2 and 3. Route data incomplete',
    }));

    const tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    expect(within(tray).getByText('Egg')).toBeTruthy();
    expect(within(tray).getByText('Bucket of milk')).toBeTruthy();
    expect(within(tray).getByText('Pot of flour')).toBeTruthy();
    expect(within(tray).getByText('Skill: Cooking 5')).toBeTruthy();
    expect(within(tray).getAllByText('Lumbridge source host')).toHaveLength(3);
    expect(within(tray).getAllByText('Spawn')).toHaveLength(3);
    expect(tray.textContent).not.toContain('19,57');
  });

  it('renders recursive ingredient chunks with their projected child provenance', async () => {
    const user = userEvent.setup();
    const analysis: PresentedQuestAnalysis = {
      questId: 'Recursive recipe',
      heading: 'Cannot complete yet',
      items: [{
        id: 'plank-0',
        anchorId: 'runeproof-item-1-plank',
        analysisState: 'ROUTE_BLOCKED',
        supplyPolicy: 'PLAYER_OBTAINED',
        quantity: 1,
        itemName: 'Plank',
        title: '1 × Plank',
        statusText: 'Route exists — requirement missing',
        routes: [{
          id: 'plank-recipe',
          label: 'Use Sawmill',
          sourceKind: 'Recipe',
          outputQuantity: 1,
          isBest: true,
          requiresChunkUnlock: false,
          steps: [
            {
              label: 'Use Sawmill',
              sourceKind: 'Recipe',
              chunk: '19,57',
              blockers: [{ category: 'Access / station', label: 'Sawmill access' }],
              requiresChunkUnlock: false,
              hasDataGap: false,
            },
            {
              label: 'Logs source',
              sourceKind: 'Spawn',
              chunk: '21,48',
              blockers: [{ category: 'Skill', label: 'Woodcutting 1' }],
              requiresChunkUnlock: false,
              hasDataGap: false,
            },
          ],
          blockers: [{ category: 'Access / station', label: 'Sawmill access' }],
          deterministic: true,
        }],
        missingChunkOptions: [],
        dataNotes: [],
      }],
    };
    render(
      <QuestRouteMap
        model={buildQuestRouteMapModel(analysis, emptyWalkthrough)}
        onViewTarget={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Route chunk 21,48/ }));
    const tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    expect(within(tray).getByText('Logs source')).toBeTruthy();
    expect(within(tray).getByText('Spawn')).toBeTruthy();
    expect(within(tray).getByText('Skill: Woodcutting 1')).toBeTruthy();
    expect(within(tray).queryByText('Sawmill access')).toBeNull();
  });

  it('explains a locked route even when it has no named gate', () => {
    const analysis: PresentedQuestAnalysis = {
      questId: 'Locked route',
      heading: 'Cannot complete yet',
      items: [{
        id: 'flour-0',
        anchorId: 'runeproof-item-1-flour',
        analysisState: 'NO_CURRENT_SOURCE',
        supplyPolicy: 'PLAYER_OBTAINED',
        quantity: 1,
        itemName: 'Pot of flour',
        title: '1 × Pot of flour',
        statusText: 'No source in current chunks',
        routes: [{
          id: 'locked-mill',
          label: 'Mill Lane Mill',
          sourceKind: 'Spawn',
          outputQuantity: 1,
          isBest: true,
          requiresChunkUnlock: true,
          steps: [{
            label: 'Mill Lane Mill',
            sourceKind: 'Spawn',
            chunk: '21,48',
            blockers: [],
            requiresChunkUnlock: true,
            hasDataGap: false,
          }],
          blockers: [],
          deterministic: true,
        }],
        missingChunkOptions: [],
        dataNotes: [],
      }],
    };
    render(
      <QuestRouteMap
        model={buildQuestRouteMapModel(analysis, emptyWalkthrough)}
        onViewTarget={vi.fn()}
      />,
    );

    const tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    expect(within(tray).getByText('Blocked')).toBeTruthy();
    expect(within(tray).getByText('Requires a chunk unlock')).toBeTruthy();
  });

  it('shows per-step reachability for a mixed unlocked and locked route', async () => {
    const user = userEvent.setup();
    const analysis: PresentedQuestAnalysis = {
      questId: 'Mixed route',
      heading: 'Cannot complete yet',
      items: [{
        id: 'mixed-0',
        anchorId: 'runeproof-item-1-mixed',
        analysisState: 'NO_CURRENT_SOURCE',
        supplyPolicy: 'PLAYER_OBTAINED',
        quantity: 1,
        itemName: 'Mixed route',
        title: '1 Ã— Mixed route',
        statusText: 'No source in current chunks',
        routes: [{
          id: 'mixed',
          label: 'Mixed route',
          sourceKind: 'Recipe',
          outputQuantity: 1,
          isBest: true,
          requiresChunkUnlock: true,
          steps: [
            {
              label: 'Unlocked ingredient',
              sourceKind: 'Spawn',
              chunk: '19,57',
              blockers: [],
              requiresChunkUnlock: false,
              hasDataGap: false,
            },
            {
              label: 'Locked station',
              sourceKind: 'Recipe',
              chunk: '21,48',
              blockers: [],
              requiresChunkUnlock: true,
              hasDataGap: false,
            },
          ],
          blockers: [],
          deterministic: true,
        }],
        missingChunkOptions: [],
        dataNotes: [],
      }],
    } as PresentedQuestAnalysis;
    render(<QuestRouteMap model={buildQuestRouteMapModel(analysis, emptyWalkthrough)} onViewTarget={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Route chunk 19,57/ }));
    let tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    expect(within(tray).getByText('Unlocked ingredient')).toBeTruthy();
    expect(within(tray).getByText('Usable now')).toBeTruthy();
    expect(within(tray).queryByText('Requires a chunk unlock')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Route chunk 21,48/ }));
    tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    expect(within(tray).getByText('Locked station')).toBeTruthy();
    expect(within(tray).getByText('Blocked')).toBeTruthy();
    expect(within(tray).getByText('Requires a chunk unlock')).toBeTruthy();
  });

  it.each(['{Enter}', ' '])('activates a focused chunk with %s', async (key) => {
    const user = userEvent.setup();
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    const usable = screen.getByRole('button', { name: 'Route chunk 21,48: Preparation step 3. Usable now' });

    usable.focus();
    await user.keyboard(key);

    expect(within(screen.getByRole('region', { name: 'Selected Preparation chunk details' }))
      .getByText('Pot of flour')).toBeTruthy();
  });

  it('passes the exact item anchor through the native requirement action', async () => {
    const user = userEvent.setup();
    const onViewTarget = vi.fn();
    render(<QuestRouteMap model={mapModel} onViewTarget={onViewTarget} />);

    await user.click(within(screen.getByRole('region', { name: 'Selected Preparation chunk details' }))
      .getByRole('button', { name: 'View requirement for Egg' }));

    expect(onViewTarget).toHaveBeenCalledWith('requirement-egg');
  });

  it('shows a concise focus label without replacing the persistent details tray', async () => {
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    const tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });

    fireEvent.focus(screen.getByRole('button', {
      name: 'Route chunk 19,57: Preparation steps 1 and 2. Blocked',
    }));

    expect(screen.getByRole('status').textContent).toBe('Steps 1 and 2 · Egg, Bucket of milk');
    expect(tray).toBeTruthy();
    expect(within(tray).getByText('Egg')).toBeTruthy();
  });

  it('selects the requested item first and updates when the nonce changes', () => {
    const view = render(
      <QuestRouteMap
        model={mapModel}
        focusRequest={{ layer: 'PREPARATION', targetId: 'flour', nonce: 1 }}
        onViewTarget={vi.fn()}
      />,
    );
    const tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    expect(within(tray).getByText('Pot of flour')).toBeTruthy();

    view.rerender(
      <QuestRouteMap
        model={mapModel}
        focusRequest={{ layer: 'PREPARATION', targetId: 'egg', nonce: 2 }}
        onViewTarget={vi.fn()}
      />,
    );
    expect(within(tray).getByText('Egg')).toBeTruthy();
  });

  it.each([
    { reduced: false, behavior: 'smooth' },
    { reduced: true, behavior: 'auto' },
  ] as const)('focuses and scrolls the requested marker with $behavior motion', ({ reduced, behavior }) => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: reduced,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    );
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      const view = render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
      const marker = screen.getByRole('button', { name: /Route chunk 21,48/ });
      view.rerender(
        <QuestRouteMap
          model={mapModel}
          focusRequest={{ layer: 'PREPARATION', targetId: 'flour', nonce: 1 }}
          onViewTarget={vi.fn()}
        />,
      );

      expect(document.activeElement).toBe(marker);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior });
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
      } else {
        delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
      }
    }
  });

  it('recentres a repeated focus request for the same item with a new nonce', async () => {
    const user = userEvent.setup();
    const view = render(
      <QuestRouteMap
        model={mapModel}
        focusRequest={{ layer: 'PREPARATION', targetId: 'egg', nonce: 1 }}
        onViewTarget={vi.fn()}
      />,
    );
    const viewport = screen.getByTestId('route-map-viewport');
    const focusedX = viewport.getAttribute('data-map-x');
    const focusedY = viewport.getAttribute('data-map-y');

    await user.click(screen.getByRole('button', { name: 'Zoom route map out' }));
    expect([
      viewport.getAttribute('data-map-x'),
      viewport.getAttribute('data-map-y'),
    ]).not.toEqual([focusedX, focusedY]);

    view.rerender(
      <QuestRouteMap
        model={mapModel}
        focusRequest={{ layer: 'PREPARATION', targetId: 'egg', nonce: 2 }}
        onViewTarget={vi.fn()}
      />,
    );
    expect(viewport.getAttribute('data-map-x')).toBe(focusedX);
    expect(viewport.getAttribute('data-map-y')).toBe(focusedY);
  });

  it('does not replay a retained focus request after direct selection and resize', async () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const user = userEvent.setup();
    render(
      <QuestRouteMap
        model={mapModel}
        focusRequest={{ layer: 'PREPARATION', targetId: 'flour', nonce: 1 }}
        onViewTarget={vi.fn()}
      />,
    );
    const viewport = screen.getByTestId('route-map-viewport');
    const directSelection = screen.getByRole('button', {
      name: 'Route chunk 19,57: Preparation steps 1 and 2. Blocked',
    });
    await user.click(directSelection);

    act(() => {
      resizeCallback?.([{
        contentRect: { width: 800, height: 400 },
      } as ResizeObserverEntry], {} as ResizeObserver);
    });

    expect(directSelection.getAttribute('aria-pressed')).toBe('true');
    const tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    const rows = Array.from(tray.querySelector('ol')?.children ?? []) as HTMLElement[];
    expect(rows.map(row => row.getAttribute('data-route-step-item'))).toEqual(['egg', 'milk']);
    expect(Number(viewport.getAttribute('data-map-scale'))).toBeLessThan(1);
  });

  it.each([
    ['first unresolved valid chunk', false],
    ['first valid chunk when every route is usable', true],
  ])('lets a stable model-identity change reset to the %s without replaying an old request', (
    _resetCase,
    makeEveryRouteUsable,
  ) => {
    const retainedRequest = { layer: 'PREPARATION', targetId: 'flour', nonce: 1 } as const;
    const view = render(
      <QuestRouteMap
        model={mapModel}
        focusRequest={retainedRequest}
        onViewTarget={vi.fn()}
      />,
    );
    const changedModel: QuestRouteMapModel = {
      ...mapModel,
      layers: [mapModel.layers[0], {
        ...mapModel.layers[1],
        chunks: mapModel.layers[1].chunks.map((chunk, chunkIndex) => ({
          ...chunk,
          state: makeEveryRouteUsable ? 'USABLE' : chunk.state,
          steps: chunk.steps.map(step => ({
            ...step,
            id: chunkIndex === 0 ? `${step.id}-reviewed` : step.id,
            state: makeEveryRouteUsable ? 'USABLE' : step.state,
          })),
        })),
      }],
    };

    view.rerender(
      <QuestRouteMap
        model={changedModel}
        focusRequest={retainedRequest}
        onViewTarget={vi.fn()}
      />,
    );

    const firstChunkState = makeEveryRouteUsable ? 'Usable now' : 'Blocked';
    expect(screen.getByRole('button', {
      name: `Route chunk 19,57: Preparation steps 1 and 2. ${firstChunkState}`,
    }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Route chunk 21,48: Preparation step 3. Usable now' })
      .getAttribute('aria-pressed')).toBe('false');
    const tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    expect(within(tray).getByText('Egg')).toBeTruthy();
    expect(within(tray).queryByText('Pot of flour')).toBeNull();
  });
  it('puts requested shared-item steps first without renumbering them', () => {
    render(
      <QuestRouteMap
        model={sharedChunkModel}
        focusRequest={{ layer: 'PREPARATION', targetId: 'milk', nonce: 1 }}
        onViewTarget={vi.fn()}
      />,
    );

    const tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    const rows = Array.from(tray.querySelector('ol')?.children ?? []) as HTMLElement[];
    expect(rows.map(row => row.getAttribute('data-route-step-item'))).toEqual([
      'milk',
      'egg',
      'flour',
    ]);
    expect(rows[0].textContent).toContain('Step 2');
    expect(rows[1].textContent).toContain('Step 1');
    expect(rows[2].textContent).toContain('Step 3');
  });

  it('zooms, clamps zoom-out, pans by pointer drag, and restores fit', async () => {
    const user = userEvent.setup();
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    const viewport = screen.getByTestId('route-map-viewport');
    const initialScale = Number(viewport.getAttribute('data-map-scale'));

    await user.click(screen.getByRole('button', { name: 'Zoom route map in' }));
    expect(Number(viewport.getAttribute('data-map-scale'))).toBeGreaterThan(initialScale);

    for (let index = 0; index < 30; index += 1) {
      await user.click(screen.getByRole('button', { name: 'Zoom route map out' }));
    }
    const clampedScale = viewport.getAttribute('data-map-scale');
    await user.click(screen.getByRole('button', { name: 'Zoom route map out' }));
    expect(viewport.getAttribute('data-map-scale')).toBe(clampedScale);

    for (let index = 0; index < 6; index += 1) {
      await user.click(screen.getByRole('button', { name: 'Zoom route map in' }));
    }
    const xBeforeDrag = viewport.getAttribute('data-map-x');
    const yBeforeDrag = viewport.getAttribute('data-map-y');
    fireEvent.pointerDown(viewport, { pointerId: 7, clientX: 200, clientY: 180 });
    fireEvent.pointerMove(viewport, { pointerId: 7, clientX: 150, clientY: 120 });
    fireEvent.pointerUp(viewport, { pointerId: 7, clientX: 150, clientY: 120 });
    expect([
      viewport.getAttribute('data-map-x'),
      viewport.getAttribute('data-map-y'),
    ]).not.toEqual([xBeforeDrag, yBeforeDrag]);

    await user.click(screen.getByRole('button', { name: 'Fit complete route' }));
    expect(viewport.getAttribute('data-map-scale')).toBe(String(initialScale));
  });

  it('keeps a 24 CSS pixel hit target around the exact chunk highlight at minimum scale', async () => {
    const user = userEvent.setup();
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    const viewport = screen.getByTestId('route-map-viewport');

    for (let index = 0; index < 30; index += 1) {
      await user.click(screen.getByRole('button', { name: 'Zoom route map out' }));
    }

    const scale = Number(viewport.getAttribute('data-map-scale'));
    const marker = screen.getByRole('button', { name: /Route chunk 20,48/ });
    const highlight = marker.querySelector<HTMLElement>('[data-route-marker-highlight]');
    expect(Number.parseFloat(marker.style.width) * scale).toBeGreaterThanOrEqual(24);
    expect(Number.parseFloat(marker.style.height) * scale).toBeGreaterThanOrEqual(24);
    expect(highlight?.style.width).toBe('192px');
    expect(highlight?.style.height).toBe('192px');
  });

  it('removes the transform transition only while pointer dragging', () => {
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    const viewport = screen.getByTestId('route-map-viewport');
    const layer = screen.getByTestId('route-map-layer');

    expect(layer.className).toContain('transition-transform');
    fireEvent.pointerDown(viewport, {
      pointerId: 7,
      button: 0,
      clientX: 200,
      clientY: 180,
    });
    expect(layer.className).not.toContain('transition-transform');
    fireEvent.pointerUp(viewport, { pointerId: 7, clientX: 200, clientY: 180 });
    expect(layer.className).toContain('transition-transform');
  });

  it('preserves local map state when an equivalent model object keeps the same stable identity', async () => {
    const user = userEvent.setup();
    const view = render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    const viewport = screen.getByTestId('route-map-viewport');
    await user.click(screen.getByRole('button', { name: 'Route chunk 21,48: Preparation step 3. Usable now' }));
    await user.click(screen.getByRole('button', { name: 'Zoom route map in' }));
    const changedScale = viewport.getAttribute('data-map-scale');

    view.rerender(
      <QuestRouteMap
        model={{ ...mapModel, layers: [mapModel.layers[0], { ...mapModel.layers[1], chunks: mapModel.layers[1].chunks.map(chunk => ({ ...chunk })) }] }}
        onViewTarget={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Route chunk 21,48: Preparation step 3. Usable now' })
      .getAttribute('aria-pressed')).toBe('true');
    expect(viewport.getAttribute('data-map-scale')).toBe(changedScale);
  });
  it('preserves the latest requested-item tray preference across a responsive resize', () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const view = render(
      <QuestRouteMap
        model={sharedChunkModel}
        focusRequest={{ layer: 'PREPARATION', targetId: 'milk', nonce: 1 }}
        onViewTarget={vi.fn()}
      />,
    );
    view.rerender(<QuestRouteMap model={sharedChunkModel} onViewTarget={vi.fn()} />);

    act(() => {
      resizeCallback?.([{
        contentRect: { width: 800, height: 400 },
      } as ResizeObserverEntry], {} as ResizeObserver);
    });

    const tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    const rows = Array.from(tray.querySelector('ol')?.children ?? []) as HTMLElement[];
    expect(rows.map(row => row.getAttribute('data-route-step-item'))).toEqual([
      'milk',
      'egg',
      'flour',
    ]);
  });
  it('preserves direct selection and local image failure across a responsive resize', async () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const user = userEvent.setup();
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    const viewport = screen.getByTestId('route-map-viewport');
    const usable = screen.getByRole('button', { name: 'Route chunk 21,48: Preparation step 3. Usable now' });
    await user.click(usable);
    fireEvent.error(screen.getByRole('img', { name: 'OSRS world map' }));

    act(() => {
      resizeCallback?.([{
        contentRect: { width: 800, height: 400 },
      } as ResizeObserverEntry], {} as ResizeObserver);
    });

    expect(usable.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Map unavailable')).toBeTruthy();
    expect(Number(viewport.getAttribute('data-map-scale'))).toBeGreaterThan(0);
  });

  it('places map failure status outside the interactive viewport so markers remain visible', () => {
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    const viewport = screen.getByTestId('route-map-viewport');
    fireEvent.error(screen.getByRole('img', { name: 'OSRS world map' }));

    expect(viewport.contains(screen.getByRole('status'))).toBe(false);
    const marker = screen.getByRole('button', { name: 'Route chunk 21,48: Preparation step 3. Usable now' });
    marker.focus();
    expect(document.activeElement).toBe(marker);
  });
  it('removes transform transitions when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);

    expect(screen.getByTestId('route-map-layer').className).not.toContain('transition-transform');
  });

  it('keeps route evidence and details available when the map image fails', () => {
    render(<QuestRouteMap model={mapModel} onViewTarget={vi.fn()} />);
    fireEvent.error(screen.getByRole('img', { name: 'OSRS world map' }));

    expect(screen.getByText('Map unavailable')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'OSRS world map' })).toBeNull();
    const tray = screen.getByRole('region', { name: 'Selected Preparation chunk details' });
    expect(within(tray).getByText('Egg')).toBeTruthy();
    expect(within(tray).getByText('Skill: Cooking 5')).toBeTruthy();
  });

  it('renders nothing when no mapped chunk has valid geometry', () => {
    const invalidModel: QuestRouteMapModel = {
      questId: 'Cook’s Assistant',
      defaultLayer: 'QUEST_PATH',
      layers: [{
        id: 'QUEST_PATH',
        label: 'Quest path',
        chunks: [],
        unmappedTargetIds: [],
      }, {
        id: 'PREPARATION',
        label: 'Preparation',
      chunks: [
        routeChunk('99,99', 'BLOCKED', [
          routeStep({
            id: 'invalid',
            sequence: 1,
            targetId: 'egg',
            itemName: 'Egg',
            chunk: '99,99',
          }),
        ]),
      ],
        unmappedTargetIds: [],
      }],
    };
    const { container } = render(
      <QuestRouteMap model={invalidModel} onViewTarget={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });
});
