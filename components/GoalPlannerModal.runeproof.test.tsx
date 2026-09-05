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

const walkthroughLoaderControl = vi.hoisted(() => ({
  loadCatalogue: undefined as undefined | ((
    availability: RuneProofAvailability,
  ) => Promise<readonly QuestStrategyDefinition[]>),
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
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
};

const renderGoalPlanner = ({
  availability,
  selectedQuest,
  contentService = loadedContent(),
}: {
  availability: 'PUBLIC' | 'PREVIEW' | 'OFF';
  selectedQuest: string;
  contentService?: ReturnType<typeof loadedContent>;
}) => render(
  <GoalPlannerModal
    onClose={() => undefined}
    initialTarget={{ kind: 'quest', id: selectedQuest }}
    runeProof={runeProof(contentService, { availability })}
  />,
);

const nextAction = async () => {
  const heading = await screen.findByRole('heading', { name: 'Next action' });
  const section = heading.closest('section');
  if (!section) throw new Error('Missing RuneProof next-action section');
  return within(section);
};

const coachProgress = (questId: string): HTMLProgressElement => (
  screen.getByRole('progressbar', { name: `${questId} progress` }) as HTMLProgressElement
);

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
  it('uses the five independently authored guides in public RuneProof and hides preview-only quests', async () => {
    const view = renderGoalPlanner({
      availability: 'PUBLIC',
      selectedQuest: "Daddy's Home",
    });

    expect(await screen.findByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Next action' })).toBeTruthy();
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
    expect(screen.queryByRole('heading', { name: 'Next action' })).toBeNull();
    off.unmount();

    render(
      <GoalPlannerModal
        onClose={() => undefined}
        runeProof={runeProof(loadedContent())}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Recommended RuneProof quests' })).toBeTruthy();
    expect(screen.getAllByText('Talk to the Cook in Lumbridge Castle.').length).toBeGreaterThan(0);
  });

  it('keeps an in-progress target search selected while the preview catalogue loads', async () => {
    const catalogue = deferred<readonly QuestStrategyDefinition[]>();
    walkthroughLoaderControl.loadCatalogue = () => catalogue.promise;
    const user = userEvent.setup();

    render(
      <GoalPlannerModal
        onClose={() => undefined}
        runeProof={runeProof(loadedContent())}
      />,
    );

    const search = screen.getByRole('textbox');
    await user.type(search, "Daddy's Home");
    expect(screen.getByText('Choose a RuneProof quest')).toBeTruthy();

    await act(async () => { catalogue.resolve(questStrategyCatalogue); });

    expect(await screen.findByRole('region', { name: 'Recommended RuneProof quests' })).toBeTruthy();
    expect(screen.getByDisplayValue("Daddy's Home")).toBeTruthy();
    expect(screen.getByText('Choose a RuneProof quest')).toBeTruthy();
    expect(screen.getByText('No matches.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Next action' })).toBeNull();
  });

  it('keeps confirmation state for every Wave 1 strategy while objectives switch', async () => {
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

    expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Recommended RuneProof quests' })).toBeTruthy();

    const search = screen.getByRole('textbox');
    for (const objective of objectives) {
      fireEvent.change(search, { target: { value: objective.questId } });
      fireEvent.click(goalPlannerTargetButton(objective.questId));
      await screen.findByRole('heading', { name: objective.questId });

      const progress = screen.getByRole('progressbar', { name: `${objective.questId} progress` });
      expect(progress).toHaveProperty('max', objective.total);
      expect(progress).toHaveProperty('value', 0);

      const current = await nextAction();
      fireEvent.click(current.getByRole('button', { name: 'Mark action complete' }));
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

    expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
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
    expect(screen.getByPlaceholderText('Search RuneProof quests…')).toBeTruthy();
    preview.unmount();

    renderGoalPlanner({
      availability: 'OFF',
      selectedQuest: "Cook's Assistant",
    });

    const plannerDialog = screen.getByRole('dialog', { name: 'Goal Planner' });
    expect(within(plannerDialog).getByRole('heading', { level: 2, name: 'Goal Planner' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Search quests, diaries, regions…')).toBeTruthy();
  });

  it('shows only reviewed quests and replaces an untreated initial RuneProof target', async () => {
    const view = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Daddy's Home",
    });

    expect(await screen.findByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeTruthy();
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

    const search = screen.getByRole('textbox');
    await userEvent.type(search, "Daddy's Home");
    expect(view.container.querySelectorAll('button.group')).toHaveLength(0);
    expect(screen.getByText('No matches.')).toBeTruthy();
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

    await screen.findByRole('heading', { name: 'Next action' });
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

    await screen.findByRole('heading', { name: 'Next action' });
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
      expect(within(row).getByText(expectedChunks[index])).toBeTruthy();
    });
  });

  it("replaces a direct Daddy's Home target with a reviewed RuneProof quest", async () => {
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Daddy's Home",
    });

    expect(await screen.findByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeTruthy();
    expect(screen.queryByText("Daddy's Home")).toBeNull();
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
    expect(screen.queryByRole('heading', { name: 'Next action' })).toBeNull();
    expect(view.container.textContent).not.toContain('Pick up the empty pot beside the Cook');

    await act(async () => { sheepLoad.resolve(true); });
    expect(await screen.findByRole('heading', { level: 2, name: 'Sheep Shearer' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Next action' })).toBeTruthy();
  });

  it('persists isolated action progress across a true close and reopen', async () => {
    const first = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
    });

    const firstAction = await nextAction();
    expect(firstAction.getByText('Talk to the Cook in Lumbridge Castle.')).toBeTruthy();
    await userEvent.click(firstAction.getByRole('button', { name: 'Mark action complete' }));
    await waitFor(() => {
      expect(firstAction.getByText('Pick up the empty pot beside the Cook in Lumbridge Castle.'))
        .toBeTruthy();
    });
    expect(JSON.parse(window.localStorage.getItem(runeProofPreviewActionStorageKey('run-a')) ?? '{}'))
      .toEqual({ "Cook's Assistant": ['cooks-assistant:start-quest'] });

    first.unmount();
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
    });

    const reopenedAction = await nextAction();
    expect(reopenedAction.getByText('Pick up the empty pot beside the Cook in Lumbridge Castle.'))
      .toBeTruthy();
    expect(reopenedAction.queryByText('Talk to the Cook in Lumbridge Castle.')).toBeNull();
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
    await user.click(current.getByRole('button', { name: 'Mark action complete' }));
    await user.click(current.getByRole('button', { name: 'Mark action complete' }));
    await user.click(current.getByRole('button', { name: 'Mark action complete' }));
    expect(current.getByText('Use the bucket on a dairy cow in the Lumbridge cow field.'))
      .toBeTruthy();

    await user.click(current.getByRole('button', { name: 'Mark action complete' }));

    expect(JSON.parse(window.localStorage.getItem(runeProofPreviewStorageKey('run-a')) ?? '{}'))
      .toEqual({ "Cook's Assistant": ['bucket of milk'] });
    expect(JSON.parse(window.localStorage.getItem(runeProofPreviewActionStorageKey('run-a')) ?? '{}'))
      .toEqual({
        "Cook's Assistant": [
          'cooks-assistant:start-quest',
          'cooks-assistant:take-pot',
          'cooks-assistant:take-bucket',
        ],
      });
    expect(current.getByText('Pick up the egg at the chicken farm beside the cow field.'))
      .toBeTruthy();
  });

  it('confirms the final RuneProof step to 9/9 without completing the Journal quest', async () => {
    const earlierActionIds = [
      'cooks-assistant:start-quest',
      'cooks-assistant:take-pot',
      'cooks-assistant:take-bucket',
      'cooks-assistant:milk-cow',
      'cooks-assistant:take-egg',
      'cooks-assistant:pick-grain',
      'cooks-assistant:make-flour',
      'cooks-assistant:return-to-cook',
    ];
    window.localStorage.setItem(
      runeProofPreviewActionStorageKey('run-a'),
      JSON.stringify({ "Cook's Assistant": earlierActionIds }),
    );
    const journalQuestsBefore = [...gameSnapshot.unlocks.quests];
    const first = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
    });
    const user = userEvent.setup();

    const current = await nextAction();
    expect(coachProgress("Cook's Assistant").value).toBe(8);
    expect(current.getByText("Cook's Assistant complete.")).toBeTruthy();
    await user.click(current.getByRole('button', { name: 'Confirm quest complete' }));

    await waitFor(() => expect(coachProgress("Cook's Assistant").value).toBe(9));
    expect(screen.getByText('All reviewed actions are complete.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Recommended RuneProof quests' }))
      .getAllByRole('button')[0]?.textContent).toContain('Sheep Shearer');
    expect(gameSnapshot.unlocks.quests).toEqual(journalQuestsBefore);
    expect(JSON.parse(window.localStorage.getItem(runeProofPreviewActionStorageKey('run-a')) ?? '{}'))
      .toEqual({
        "Cook's Assistant": [...earlierActionIds, 'cooks-assistant:complete'],
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
    window.localStorage.setItem(
      runeProofPreviewActionStorageKey('run-a'),
      JSON.stringify({
        "Cook's Assistant": [
          'cooks-assistant:start-quest',
          'cooks-assistant:take-pot',
          'cooks-assistant:take-bucket',
          'cooks-assistant:milk-cow',
          'cooks-assistant:take-egg',
          'cooks-assistant:pick-grain',
          'cooks-assistant:make-flour',
          'cooks-assistant:return-to-cook',
          'cooks-assistant:complete',
        ],
      }),
    );

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
    expect(current.getByText('Talk to the Cook in Lumbridge Castle.')).toBeTruthy();
    await user.click(current.getByRole('button', { name: 'Mark action complete' }));
    const coachScroller = current
      .getByText('Pick up the empty pot beside the Cook in Lumbridge Castle.')
      .closest<HTMLElement>('.custom-scrollbar');
    if (!coachScroller) throw new Error('Missing RuneProof scroll container.');
    coachScroller.scrollTop = 173;
    await user.click(current.getByRole('button', {
      name: 'Show Pick up the empty pot beside the Cook in Lumbridge Castle. on map',
    }));

    const map = screen.getByRole('dialog', {
      name: 'Temporary map for Pick up the empty pot beside the Cook in Lumbridge Castle.',
    });
    expect(within(map).getByText('Chunk 50,50')).toBeTruthy();
    expect(map.getAttribute('aria-modal')).toBe('true');
    expect(map.closest('.custom-scrollbar')).toBeNull();
    expect(plannerDialog.getAttribute('aria-hidden')).toBe('true');
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenWorldChunk).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', {
      name: 'Temporary map for Pick up the empty pot beside the Cook in Lumbridge Castle.',
    })).toBeNull();
    expect(current.getByText('Pick up the empty pot beside the Cook in Lumbridge Castle.'))
      .toBeTruthy();
    expect(coachProgress("Cook's Assistant").value).toBe(1);
    expect(coachScroller.scrollTop).toBe(173);
    expect(plannerDialog.getAttribute('aria-hidden')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    const showMap = current.getByRole('button', {
      name: 'Show Pick up the empty pot beside the Cook in Lumbridge Castle. on map',
    });
    await user.click(showMap);
    const closeButtonMap = screen.getByRole('dialog', {
      name: 'Temporary map for Pick up the empty pot beside the Cook in Lumbridge Castle.',
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
      name: 'Temporary map for Pick up the empty pot beside the Cook in Lumbridge Castle.',
    });
    const backdrop = backdropMap.parentElement;
    if (!backdrop) throw new Error('Missing RuneProof temporary map backdrop.');
    await user.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
    expect(current.getByText('Pick up the empty pot beside the Cook in Lumbridge Castle.'))
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
    window.localStorage.setItem(
      runeProofPreviewStorageKey('run-a'),
      JSON.stringify({ "Cook's Assistant": ['egg'] }),
    );
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
    expect(current.getByText('Blocked')).toBeTruthy();
    expect(current.getByText('Unlock chunk 49,51 to use Mill Lane Mill.')).toBeTruthy();
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
    expect(current.getByText('Unlock chunk 49,51 to use Mill Lane Mill.')).toBeTruthy();
  });

  it('keeps the local flour blocker and map handoff exact after grain is confirmed', async () => {
    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ chunks: ['50,51'] }),
      gameModeId: 'chunked',
    };
    window.localStorage.setItem(
      runeProofPreviewStorageKey('run-a'),
      JSON.stringify({ "Cook's Assistant": ['egg'] }),
    );
    window.localStorage.setItem(
      runeProofPreviewActionStorageKey('run-a'),
      JSON.stringify({ "Cook's Assistant": ['cooks-assistant:pick-grain'] }),
    );
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
    expect(current.getByText('Use the grain in Mill Lane Mill and collect the flour in the pot.'))
      .toBeTruthy();
    expect(current.getByText('Blocked')).toBeTruthy();
    expect(current.getByText('Unlock chunk 49,51 to use Mill Lane Mill.')).toBeTruthy();
    await userEvent.click(current.getByRole('button', {
      name: 'Show Use the grain in Mill Lane Mill and collect the flour in the pot. on map',
    }));

    const map = screen.getByRole('dialog', {
      name: 'Temporary map for Use the grain in Mill Lane Mill and collect the flour in the pot.',
    });
    expect(within(map).getByText('Chunk 49,51')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenWorldChunk).not.toHaveBeenCalled();
    await userEvent.click(within(map).getByRole('button', {
      name: 'Close map and return to RuneProof',
    }));
    expect(current.getByText('Unlock chunk 49,51 to use Mill Lane Mill.')).toBeTruthy();
  });

  it('rejects nullable analysis before rendering and keeps the objective picker usable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const contentService = loadedContent();
    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(contentService, {
          analyze: (questId: string, snapshot: QuestRouteAnalysisSnapshot) => ({
            ...analyzeQuest(questId, snapshot),
            items: null,
          }),
        })}
      />,
    );

    expect(await screen.findByText('Analysis unavailable')).toBeTruthy();
    const recommendations = screen.getByRole('region', { name: 'Recommended RuneProof quests' });
    expect(within(recommendations).queryByRole('button', { name: /Daddy's Home/ })).toBeNull();
    await userEvent.click(within(recommendations).getByRole('button', { name: /Sheep Shearer/ }));

    expect(await screen.findByText('Analysis unavailable')).toBeTruthy();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps unsupported targets in Goal Planner but replaces them in RuneProof', async () => {
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

      expect(await screen.findByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeTruthy();
      expect(preview.container.textContent).not.toContain(target.label);
      expect(await screen.findByRole('region', { name: 'Recommended RuneProof quests' })).toBeTruthy();
      expect(contentService.initCalls).toBe(1);
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

    expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
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
    expect(contentService.entityLocations).toHaveBeenCalledWith('Cook (Lumbridge)', ['npc']);
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
    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(contentService, {
          analyze: (questId: string, snapshot: QuestRouteAnalysisSnapshot) => {
            observed = snapshot;
            return analyzeQuest(questId, snapshot);
          },
        })}
      />,
    );

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
    let observed: QuestRouteAnalysisSnapshot | undefined;
    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(contentService, {
          analyze: (questId: string, snapshot: QuestRouteAnalysisSnapshot) => {
            observed = snapshot;
            return analyzeQuest(questId, snapshot);
          },
        })}
      />,
    );

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

    expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();
    expect(document.querySelectorAll('[data-runeproof-route-map]')).toHaveLength(0);
  });

  it('hydrates isolated preview item checks into coach progress per run', async () => {
    window.localStorage.setItem(
      runeProofPreviewStorageKey('run-a'),
      JSON.stringify({ "Cook's Assistant": ['egg'] }),
    );
    renderGoalPlanner({ availability: 'PREVIEW', selectedQuest: "Cook's Assistant" });

    const current = await nextAction();
    expect(current.getByText('Pick grain outside Mill Lane Mill.')).toBeTruthy();
    expect(coachProgress("Cook's Assistant").value).toBe(5);
    expect(screen.queryByRole('region', { name: 'Quest requirements' })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(runeProofPreviewStorageKey('run-a')) ?? '{}'))
      .toEqual({ "Cook's Assistant": ['egg'] });
  });

  it('keeps the saved checklist available when chunk analysis cannot initialize', async () => {
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
      contentService: loadedContent(async () => false),
    });
    expect(await screen.findByRole('region', { name: 'Quest requirements' })).toBeTruthy();
    expect(screen.getByText('Analysis unavailable')).toBeTruthy();
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

    await screen.findByRole('heading', { name: 'Next action' });
    const dialogPanel = screen.getByRole('dialog', { name: 'RuneProof' }).firstElementChild;
    expect(dialogPanel?.className).toContain('max-w-5xl');

    flushSync(() => { goalPlannerTargetButton('Sheep Shearer').click(); });
    expect(screen.queryByRole('heading', { name: 'Next action' })).toBeNull();
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

    await screen.findByRole('heading', { name: 'Next action' });
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
    expect(screen.getByRole('heading', { name: 'Next action' })).toBeTruthy();
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
    const load = deferred<boolean>();
    const onClose = vi.fn();
    const view = render(
      <GoalPlannerModal
        onClose={onClose}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(loadedContent(() => load.promise))}
      />,
    );

    screen.getByRole('button', { name: 'Close' }).click();
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => { load.resolve(true); });
    expect(view.container.querySelector('[aria-labelledby="runeproof-heading"]')).toBeNull();
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();
  });

  it('does not send an explicit unsupported target through RuneProof map routing', async () => {
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

    expect(await screen.findByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeTruthy();
    expect(screen.queryByText("Daddy's Home")).toBeNull();
    expect(screen.queryByRole('region', { name: "Daddy's Home main path map" })).toBeNull();
    expect(screen.queryByRole('button', { name: /Open chunk .* on world map/ })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenWorldChunk).not.toHaveBeenCalled();
  });

  it('keeps an unsupported direct target hidden when navigation is omitted', async () => {
    render(
      <GoalPlannerModal
        onClose={vi.fn()}
        initialTarget={{ kind: 'quest', id: "Daddy's Home" }}
        runeProof={runeProof(loadedContent())}
      />,
    );

    expect(await screen.findByRole('heading', { level: 2, name: "Cook's Assistant" })).toBeTruthy();
    expect(screen.queryByText("Daddy's Home")).toBeNull();
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

    expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
    expect(screen.queryByText('Analysis unavailable')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Quest requirements' })).toBeNull();
  });

  it('keeps the saved checklist and local unavailable message after rejected initialization', async () => {
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
    expect(screen.getByRole('region', { name: 'Quest requirements' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 3, name: "Cook's Assistant" }).length).toBeGreaterThan(0);
  });

  it('shows the preview-only reviewed strategy in private preview', async () => {
    renderGoalPlanner({ availability: 'PREVIEW', selectedQuest: "Cook's Assistant" });

    expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
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

    await userEvent.click(current.getByRole('button', { name: 'Mark action complete' }));
    await userEvent.click(current.getByRole('button', { name: 'Mark action complete' }));
    await userEvent.click(current.getByRole('button', { name: 'Mark action complete' }));
    await userEvent.click(current.getByRole('button', { name: 'Mark action complete' }));

    await waitFor(() => expect(current.getByText('Pick up the egg at the chicken farm beside the cow field.'))
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
    expect(current.getByText('Blocked')).toBeTruthy();
    expect(analyze).toHaveBeenCalledTimes(1);

    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ chunks: ['49,51'] }),
    };
    view.rerender(modal());

    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
    const updatedCurrent = await nextAction();
    expect(updatedCurrent.getByText('Do now')).toBeTruthy();
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

    expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
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
