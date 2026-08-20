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
import { analyzeQuest as analyzeQuestWithWalkthrough, type QuestRouteAnalysisSnapshot } from '../utils/questRoutes/analyzeQuest';
import { isRuneProofQuestSupported } from '../data/questItemRequirements';
import { GoalPlannerModal } from './GoalPlannerModal';
import userEvent from '@testing-library/user-event';
import { ALL_CHUNK_KEYS, parseChunkKey } from '../utils/chunkAdjacency';
import { chunkUnlocked } from '../utils/chunkLocations';
import type { EntityHit } from '../services/ChunkContentService';
import * as walkthroughCatalogue from '../data/questWalkthroughs';
import { runeProofPreviewStorageKey } from '../utils/questRoutes/previewChecks';
import { runeProofPreviewActionStorageKey } from '../utils/questStrategies/previewActions';


const analyzeQuest = (
  questId: string,
  snapshot: QuestRouteAnalysisSnapshot,
) => {
  const walkthrough = walkthroughCatalogue.questWalkthroughFor(questId);
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
  availability: 'PREVIEW' | 'OFF';
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

describe('Goal Planner responsive layout', () => {
  it('stacks the picker above a shrinkable plan on narrow screens while preserving the desktop split', () => {
    render(
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Doric's Quest" }}
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
  it("defaults a fresh private preview to Cook's strategy without changing the off-mode empty state", async () => {
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
    expect(screen.getAllByText('Talk to the Cook in Lumbridge Castle.').length).toBeGreaterThan(0);
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

  it("keeps Daddy's Home on the ordinary planner path in preview", async () => {
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Daddy's Home",
    });

    expect(await screen.findByRole('heading', { level: 3, name: "Daddy's Home" })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Next action' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change objective' })).toBeNull();
  });

  it('cannot render stale Cook coach output after rapidly switching targets', async () => {
    const cookLoad = deferred<boolean>();
    const daddyLoad = deferred<boolean>();
    let request = 0;
    const contentService = loadedContent(() => (
      request++ === 0 ? cookLoad.promise : daddyLoad.promise
    ));
    const view = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
      contentService,
    });

    screen.getByRole('button', { name: /Daddy's Home/ }).click();
    await act(async () => { cookLoad.resolve(true); });
    expect(screen.queryByRole('heading', { name: 'Next action' })).toBeNull();
    expect(view.container.textContent).not.toContain('Pick up the empty pot beside the Cook');

    await act(async () => { daddyLoad.resolve(true); });
    expect(await screen.findByRole('heading', { level: 3, name: "Daddy's Home" })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Next action' })).toBeNull();
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

  it('closes the modal and hands the exact reviewed current-action chunk to the map', async () => {
    const onClose = vi.fn();
    const onOpenWorldChunk = vi.fn();
    render(
      <GoalPlannerModal
        onClose={onClose}
        onOpenWorldChunk={onOpenWorldChunk}
        initialTarget={{ kind: 'quest', id: "Cook's Assistant" }}
        runeProof={runeProof(loadedContent())}
      />,
    );

    const current = await nextAction();
    expect(current.getByText('Talk to the Cook in Lumbridge Castle.')).toBeTruthy();
    await userEvent.click(current.getByRole('button', { name: 'Mark action complete' }));
    await userEvent.click(current.getByRole('button', {
      name: 'Show Pick up the empty pot beside the Cook in Lumbridge Castle. on map',
    }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onOpenWorldChunk).toHaveBeenCalledWith(50, 50);
    expect(onClose.mock.invocationCallOrder[0])
      .toBeLessThan(onOpenWorldChunk.mock.invocationCallOrder[0]);
  });

  it('contains coach projection failures and keeps the objective picker usable', async () => {
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

    expect((await screen.findByRole('status')).textContent).toContain(
      'RuneProof preview is unavailable. The Goal Planner is still available.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Change objective' }));
    await userEvent.click(screen.getByRole('button', { name: /Daddy's Home/ }));

    expect(await screen.findByRole('heading', { level: 3, name: "Daddy's Home" })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Next action' })).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  it('leaves unsupported quests, diaries, and regions on the exact existing render path', () => {
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
      const existingMarkup = off.container.innerHTML;
      cleanup();

      const preview = render(
        <GoalPlannerModal
          onClose={() => undefined}
          initialTarget={{ kind: target.kind, id: target.id }}
          runeProof={runeProof(contentService)}
        />,
      );

      expect(preview.container.innerHTML).toBe(existingMarkup);
      expect(contentService.initCalls).toBe(0);
      expect(screen.queryByRole('region', { name: `${target.id} main path map` })).toBeNull();
      cleanup();
    }
  });

  it('leaves a reviewed quest unchanged when RuneProof is off', () => {
    const contentService = loadedContent();
    const initialTarget = { kind: 'quest' as const, id: "Cook's Assistant" };
    const existing = render(<GoalPlannerModal onClose={() => undefined} initialTarget={initialTarget} />);
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

  it('requests the exact Doric NPC needed by the reviewed walkthrough', async () => {
    const contentService = loadedContent();
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Doric's Quest",
      contentService,
    });

    await screen.findByText('RuneProof');
    expect(contentService.entityLocations).toHaveBeenCalledWith('Doric', ['npc']);
  });

  it("deduplicates Daddy's Home walkthrough entity requests", async () => {
    const contentService = loadedContent();
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Daddy's Home",
      contentService,
    });

    await screen.findByText('RuneProof');
    const sawmillRequests = contentService.entityLocations.mock.calls.filter(([name, kinds]) => (
      name === 'Sawmill operator' && kinds[0] === 'npc'
    ));
    expect(sawmillRequests).toHaveLength(1);
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
    expect(screen.getByText('5/9 complete')).toBeTruthy();
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

    screen.getByRole('button', { name: /Daddy's Home/ }).click();
    await act(async () => { first.resolve(true); });
    expect(view.container.querySelector('[aria-labelledby="runeproof-heading"]')).toBeNull();

    await act(async () => { second.resolve(true); });
    await waitFor(() => {
      const panel = view.container.querySelector('[aria-labelledby="runeproof-heading"]');
      expect(panel?.textContent).toContain("Daddy's Home");
      expect(panel?.textContent).not.toContain("Cook's Assistant");
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

    flushSync(() => { screen.getByRole('button', { name: /Daddy's Home/ }).click(); });
    expect(screen.queryByRole('heading', { name: 'Next action' })).toBeNull();

    await act(async () => { nextLoad.resolve(true); });
    await waitFor(() => {
      expect(view.container.querySelector('[aria-labelledby="runeproof-heading"]')?.textContent)
        .toContain("Daddy's Home");
    });
  });

  it('keeps the legacy map state isolated when leaving the primary coach', async () => {
    const nextLoad = deferred<boolean>();
    const user = userEvent.setup();
    let request = 0;
    const contentService = loadedContent(() => (
      request++ === 0 ? Promise.resolve(true) : nextLoad.promise
    ));
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
      contentService,
    });

    await screen.findByRole('heading', { name: 'Next action' });
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();

    flushSync(() => { screen.getByRole('button', { name: /Daddy's Home/ }).click(); });
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Selected route chunk details' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show Egg on map' })).toBeNull();

    await act(async () => { nextLoad.resolve(true); });
    expect(await screen.findByRole('region', {
      name: "Daddy's Home main path map",
    })).toBeTruthy();
    expect(screen.queryByRole('region', {
      name: "Cook's Assistant main path map",
    })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show Egg on map' })).toBeNull();
    expect(document.querySelectorAll('[data-runeproof-route-map]')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Show Bolt of cloth on map' }));
    const currentTray = screen.getByRole('region', { name: 'Selected route chunk details' });
    expect(currentTray.querySelector('[data-route-step-item="bolt of cloth-1"]')).toBeTruthy();
    expect(currentTray.textContent).toContain('Bolt of cloth source');
  }, 15_000);

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
    expect(host.textContent).toContain('RuneProof');

    flushSync(() => { root.render(modal('OFF')); });
    expect(host.textContent).not.toContain('RuneProof');

    flushSync(() => { root.render(modal('PREVIEW')); });
    expect(host.textContent).not.toContain('RuneProof');

    await act(async () => { reenabledLoad.resolve(true); });
    expect(host.textContent).toContain('RuneProof');

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

  it('closes and forwards the exact RuneProof chunk to the world map', async () => {
    const onClose = vi.fn();
    const onOpenWorldChunk = vi.fn();
    const { container } = render(
      <GoalPlannerModal
        onClose={onClose}
        onOpenWorldChunk={onOpenWorldChunk}
        initialTarget={{ kind: 'quest', id: "Daddy's Home" }}
        runeProof={runeProof(loadedContent())}
      />,
    );

    const routeMap = await screen.findByRole('region', { name: "Daddy's Home main path map" });
    const boltCard = container.querySelector<HTMLElement>(
      '[data-runeproof-requirement="runeproof-item-2-bolt-of-cloth"]',
    );
    if (!boltCard) throw new Error('Missing Bolt of cloth requirement card');
    fireEvent.click(within(boltCard).getByRole('button', { name: 'Show Bolt of cloth on map' }));
    fireEvent.click(within(routeMap).getByRole('button', {
      name: 'Open chunk 21,57 on world map',
    }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onOpenWorldChunk).toHaveBeenCalledOnce();
    expect(onOpenWorldChunk).toHaveBeenCalledWith(21, 57);
    expect(onClose.mock.invocationCallOrder[0])
      .toBeLessThan(onOpenWorldChunk.mock.invocationCallOrder[0]);
  });

  it('does not render a dead world-map handoff when navigation is omitted', async () => {
    render(
      <GoalPlannerModal
        onClose={vi.fn()}
        initialTarget={{ kind: 'quest', id: "Daddy's Home" }}
        runeProof={runeProof(loadedContent())}
      />,
    );

    await screen.findByRole('region', { name: "Daddy's Home main path map" });
    expect(screen.queryByRole('button', { name: /Open chunk .* on world map/ })).toBeNull();
  });

  it("never renders Doric's actions under Cook after a stale content load finishes", async () => {
    const doricLoad = deferred<boolean>();
    const cookLoad = deferred<boolean>();
    let request = 0;
    const contentService = loadedContent(() => (
      request++ === 0 ? doricLoad.promise : cookLoad.promise
    ));
    const view = renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Doric's Quest",
      contentService,
    });

    await waitFor(() => expect(contentService.initCalls).toBe(1));
    screen.getByRole('button', { name: /Cook's Assistant/ }).click();
    await waitFor(() => expect(contentService.initCalls).toBe(2));

    await act(async () => { doricLoad.resolve(true); });
    expect(view.container.querySelector('[aria-labelledby="runeproof-heading"]')).toBeNull();
    expect(screen.queryByText('Talk to Doric to start the quest.')).toBeNull();

    await act(async () => { cookLoad.resolve(true); });
    expect((await screen.findAllByText('Talk to the Cook in Lumbridge Castle.')).length)
      .toBeGreaterThan(0);
    expect(screen.queryByText('Talk to Doric to start the quest.')).toBeNull();
  });

  it('keeps a null walkthrough entity lookup local to its action evidence', async () => {
    renderGoalPlanner({
      availability: 'PREVIEW',
      selectedQuest: "Cook's Assistant",
      contentService: loadedContent(),
    });

    expect((await screen.findAllByText('Needs confirmation')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Analysis unavailable')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Quest requirements' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Next action' })).toBeTruthy();
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
    expect(screen.getByRole('heading', { level: 3, name: "Cook's Assistant" })).toBeTruthy();
  });

  it('shows the preview-only reviewed strategy in private preview', async () => {
    renderGoalPlanner({ availability: 'PREVIEW', selectedQuest: "Cook's Assistant" });

    expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
    expect(screen.queryByText(/not release-approved/i)).toBeNull();
  });

  it('re-presents confirmed items without running route analysis again', async () => {
    const contentService = loadedContent();
    const analyze = vi.fn((questId: string, snapshot: QuestRouteAnalysisSnapshot) => (
      analyzeQuest(questId, snapshot)
    ));
    const integration = runeProof(contentService, { analyze });
    const modal = () => (
      <GoalPlannerModal
        onClose={() => undefined}
        initialTarget={{ kind: 'quest', id: "Doric's Quest" }}
        runeProof={integration}
      />
    );
    render(modal());

    expect(await screen.findByRole('region', { name: 'Quest walkthrough' })).toBeTruthy();
    const prepareRow = document.getElementById('dorics-quest:prepare-materials');
    if (!prepareRow) throw new Error('Missing Doric preparation action row');
    expect(analyze).toHaveBeenCalledTimes(1);

    const checklist = screen.getByRole('region', { name: 'Quest requirements' });
    await userEvent.click(within(checklist).getByRole('checkbox', { name: /^6 Clay/ }));
    await userEvent.click(within(checklist).getByRole('checkbox', { name: /^4 Copper ore/ }));
    await userEvent.click(within(checklist).getByRole('checkbox', { name: /^2 Iron ore/ }));

    await waitFor(() => expect(prepareRow.textContent).toContain('6 Clay confirmed.'));
    expect(prepareRow.textContent).toContain('4 Copper ore confirmed.');
    expect(prepareRow.textContent).toContain('2 Iron ore confirmed.');
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
        initialTarget={{ kind: 'quest', id: 'Elemental Workshop I' }}
        runeProof={integration}
      />
    );
    const view = render(modal());

    expect(await screen.findByRole('region', { name: 'Quest walkthrough' })).toBeTruthy();
    const firstActionRow = document.getElementById('elemental-workshop-i:find-battered-book');
    if (!firstActionRow) throw new Error('Missing Elemental Workshop first action row');
    expect(within(firstActionRow).getByText('Chunk locked')).toBeTruthy();
    expect(analyze).toHaveBeenCalledTimes(1);

    gameSnapshot = {
      ...gameSnapshot,
      unlocks: plannerUnlocks({ chunks: ['42,54'] }),
    };
    view.rerender(modal());

    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
    const updatedFirstActionRow = document.getElementById('elemental-workshop-i:find-battered-book');
    if (!updatedFirstActionRow) throw new Error('Missing updated Elemental Workshop first action row');
    expect(within(updatedFirstActionRow).getByText('Ready here')).toBeTruthy();
    expect(analyze).toHaveBeenCalledTimes(2);
    expect(snapshots[1].unlockedChunks).toEqual(['42,54', '50,50']);
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
