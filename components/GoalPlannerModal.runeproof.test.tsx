// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { UnlockState } from '../types';
import { PlanStep, listGoalTargets, planForTarget } from '../utils/goalPlanner';
import { GoalPlanReadiness, goalPlannerStepHasWikiLink, goalPlannerTargetState } from './GoalPlannerModal';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import {
  analyzeQuest as analyzeQuestWithWalkthrough,
  type QuestPreparationRouteAnalysis,
  type QuestRouteAnalysisSnapshot,
} from '../utils/questRoutes/analyzeQuest';
import { isRuneProofQuestSupported } from '../data/questItemRequirements';
import { GoalPlannerModal } from './GoalPlannerModal';
import userEvent from '@testing-library/user-event';
import { ALL_CHUNK_KEYS, parseChunkKey } from '../utils/chunkAdjacency';
import { chunkUnlocked } from '../utils/chunkLocations';
import type { EntityHit } from '../services/ChunkContentService';
import * as walkthroughCatalogue from '../data/questWalkthroughs';
import type { QuestWalkthroughDefinition } from '../utils/questWalkthroughs/model';
import { runeProofPreviewStorageKey } from '../utils/questRoutes/previewChecks';
import { runeProofPreviewActionStorageKey } from '../utils/questStrategies/previewActions';
import { questStrategyCatalogue } from '../data/questWalkthroughs.preview-boundary';
import type { RuneProofAvailability } from '../utils/questRoutes/featureFlag';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import {
  loadRuneProofCatalogue,
  loadRuneProofPackFor,
  loadRuneProofPlatformReviewHarness,
  runeProofLoadedPackMatchesRelease,
  validatedRuneProofPlatformReviewHarness,
  type RuneProofCatalogueSummary,
  type RuneProofLoadedPack,
  type RuneProofPlatformReviewHarness,
} from '../data/questWalkthroughLoader';
import { buildRuneProofPackCoachModel } from '../utils/questStrategies/coach';
import { publicRuneProofPackReleases } from '../data/runeProofPackRelease.public';
import {
  catalogueSummary,
  makeCatalogueSummaries,
} from '../utils/questStrategies/testFixtures';
import type { RuneProofIntegration } from '../utils/questRoutes/goalPlannerRuneProof';
import type { RuneProofStorage } from '../utils/questRoutes/previewChecks';
import {
  runeProofProgressIndexStorageKey,
  runeProofProgressStorageKey,
} from '../utils/questStrategies/progress';

const walkthroughLoaderControl = vi.hoisted(() => ({
  loadCatalogue: undefined as undefined | ((
    availability: RuneProofAvailability,
  ) => Promise<readonly QuestStrategyDefinition[]>),
}));

const objectiveWorkControl = vi.hoisted(() => ({
  preflightMetrics: [] as Readonly<{
    headerEvaluations: number;
    progressIndexLookups: number;
    packLoads: 0;
    deepAnalyses: 0;
  }>[],
}));

vi.mock('../data/questWalkthroughLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/questWalkthroughLoader')>();
  return {
    ...actual,
    loadQuestStrategyCatalogue: (availability: RuneProofAvailability) => (
      walkthroughLoaderControl.loadCatalogue?.(availability)
      ?? actual.loadQuestStrategyCatalogue(availability)
    ),
  };
});

vi.mock('../utils/questStrategies/objectives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/questStrategies/objectives')>();
  return {
    ...actual,
    preflightRuneProofObjectives: (
      ...args: Parameters<typeof actual.preflightRuneProofObjectives>
    ) => {
      const result = actual.preflightRuneProofObjectives(...args);
      objectiveWorkControl.preflightMetrics.push(result.metrics);
      return result;
    },
  };
});
const analyzeQuest = (
  questId: string,
  snapshot: QuestRouteAnalysisSnapshot,
  suppliedWalkthrough?: QuestWalkthroughDefinition,
) => {
  const walkthrough = suppliedWalkthrough ?? walkthroughCatalogue.questWalkthroughFor(questId);
  if (!walkthrough) throw new Error(`Missing walkthrough fixture for ${questId}`);
  return analyzeQuestWithWalkthrough(questId, snapshot, walkthrough);
};
const step = (id: string, label: string): PlanStep => ({
  kind: 'region',
  id,
  label,
  done: false,
});

let gameSnapshot: {
  unlocks: UnlockState;
  gameModeId: string | undefined;
  runId: string;
};

vi.mock('../context/GameContext', () => ({
  useGame: () => gameSnapshot,
}));

const plannerUnlocks = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {},
  skills: {},
  levels: { Cooking: 99, Construction: 99, Mining: 99 },
  regions: [],
  chunks: ['19,57'],
  mobility: ['Fairy rings'],
  arcana: [],
  housing: [],
  merchants: ['General store'],
  minigames: ['Tempoross'],
  bosses: [],
  storage: [],
  guilds: ['Cooks Guild'],
  farming: [],
  slayerUnlocks: ['Bigger and Badder'],
  quests: ['Druidic Ritual'],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
  ...overrides,
});

gameSnapshot = {
  unlocks: plannerUnlocks(),
  gameModeId: 'chunked',
  runId: 'run-a',
};
const previewStorage = new Map<string, string>();
beforeEach(() => {
  previewStorage.clear();
  objectiveWorkControl.preflightMetrics.length = 0;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => previewStorage.get(key) ?? null,
      setItem: (key: string, value: string) => { previewStorage.set(key, value); },
      removeItem: (key: string) => { previewStorage.delete(key); },
      clear: () => { previewStorage.clear(); },
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  walkthroughLoaderControl.loadCatalogue = undefined;
  cleanup();
  window.localStorage.clear();
  gameSnapshot = {
    unlocks: plannerUnlocks(),
    gameModeId: 'chunked',
    runId: 'run-a',
  };
});

const sourceRecord = (itemName: string, cx = 19, cy = 57) => ({
  itemName,
  kind: 'spawn' as const,
  hostName: `${itemName} source`,
  cx,
  cy,
  rawRequirements: [],
});

const loadedContent = (init: () => Promise<boolean> = async () => true) => {
  const records = new Map([
    ['egg', [sourceRecord('Egg')]],
    ['bucket', [sourceRecord('Bucket')]],
    ['grain', [sourceRecord('Grain')]],
    ['pot', [sourceRecord('Pot')]],
    ['plank', [sourceRecord('Plank', 20, 57)]],
    ['clay', [sourceRecord('Clay')]],
    ['copper ore', [sourceRecord('Copper ore')]],
    ['iron ore', [sourceRecord('Iron ore')]],
    ['bolt of cloth', [sourceRecord('Bolt of cloth', 21, 57)]],
    ['bronze nails', [sourceRecord('Bronze nails', 22, 57)]],
  ]);
  const stations = new Map<string, EntityHit>([
    ['object|dairy cow', {
      name: 'Dairy cow',
      kind: 'object' as const,
      locations: [{ cx: 19, cy: 57 }],
    }],
    ['object|hopper', {
      name: 'Hopper',
      kind: 'object' as const,
      locations: [{ cx: 19, cy: 57 }],
    }],
  ]);
  let initCalls = 0;

  return {
    get initCalls() { return initCalls; },
    init: () => {
      initCalls += 1;
      return init();
    },
    itemSourceRecords: (itemName: string) => records.get(itemName.toLowerCase()) ?? [],
    itemSourceCoverage: () => 'COMPLETE' as const,
    entityLocations: vi.fn((name: string, kinds: readonly string[]) => (
      stations.get(`${kinds[0]}|${name.toLowerCase()}`) ?? null
    )),
    taskRequirements: (name: string, kind: string, cx: number, cy: number) => (
      name === 'Hopper' && kind === 'object' && cx === 19 && cy === 57 ? ['Cook access'] : []
    ),
    chunkEntryRequirements: (cx: number, cy: number) => (
      cx === 19 && cy === 57 ? ['Druidic Ritual'] : []
    ),
    connectGraph: () => ({ '19,57': ['20,57'] }),
  };
};

const multiLocationCookContent = () => {
  const contentService = loadedContent();
  const defaultLookup = contentService.entityLocations.getMockImplementation()!;
  const multiLocationEntities = new Map<string, EntityHit>([
    ['object|dairy cow', {
      name: 'Dairy cow',
      kind: 'object',
      locations: [{ cx: 49, cy: 52 }, { cx: 50, cy: 51 }],
    }],
    ['object|wheat', {
      name: 'Wheat',
      kind: 'object',
      locations: [{ cx: 49, cy: 51 }, { cx: 49, cy: 52 }],
    }],
    ['object|hopper', {
      name: 'Hopper',
      kind: 'object',
      locations: [{ cx: 49, cy: 51 }, { cx: 50, cy: 53 }],
    }],
  ]);
  contentService.entityLocations.mockImplementation((name, kinds) => (
    multiLocationEntities.get(`${kinds[0]}|${name.toLowerCase()}`)
    ?? defaultLookup(name, kinds)
  ));
  return contentService;
};

const reviewedCookContent = () => {
  const contentService = multiLocationCookContent();
  const defaultLookup = contentService.entityLocations.getMockImplementation()!;
  contentService.entityLocations.mockImplementation((name, kinds) => {
    if (name === 'Cook (Lumbridge)' && kinds[0] === 'npc') {
      return {
        name: 'Cook (Lumbridge)',
        kind: 'npc',
        locations: [{ cx: 50, cy: 50 }],
      };
    }
    return defaultLookup(name, kinds);
  });
  return contentService;
};

const runeProof = (
  contentService: ReturnType<typeof loadedContent>,
  overrides: Record<string, unknown> = {},
) => ({
  availability: 'PREVIEW' as const,
  chunkDataVersion: 73,
  contentService,
  analyze: analyzeQuest,
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, reject, resolve };
};

const renderGoalPlanner = ({
  availability = 'PREVIEW',
  selectedQuest,
  contentService = loadedContent(),
  ...integrationOverrides
}: {
  availability?: 'PUBLIC' | 'PREVIEW' | 'OFF';
  selectedQuest?: string;
  contentService?: ReturnType<typeof loadedContent>;
} & Partial<RuneProofIntegration>) => render(
  <GoalPlannerModal
    onClose={() => undefined}
    initialTarget={selectedQuest ? { kind: 'quest', id: selectedQuest } : undefined}
    runeProof={runeProof(contentService, { availability, ...integrationOverrides })}
  />,
);

const goldenPack = async (questId: string): Promise<RuneProofLoadedPack> => {
  const release = publicRuneProofPackReleases.find(value => value.questId === questId);
  if (!release) throw new Error(`Missing public release for ${questId}.`);
  const loaded = await loadRuneProofPackFor('PUBLIC', release);
  if (!loaded) throw new Error(`Missing public pack for ${questId}.`);
  return loaded;
};

const withCookWalkthroughEntity = (loaded: RuneProofLoadedPack): RuneProofLoadedPack => {
  if (!loaded.legacyProjection) throw new Error('Missing legacy projection fixture.');
  return {
    ...loaded,
    legacyProjection: {
      ...loaded.legacyProjection,
      walkthrough: {
        ...loaded.legacyProjection.walkthrough,
        actions: loaded.legacyProjection.walkthrough.actions.map((action, index) => (
          index === 0
            ? {
                ...action,
                entities: [
                  ...action.entities,
                  { name: 'Cook (Lumbridge)', kind: 'npc' as const },
                ],
              }
            : action
        )),
      },
    },
  };
};

const summariesFor = async (
  ...loaded: readonly RuneProofLoadedPack[]
): Promise<readonly RuneProofCatalogueSummary[]> => {
  const publicSummaries = await loadRuneProofCatalogue('PUBLIC');
  const wanted = new Set(loaded.map(value => value.pack.questId));
  return publicSummaries.filter(summary => wanted.has(summary.questId));
};

const releasedSummaryWithUnresolvedPreflight = (
  questId: string,
): RuneProofCatalogueSummary => catalogueSummary({
  questId,
  requirementStatus: 'UNRESOLVED',
  packDisposition: 'RELEASED',
  reviewStatus: 'PREVIEW_VALIDATED',
  lifecycle: 'PREVIEW_VALIDATED',
  packRevision: 'unresolved-pack-v1',
  playable: true,
});

const instrumentedStorage = (
  entries: readonly (readonly [string, string])[] = [],
): RuneProofStorage & {
  readonly reads: string[];
  readonly writes: string[];
  readonly removes: string[];
  readonly values: Map<string, string>;
} => {
  const values = new Map(entries);
  const reads: string[] = [];
  const writes: string[] = [];
  const removes: string[] = [];
  return {
    reads,
    writes,
    removes,
    values,
    getItem: key => {
      reads.push(key);
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      writes.push(key);
      values.set(key, value);
    },
    removeItem: key => {
      removes.push(key);
      values.delete(key);
    },
  };
};

const catalogueWithNamedRows = (
  count: number,
  overrides: readonly RuneProofCatalogueSummary[],
): readonly RuneProofCatalogueSummary[] => {
  const rows = [...makeCatalogueSummaries(count)];
  overrides.forEach((summary, index) => { rows[index] = summary; });
  return rows;
};

const withAlternativeBranch = (loaded: RuneProofLoadedPack): RuneProofLoadedPack => {
  const main = loaded.pack.branches[0];
  if (!main) throw new Error('Missing main branch fixture.');
  const actionIds = new Map(main.actions.map(action => [
    action.id,
    `alternative:${action.id}`,
  ]));
  const alternativeActions = main.actions.map(action => ({
    ...action,
    id: actionIds.get(action.id)!,
    dependsOn: action.dependsOn.map(dependencyId => (
      actionIds.get(dependencyId) ?? dependencyId
    )),
  }));
  const completionActionId = loaded.pack.completion.branchActionIds[main.id];
  if (!completionActionId) throw new Error('Missing main completion fixture.');

  return {
    ...loaded,
    pack: {
      ...loaded.pack,
      branches: [main, {
        ...main,
        id: 'alternative',
        label: 'Alternative route',
        rank: { ...main.rank, tieBreak: main.rank.tieBreak + 1 },
        actions: alternativeActions,
      }],
      completion: {
        ...loaded.pack.completion,
        branchActionIds: {
          ...loaded.pack.completion.branchActionIds,
          alternative: actionIds.get(completionActionId)!,
        },
      },
    },
  };
};

const nextAction = async () => {
  const heading = await screen.findByRole('heading', { name: 'Do now' });
  const section = heading.closest('section');
  if (!section) throw new Error('Missing RuneProof next-action section');
  return within(section);
};

const coachProgress = (questId: string): HTMLProgressElement => (
  screen.getByRole('progressbar', { name: `${questId} progress` }) as HTMLProgressElement
);

const confirmCurrentAction = async (): Promise<void> => {
  const current = await nextAction();
  await userEvent.click(current.getByRole('checkbox', { name: /^Confirm / }));
};

const seedCookProgress = ({
  confirmedActionIds,
  confirmedItemKeys = [],
  includeIndex = false,
}: {
  readonly confirmedActionIds: readonly string[];
  readonly confirmedItemKeys?: readonly string[];
  readonly includeIndex?: boolean;
}): void => {
  const release = publicRuneProofPackReleases.find(value => value.questId === "Cook's Assistant");
  if (!release) throw new Error("Missing Cook's Assistant release fixture.");
  const updatedAt = '2026-08-23T00:00:00.000Z';
  window.localStorage.setItem(
    runeProofProgressStorageKey('run-a', 'cooks-assistant'),
    JSON.stringify({
      schemaVersion: 2,
      runId: 'run-a',
      questId: "Cook's Assistant",
      packRevision: release.packRevision,
      selectedBranchId: 'main',
      confirmedActionIds,
      confirmedItemKeys,
      manualConfirmationIds: [],
      confirmedCheckpointIds: [],
      updatedAt,
    }),
  );
  if (includeIndex) {
    window.localStorage.setItem(
      runeProofProgressIndexStorageKey('run-a'),
      JSON.stringify({
        schemaVersion: 2,
        runId: 'run-a',
        entries: {
          'cooks-assistant': {
            questId: "Cook's Assistant",
            packRevision: release.packRevision,
            selectedBranchId: 'main',
            completedActionCount: 9,
            totalActionCount: 9,
            complete: true,
            updatedAt,
          },
        },
      }),
    );
  }
};

const coachOnlyAnalysis = (
  questId: string,
  snapshot: QuestRouteAnalysisSnapshot,
  walkthrough: { readonly source: { readonly wikiRevision: string } },
): QuestPreparationRouteAnalysis => ({
  questId,
  status: 'READY_NOW',
  items: [],
  generatedFrom: {
    chunkDataVersion: snapshot.chunkDataVersion,
    questRevision: walkthrough.source.wikiRevision,
    accountFingerprint: 'objective-switching-test',
  },
});

const goalPlannerTargetButton = (questId: string): HTMLButtonElement => {
  const button = screen.getAllByRole('button', { name: new RegExp(questId, 'i') })
    .find(candidate => candidate instanceof HTMLButtonElement && candidate.className.includes('group'));
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing Goal Planner target button for ${questId}.`);
  }
  return button;
};

describe('Goal Planner responsive layout', () => {
  it('stacks the picker above a shrinkable plan on narrow screens while preserving the desktop split', () => {
    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Doric's Quest" }}
        runeProof={runeProof(loadedContent(), { availability: 'OFF' })}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Goal Planner' });
    const modal = dialog.firstElementChild;
    const body = modal?.lastElementChild;
    const picker = body?.firstElementChild;
    const plan = body?.lastElementChild;

    expect(body?.classList.contains('flex-col')).toBe(true);
    expect(body?.classList.contains('sm:flex-row')).toBe(true);
    expect(picker?.classList.contains('w-full')).toBe(true);
    expect(picker?.classList.contains('h-[34%]')).toBe(true);
    expect(picker?.classList.contains('sm:w-[44%]')).toBe(true);
    expect(picker?.classList.contains('sm:h-auto')).toBe(true);
    expect(plan?.classList.contains('min-w-0')).toBe(true);
  });

  it('locks document scrolling behind the modal and restores the prior overflow styles', () => {
    const originalRootOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'scroll';
    let view: ReturnType<typeof render> | undefined;

    try {
      view = render(
        <GoalPlannerModal
          onClose={() => undefined}
          initialTarget={{ kind: 'quest', id: "Doric's Quest" }}
          runeProof={runeProof(loadedContent(), { availability: 'OFF' })}
        />,
      );

      expect(document.documentElement.style.overflow).toBe('hidden');
      expect(document.body.style.overflow).toBe('hidden');

      view.unmount();
      view = undefined;
      expect(document.documentElement.style.overflow).toBe('auto');
      expect(document.body.style.overflow).toBe('scroll');
    } finally {
      view?.unmount();
      document.documentElement.style.overflow = originalRootOverflow;
      document.body.style.overflow = originalBodyOverflow;
    }
  });
});

describe('goalPlannerStepHasWikiLink', () => {
  it('keeps normal goal steps linked to their wiki article', () => {
    expect(goalPlannerStepHasWikiLink(step('Lumbridge', 'Lumbridge'))).toBe(true);
  });

  it('does not invent a wiki article for a combined route alternative', () => {
    expect(goalPlannerStepHasWikiLink(step(
      'alternative:One of: East Ardougne or Tree Gnome Stronghold',
      'One of: East Ardougne or Tree Gnome Stronghold',
    ))).toBe(false);
  });
});

const pryingTimesUnlocks = (): UnlockState => ({
  equipment: {},
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: ['Pandemonium', "The Knight's Sword"],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

it('gives Prying Times a distinct confirmation state', () => {
  const unlocks = pryingTimesUnlocks();
  const target = listGoalTargets().find(target => (
    target.kind === 'quest' && target.id === 'Prying Times'
  ))!;

  expect(goalPlannerTargetState(target, unlocks)).toBe('confirm');
});

it('renders the outstanding Prying Times confirmation instead of ready copy', () => {
  const plan = planForTarget('quest', 'Prying Times', pryingTimesUnlocks())!;
  const markup = renderToStaticMarkup(<GoalPlanReadiness plan={plan} />);

  expect(markup).toContain('Confirm: One open Sailing task slot');
  expect(markup).not.toContain('Available right now');
});

it('does not invent a wiki article for a manual confirmation', () => {
  expect(goalPlannerStepHasWikiLink({ ...step('manual:prying', 'Confirm: One open Sailing task slot'), kind: 'manual' })).toBe(false);
});

describe('RuneProof Goal Planner integration', () => {
  it('searches and filters 210 summaries without loading or analyzing a pack', async () => {
    const summaries = catalogueWithNamedRows(210, [catalogueSummary({
      questId: 'Dragon audit objective',
      membership: 'MEMBERS',
      kind: 'quest',
      requirementStatus: 'UNRESOLVED',
      packDisposition: 'NO_PACK',
      reviewStatus: 'NO_PACK',
      lifecycle: undefined,
      packRevision: undefined,
      playable: false,
      proofState: 'NEEDS_REVIEW',
    })]);
    const loadCatalogue = vi.fn(async () => summaries);
    const loadPack = vi.fn();
    const analyze = vi.fn();
    renderGoalPlanner({
      selectedQuest: 'Dragon audit objective',
      loadCatalogue,
      loadPack,
      analyze,
    });

    expect(await screen.findByText('Showing 210 of 210 objectives')).toBeTruthy();
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search RuneProof objectives' }),
      'dragon',
    );
    await userEvent.selectOptions(screen.getByLabelText('Objective kind'), 'quest');
    await userEvent.selectOptions(screen.getByLabelText('Membership'), 'MEMBERS');
    await userEvent.selectOptions(screen.getByLabelText('Readiness'), 'NEEDS_REVIEW');
    expect(screen.getByText('Showing 1 of 210 objectives')).toBeTruthy();
    expect(loadPack).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
  });

  it('loads and deeply analyzes only the selected playable objective', async () => {
    const first = await goldenPack("Cook's Assistant");
    const second = await goldenPack('Sheep Shearer');
    const summaries = await summariesFor(first, second);
    const loadPack = vi.fn(async (_availability, release) => (
      release.questId === first.pack.questId ? first : second
    ));
    const analyze = vi.fn(analyzeQuestWithWalkthrough);
    renderGoalPlanner({
      selectedQuest: first.pack.questId,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack,
      analyze,
    });

    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', {
      name: /Sheep Shearer.*Open reviewed route/i,
    }));
    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
  });

  it('bounds selected legacy-pack work and reuses it across an in-pack branch switch', async () => {
    const first = await goldenPack("Cook's Assistant");
    const second = withAlternativeBranch(await goldenPack('Sheep Shearer'));
    const summaries = catalogueWithNamedRows(210, await summariesFor(first, second));
    const storage = instrumentedStorage();
    const loadPack = vi.fn(async (_availability, release) => (
      release.questId === first.pack.questId ? first : second
    ));
    const analyze = vi.fn(analyzeQuestWithWalkthrough);
    renderGoalPlanner({
      selectedQuest: first.pack.questId,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack,
      analyze,
      progressStorage: storage,
    });

    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    await userEvent.click(goalPlannerTargetButton(second.pack.questId));
    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));

    objectiveWorkControl.preflightMetrics.length = 0;
    storage.reads.length = 0;
    storage.writes.length = 0;
    storage.removes.length = 0;
    const branchSwitch = screen.getByRole('button', { name: 'Use Alternative route' });
    await userEvent.click(branchSwitch);
    await waitFor(() => expect(branchSwitch).toHaveProperty('disabled', true));
    await waitFor(() => expect(objectiveWorkControl.preflightMetrics).toEqual([{
      headerEvaluations: 210,
      progressIndexLookups: 210,
      packLoads: 0,
      deepAnalyses: 0,
    }]));

    expect(loadPack).toHaveBeenCalledTimes(2);
    expect(analyze).toHaveBeenCalledTimes(2);
    const recordKey = runeProofProgressStorageKey('run-a', second.pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    const transactionKey = 'fate_runeproof_progress_tx_v2:run-a';
    const commitKey = `${transactionKey}:committed`;
    expect(storage.writes.filter(key => key === recordKey)).toHaveLength(1);
    expect(storage.writes.filter(key => key === indexKey)).toHaveLength(1);
    expect(storage.writes).toEqual([transactionKey, recordKey, indexKey, commitKey]);
    expect(storage.reads.every(key => (
      key === transactionKey || key === commitKey || key === recordKey || key === indexKey
    ))).toBe(true);
    expect(storage.writes.filter(key => key.startsWith('fate_runeproof_progress_v2:')))
      .toEqual([recordKey]);
    expect(storage.reads.filter(key => key.startsWith('fate_runeproof_progress_v2:')))
      .toEqual([recordKey, recordKey]);
    expect(storage.removes.filter(key => key.startsWith('fate_runeproof_progress_v2:')))
      .toEqual([]);
    expect(storage.values.has(transactionKey)).toBe(false);
    expect(storage.values.has(commitKey)).toBe(false);
    expect(storage.removes).toEqual([transactionKey, commitKey]);
    expect(JSON.parse(storage.values.get(recordKey) ?? '{}')).toMatchObject({
      schemaVersion: 2,
      runId: 'run-a',
      questId: second.pack.questId,
      selectedBranchId: 'alternative',
    });
  });

  it('keeps an unreleased row visible but falls back to the ordinary planner', async () => {
    const summaries = catalogueWithNamedRows(210, [catalogueSummary({
      questId: "Daddy's Home",
      packDisposition: 'NO_PACK',
      reviewStatus: 'NO_PACK',
      lifecycle: undefined,
      packRevision: undefined,
      playable: false,
      proofState: 'NEEDS_REVIEW',
    })]);
    const loadPack = vi.fn();
    renderGoalPlanner({
      selectedQuest: "Daddy's Home",
      loadCatalogue: vi.fn(async () => summaries),
      loadPack,
    });

    expect(await screen.findByText('Needs review')).toBeTruthy();
    expect(screen.queryByText('Do now')).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: "Daddy's Home" })).toBeTruthy();
    expect(loadPack).not.toHaveBeenCalled();
  });

  it('does not load a released row whose account preflight needs review', async () => {
    const summary = releasedSummaryWithUnresolvedPreflight("Daddy's Home");
    const loadPack = vi.fn();
    renderGoalPlanner({
      selectedQuest: summary.questId,
      loadCatalogue: vi.fn(async () => [summary]),
      loadPack,
    });

    expect(await screen.findByText('Needs review')).toBeTruthy();
    expect(loadPack).not.toHaveBeenCalled();
  });

  it('suppresses the old coach in the selection render before the next pack resolves', async () => {
    const first = await goldenPack("Cook's Assistant");
    const second = await goldenPack('Sheep Shearer');
    const summaries = await summariesFor(first, second);
    const secondLoad = deferred<RuneProofLoadedPack | undefined>();
    const loadPack = vi.fn(async (_availability, release) => (
      release.questId === first.pack.questId ? first : secondLoad.promise
    ));
    renderGoalPlanner({
      selectedQuest: first.pack.questId,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack,
    });
    const firstInstruction = first.pack.branches[0].actions[0].instruction;
    expect((await screen.findAllByText(firstInstruction)).length).toBeGreaterThan(0);

    flushSync(() => {
      screen.getByRole('button', { name: /Sheep Shearer.*Open reviewed route/i }).click();
    });
    expect(screen.queryAllByText(firstInstruction)).toHaveLength(0);
    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(2));

    await act(async () => { secondLoad.resolve(second); });
    expect(await screen.findByRole('heading', { level: 2, name: 'Sheep Shearer' })).toBeTruthy();
  });

  it.each([
    ['packRevision', 'pack-next'],
    ['catalogueRevision', 'catalogue-next'],
    ['lifecycle', 'MILESTONE_APPROVED'],
  ] as const)('invalidates a cached coach when release %s changes', async (field, value) => {
    const loaded = await goldenPack("Cook's Assistant");
    const [summary] = await summariesFor(loaded);
    const oldInstruction = loaded.pack.branches[0].actions[0].instruction;
    const loadPack = vi.fn(async () => loaded);
    const initialCatalogue = vi.fn(async () => [summary]);
    const modal = (loadCatalogue: RuneProofIntegration['loadCatalogue']) => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={runeProof(loadedContent(), {
          loadCatalogue,
          loadPack,
          analyze: analyzeQuestWithWalkthrough,
        })}
      />
    );
    const view = render(modal(initialCatalogue));
    expect((await screen.findAllByText(oldInstruction)).length).toBeGreaterThan(0);
    const nextSummary = {
      ...summary,
      [field]: value,
      reviewStatus: field === 'lifecycle' ? value : summary.reviewStatus,
    } as RuneProofCatalogueSummary;
    const nextCatalogue = vi.fn(async () => [nextSummary]);

    flushSync(() => { view.rerender(modal(nextCatalogue)); });
    expect(screen.queryAllByText(oldInstruction)).toHaveLength(0);
    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(2));
  });

  it('invalidates cached analysis when an injected service identity changes', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const loadCatalogue = vi.fn(async () => summaries);
    const loadPack = vi.fn(async () => loaded);
    const firstAnalyze = vi.fn(analyzeQuestWithWalkthrough);
    const secondAnalyze = vi.fn(analyzeQuestWithWalkthrough);
    const contentService = loadedContent();
    const modal = (analyze: typeof analyzeQuestWithWalkthrough) => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={runeProof(contentService, { loadCatalogue, loadPack, analyze })}
      />
    );
    const view = render(modal(firstAnalyze));
    const oldInstruction = loaded.pack.branches[0].actions[0].instruction;
    expect((await screen.findAllByText(oldInstruction)).length).toBeGreaterThan(0);

    flushSync(() => { view.rerender(modal(secondAnalyze)); });
    expect(screen.queryAllByText(oldInstruction)).toHaveLength(0);
    await waitFor(() => expect(secondAnalyze).toHaveBeenCalledTimes(1));
  });

});
// TASK_13_CURRENT_TESTS_START
describe('RuneProof Task 13 catalogue, pack, and platform review contracts', () => {
  it.each(['pack', 'content initialization'] as const)(
    'cancels deferred %s work when controlled Close leaves the modal mounted',
    async pendingStage => {
      const loaded = await goldenPack("Cook's Assistant");
      const summaries = await summariesFor(loaded);
      const packLoad = deferred<RuneProofLoadedPack | undefined>();
      const initialization = deferred<boolean>();
      const contentService = loadedContent(() => initialization.promise);
      const loadPack = vi.fn(() => pendingStage === 'pack'
        ? packLoad.promise
        : Promise.resolve(loaded));
      const analyze = vi.fn(analyzeQuestWithWalkthrough);
      const progressStorage = instrumentedStorage();
      const onClose = vi.fn();
      const view = render(
        <GoalPlannerModal
          onClose={onClose}
          initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
          runeProof={runeProof(contentService, {
            loadCatalogue: vi.fn(async () => summaries),
            loadPack,
            analyze,
            progressStorage,
          })}
        />,
      );

      await waitFor(() => expect(loadPack).toHaveBeenCalledOnce());
      if (pendingStage === 'content initialization') {
        await waitFor(() => expect(contentService.initCalls).toBe(1));
      }
      const readsAtClose = [...progressStorage.reads];
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledOnce();

      await act(async () => {
        if (pendingStage === 'pack') packLoad.resolve(loaded);
        else initialization.resolve(true);
        await Promise.resolve();
      });

      expect(loadPack).toHaveBeenCalledOnce();
      expect(contentService.initCalls).toBe(pendingStage === 'pack' ? 0 : 1);
      expect(analyze).not.toHaveBeenCalled();
      expect(progressStorage.reads).toEqual(readsAtClose);
      expect(view.container.querySelector(`progress[aria-label="${loaded.pack.questId} progress"]`))
        .toBeNull();
      expect(screen.queryByRole('heading', { level: 2, name: loaded.pack.questId })).toBeNull();
    },
  );

  it('cancels deferred pack work when the modal unmounts', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const pending = deferred<RuneProofLoadedPack | undefined>();
    const contentService = loadedContent();
    const loadPack = vi.fn(() => pending.promise);
    const analyze = vi.fn(analyzeQuestWithWalkthrough);
    const progressStorage = instrumentedStorage();
    const view = renderGoalPlanner({
      selectedQuest: loaded.pack.questId,
      contentService,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack,
      analyze,
      progressStorage,
    });

    await waitFor(() => expect(loadPack).toHaveBeenCalledOnce());
    const readsAtUnmount = [...progressStorage.reads];
    view.unmount();
    await act(async () => { pending.resolve(loaded); await Promise.resolve(); });

    expect(loadPack).toHaveBeenCalledOnce();
    expect(contentService.initCalls).toBe(0);
    expect(analyze).not.toHaveBeenCalled();
    expect(progressStorage.reads).toEqual(readsAtUnmount);
  });

  it('cancels deferred pack work before opening platform review', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const pending = deferred<RuneProofLoadedPack | undefined>();
    const contentService = loadedContent();
    const loadPack = vi.fn(() => pending.promise);
    const analyze = vi.fn(analyzeQuestWithWalkthrough);
    const progressStorage = instrumentedStorage();
    renderGoalPlanner({
      selectedQuest: loaded.pack.questId,
      contentService,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack,
      analyze,
      progressStorage,
    });

    await waitFor(() => expect(loadPack).toHaveBeenCalledOnce());
    const readsAtReview = [...progressStorage.reads];
    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    expect(await screen.findAllByRole('tab')).toHaveLength(5);
    await act(async () => { pending.resolve(loaded); await Promise.resolve(); });

    expect(loadPack).toHaveBeenCalledOnce();
    expect(contentService.initCalls).toBe(0);
    expect(analyze).not.toHaveBeenCalled();
    expect(progressStorage.reads).toEqual(readsAtReview);
    expect(screen.queryByRole('heading', { level: 2, name: loaded.pack.questId })).toBeNull();
  });

  it('deduplicates a pending pack load across canonically identical unlock rerenders', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const pending = deferred<RuneProofLoadedPack | undefined>();
    const contentService = loadedContent();
    const loadCatalogue = vi.fn(async () => summaries);
    const loadPack = vi.fn(() => pending.promise);
    const analyze = vi.fn(analyzeQuestWithWalkthrough);
    const integration = runeProof(contentService, { loadCatalogue, loadPack, analyze });
    const modal = () => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={integration}
      />
    );
    const view = render(modal());
    await waitFor(() => expect(loadPack).toHaveBeenCalledOnce());

    gameSnapshot = {
      ...gameSnapshot,
      unlocks: structuredClone(gameSnapshot.unlocks),
    };
    flushSync(() => { view.rerender(modal()); });
    await act(async () => { await Promise.resolve(); });
    expect(loadPack).toHaveBeenCalledOnce();

    await act(async () => { pending.resolve(loaded); });
    expect(await screen.findByRole('heading', { level: 2, name: loaded.pack.questId })).toBeTruthy();
    expect(loadPack).toHaveBeenCalledOnce();
    expect(contentService.initCalls).toBe(1);
    expect(analyze).toHaveBeenCalledOnce();
  });

  it('does not revive resolved catalogue state across a PREVIEW to OFF to PREVIEW round trip', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const nextCatalogue = deferred<readonly RuneProofCatalogueSummary[]>();
    const packLoad = deferred<RuneProofLoadedPack | undefined>();
    const loadCatalogue = vi.fn()
      .mockResolvedValueOnce(summaries)
      .mockImplementationOnce(() => nextCatalogue.promise);
    const loadPack = vi.fn(() => packLoad.promise);
    const integration = runeProof(loadedContent(), { loadCatalogue, loadPack });
    const modal = (availability: 'PREVIEW' | 'OFF') => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={{ ...integration, availability }}
      />
    );
    const view = render(modal('PREVIEW'));
    expect(await screen.findByText('Showing 1 of 1 objectives')).toBeTruthy();
    await waitFor(() => expect(loadPack).toHaveBeenCalledOnce());

    flushSync(() => { view.rerender(modal('OFF')); });
    flushSync(() => { view.rerender(modal('PREVIEW')); });
    expect(screen.queryByText('Showing 1 of 1 objectives')).toBeNull();
    expect(loadPack).toHaveBeenCalledOnce();

    await act(async () => { nextCatalogue.resolve([]); });
    expect(loadPack).toHaveBeenCalledOnce();
  });

  it('ignores an A1 catalogue promise after a PREVIEW to OFF to PREVIEW A2 transition', async () => {
    const first = deferred<readonly RuneProofCatalogueSummary[]>();
    const second = deferred<readonly RuneProofCatalogueSummary[]>();
    const oldRows = makeCatalogueSummaries(210);
    const currentRow = catalogueSummary({
      questId: "Daddy's Home",
      packDisposition: 'NO_PACK',
      reviewStatus: 'NO_PACK',
      lifecycle: undefined,
      packRevision: undefined,
      playable: false,
      proofState: 'NEEDS_REVIEW',
    });
    const loadCatalogue = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const loadPack = vi.fn();
    const integration = runeProof(loadedContent(), { loadCatalogue, loadPack });
    const modal = (availability: 'PREVIEW' | 'OFF') => (
      <GoalPlannerModal onClose={() => undefined} runeProof={{ ...integration, availability }} />
    );
    const view = render(modal('PREVIEW'));
    await waitFor(() => expect(loadCatalogue).toHaveBeenCalledOnce());
    flushSync(() => { view.rerender(modal('OFF')); });
    flushSync(() => { view.rerender(modal('PREVIEW')); });
    await waitFor(() => expect(loadCatalogue).toHaveBeenCalledTimes(2));

    await act(async () => { second.resolve([currentRow]); });
    expect(await screen.findByText('Showing 1 of 1 objectives')).toBeTruthy();
    await act(async () => { first.resolve(oldRows); });
    expect(screen.getByText('Showing 1 of 1 objectives')).toBeTruthy();
    expect(screen.queryByText('Showing 210 of 210 objectives')).toBeNull();
    expect(loadPack).not.toHaveBeenCalled();
  });

  it('ignores an A1 catalogue rejection after A2 has loaded', async () => {
    const first = deferred<readonly RuneProofCatalogueSummary[]>();
    const currentRow = catalogueSummary({
      questId: "Daddy's Home",
      packDisposition: 'REJECTED',
      reviewStatus: 'REJECTED',
      lifecycle: undefined,
      packRevision: undefined,
      playable: false,
      proofState: 'NEEDS_REVIEW',
    });
    const loadCatalogue = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce([currentRow]);
    const integration = runeProof(loadedContent(), { loadCatalogue });
    const modal = (availability: 'PREVIEW' | 'OFF') => (
      <GoalPlannerModal onClose={() => undefined} runeProof={{ ...integration, availability }} />
    );
    const view = render(modal('PREVIEW'));
    await waitFor(() => expect(loadCatalogue).toHaveBeenCalledOnce());
    flushSync(() => { view.rerender(modal('OFF')); });
    flushSync(() => { view.rerender(modal('PREVIEW')); });
    expect(await screen.findByText('Showing 1 of 1 objectives')).toBeTruthy();

    await act(async () => { first.reject(new Error('stale A1 rejection')); });
    expect(screen.getByText('Showing 1 of 1 objectives')).toBeTruthy();
  });

  it('does not revive a resolved review workspace after a PREVIEW round trip', async () => {
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    if (!harness) throw new Error('Missing review harness fixture');
    const loadReviewHarness = vi.fn(async () => harness);
    const integration = runeProof(loadedContent(), {
      loadCatalogue: vi.fn(async () => []),
      loadReviewHarness,
    });
    const modal = (availability: 'PREVIEW' | 'PUBLIC') => (
      <GoalPlannerModal onClose={() => undefined} runeProof={{ ...integration, availability }} />
    );
    const view = render(modal('PREVIEW'));
    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    expect(await screen.findAllByRole('tab')).toHaveLength(5);

    flushSync(() => { view.rerender(modal('PUBLIC')); });
    flushSync(() => { view.rerender(modal('PREVIEW')); });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByText('Platform review harness — not a quest')).toBeNull();
    expect(loadReviewHarness).toHaveBeenCalledOnce();
  });

  it('ignores an opening A1 review promise and permits one explicit A2 opening', async () => {
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    if (!harness) throw new Error('Missing review harness fixture');
    const first = deferred<RuneProofPlatformReviewHarness | undefined>();
    const second = deferred<RuneProofPlatformReviewHarness | undefined>();
    const loadReviewHarness = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const integration = runeProof(loadedContent(), {
      loadCatalogue: vi.fn(async () => []),
      loadReviewHarness,
    });
    const modal = (availability: 'PREVIEW' | 'PUBLIC') => (
      <GoalPlannerModal onClose={() => undefined} runeProof={{ ...integration, availability }} />
    );
    const view = render(modal('PREVIEW'));
    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    expect(screen.getByRole('status').textContent).toContain('Loading platform review');

    flushSync(() => { view.rerender(modal('PUBLIC')); });
    flushSync(() => { view.rerender(modal('PREVIEW')); });
    expect(screen.queryByText('Loading platform review…')).toBeNull();
    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    expect(loadReviewHarness).toHaveBeenCalledTimes(2);
    await act(async () => { first.resolve(harness); });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Loading platform review');
    await act(async () => { second.resolve(harness); });
    expect(await screen.findAllByRole('tab')).toHaveLength(5);
    expect(loadReviewHarness).toHaveBeenCalledTimes(2);
  });

  it('does not revive an A1 review rejection after a PREVIEW round trip', async () => {
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    if (!harness) throw new Error('Missing review harness fixture');
    const next = deferred<RuneProofPlatformReviewHarness | undefined>();
    const loadReviewHarness = vi.fn()
      .mockRejectedValueOnce(new Error('A1 unavailable'))
      .mockImplementationOnce(() => next.promise);
    const integration = runeProof(loadedContent(), {
      loadCatalogue: vi.fn(async () => []),
      loadReviewHarness,
    });
    const modal = (availability: 'PREVIEW' | 'PUBLIC') => (
      <GoalPlannerModal onClose={() => undefined} runeProof={{ ...integration, availability }} />
    );
    const view = render(modal('PREVIEW'));
    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    expect(await screen.findByText('Platform review unavailable.')).toBeTruthy();

    flushSync(() => { view.rerender(modal('PUBLIC')); });
    flushSync(() => { view.rerender(modal('PREVIEW')); });
    expect(screen.queryByText('Platform review unavailable.')).toBeNull();
    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    expect(screen.getByRole('status').textContent).toContain('Loading platform review');
    await act(async () => { next.resolve(harness); });
    expect(await screen.findAllByRole('tab')).toHaveLength(5);
  });


  it('browses the complete preview catalogue and metadata without loading or analyzing a pack', async () => {
    const catalogue = await loadRuneProofCatalogue('PREVIEW');
    const noPack = catalogue.find(summary => summary.packDisposition === 'NO_PACK');
    if (!noPack) throw new Error('Missing no-pack preview catalogue fixture.');
    const loadPack = vi.fn();
    const analyze = vi.fn();
    renderGoalPlanner({
      selectedQuest: noPack.questId,
      loadCatalogue: vi.fn(async () => catalogue),
      loadPack,
      analyze,
    });

    expect(await screen.findByText('Showing 210 of 210 objectives')).toBeTruthy();
    const recommendations = screen.getByRole('region', { name: 'Recommended RuneProof quests' });
    expect(within(recommendations).getAllByRole('button').length).toBeLessThanOrEqual(3);
    expect(recommendations.textContent).not.toContain('Needs review');

    const kind = screen.getByRole('combobox', { name: 'Objective kind' });
    await userEvent.selectOptions(kind, 'quest');
    expect(screen.getByText('Showing 191 of 210 objectives')).toBeTruthy();
    await userEvent.selectOptions(kind, 'miniquest');
    expect(screen.getByText('Showing 19 of 210 objectives')).toBeTruthy();
    await userEvent.selectOptions(kind, 'ALL');

    const membership = screen.getByRole('combobox', { name: 'Membership' });
    await userEvent.selectOptions(membership, 'F2P');
    expect(screen.getByText('Showing 23 of 210 objectives')).toBeTruthy();
    await userEvent.selectOptions(membership, 'MEMBERS');
    expect(screen.getByText('Showing 187 of 210 objectives')).toBeTruthy();
    await userEvent.selectOptions(membership, 'ALL');

    const metadata = screen.getByText(`Review metadata for ${noPack.questId}`);
    await userEvent.click(metadata);
    expect(metadata.closest('details')).toHaveProperty('open', true);
    expect(loadPack).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
  });

  it('keeps a selected no-pack row selected after hydration and recommendation effects flush', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const [released] = await summariesFor(loaded);
    const noPack = catalogueSummary({
      questId: "Daddy's Home",
      packDisposition: 'NO_PACK',
      reviewStatus: 'NO_PACK',
      lifecycle: undefined,
      packRevision: undefined,
      playable: false,
      proofState: 'NEEDS_REVIEW',
    });
    const loadPack = vi.fn();
    renderGoalPlanner({
      selectedQuest: noPack.questId,
      loadCatalogue: vi.fn(async () => [released, noPack]),
      loadPack,
    });

    expect(await screen.findByRole('heading', { level: 3, name: noPack.questId })).toBeTruthy();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('heading', { level: 3, name: noPack.questId })).toBeTruthy();
    expect(loadPack).not.toHaveBeenCalled();
  });

  it('loads a compiled pack without deep analysis when it has no legacy projection', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const packOnly: RuneProofLoadedPack = { pack: loaded.pack };
    const analyze = vi.fn();
    const contentService = loadedContent();
    renderGoalPlanner({
      selectedQuest: loaded.pack.questId,
      contentService,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack: vi.fn(async () => packOnly),
      analyze,
    });

    expect(await screen.findByRole('heading', { level: 2, name: loaded.pack.questId })).toBeTruthy();
    expect(analyze).not.toHaveBeenCalled();
    expect(contentService.initCalls).toBe(0);
  });

  it('rejects an injected pack whose legacy projection is not correlated to the release', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const malformed: RuneProofLoadedPack = {
      ...loaded,
      legacyProjection: loaded.legacyProjection && {
        ...loaded.legacyProjection,
        strategy: { ...loaded.legacyProjection.strategy, questId: 'Wrong Quest' },
      },
    };
    const analyze = vi.fn();
    renderGoalPlanner({
      selectedQuest: loaded.pack.questId,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack: vi.fn(async () => malformed),
      analyze,
    });

    expect(await screen.findByText('Analysis unavailable')).toBeTruthy();
    expect(analyze).not.toHaveBeenCalled();
  });

  it.each([
    ['pack quest', (loaded: RuneProofLoadedPack) => ({
      ...loaded, pack: { ...loaded.pack, questId: 'Wrong Quest' },
    })],
    ['pack revision', (loaded: RuneProofLoadedPack) => ({
      ...loaded, pack: { ...loaded.pack, revision: 'wrong-revision' },
    })],
    ['pack catalogue revision', (loaded: RuneProofLoadedPack) => ({
      ...loaded, pack: { ...loaded.pack, catalogueRevision: 'wrong-catalogue' },
    })],
    ['pack catalogue quest', (loaded: RuneProofLoadedPack) => ({
      ...loaded,
      pack: { ...loaded.pack, catalogue: { ...loaded.pack.catalogue, questId: 'Wrong Quest' } },
    })],
    ['walkthrough quest', (loaded: RuneProofLoadedPack) => ({
      ...loaded,
      legacyProjection: loaded.legacyProjection && {
        ...loaded.legacyProjection,
        walkthrough: { ...loaded.legacyProjection.walkthrough, questId: 'Wrong Quest' },
      },
    })],
    ['walkthrough revision', (loaded: RuneProofLoadedPack) => ({
      ...loaded,
      legacyProjection: loaded.legacyProjection && {
        ...loaded.legacyProjection,
        walkthrough: { ...loaded.legacyProjection.walkthrough, revision: 'wrong-revision' },
      },
    })],
    ['strategy quest', (loaded: RuneProofLoadedPack) => ({
      ...loaded,
      legacyProjection: loaded.legacyProjection && {
        ...loaded.legacyProjection,
        strategy: { ...loaded.legacyProjection.strategy, questId: 'Wrong Quest' },
      },
    })],
    ['strategy revision', (loaded: RuneProofLoadedPack) => ({
      ...loaded,
      legacyProjection: loaded.legacyProjection && {
        ...loaded.legacyProjection,
        strategy: { ...loaded.legacyProjection.strategy, revision: 'wrong-revision' },
      },
    })],
    ['reviewed requirement quest', (loaded: RuneProofLoadedPack) => ({
      ...loaded,
      legacyProjection: loaded.legacyProjection && {
        ...loaded.legacyProjection,
        reviewedRequirements: {
          ...loaded.legacyProjection.reviewedRequirements,
          questId: 'Wrong Quest',
        },
      },
    })],
  ] as const)('requires exact release correlation for the %s identity', async (_field, mutate) => {
    const loaded = await goldenPack("Cook's Assistant");
    const release = publicRuneProofPackReleases.find(value => value.questId === loaded.pack.questId);
    if (!release) throw new Error('Missing release fixture.');

    expect(runeProofLoadedPackMatchesRelease(loaded, release)).toBe(true);
    expect(runeProofLoadedPackMatchesRelease(mutate(loaded), release)).toBe(false);
  });

  it('waits for the current run and storage index hydration before one pack load', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const firstStorage = instrumentedStorage([
      [runeProofProgressIndexStorageKey('run-a'), JSON.stringify({
        schemaVersion: 2,
        runId: 'run-a',
        entries: {},
      })],
    ]);
    const secondStorage = instrumentedStorage([
      [runeProofProgressIndexStorageKey('run-b'), JSON.stringify({
        schemaVersion: 2,
        runId: 'run-b',
        entries: {},
      })],
    ]);
    const loadPack = vi.fn(async () => loaded);
    const modal = (storage: RuneProofStorage) => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={runeProof(loadedContent(), {
          loadCatalogue: vi.fn(async () => summaries),
          loadPack,
          progressStorage: storage,
        })}
      />
    );
    const view = render(modal(firstStorage));
    expect(loadPack).not.toHaveBeenCalled();
    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(1));

    gameSnapshot = { ...gameSnapshot, runId: 'run-b' };
    flushSync(() => { view.rerender(modal(secondStorage)); });
    expect(screen.queryByRole('heading', { level: 2, name: loaded.pack.questId })).toBeNull();
    expect(loadPack).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(2));
  });

  it('waits for a replacement progress storage index before reloading the pack', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const firstStorage = instrumentedStorage();
    const secondStorage = instrumentedStorage();
    const loadCatalogue = vi.fn(async () => summaries);
    const loadPack = vi.fn(async () => loaded);
    const contentService = loadedContent();
    const modal = (progressStorage: RuneProofStorage) => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={runeProof(contentService, {
          loadCatalogue,
          loadPack,
          progressStorage,
        })}
      />
    );
    const view = render(modal(firstStorage));
    const instruction = loaded.pack.branches[0].actions[0].instruction;
    expect((await screen.findAllByText(instruction)).length).toBeGreaterThan(0);
    expect(loadPack).toHaveBeenCalledOnce();

    flushSync(() => { view.rerender(modal(secondStorage)); });
    expect(screen.queryAllByText(instruction)).toHaveLength(0);
    expect(loadPack).toHaveBeenCalledOnce();
    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(2));
  });

  it('suppresses the old coach in the chunk-data-version render', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const loadCatalogue = vi.fn(async () => summaries);
    const loadPack = vi.fn(async () => loaded);
    const contentService = loadedContent();
    const modal = (chunkDataVersion: number) => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={runeProof(contentService, { chunkDataVersion, loadCatalogue, loadPack })}
      />
    );
    const view = render(modal(73));
    const instruction = loaded.pack.branches[0].actions[0].instruction;
    expect((await screen.findAllByText(instruction)).length).toBeGreaterThan(0);

    flushSync(() => { view.rerender(modal(74)); });
    expect(screen.queryAllByText(instruction)).toHaveLength(0);
    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(2));
  });

  it('suppresses the old coach in the account-identity render', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const loadCatalogue = vi.fn(async () => summaries);
    const loadPack = vi.fn(async () => loaded);
    const contentService = loadedContent();
    const modal = () => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={runeProof(contentService, { loadCatalogue, loadPack })}
      />
    );
    const view = render(modal());
    const instruction = loaded.pack.branches[0].actions[0].instruction;
    expect((await screen.findAllByText(instruction)).length).toBeGreaterThan(0);

    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ levels: { ...gameSnapshot.unlocks.levels, Cooking: 98 } }),
    };
    flushSync(() => { view.rerender(modal()); });
    expect(screen.queryAllByText(instruction)).toHaveLength(0);
    await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(2));
  });

  it('hides a keyed pack failure immediately when selection changes', async () => {
    const cook = await goldenPack("Cook's Assistant");
    const sheep = await goldenPack('Sheep Shearer');
    const summaries = await summariesFor(cook, sheep);
    const sheepLoad = deferred<RuneProofLoadedPack | undefined>();
    const loadPack = vi.fn(async (_availability, release) => (
      release.questId === cook.pack.questId ? undefined : sheepLoad.promise
    ));
    renderGoalPlanner({
      selectedQuest: cook.pack.questId,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack,
    });
    expect(await screen.findByText('Analysis unavailable')).toBeTruthy();

    flushSync(() => { goalPlannerTargetButton(sheep.pack.questId).click(); });
    expect(screen.queryByText('Analysis unavailable')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Loading Sheep Shearer');
    await act(async () => { sheepLoad.resolve(sheep); });
  });

  it('hides a keyed pack failure immediately when the pack service changes', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const next = deferred<RuneProofLoadedPack | undefined>();
    const loadCatalogue = vi.fn(async () => summaries);
    const modal = (loadPack: RuneProofIntegration['loadPack']) => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={runeProof(loadedContent(), { loadCatalogue, loadPack })}
      />
    );
    const view = render(modal(vi.fn(async () => undefined)));
    expect(await screen.findByText('Analysis unavailable')).toBeTruthy();

    flushSync(() => { view.rerender(modal(vi.fn(async () => next.promise))); });
    expect(screen.queryByText('Analysis unavailable')).toBeNull();
    await act(async () => { next.resolve(loaded); });
  });

  it('writes only V2 pack progress and never mutates canonical quest completion', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const completedBefore = [...gameSnapshot.unlocks.quests];
    renderGoalPlanner({
      selectedQuest: loaded.pack.questId,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack: vi.fn(async () => loaded),
    });
    const confirmation = await screen.findByRole('checkbox');
    await userEvent.click(confirmation);
    await waitFor(() => expect(window.localStorage.getItem(
      runeProofProgressStorageKey('run-a', loaded.pack.catalogue.slug),
    )).not.toBeNull());

    expect(window.localStorage.getItem(runeProofProgressIndexStorageKey('run-a'))).not.toBeNull();
    expect(window.localStorage.getItem(runeProofPreviewStorageKey('run-a'))).toBeNull();
    expect(window.localStorage.getItem(runeProofPreviewActionStorageKey('run-a'))).toBeNull();
    expect(gameSnapshot.unlocks.quests).toEqual(completedBefore);
  });

  it('opens the exact five-state platform review without catalogue, pack, analysis, or durable writes', async () => {
    const noPack = catalogueSummary({
      questId: "Daddy's Home",
      packDisposition: 'NO_PACK',
      reviewStatus: 'NO_PACK',
      lifecycle: undefined,
      packRevision: undefined,
      playable: false,
      proofState: 'NEEDS_REVIEW',
    });
    const loadPack = vi.fn();
    const analyze = vi.fn();
    const loadReviewHarness = vi.fn(loadRuneProofPlatformReviewHarness);
    const progressStorage = instrumentedStorage();
    renderGoalPlanner({
      selectedQuest: noPack.questId,
      loadCatalogue: vi.fn(async () => [noPack]),
      loadPack,
      analyze,
      loadReviewHarness,
      progressStorage,
    });
    await screen.findByText('Showing 1 of 1 objectives');
    const durableBefore = new Map(previewStorage);
    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    const tabs = await screen.findAllByRole('tab');

    expect(screen.getByText('Platform review harness — not a quest')).toBeTruthy();
    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Ready', 'Confirm', 'Blocked', 'Needs review', 'Complete',
    ]);
    expect(new Set(tabs.map(tab => tab.textContent)).size).toBe(5);
    for (const [index, state] of [
      'Ready', 'Needs confirmation', 'Blocked', 'Needs review', 'Complete',
    ].entries()) {
      await userEvent.click(tabs[index]);
      expect(await screen.findByText(`Proof state: ${state}`)).toBeTruthy();
    }
    expect(loadReviewHarness).toHaveBeenCalledOnce();
    expect(loadPack).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
    expect(progressStorage.reads.every(key => !key.includes('runeproof-platform-review')))
      .toBe(true);
    await userEvent.click(tabs[1]);
    const [checkbox] = await screen.findAllByRole('checkbox');
    await userEvent.click(checkbox);
    expect(new Map(previewStorage)).toEqual(durableBefore);
  });

  it.each([
    ['malformed', async () => ({ marker: 'wrong', scenarios: [] })],
    ['missing-scenario', async () => {
      const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
      return harness && { ...harness, scenarios: harness.scenarios.slice(0, 4) };
    }],
    ['extra-scenario', async () => {
      const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
      return harness && { ...harness, scenarios: [...harness.scenarios, harness.scenarios[0]] };
    }],
    ['rejected', async () => { throw new Error('review failed'); }],
  ])('contains a %s platform review load', async (_case, loadReviewHarness) => {
    renderGoalPlanner({ loadReviewHarness: loadReviewHarness as RuneProofIntegration['loadReviewHarness'] });
    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    expect(await screen.findByText('Platform review unavailable.')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('deduplicates rapid activation of the same pending platform review loader', async () => {
    const pending = deferred<RuneProofPlatformReviewHarness | undefined>();
    const loadReviewHarness = vi.fn(() => pending.promise);
    renderGoalPlanner({ loadReviewHarness });
    const button = screen.getByRole('button', { name: 'Review branch and combat controls' });

    await userEvent.click(button);
    await userEvent.click(button);
    expect(loadReviewHarness).toHaveBeenCalledOnce();

    await act(async () => {
      pending.resolve(await loadRuneProofPlatformReviewHarness('PREVIEW'));
    });
    const tabs = await screen.findAllByRole('tab');
    expect(tabs).toHaveLength(5);
    await userEvent.click(tabs[1]);
    await userEvent.click(button);
    expect(loadReviewHarness).toHaveBeenCalledOnce();
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });

  it('suppresses stale catalogue rows and harness in the PREVIEW to PUBLIC render', async () => {
    const previewRows = makeCatalogueSummaries(210);
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    if (!harness) throw new Error('Missing review harness fixture');
    const publicLoad = deferred<readonly RuneProofCatalogueSummary[]>();
    const previewCatalogue = vi.fn(async () => previewRows);
    const publicCatalogue = vi.fn(() => publicLoad.promise);
    const modal = (availability: 'PREVIEW' | 'PUBLIC', loadCatalogue: RuneProofIntegration['loadCatalogue']) => (
      <GoalPlannerModal
        onClose={() => undefined}
        runeProof={runeProof(loadedContent(), {
          availability,
          loadCatalogue,
          loadReviewHarness: vi.fn(async () => harness),
        })}
      />
    );
    const view = render(modal('PREVIEW', previewCatalogue));
    await screen.findByText('Showing 210 of 210 objectives');
    await userEvent.click(screen.getByRole('button', { name: 'Review branch and combat controls' }));
    expect(await screen.findAllByRole('tab')).toHaveLength(5);

    flushSync(() => { view.rerender(modal('PUBLIC', publicCatalogue)); });
    expect(screen.queryByText('Showing 210 of 210 objectives')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Review branch and combat controls' })).toBeNull();
    await act(async () => { publicLoad.resolve([]); });
  });

  it('suppresses stale catalogue rows in the loader-identity render', async () => {
    const oldRows = makeCatalogueSummaries(210);
    const nextLoad = deferred<readonly RuneProofCatalogueSummary[]>();
    const firstLoader = vi.fn(async () => oldRows);
    const secondLoader = vi.fn(() => nextLoad.promise);
    const modal = (loadCatalogue: RuneProofIntegration['loadCatalogue']) => (
      <GoalPlannerModal
        onClose={() => undefined}
        runeProof={runeProof(loadedContent(), { loadCatalogue })}
      />
    );
    const view = render(modal(firstLoader));
    await screen.findByText('Showing 210 of 210 objectives');
    flushSync(() => { view.rerender(modal(secondLoader)); });
    expect(screen.queryByText('Showing 210 of 210 objectives')).toBeNull();
    await act(async () => { nextLoad.resolve([]); });
  });

  it('suppresses a loaded review harness in the harness-loader-identity render', async () => {
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    if (!harness) throw new Error('Missing review harness fixture');
    const nextLoad = deferred<RuneProofPlatformReviewHarness | undefined>();
    const firstLoader = vi.fn(async () => harness);
    const secondLoader = vi.fn(() => nextLoad.promise);
    const loadCatalogue = vi.fn(async () => []);
    const contentService = loadedContent();
    const modal = (loadReviewHarness: RuneProofIntegration['loadReviewHarness']) => (
      <GoalPlannerModal
        onClose={() => undefined}
        runeProof={runeProof(contentService, { loadCatalogue, loadReviewHarness })}
      />
    );
    const view = render(modal(firstLoader));
    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    expect(await screen.findAllByRole('tab')).toHaveLength(5);

    flushSync(() => { view.rerender(modal(secondLoader)); });
    expect(screen.queryByRole('tablist')).toBeNull();
    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    expect(screen.getByRole('status').textContent).toContain('Loading platform review');
    await act(async () => { nextLoad.resolve(harness); });
    expect(await screen.findAllByRole('tab')).toHaveLength(5);
  });

  it('restores the cached quest coach and focus after closing platform review', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const loadPack = vi.fn(async () => loaded);
    const analyze = vi.fn(analyzeQuestWithWalkthrough);
    renderGoalPlanner({
      selectedQuest: loaded.pack.questId,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack,
      analyze,
    });
    const instruction = loaded.pack.branches[0].actions[0].instruction;
    expect((await screen.findAllByText(instruction)).length).toBeGreaterThan(0);
    const reviewButton = screen.getByRole('button', { name: 'Review branch and combat controls' });
    reviewButton.focus();
    await userEvent.click(reviewButton);
    expect(await screen.findAllByRole('tab')).toHaveLength(5);
    const showMap = screen.getByRole('button', { name: /^Show .* on map$/ });
    await userEvent.click(showMap);
    expect(screen.getByRole('button', { name: 'Close map and return to RuneProof' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close platform review', hidden: true }));

    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close map and return to RuneProof' })).toBeNull();
    expect(screen.queryByText('Selected route chunk details')).toBeNull();
    expect(screen.getAllByText(instruction).length).toBeGreaterThan(0);
    expect(loadPack).toHaveBeenCalledOnce();
    expect(analyze).toHaveBeenCalledOnce();
    await waitFor(() => expect(document.activeElement).toBe(reviewButton));
  });

  it('invalidates cached analysis when only the content service identity changes', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const loadCatalogue = vi.fn(async () => summaries);
    const loadPack = vi.fn(async () => loaded);
    const analyze = vi.fn(analyzeQuestWithWalkthrough);
    const modal = (contentService: ReturnType<typeof loadedContent>) => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={runeProof(contentService, { loadCatalogue, loadPack, analyze })}
      />
    );
    const view = render(modal(loadedContent()));
    const instruction = loaded.pack.branches[0].actions[0].instruction;
    expect((await screen.findAllByText(instruction)).length).toBeGreaterThan(0);
    expect(analyze).toHaveBeenCalledTimes(1);

    flushSync(() => { view.rerender(modal(loadedContent())); });
    expect(screen.queryAllByText(instruction)).toHaveLength(0);
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
  });

  it('ignores a stale platform review result after availability changes', async () => {
    const pending = deferred<RuneProofPlatformReviewHarness | undefined>();
    const previewLoader = vi.fn(() => pending.promise);
    const publicCatalogue = vi.fn(async () => []);
    const modal = (availability: 'PREVIEW' | 'PUBLIC') => (
      <GoalPlannerModal
        onClose={() => undefined}
        runeProof={runeProof(loadedContent(), {
          availability,
          loadCatalogue: publicCatalogue,
          loadReviewHarness: previewLoader,
        })}
      />
    );
    const view = render(modal('PREVIEW'));
    await userEvent.click(screen.getByRole('button', { name: 'Review branch and combat controls' }));
    expect(screen.getByRole('status').textContent).toContain('Loading platform review');

    flushSync(() => { view.rerender(modal('PUBLIC')); });
    expect(screen.queryByText('Loading platform review…')).toBeNull();
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    await act(async () => { pending.resolve(harness); });
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('rejects a harness with duplicate scenario identities', async () => {
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    if (!harness) throw new Error('Missing review harness fixture');
    const duplicate = {
      ...harness,
      scenarios: harness.scenarios.map((scenario, index) => index === 1
        ? { ...scenario, id: harness.scenarios[0].id }
        : scenario),
    };
    renderGoalPlanner({ loadReviewHarness: vi.fn(async () => duplicate) as RuneProofIntegration['loadReviewHarness'] });
    await userEvent.click(screen.getByRole('button', { name: 'Review branch and combat controls' }));
    expect(await screen.findByText('Platform review unavailable.')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it.each([
    ['compiled pack', (scenario: RuneProofPlatformReviewHarness['scenarios'][number]) => ({
      ...scenario,
      pack: { questId: 'malformed-pack' },
    })],
    ['requirement snapshot', (scenario: RuneProofPlatformReviewHarness['scenarios'][number]) => ({
      ...scenario,
      snapshot: {},
    })],
  ] as const)('fails closed before hooks receive a malformed review %s', async (_field, mutate) => {
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    if (!harness) throw new Error('Missing review harness fixture');
    const malformed = {
      ...harness,
      scenarios: harness.scenarios.map((scenario, index) => index === 0
        ? mutate(scenario)
        : scenario),
    };
    const progressStorage = instrumentedStorage();
    renderGoalPlanner({
      loadCatalogue: vi.fn(async () => []),
      loadReviewHarness: vi.fn(async () => malformed) as RuneProofIntegration['loadReviewHarness'],
      progressStorage,
    });
    await waitFor(() => expect(progressStorage.reads.length).toBeGreaterThan(0));
    const readsBeforeReview = [...progressStorage.reads];

    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));
    expect(await screen.findByText('Platform review unavailable.')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(progressStorage.reads).toEqual(readsBeforeReview);
  });

  it('characterizes the five empty-progress review states through the production pack coach', async () => {
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    if (!harness) throw new Error('Missing review harness fixture');
    expect(harness.scenarios.map(scenario => [
      scenario.id,
      buildRuneProofPackCoachModel({
        pack: scenario.pack,
        progress: {
          schemaVersion: 2,
          runId: 'runeproof-platform-review',
          questId: scenario.pack.questId,
          packRevision: scenario.pack.revision,
          confirmedActionIds: [],
          confirmedItemKeys: [],
          manualConfirmationIds: [],
          confirmedCheckpointIds: [],
          updatedAt: '1970-01-01T00:00:00.000Z',
        },
        requirementSnapshot: scenario.snapshot,
        completedQuestIds: new Set(scenario.completedQuestIds),
      }).proofState,
    ])).toEqual([
      ['READY', 'READY'],
      ['CONFIRM', 'CONFIRM'],
      ['BLOCKED', 'BLOCKED'],
      ['NEEDS_REVIEW', 'NEEDS_REVIEW'],
      ['COMPLETE', 'COMPLETE'],
    ]);
  });

  it('rejects a compiled harness whose Blocked snapshot projects Ready', async () => {
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    if (!harness) throw new Error('Missing review harness fixture');
    const mutated = {
      ...harness,
      scenarios: harness.scenarios.map(scenario => scenario.id === 'BLOCKED'
        ? {
            ...scenario,
            snapshot: {
              ...scenario.snapshot,
              levels: { ...scenario.snapshot.levels, Mining: 99 },
            },
          }
        : scenario),
    };
    const blocked = mutated.scenarios[2];
    expect(buildRuneProofPackCoachModel({
      pack: blocked.pack,
      progress: {
        schemaVersion: 2,
        runId: 'runeproof-platform-review',
        questId: blocked.pack.questId,
        packRevision: blocked.pack.revision,
        confirmedActionIds: [],
        confirmedItemKeys: [],
        manualConfirmationIds: [],
        confirmedCheckpointIds: [],
        updatedAt: '1970-01-01T00:00:00.000Z',
      },
      requirementSnapshot: blocked.snapshot,
      completedQuestIds: new Set(blocked.completedQuestIds),
    }).proofState).toBe('READY');
    expect(await validatedRuneProofPlatformReviewHarness(mutated)).toBeUndefined();
  });

  it('fails closed before review progress receives a semantically mismatched harness', async () => {
    const harness = await loadRuneProofPlatformReviewHarness('PREVIEW');
    if (!harness) throw new Error('Missing review harness fixture');
    const mismatched = {
      ...harness,
      scenarios: harness.scenarios.map(scenario => scenario.id === 'BLOCKED'
        ? {
            ...scenario,
            snapshot: {
              ...scenario.snapshot,
              levels: { ...scenario.snapshot.levels, Mining: 99 },
            },
          }
        : scenario),
    };
    const progressStorage = instrumentedStorage();
    renderGoalPlanner({
      loadCatalogue: vi.fn(async () => []),
      loadReviewHarness: vi.fn(async () => mismatched),
      progressStorage,
    });
    await waitFor(() => expect(progressStorage.reads.length).toBeGreaterThan(0));
    const readsBeforeReview = [...progressStorage.reads];

    await userEvent.click(screen.getByRole('button', {
      name: 'Review branch and combat controls',
    }));

    expect(await screen.findByText('Platform review unavailable.')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(progressStorage.reads).toEqual(readsBeforeReview);
  });

  it('restores the ordinary OFF-mode empty search result', async () => {
    renderGoalPlanner({ availability: 'OFF' });
    await userEvent.type(
      screen.getByPlaceholderText('Search quests, diaries, regions…'),
      'no ordinary objective has this exact label',
    );
    expect(screen.getByText('No matches.')).toBeTruthy();
  });

  it('restores ordinary OFF-mode selected metadata and row interaction styling', () => {
    const selectedTarget = listGoalTargets().find(target => target.label === "Doric's Quest");
    if (!selectedTarget) throw new Error("Missing Doric's Quest ordinary target.");
    renderGoalPlanner({ availability: 'OFF', selectedQuest: selectedTarget.id });

    const selectedRow = screen.getByRole('button', { name: /Doric's Quest/ });
    expect(selectedRow.getAttribute('aria-current')).toBe('true');
    expect(selectedRow.textContent).toContain(`Quest · ${selectedTarget.group}`);
    expect(selectedRow.className).toContain('bg-cyan-900/25');
    expect(selectedRow.className).toContain('border-cyan-500/30');

    const ordinaryRow = screen.getByRole('button', { name: /Sheep Shearer/ });
    expect(ordinaryRow.className).toContain('hover:bg-white/5');
    expect(ordinaryRow.className).toContain('transition-colors');
  });

  it('restores the ordinary OFF-mode wide-open zero-step message', () => {
    renderGoalPlanner({ availability: 'OFF', selectedQuest: 'Druidic Ritual' });
    expect(screen.getByText('No prerequisites — this target is wide open.')).toBeTruthy();
  });

  it('exposes exactly five public objectives and no platform review controls', async () => {
    const view = renderGoalPlanner({ availability: 'PUBLIC' });
    expect(await screen.findByText('Showing 5 of 5 objectives')).toBeTruthy();
    const rows = Array.from(view.container.querySelectorAll<HTMLButtonElement>('button.group'));
    const questIds = rows.map(row => row.getAttribute('aria-label')?.split(' — ')[0]);
    expect(rows).toHaveLength(5);
    expect(new Set(questIds).size).toBe(5);
    expect(screen.queryByRole('button', { name: 'Review branch and combat controls' })).toBeNull();
    expect(view.container.textContent).not.toContain(['RUNEPROOF', 'PLATFORM', 'REVIEW', 'HARNESS', 'V1'].join('_'));
  });
});
describe('Retained RuneProof Goal Planner integration', () => {
  it('uses the five independently authored guides in public RuneProof and hides preview-only quests', async () => {
    const view = renderGoalPlanner({
      availability: 'PUBLIC',
      selectedQuest: "Daddy's Home",
    });

    expect(await screen.findByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(view.container.textContent).toContain('Choose a RuneProof quest and follow its verified route.');
    expect(view.container.textContent).not.toContain('reviewed RuneProof route');
    expect(screen.getAllByText('Speak with the Cook in Lumbridge Castle to begin.')).toHaveLength(2);
    await waitFor(() => {
      const visibleTargets = Array.from(view.container.querySelectorAll<HTMLButtonElement>('button.group'))
        .map(button => button.textContent?.split('Quest')[0]?.trim())
        .sort();
      expect(visibleTargets).toEqual([
        "Cook's Assistant",
        'Imp Catcher',
        'Rune Mysteries',
        'Sheep Shearer',
        'The Restless Ghost',
      ]);
    });
    expect(view.container.textContent).not.toContain("Daddy's Home");
  });

  it("selects the first ranked private-preview objective without changing the off-mode empty state", async () => {
    const off = render(
      <GoalPlannerModal
        onClose={() => undefined}
        runeProof={runeProof(loadedContent(), { availability: 'OFF' })}
      />,
    );
    expect(screen.getByText('Choose a goal')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();
    off.unmount();

    render(
      <GoalPlannerModal
        onClose={() => undefined}
        runeProof={runeProof(loadedContent())}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Recommended RuneProof quests' })).toBeTruthy();
    expect(screen.getAllByText('Speak with the Cook in Lumbridge Castle to begin.').length)
      .toBeGreaterThan(0);
  });

  it('keeps an in-progress target search selected while the preview catalogue loads', async () => {
    const catalogue = deferred<readonly RuneProofCatalogueSummary[]>();
    const summaries = await loadRuneProofCatalogue('PREVIEW');
    const user = userEvent.setup();

    renderGoalPlanner({ loadCatalogue: vi.fn(() => catalogue.promise) });

    const search = screen.getByRole('searchbox', { name: 'Search RuneProof objectives' });
    await user.type(search, "Daddy's Home");
    expect(screen.getByText('Choose a RuneProof objective')).toBeTruthy();

    await act(async () => { catalogue.resolve(summaries); });

    expect(await screen.findByRole('region', { name: 'Recommended RuneProof quests' })).toBeTruthy();
    expect(screen.getByDisplayValue("Daddy's Home")).toBeTruthy();
    expect(screen.getByRole('button', { name: "Daddy's Home" })).toBeTruthy();
    expect(screen.getByText('Choose a RuneProof objective')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();
  });

  it('keeps confirmation state for every Wave 1 strategy while objectives switch', async () => {
    gameSnapshot = { ...gameSnapshot, gameModeId: 'vanilla' };
    const journalQuestsBefore = [...gameSnapshot.unlocks.quests];
    const objectives = [
      { questId: "Cook's Assistant", total: 9 },
      { questId: 'Sheep Shearer', total: 5 },
      { questId: 'The Restless Ghost', total: 7 },
      { questId: 'Rune Mysteries', total: 5 },
      { questId: 'Imp Catcher', total: 6 },
    ];

    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(loadedContent(), { analyze: coachOnlyAnalysis })}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Recommended RuneProof quests' })).toBeTruthy();

    const search = screen.getByRole('searchbox', { name: 'Search RuneProof objectives' });
    for (const objective of objectives) {
      fireEvent.change(search, { target: { value: objective.questId } });
      fireEvent.click(goalPlannerTargetButton(objective.questId));
      await screen.findByRole('heading', { name: objective.questId });

      const progress = screen.getByRole('progressbar', { name: `${objective.questId} progress` });
      expect(progress).toHaveProperty('max', objective.total);
      expect(progress).toHaveProperty('value', 0);

      const current = await nextAction();
      fireEvent.click(current.getByRole('checkbox', { name: /^Confirm / }));
      await waitFor(() => expect(progress).toHaveProperty('value', 1));
    }

    for (const objective of objectives) {
      fireEvent.change(search, { target: { value: objective.questId } });
      fireEvent.click(goalPlannerTargetButton(objective.questId));
      await screen.findByRole('heading', { name: objective.questId });

      expect(screen.getByRole('progressbar', { name: `${objective.questId} progress` }))
        .toHaveProperty('value', 1);
    }

    expect(gameSnapshot.unlocks.quests).toEqual(journalQuestsBefore);
  });

  it("makes Cook's reviewed coach the primary preview workspace", async () => {
    const view = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
    });

    expect(await screen.findByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(screen.queryByText('Quest requirements')).toBeNull();
    expect(screen.queryByText('Best route: Black Knight')).toBeNull();
    expect(screen.queryByText('Analysis incomplete')).toBeNull();
    expect(screen.getByRole('button', { name: 'Change objective' })).toBeTruthy();
    expect(view.container.querySelector('.max-w-5xl')).toBeTruthy();
    expect(view.container.querySelector('.max-w-3xl')).toBeNull();
  });

  it('brands the reviewed preview as RuneProof without renaming the ordinary Goal Planner', async () => {
    const preview = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
    });

    const runeProofDialog = await screen.findByRole('dialog', { name: 'RuneProof' });
    expect(within(runeProofDialog).getByRole('heading', { level: 2, name: 'RuneProof' })).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search RuneProof objectives' })).toBeTruthy();
    preview.unmount();

    renderGoalPlanner({
      availability: 'OFF',
      selectedQuest: "Cook's Assistant",
    });

    const plannerDialog = screen.getByRole('dialog', { name: 'Goal Planner' });
    expect(within(plannerDialog).getByRole('heading', { level: 2, name: 'Goal Planner' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Search quests, diaries, regions…')).toBeTruthy();
  });

  it('shows the full preview catalogue and preserves an untreated initial RuneProof target', async () => {
    const view = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Daddy's Home",
    });

    expect(await screen.findByText('Showing 210 of 210 objectives')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: "Daddy's Home" })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Needs review');
    expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();

    const search = screen.getByRole('searchbox', { name: 'Search RuneProof objectives' });
    await userEvent.type(search, "Daddy's Home");
    expect(view.container.querySelectorAll('button.group')).toHaveLength(1);
    expect(screen.getByRole('button', { name: "Daddy's Home" })).toBeTruthy();
  });

  it('moves mobile keyboard objective selection focus to Change objective', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 639px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const user = userEvent.setup();
    renderGoalPlanner({ availability: 'PREVIEW', selectedQuest: "Cook's Assistant" });

    await screen.findByRole('heading', { name: 'Do now' });
    await user.click(screen.getByRole('button', { name: 'Change objective' }));

    const recommendations = screen.getByRole('region', { name: 'Recommended RuneProof quests' });
    within(recommendations).getByRole('button', { name: /Sheep Shearer/ }).focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { level: 2, name: 'Sheep Shearer' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change objective' }));
  });

  it("shows the reviewed chunk on every Cook's Assistant route step", async () => {
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
      contentService: reviewedCookContent(),
    });

    await screen.findByRole('heading', { name: 'Do now' });
    const rows = within(screen.getByRole('list', { name: "Cook's Assistant route" }))
      .getAllByRole('listitem');
    const expectedChunks = [
      'Chunk 50,50',
      'Chunk 50,50',
      'Chunk 50,50',
      'Chunk 50,51',
      'Chunk 50,51',
      'Chunk 49,51',
      'Chunk 49,51',
      'Chunk 50,50',
      'Chunk 50,50',
    ];

    expect(rows).toHaveLength(expectedChunks.length);
    rows.forEach((row, index) => {
      expect(within(row).getByText(`Surface chunks: ${expectedChunks[index].replace('Chunk ', '')}`))
        .toBeTruthy();
    });
  });

  it("preserves a direct Daddy's Home target as an ordinary needs-review plan", async () => {
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Daddy's Home",
    });

    expect(await screen.findByRole('heading', { level: 3, name: "Daddy's Home" })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Needs review');
    expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change objective' })).toBeTruthy();
  });

  it('cannot render stale Cook coach output after rapidly switching targets', async () => {
    const cookLoad = deferred<boolean>();
    const sheepLoad = deferred<boolean>();
    let request = 0;
    const contentService = loadedContent(() => (
      request++ === 0 ? cookLoad.promise : sheepLoad.promise
    ));
    const view = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
      contentService,
    });

    await waitFor(() => {
      expect(view.container.querySelectorAll('button.group').length).toBeGreaterThan(0);
    });
    goalPlannerTargetButton('Sheep Shearer').click();
    await act(async () => { cookLoad.resolve(true); });
    expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();
    expect(view.container.textContent).not.toContain('Pick up the empty pot beside the Cook');

    await act(async () => { sheepLoad.resolve(true); });
    expect(await screen.findByRole('heading', { level: 2, name: 'Sheep Shearer' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Do now' })).toBeTruthy();
  });

  it('persists isolated action progress across a true close and reopen', async () => {
    const first = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
    });

    const firstAction = await nextAction();
    expect(firstAction.getByText('Speak with the Cook in Lumbridge Castle to begin.')).toBeTruthy();
    await userEvent.click(firstAction.getByRole('checkbox', {
      name: 'Confirm Speak with the Cook in Lumbridge Castle to begin.',
    }));
    await waitFor(() => {
      expect(firstAction.getByText("Take the empty pot from the Cook's kitchen."))
        .toBeTruthy();
    });
    const stored = JSON.parse(window.localStorage.getItem(
      runeProofProgressStorageKey('run-a', 'cooks-assistant'),
    ) ?? '{}');
    expect(stored).toMatchObject({
      schemaVersion: 2,
      runId: 'run-a',
      questId: "Cook's Assistant",
      confirmedActionIds: ['cooks-assistant:start-quest'],
      confirmedItemKeys: [],
      manualConfirmationIds: [],
      confirmedCheckpointIds: [],
    });
    expect(window.localStorage.getItem(runeProofPreviewActionStorageKey('run-a'))).toBeNull();

    first.unmount();
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
    });

    const reopenedAction = await nextAction();
    expect(reopenedAction.getByText("Take the empty pot from the Cook's kitchen."))
      .toBeTruthy();
    expect(reopenedAction.queryByText('Speak with the Cook in Lumbridge Castle to begin.'))
      .toBeNull();
  });

  it('confirms a current ingredient through isolated item progress rather than action progress', async () => {
    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ chunks: ['50,50', '50,51'] }),
    };
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
    });
    const user = userEvent.setup();

    const current = await nextAction();
    await user.click(current.getByRole('checkbox', { name: /^Confirm / }));
    await user.click(current.getByRole('checkbox', { name: /^Confirm / }));
    await user.click(current.getByRole('checkbox', { name: /^Confirm / }));
    expect(current.getByText('Use the bucket on a dairy cow in the Lumbridge field.'))
      .toBeTruthy();

    await user.click(current.getByRole('checkbox', { name: /^Confirm / }));

    expect(JSON.parse(window.localStorage.getItem(
      runeProofProgressStorageKey('run-a', 'cooks-assistant'),
    ) ?? '{}')).toMatchObject({
        confirmedItemKeys: ['bucket of milk'],
        confirmedActionIds: [
          'cooks-assistant:start-quest',
          'cooks-assistant:take-pot',
          'cooks-assistant:take-bucket',
        ],
      });
    expect(window.localStorage.getItem(runeProofPreviewStorageKey('run-a'))).toBeNull();
    expect(window.localStorage.getItem(runeProofPreviewActionStorageKey('run-a'))).toBeNull();
    expect(current.getByText('Pick up an egg at the chicken farm beside the cow field.'))
      .toBeTruthy();
  });

  it('confirms the final RuneProof step to 9/9 without completing the Journal quest', async () => {
    const earlierActionIds = [
      'cooks-assistant:start-quest',
      'cooks-assistant:take-pot',
      'cooks-assistant:take-bucket',
      'cooks-assistant:pick-grain',
      'cooks-assistant:return-to-cook',
    ];
    seedCookProgress({
      confirmedActionIds: earlierActionIds,
      confirmedItemKeys: ['bucket of milk', 'egg', 'pot of flour'],
    });
    const journalQuestsBefore = [...gameSnapshot.unlocks.quests];
    const first = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
    });
    const user = userEvent.setup();

    const current = await nextAction();
    expect(coachProgress("Cook's Assistant").value).toBe(8);
    expect(current.getByText("Cook's Assistant is complete.")).toBeTruthy();
    await user.click(current.getByRole('checkbox', {
      name: "Confirm Cook's Assistant is complete.",
    }));

    await waitFor(() => expect(coachProgress("Cook's Assistant").value).toBe(9));
    expect(screen.getByText('All reviewed actions are complete.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Recommended RuneProof quests' }))
      .getAllByRole('button')[0]?.textContent).toContain('Sheep Shearer');
    expect(gameSnapshot.unlocks.quests).toEqual(journalQuestsBefore);
    expect(JSON.parse(window.localStorage.getItem(
      runeProofProgressStorageKey('run-a', 'cooks-assistant'),
    ) ?? '{}')).toMatchObject({
      confirmedActionIds: [...earlierActionIds, 'cooks-assistant:complete'],
      confirmedItemKeys: ['bucket of milk', 'egg', 'pot of flour'],
    });

    first.unmount();
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
    });
    await waitFor(() => expect(coachProgress("Cook's Assistant").value).toBe(9));
    expect(screen.getByText('All reviewed actions are complete.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Recommended RuneProof quests' }))
      .getAllByRole('button')[0]?.textContent).toContain('Sheep Shearer');
    expect(gameSnapshot.unlocks.quests).toEqual(journalQuestsBefore);
  });

  it('skips completed Cook when a no-target preview remount auto-selects its first objective', async () => {
    seedCookProgress({
      confirmedActionIds: [
        'cooks-assistant:start-quest',
        'cooks-assistant:take-pot',
        'cooks-assistant:take-bucket',
        'cooks-assistant:pick-grain',
        'cooks-assistant:return-to-cook',
        'cooks-assistant:complete',
      ],
      confirmedItemKeys: ['bucket of milk', 'egg', 'pot of flour'],
      includeIndex: true,
    });

    render(
      <GoalPlannerModal
        onClose={() => undefined}
        runeProof={runeProof(loadedContent())}
      />,
    );

    expect(await screen.findByRole('heading', { level: 2, name: 'Sheep Shearer' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Recommended RuneProof quests' }))
      .queryByRole('button', { name: /Cook's Assistant/ })).toBeNull();
  });

  it('keeps RuneProof mounted while its temporary map opens and closes', async () => {
    const onClose = vi.fn();
    const onOpenWorldChunk = vi.fn();
    const user = userEvent.setup();
    render(
      <GoalPlannerModal
        onClose={onClose}
        onOpenWorldChunk={onOpenWorldChunk}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(loadedContent())}
      />,
    );

    const current = await nextAction();
    const plannerDialog = screen.getByRole('dialog', { name: 'RuneProof' });
    expect(current.getByText('Speak with the Cook in Lumbridge Castle to begin.')).toBeTruthy();
    await user.click(current.getByRole('checkbox', { name: /^Confirm / }));
    const coachScroller = current
      .getByText("Take the empty pot from the Cook's kitchen.")
      .closest<HTMLElement>('.custom-scrollbar');
    if (!coachScroller) throw new Error('Missing RuneProof scroll container.');
    coachScroller.scrollTop = 173;
    await user.click(current.getByRole('button', {
      name: "Show Take the empty pot from the Cook's kitchen. on map",
    }));

    const map = screen.getByRole('dialog', {
      name: "Temporary map for Take the empty pot from the Cook's kitchen.",
    });
    expect(within(map).getByText('Chunk 50,50')).toBeTruthy();
    expect(map.getAttribute('aria-modal')).toBe('true');
    expect(map.closest('.custom-scrollbar')).toBeNull();
    expect(plannerDialog.getAttribute('aria-hidden')).toBe('true');
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenWorldChunk).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', {
      name: "Temporary map for Take the empty pot from the Cook's kitchen.",
    })).toBeNull();
    expect(current.getByText("Take the empty pot from the Cook's kitchen."))
      .toBeTruthy();
    expect(coachProgress("Cook's Assistant").value).toBe(1);
    expect(coachScroller.scrollTop).toBe(173);
    expect(plannerDialog.getAttribute('aria-hidden')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    const showMap = current.getByRole('button', {
      name: "Show Take the empty pot from the Cook's kitchen. on map",
    });
    await user.click(showMap);
    const closeButtonMap = screen.getByRole('dialog', {
      name: "Temporary map for Take the empty pot from the Cook's kitchen.",
    });
    await user.click(within(closeButtonMap).getByRole('button', {
      name: 'Close map and return to RuneProof',
    }));

    expect(onClose).not.toHaveBeenCalled();
    expect(coachProgress("Cook's Assistant").value).toBe(1);
    expect(coachScroller.scrollTop).toBe(173);
    expect(document.activeElement).toBe(showMap);

    await user.click(showMap);
    const backdropMap = screen.getByRole('dialog', {
      name: "Temporary map for Take the empty pot from the Cook's kitchen.",
    });
    const backdrop = backdropMap.parentElement;
    if (!backdrop) throw new Error('Missing RuneProof temporary map backdrop.');
    await user.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
    expect(current.getByText("Take the empty pot from the Cook's kitchen."))
      .toBeTruthy();
    expect(coachProgress("Cook's Assistant").value).toBe(1);
    expect(coachScroller.scrollTop).toBe(173);
    expect(document.activeElement).toBe(showMap);
  });

  it('keeps the local mill blocker and map handoff exact when live entities have multiple locations', async () => {
    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ chunks: ['50,51'] }),
      gameModeId: 'chunked',
    };
    seedCookProgress({
      confirmedActionIds: [
        'cooks-assistant:start-quest',
        'cooks-assistant:take-pot',
        'cooks-assistant:take-bucket',
      ],
      confirmedItemKeys: ['bucket of milk', 'egg'],
    });
    const onClose = vi.fn();
    const onOpenWorldChunk = vi.fn();
    const contentService = multiLocationCookContent();
    render(
      <GoalPlannerModal
        onClose={onClose}
        onOpenWorldChunk={onOpenWorldChunk}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(contentService)}
      />,
    );

    const current = await nextAction();
    expect(current.getByText('Pick grain outside Mill Lane Mill.')).toBeTruthy();
    expect(current.getByText('Surface chunks: 49,51')).toBeTruthy();
    await userEvent.click(current.getByRole('button', {
      name: 'Show Pick grain outside Mill Lane Mill. on map',
    }));

    const map = screen.getByRole('dialog', {
      name: 'Temporary map for Pick grain outside Mill Lane Mill.',
    });
    expect(within(map).getByText('Chunk 49,51')).toBeTruthy();
    expect(contentService.entityLocations).toHaveBeenCalledWith('Wheat', ['object']);
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenWorldChunk).not.toHaveBeenCalled();
    await userEvent.click(within(map).getByRole('button', {
      name: 'Close map and return to RuneProof',
    }));
    expect(current.getByText('Surface chunks: 49,51')).toBeTruthy();
  });

  it('keeps the local flour blocker and map handoff exact after grain is confirmed', async () => {
    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ chunks: ['50,51'] }),
      gameModeId: 'chunked',
    };
    seedCookProgress({
      confirmedActionIds: [
        'cooks-assistant:start-quest',
        'cooks-assistant:take-pot',
        'cooks-assistant:take-bucket',
        'cooks-assistant:pick-grain',
      ],
      confirmedItemKeys: ['bucket of milk', 'egg'],
    });
    const onClose = vi.fn();
    const onOpenWorldChunk = vi.fn();
    render(
      <GoalPlannerModal
        onClose={onClose}
        onOpenWorldChunk={onOpenWorldChunk}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(multiLocationCookContent())}
      />,
    );

    const current = await nextAction();
    expect(current.getByText('Grind the grain at Mill Lane Mill and collect the flour in your pot.'))
      .toBeTruthy();
    expect(current.getByText('Surface chunks: 49,51')).toBeTruthy();
    await userEvent.click(current.getByRole('button', {
      name: 'Show Grind the grain at Mill Lane Mill and collect the flour in your pot. on map',
    }));

    const map = screen.getByRole('dialog', {
      name: 'Temporary map for Grind the grain at Mill Lane Mill and collect the flour in your pot.',
    });
    expect(within(map).getByText('Chunk 49,51')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenWorldChunk).not.toHaveBeenCalled();
    await userEvent.click(within(map).getByRole('button', {
      name: 'Close map and return to RuneProof',
    }));
    expect(current.getByText('Surface chunks: 49,51')).toBeTruthy();
  });

  it('contains deep analysis failures and keeps the objective picker usable', async () => {
    const contentService = loadedContent();
    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(contentService, {
          analyze: () => { throw new Error('projection failure'); },
        })}
      />,
    );

    expect((await screen.findByRole('status')).textContent).toContain('Analysis unavailable');
    const recommendations = screen.getByRole('region', { name: 'Recommended RuneProof quests' });
    expect(within(recommendations).getAllByRole('button')).toHaveLength(3);
    await userEvent.click(within(recommendations).getByRole('button', { name: /Sheep Shearer/ }));

    expect((await screen.findByRole('status')).textContent).toContain('Analysis unavailable');
  });

  it('keeps unsupported targets in Goal Planner and preserves catalogued preview quests', async () => {
    const unsupportedQuest = listGoalTargets().find(target => (
      target.kind === 'quest' && !isRuneProofQuestSupported(target.id)
    ))!;
    const diary = listGoalTargets().find(target => target.kind === 'diary')!;
    const region = listGoalTargets().find(target => target.kind === 'region')!;

    for (const target of [unsupportedQuest, diary, region]) {
      const contentService = loadedContent();
      const off = render(
        <GoalPlannerModal
          onClose={() => undefined}
          initialTarget={{ kind: target.kind, id: target.id }}
          runeProof={runeProof(contentService, { availability: 'OFF' })}
        />,
      );
      expect(off.container.textContent).toContain(target.label);
      cleanup();

      const preview = render(
        <GoalPlannerModal
          onClose={() => undefined}
          initialTarget={{ kind: target.kind, id: target.id }}
          runeProof={runeProof(contentService)}
        />,
      );

      if (target.kind === 'quest') {
        expect(await screen.findByRole('heading', { level: 3, name: target.label })).toBeTruthy();
        expect((await screen.findByRole('status')).textContent).toContain('Needs review');
        expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();
      } else {
        expect(await screen.findByRole(
          'heading',
          { level: 2, name: "Cook's Assistant" },
          { timeout: 5_000 },
        ))
          .toBeTruthy();
        expect(preview.container.textContent).not.toContain(target.label);
      }
      expect(await screen.findByRole('region', { name: 'Recommended RuneProof quests' })).toBeTruthy();
      expect(contentService.initCalls).toBe(target.kind === 'quest' ? 0 : 1);
      expect(screen.queryByRole('region', { name: `${target.id} main path map` })).toBeNull();
      cleanup();
    }
  });

  it('leaves a reviewed quest unchanged when RuneProof is off', () => {
    const contentService = loadedContent();
    const initialTarget = { kind: 'quest' as const, id: "Cook's Assistant" };
    const existing = render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={initialTarget}
        runeProof={runeProof(contentService, { availability: 'OFF' })}
      />,
    );
    const existingMarkup = existing.container.innerHTML;
    cleanup();

    const disabled = render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={initialTarget}
        runeProof={runeProof(contentService, { availability: 'OFF' })}
      />,
    );

    expect(disabled.container.innerHTML).toBe(existingMarkup);
    expect(contentService.initCalls).toBe(0);
    expect(screen.queryByText('RuneProof')).toBeNull();
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();
  });

  it('builds the primary coach from a materialized current snapshot in preview', async () => {
    const contentService = loadedContent();
    let observed: QuestRouteAnalysisSnapshot | undefined;
    const integration = runeProof(contentService, {
      analyze: (questId: string, snapshot: QuestRouteAnalysisSnapshot) => {
        observed = snapshot;
        return analyzeQuest(questId, snapshot);
      },
    });

    const view = render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={integration}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(view.container.textContent).not.toContain('Best route: milk-cow');
    expect(view.container.textContent).not.toContain('Best route: Use Hopper');
    expect(observed).toMatchObject({
      chunkDataVersion: 73,
      unlockedChunks: ['19,57', '50,50'],
      unlocks: {
        levels: { Cooking: 99, Construction: 99, Mining: 99 },
        quests: ['Druidic Ritual'],
        guilds: ['Cooks Guild'],
        merchants: ['General store'],
        minigames: ['Tempoross'],
        mobility: ['Fairy rings'],
        slayerUnlocks: ['Bigger and Badder'],
      },
      connectGraph: { '19,57': ['20,57'] },
    });
    expect(observed?.itemSourceRecords.map(record => record.itemName)).toEqual([
      'Egg', 'Bucket', 'Grain', 'Pot',
    ]);
    expect(observed?.recipes.map(recipe => recipe.id)).toEqual([
      'grain-to-flour',
      'milk-cow',
      'pick-wheat',
    ]);
    expect(observed?.entityLocations.map(hit => hit.name)).toEqual(['Dairy cow', 'Hopper']);
    expect(contentService.entityLocations).not.toHaveBeenCalledWith('Cook (Lumbridge)', ['npc']);
    expect(observed?.stationRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Hopper',
        rawRequirements: [
          { raw: 'Cook access', origin: 'ENTITY' },
          { raw: 'Druidic Ritual', origin: 'CHUNK_ENTRY' },
        ],
      }),
      expect.objectContaining({
        name: 'Dairy cow',
        rawRequirements: [{ raw: 'Druidic Ritual', origin: 'CHUNK_ENTRY' }],
      }),
    ]));
  });

  it('copies an exact walkthrough entity into the deterministically sorted snapshot', async () => {
    const contentService = loadedContent();
    const loaded = withCookWalkthroughEntity(await goldenPack("Cook's Assistant"));
    const summaries = await summariesFor(loaded);
    const stationLookup = contentService.entityLocations.getMockImplementation()!;
    contentService.entityLocations.mockImplementation((name, kinds) => {
      if (name === 'Cook (Lumbridge)' && kinds[0] === 'npc') {
        return {
          name: 'Cook (Lumbridge)',
          kind: 'npc',
          locations: [{ cx: 50, cy: 50 }],
        };
      }
      return stationLookup(name, kinds);
    });
    let observed: QuestRouteAnalysisSnapshot | undefined;
    renderGoalPlanner({
      selectedQuest: "Cook's Assistant",
      contentService,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack: vi.fn(async () => loaded),
      analyze: (questId: string, snapshot: QuestRouteAnalysisSnapshot) => {
        observed = snapshot;
        return analyzeQuest(questId, snapshot, loaded.legacyProjection!.walkthrough);
      },
    });

    await screen.findByText('RuneProof');
    expect(contentService.entityLocations).toHaveBeenCalledWith('Cook (Lumbridge)', ['npc']);
    expect(observed?.entityLocations.map(hit => hit.name)).toEqual([
      'Cook (Lumbridge)',
      'Dairy cow',
      'Hopper',
    ]);
  });

  it('isolates a missing walkthrough entity from recipe stations and route analysis', async () => {
    const contentService = loadedContent();
    const loaded = withCookWalkthroughEntity(await goldenPack("Cook's Assistant"));
    const summaries = await summariesFor(loaded);
    let observed: QuestRouteAnalysisSnapshot | undefined;
    renderGoalPlanner({
      selectedQuest: "Cook's Assistant",
      contentService,
      loadCatalogue: vi.fn(async () => summaries),
      loadPack: vi.fn(async () => loaded),
      analyze: (questId: string, snapshot: QuestRouteAnalysisSnapshot) => {
        observed = snapshot;
        return analyzeQuest(questId, snapshot, loaded.legacyProjection!.walkthrough);
      },
    });

    await screen.findByText('RuneProof');
    expect(contentService.entityLocations).toHaveBeenCalledWith('Cook (Lumbridge)', ['npc']);
    expect(observed?.entityLocations.map(hit => hit.name)).toEqual(['Dairy cow', 'Hopper']);
    expect(observed?.stationRequirements).toHaveLength(2);
  });

  it('materializes exact free and named-region chunks for a Vanilla account', async () => {
    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ regions: ['Falador'], chunks: [] }),
      gameModeId: 'vanilla',
    };
    let observed: QuestRouteAnalysisSnapshot | undefined;
    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(loadedContent(), {
          analyze: (questId: string, snapshot: QuestRouteAnalysisSnapshot) => {
            observed = snapshot;
            return analyzeQuest(questId, snapshot);
          },
        })}
      />,
    );

    await screen.findByText('RuneProof');
    expect(observed).toMatchObject({
      gameModeId: 'vanilla',
      unlocks: { regions: ['Falador'], chunks: [] },
    });
    expect(observed?.unlockedChunks).toEqual(ALL_CHUNK_KEYS.filter((key) => {
      const { cx, cy } = parseChunkKey(key);
      return chunkUnlocked(cx, cy, gameSnapshot.unlocks, gameSnapshot.gameModeId);
    }));
    expect(observed?.unlockedChunks).toEqual(expect.arrayContaining(['50,50', '46,52']));
  });

  it('materializes the canonical free start chunk for a new Chunked account', async () => {
    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ chunks: [] }),
      gameModeId: 'chunked',
    };
    let observed: QuestRouteAnalysisSnapshot | undefined;
    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(loadedContent(), {
          analyze: (questId: string, snapshot: QuestRouteAnalysisSnapshot) => {
            observed = snapshot;
            return analyzeQuest(questId, snapshot);
          },
        })}
      />,
    );

    await screen.findByText('RuneProof');
    expect(observed).toMatchObject({
      gameModeId: 'chunked',
      unlockedChunks: ['50,50'],
      unlocks: { chunks: [] },
    });
  });

  it('does not duplicate the legacy route map inside the primary coach', async () => {
    renderGoalPlanner({ availability: 'PREVIEW', selectedQuest: "Cook's Assistant" });

    expect(await screen.findByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();
    expect(document.querySelectorAll('[data-runeproof-route-map]')).toHaveLength(0);
  });

  it('hydrates isolated preview item checks into coach progress per run', async () => {
    seedCookProgress({
      confirmedActionIds: [
        'cooks-assistant:start-quest',
        'cooks-assistant:take-pot',
        'cooks-assistant:take-bucket',
      ],
      confirmedItemKeys: ['bucket of milk', 'egg'],
    });
    renderGoalPlanner({ availability: 'PREVIEW', selectedQuest: "Cook's Assistant" });

    const current = await nextAction();
    expect(current.getByText('Pick grain outside Mill Lane Mill.')).toBeTruthy();
    expect(coachProgress("Cook's Assistant").value).toBe(5);
    expect(screen.queryByRole('region', { name: 'Quest requirements' })).toBeNull();
    expect(window.localStorage.getItem(runeProofPreviewStorageKey('run-a'))).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(
      runeProofProgressStorageKey('run-a', 'cooks-assistant'),
    ) ?? '{}')).toMatchObject({
      confirmedActionIds: [
        'cooks-assistant:start-quest',
        'cooks-assistant:take-pot',
        'cooks-assistant:take-bucket',
      ],
      confirmedItemKeys: ['bucket of milk', 'egg'],
    });
  });

  it('keeps the ordinary plan available when chunk analysis cannot initialize', async () => {
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
      contentService: loadedContent(async () => false),
    });
    expect(await screen.findByText('Analysis unavailable')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: "Cook's Assistant" })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();
  });

  it('keeps the normal plan and localizes chunk-content load failure', async () => {
    const contentService = loadedContent(async () => false);
    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(contentService)}
      />,
    );

    expect(await screen.findByText('Analysis unavailable')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: "Cook's Assistant" })).toBeTruthy();
    expect(screen.getByText('Quests in order')).toBeTruthy();
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();
  });

  it('keeps the normal plan and localizes a synchronous content initialization throw', async () => {
    const contentService = loadedContent(() => {
      throw new Error('synchronous content init failure');
    });
    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(contentService)}
      />,
    );

    expect(await screen.findByText('Analysis unavailable')).toBeTruthy();
    expect(contentService.initCalls).toBe(1);
    expect(screen.getByRole('heading', { level: 3, name: "Cook's Assistant" })).toBeTruthy();
    expect(screen.getByText('Quests in order')).toBeTruthy();
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();
  });
  it('cannot display a stale analysis after switching reviewed goals', async () => {
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    let request = 0;
    const contentService = loadedContent(() => (request++ === 0 ? first.promise : second.promise));
    const integration = runeProof(contentService);
    const view = render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={integration}
      />,
    );

    await waitFor(() => expect(contentService.initCalls).toBe(1));
    goalPlannerTargetButton('Sheep Shearer').click();
    await waitFor(() => expect(contentService.initCalls).toBe(2));
    await act(async () => { first.resolve(true); });
    expect(screen.queryByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeNull();

    await act(async () => { second.resolve(true); });
    await waitFor(() => {
      expect(view.container.querySelector('h2')?.textContent).toContain('RuneProof');
      expect(screen.getByRole('heading', { level: 2, name: 'Sheep Shearer' })).toBeTruthy();
      expect(screen.queryByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeNull();
    });
  });

  it('hides a loaded analysis immediately when the reviewed goal changes', async () => {
    const nextLoad = deferred<boolean>();
    let request = 0;
    const contentService = loadedContent(() => (
      request++ === 0 ? Promise.resolve(true) : nextLoad.promise
    ));
    const view = render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(contentService)}
      />,
    );

    await screen.findByRole('heading', { name: 'Do now' });
    const dialogPanel = screen.getByRole('dialog', { name: 'RuneProof' }).firstElementChild;
    expect(dialogPanel?.className).toContain('max-w-5xl');

    flushSync(() => { goalPlannerTargetButton('Sheep Shearer').click(); });
    expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Loading Sheep Shearer RuneProof route');
    expect(screen.queryByText('Quests in order')).toBeNull();
    expect(dialogPanel?.className).toContain('max-w-5xl');

    await act(async () => { nextLoad.resolve(true); });
    await waitFor(() => {
      expect(view.container.querySelector('h2')?.textContent).toContain('RuneProof');
      expect(screen.getByRole('heading', { level: 2, name: 'Sheep Shearer' })).toBeTruthy();
    });
  });

  it('keeps legacy map state isolated when switching reviewed RuneProof quests', async () => {
    const contentService = loadedContent();
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
      contentService,
    });

    await screen.findByRole('heading', { name: 'Do now' });
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();

    flushSync(() => { goalPlannerTargetButton('Sheep Shearer').click(); });
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Selected route chunk details' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show Egg on map' })).toBeNull();
    expect(await screen.findByRole('heading', { level: 2, name: 'Sheep Shearer' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(contentService.initCalls).toBe(2);
    expect(document.querySelectorAll('[data-runeproof-route-map]')).toHaveLength(0);
  });

  it('hides analysis in the same commit when the feature becomes unavailable', async () => {
    const reenabledLoad = deferred<boolean>();
    let request = 0;
    const contentService = loadedContent(() => (
      request++ === 0 ? Promise.resolve(true) : reenabledLoad.promise
    ));
    const preview = runeProof(contentService);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const modal = (availability: 'PREVIEW' | 'OFF') => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={{ ...preview, availability }}
      />
    );

    await act(async () => { root.render(modal('PREVIEW')); });
    expect(host.querySelector('progress[aria-label$=" progress"]')).toBeTruthy();

    flushSync(() => { root.render(modal('OFF')); });
    expect(host.querySelector('progress[aria-label$=" progress"]')).toBeNull();

    flushSync(() => { root.render(modal('PREVIEW')); });
    expect(host.querySelector('progress[aria-label$=" progress"]')).toBeNull();

    await act(async () => { reenabledLoad.resolve(true); });
    expect(host.querySelector('progress[aria-label$=" progress"]')).toBeTruthy();

    await act(async () => { root.unmount(); });
    host.remove();
  });

  it('ignores an in-flight result after close is requested', async () => {
    const loaded = await goldenPack("Cook's Assistant");
    const summaries = await summariesFor(loaded);
    const load = deferred<RuneProofLoadedPack | undefined>();
    const loadPack = vi.fn(() => load.promise);
    const analyze = vi.fn(analyzeQuestWithWalkthrough);
    const contentService = loadedContent();
    const progressStorage = instrumentedStorage();
    const onClose = vi.fn();
    render(
      <GoalPlannerModal
        onClose={onClose}
        initialTarget={{ kind: 'quest', id: loaded.pack.questId }}
        runeProof={runeProof(contentService, {
          loadCatalogue: vi.fn(async () => summaries),
          loadPack,
          analyze,
          progressStorage,
        })}
      />,
    );

    await waitFor(() => expect(loadPack).toHaveBeenCalledOnce());
    const readsAtClose = [...progressStorage.reads];
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => { load.resolve(loaded); await Promise.resolve(); });

    expect(loadPack).toHaveBeenCalledOnce();
    expect(contentService.initCalls).toBe(0);
    expect(analyze).not.toHaveBeenCalled();
    expect(progressStorage.reads).toEqual(readsAtClose);
    expect(screen.queryByRole('heading', { level: 2, name: loaded.pack.questId })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('does not send an explicit no-pack target through RuneProof map routing', async () => {
    const onClose = vi.fn();
    const onOpenWorldChunk = vi.fn();
    render(
      <GoalPlannerModal
        onClose={onClose}
        onOpenWorldChunk={onOpenWorldChunk}
        initialTarget={{ kind: 'quest', id: "Daddy's Home" }}
        runeProof={runeProof(loadedContent())}
      />,
    );

    expect(await screen.findByRole('heading', { level: 3, name: "Daddy's Home" })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Needs review');
    expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();
    expect(screen.queryByRole('region', { name: "Daddy's Home main path map" })).toBeNull();
    expect(screen.queryByRole('button', { name: /Open chunk .* on world map/ })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenWorldChunk).not.toHaveBeenCalled();
  });

  it('keeps a no-pack direct target in the ordinary plan when navigation is omitted', async () => {
    render(
      <GoalPlannerModal
        onClose={vi.fn()}
        initialTarget={{ kind: 'quest', id: "Daddy's Home" }}
        runeProof={runeProof(loadedContent())}
      />,
    );

    expect(await screen.findByRole('heading', { level: 3, name: "Daddy's Home" })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Needs review');
    expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();
    expect(screen.queryByRole('region', { name: "Daddy's Home main path map" })).toBeNull();
    expect(screen.queryByRole('button', { name: /Open chunk .* on world map/ })).toBeNull();
  });

  it("never renders Sheep Shearer's actions under Cook after a stale content load finishes", async () => {
    const sheepLoad = deferred<boolean>();
    const cookLoad = deferred<boolean>();
    let request = 0;
    const contentService = loadedContent(() => (
      request++ === 0 ? sheepLoad.promise : cookLoad.promise
    ));
    const view = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: 'Sheep Shearer',
      contentService,
    });

    await waitFor(() => expect(contentService.initCalls).toBe(1));
    goalPlannerTargetButton("Cook's Assistant").click();
    await waitFor(() => expect(contentService.initCalls).toBe(2));

    await act(async () => { sheepLoad.resolve(true); });
    expect(screen.queryByRole('heading', { level: 2, name: 'Sheep Shearer' })).toBeNull();

    await act(async () => { cookLoad.resolve(true); });
    expect(view.container.querySelector('h2')?.textContent).toContain('RuneProof');
    expect(await screen.findByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Sheep Shearer' })).toBeNull();
  });

  it('keeps a null walkthrough entity lookup local to its action evidence', async () => {
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
      contentService: loadedContent(),
    });

    expect(await screen.findByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(screen.queryByText('Analysis unavailable')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Quest requirements' })).toBeNull();
  });

  it('keeps the ordinary plan and local unavailable message after rejected initialization', async () => {
    const contentService = loadedContent(async () => {
      throw new Error('content initialization rejected');
    });
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
      contentService,
    });

    expect(await screen.findByText('Analysis unavailable')).toBeTruthy();
    expect(contentService.initCalls).toBe(1);
    expect(screen.getAllByRole('heading', { level: 3, name: "Cook's Assistant" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Do now' })).toBeNull();
  });

  it('shows the preview-only reviewed strategy in private preview', async () => {
    renderGoalPlanner({ availability: 'PREVIEW', selectedQuest: "Cook's Assistant" });

    expect(await screen.findByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(screen.queryByText(/not release-approved/i)).toBeNull();
  });

  it('re-presents confirmed items without running route analysis again', async () => {
    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ chunks: ['50,50', '50,51'] }),
    };
    const contentService = loadedContent();
    const analyze = vi.fn((questId: string, snapshot: QuestRouteAnalysisSnapshot) => (
      analyzeQuest(questId, snapshot)
    ));
    const integration = runeProof(contentService, { analyze });
    const modal = () => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={integration}
      />
    );
    render(modal());

    const current = await nextAction();
    expect(analyze).toHaveBeenCalledTimes(1);

    await userEvent.click(current.getByRole('checkbox', { name: /^Confirm / }));
    await userEvent.click(current.getByRole('checkbox', { name: /^Confirm / }));
    await userEvent.click(current.getByRole('checkbox', { name: /^Confirm / }));
    await userEvent.click(current.getByRole('checkbox', { name: /^Confirm / }));

    await waitFor(() => expect(current.getByText('Pick up an egg at the chicken farm beside the cow field.'))
      .toBeTruthy());
    expect(coachProgress("Cook's Assistant").value).toBe(4);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('re-runs analysis and updates walkthrough chunk state when unlocked chunks change', async () => {
    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ chunks: [] }),
      gameModeId: 'chunked',
    };
    const contentService = loadedContent();
    const snapshots: QuestRouteAnalysisSnapshot[] = [];
    const analyze = vi.fn((questId: string, snapshot: QuestRouteAnalysisSnapshot) => {
      snapshots.push(snapshot);
      return analyzeQuest(questId, snapshot);
    });
    const integration = runeProof(contentService, { analyze });
    const modal = () => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: 'Sheep Shearer' }}
        runeProof={integration}
      />
    );
    const view = render(modal());

    const current = await nextAction();
    expect(current.getByText('Ask Fred the Farmer, north of Lumbridge, for work.')).toBeTruthy();
    expect(analyze).toHaveBeenCalledTimes(1);

    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ chunks: ['49,51'] }),
    };
    view.rerender(modal());

    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
    const updatedCurrent = await nextAction();
    expect(updatedCurrent.getByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(analyze).toHaveBeenCalledTimes(2);
    expect(snapshots[1].unlockedChunks).toEqual(['49,51', '50,50']);
  });

  it('does not re-run analysis for a canonically identical account snapshot', async () => {
    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({
        chunks: ['46,52', '19,57'],
        merchants: ['General store', 'Aubury'],
        quests: ['Druidic Ritual', 'Rune Mysteries'],
      }),
    };
    const contentService = loadedContent();
    const analyze = vi.fn((questId: string, snapshot: QuestRouteAnalysisSnapshot) => (
      analyzeQuest(questId, snapshot)
    ));
    const integration = runeProof(contentService, { analyze });
    const modal = () => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={integration}
      />
    );
    const view = render(modal());

    expect(await screen.findByRole('heading', { name: 'Do now' })).toBeTruthy();
    expect(analyze).toHaveBeenCalledTimes(1);

    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({
        chunks: ['19,57', '46,52', '19,57'],
        merchants: ['Aubury', 'General store'],
        quests: ['Rune Mysteries', 'Druidic Ritual'],
      }),
    };
    view.rerender(modal());

    await act(async () => { await Promise.resolve(); });
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(contentService.initCalls).toBe(1);
  });
});
