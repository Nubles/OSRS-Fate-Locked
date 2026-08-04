/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChunkContent } from '../services/ChunkContentService';

const mocks = vi.hoisted(() => {
  const state = { content: null as ChunkContent | null, completedQuests: [] as string[], regions: [] as string[], bosses: [] as string[], guilds: [] as string[], minigames: [] as string[], farming: [] as string[], merchants: [] as string[], mobility: [] as string[], skills: {} as Record<string, number>, levels: {} as Record<string, number> };
  return {
    state,
    service: {
      ready: true as boolean,
      init: vi.fn(async () => true),
      contentFor: vi.fn(() => state.content),
      aggregate: vi.fn(() => state.content),
      entrancesFor: vi.fn(() => []),
      connectGraph: vi.fn(() => ({})),
      skillYields: vi.fn(() => ({})),
      taskRequirements: vi.fn((_name: string, _kind: string, _cx: number, _cy: number): string[] => []),
      chunkEntryRequirements: vi.fn(() => []),
      hasBank: vi.fn(() => false),
      shopStock: vi.fn(() => []),
    },
  };
});

vi.mock('../services/ChunkContentService', () => ({ chunkContentService: mocks.service }));
vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return { ...actual, useGame: () => ({
    ...actual.initialState,
    unlocks: { ...actual.initialState.unlocks, quests: mocks.state.completedQuests, regions: mocks.state.regions, bosses: mocks.state.bosses, guilds: mocks.state.guilds, minigames: mocks.state.minigames, farming: mocks.state.farming, merchants: mocks.state.merchants, mobility: mocks.state.mobility, skills: { ...actual.initialState.unlocks.skills, ...mocks.state.skills }, levels: { ...actual.initialState.unlocks.levels, ...mocks.state.levels } },
    customMode: undefined,
  }) };
});

import { ChunkActivityPanel } from './ChunkActivityPanel';

const emptyContent = (): ChunkContent => ({
  name: 'Varrock West', monsters: [], npcs: [], objects: [], shops: [], quests: {}, diaries: {}, clues: {}, spawns: [],
});

const baseProps = {
  chunk: { cx: 50, cy: 53 },
  region: 'Misthalin',
  subArea: 'Varrock',
  regionChunks: [{ cx: 50, cy: 53 }],
  unlocked: true,
  wholeAreaOwnershipMixed: true,
  onClose: () => undefined,
} as const;

const setRequirementAwareFixture = () => {
  mocks.state.content = {
    ...emptyContent(),
    monsters: [{ name: 'Vardorvis', count: 1, slayer: null }],
    objects: [['Allotment patch', 1]],
    shops: ['Oziach (shop)'],
  };
  mocks.state.bosses = ['Vardorvis'];
  mocks.state.farming = ['Allotment'];
  mocks.state.merchants = ['Platebody Shops'];
  mocks.service.taskRequirements.mockImplementation((name: string, kind: string) => {
    const requirements: Record<string, string[]> = {
      'monster|Vardorvis': ['Desert Treasure II - The Fallen Empire'],
      'object|Allotment patch': ['Access the Farming Guild#Beginner tier'],
      'shop|Oziach (shop)': ['Dragon Slayer I'],
    };
    return requirements[`${kind}|${name}`] ?? [];
  });
};

afterEach(cleanup);
beforeEach(() => {
  mocks.service.ready = true;
  mocks.service.init.mockReset();
  mocks.service.init.mockImplementation(async () => true);
  mocks.state.completedQuests = [];
  mocks.state.regions = [];
  mocks.state.bosses = [];
  mocks.state.guilds = [];
  mocks.state.minigames = [];
  mocks.state.farming = [];
  mocks.state.merchants = [];
  mocks.state.mobility = [];
  mocks.state.skills = {};
  mocks.state.levels = {};
  mocks.state.content = { ...emptyContent(), monsters: [{ name: 'Rat', count: 3, slayer: null }] };
  mocks.service.chunkEntryRequirements.mockReturnValue(['Dragon Slayer I']);
  mocks.service.entrancesFor.mockReturnValue([{
    location: 'Taverley Dungeon',
    label: 'Entrance to Taverley Dungeon',
    wikiPage: 'Taverley_Dungeon',
    requirements: ['Example Quest'],
  }]);
  mocks.service.hasBank.mockReturnValue(true);
  mocks.service.connectGraph.mockReset();
  mocks.service.connectGraph.mockReturnValue({});
  mocks.service.shopStock.mockReset();
  mocks.service.shopStock.mockReturnValue([]);
  mocks.service.skillYields.mockReset();
  mocks.service.skillYields.mockReturnValue({});
  mocks.service.taskRequirements.mockReset();
  mocks.service.taskRequirements.mockReturnValue([]);
});

describe('ChunkActivityPanel activity accordions', () => {
  it('resets scroll position and accordion expansion when switching chunks', async () => {
    mocks.state.content = {
      ...emptyContent(),
      quests: { 'Sheep Shearer': 'first' },
      monsters: [{ name: 'Rat', count: 3, slayer: null }],
    };

    const { rerender } = render(<ChunkActivityPanel {...baseProps} />);
    const scrollBody = screen.getByTestId('chunk-info-scroll-body');
    scrollBody.scrollTop = 240;

    await userEvent.click(screen.getByRole('button', { name: /Combat/ }));
    expect(screen.getByRole('button', { name: /Quests/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Combat/ }).getAttribute('aria-expanded')).toBe('true');

    rerender(<ChunkActivityPanel {...baseProps} chunk={{ cx: 51, cy: 53 }} />);

    expect(scrollBody.scrollTop).toBe(0);
    expect(screen.getByRole('button', { name: /Quests/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Combat/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps locked activities readable and shows their state in the drawer', () => {
    mocks.state.content = {
      ...emptyContent(),
      monsters: [{ name: 'King Black Dragon', count: 1, slayer: null }],
    };
    mocks.state.bosses = ['King Black Dragon'];

    render(<ChunkActivityPanel {...baseProps} unlocked={false} />);

    const lockedName = screen.getByText('King Black Dragon');
    const lockedRow = lockedName.closest('div');
    expect(lockedName.closest('span')?.className).not.toContain('line-through');
    expect(lockedRow).toBeTruthy();
    expect(within(lockedRow as HTMLElement).getByText('Locked')).toBeTruthy();

    const drawer = screen.getByTestId('chunk-info-scroll-body').parentElement;
    expect(drawer?.className).toContain('w-80');
    expect(drawer?.className).toContain('max-w-[calc(100%-1.5rem)]');
  });

  it('clears nested shop and resource disclosures when switching chunks', async () => {
    mocks.state.content = {
      ...emptyContent(),
      shops: ['Varrock General Store'],
      objects: [['Yew tree', 1]],
    };
    mocks.service.shopStock.mockReturnValue(['Bronze dagger']);
    mocks.service.skillYields.mockReturnValue({ 'Yew tree': [['Yew logs', '1']] });

    const { rerender } = render(<ChunkActivityPanel {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: /Shops/ }));
    await userEvent.click(screen.getByTitle('Show stock'));
    expect(screen.getByText('Bronze dagger')).toBeTruthy();

    await userEvent.click(screen.getByTitle('Show what this yields'));
    expect(screen.getByText('Yew logs')).toBeTruthy();

    rerender(<ChunkActivityPanel {...baseProps} chunk={{ cx: 51, cy: 53 }} />);

    expect(screen.queryByText('Bronze dagger')).toBeNull();
    expect(screen.queryByText('Yew logs')).toBeNull();
  });

  it('labels nested shop and resource disclosures and connects them to their content', async () => {
    mocks.state.content = {
      ...emptyContent(),
      shops: ['Varrock General Store'],
      objects: [['Yew tree', 1]],
    };
    mocks.service.shopStock.mockReturnValue(['Bronze dagger']);
    mocks.service.skillYields.mockReturnValue({ 'Yew tree': [['Yew logs', '1']] });

    render(<ChunkActivityPanel {...baseProps} />);
    const gatheringButton = screen.getByRole('button', { name: /Gathering/ });
    if (gatheringButton.getAttribute('aria-expanded') === 'false') {
      await userEvent.click(gatheringButton);
    }
    await userEvent.click(screen.getByRole('button', { name: /Shops/ }));

    const resourceButton = screen.getByRole('button', { name: 'Show yields for Yew tree' });
    const shopButton = screen.getByRole('button', { name: 'Show stock for Varrock General Store' });
    const resourceDisclosureId = resourceButton.getAttribute('aria-controls');
    const shopDisclosureId = shopButton.getAttribute('aria-controls');

    expect(resourceDisclosureId).toBeTruthy();
    expect(shopDisclosureId).toBeTruthy();
    expect(resourceDisclosureId).not.toBe(shopDisclosureId);

    await userEvent.click(resourceButton);
    await userEvent.click(shopButton);

    expect(document.getElementById(resourceDisclosureId!)).toBeTruthy();
    expect(document.getElementById(shopDisclosureId!)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide yields for Yew tree' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide stock for Varrock General Store' })).toBeTruthy();
  });
  it('shows locked chunk state in every intrinsically available activity row', async () => {
    mocks.state.content = {
      ...emptyContent(),
      monsters: [{ name: 'King Black Dragon', count: 1, slayer: null }, { name: 'Rat', count: 1, slayer: null }],
      objects: [['Herb patch', 1], ['Yew tree', 1], ['Fairy ring', 1]],
      shops: ['Varrock General Store'],
      diaries: { Lumbridge: '1' },
    };
    mocks.state.bosses = ['King Black Dragon'];
    mocks.state.farming = ['Herb'];
    mocks.state.merchants = ['General Stores'];
    mocks.state.mobility = ['Fairy Rings'];
    mocks.state.skills = { Woodcutting: 6 };
    mocks.state.levels = { Woodcutting: 60 };
    mocks.state.regions = ['Misthalin', 'Varrock'];
    mocks.service.connectGraph.mockReturnValue({ '12853': ['12854'] });

    render(<ChunkActivityPanel {...baseProps} unlocked={false} />);

    await userEvent.click(screen.getByRole('button', { name: /Gathering/ }));
    await userEvent.click(screen.getByRole('button', { name: /Shops/ }));
    await userEvent.click(screen.getByRole('button', { name: /Travel/ }));
    await userEvent.click(screen.getByRole('button', { name: /Other/ }));

    const expectRowLocked = (label: string) => {
      const row = screen.getByText(label).closest('div');
      expect(row).toBeTruthy();
      expect(within(row as HTMLElement).getByText('Locked')).toBeTruthy();
    };

    ['King Black Dragon', 'Rat', 'Herb patch', 'Yew tree', 'Varrock General Store', 'Fairy ring', 'Lumbridge'].forEach(expectRowLocked);

    const travelSection = screen.getByRole('button', { name: /Travel/ }).closest('section') as HTMLElement;
    const lockedDestination = within(travelSection).getAllByTitle('Chunk locked').find(element => element.tagName === 'BUTTON');
    expect(lockedDestination).toBeTruthy();
    expect(lockedDestination?.tagName).toBe('BUTTON');
    expect(lockedDestination?.className).not.toContain('text-emerald');
  });

  it('keeps reachable diary references neutral until task requirements are evaluated', async () => {
    mocks.state.content = { ...emptyContent(), diaries: { Lumbridge: 'LB1' } };
    mocks.state.regions = ['Misthalin'];

    render(<ChunkActivityPanel {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Other, 1 item' }));

    expect(screen.getByText('Available now').previousElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Needs unlocks').previousElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Tasks here')).toBeTruthy();
    expect(screen.queryByText('Reachable')).toBeNull();
    expect(screen.getByText('(LB1)')).toBeTruthy();
  });

  it('still counts diary references as locked when the selected chunk is locked', () => {
    mocks.state.content = { ...emptyContent(), diaries: { Lumbridge: 'LB1' } };
    mocks.state.regions = ['Misthalin'];

    render(<ChunkActivityPanel {...baseProps} unlocked={false} />);

    expect(screen.getByText('Needs unlocks').previousElementSibling?.textContent).toBe('1');
  });


  it('labels available activity rows without relying on green styling alone', async () => {
    mocks.state.content = {
      ...emptyContent(),
      monsters: [{ name: 'Rat', count: 1, slayer: null }, { name: 'Banshee', count: 1, slayer: 15 }],
      objects: [['Herb patch', 1], ['Yew tree', 1], ['Fairy ring', 1]],
      shops: ['Varrock General Store', 'Odd Shop'],
    };
    mocks.state.farming = ['Herb'];
    mocks.state.merchants = ['General Stores'];
    mocks.state.mobility = ['Fairy Rings'];
    mocks.state.skills = { Slayer: 1, Woodcutting: 6 };
    mocks.state.levels = { Slayer: 15, Woodcutting: 60 };
    mocks.state.regions = ['Misthalin', 'Varrock'];
    mocks.service.connectGraph.mockReturnValue({ '12853': ['12854'] });

    render(<ChunkActivityPanel {...baseProps} />);

    await userEvent.click(screen.getByRole('button', { name: /Combat/ }));
    await userEvent.click(screen.getByRole('button', { name: /Gathering/ }));
    await userEvent.click(screen.getByRole('button', { name: /Shops/ }));
    await userEvent.click(screen.getByRole('button', { name: /Travel/ }));

    const expectRowLabel = (label: string, state: 'Available' | 'Unlocked' | 'No unlock gate') => {
      const row = screen.getByText(label).closest('div');
      expect(row).toBeTruthy();
      expect(within(row as HTMLElement).getByText(state)).toBeTruthy();
    };

    expectRowLabel('Rat', 'Available');
    expectRowLabel('Herb patch', 'Available');
    expectRowLabel('Yew tree', 'Available');
    expectRowLabel('Varrock General Store', 'Unlocked');
    expectRowLabel('Odd Shop', 'No unlock gate');
    expectRowLabel('Fairy ring', 'Available');
    expect(screen.getByText('Available now').previousElementSibling?.textContent).toBe('7');
    expect(screen.getByText('Needs unlocks').previousElementSibling?.textContent).toBe('0');
    const slayerBadge = screen.getByTitle('Slayer requirement met');
    expect(slayerBadge.querySelector('svg')).toBeTruthy();

    const travelSection = screen.getByRole('button', { name: /Travel/ }).closest('section') as HTMLElement;
    const destination = within(travelSection).getByTitle(/Reachable/);
    expect(destination.querySelector('svg')).toBeTruthy();
  });

  it('renders restored count separators and requirement punctuation as player-facing text', async () => {
    mocks.state.content = {
      ...emptyContent(),
      monsters: [
        { name: 'King Black Dragon', count: 2, slayer: null },
        { name: 'Rat', count: 3, slayer: null },
        { name: 'Banshee', count: 1, slayer: 15 },
      ],
      objects: [['Herb patch', 4], ['Yew tree', 5]],
    };
    mocks.state.skills = { Slayer: 1, Woodcutting: 6 };
    mocks.state.levels = { Slayer: 1, Woodcutting: 40 };

    render(<ChunkActivityPanel {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: /Gathering/ }));

    expect(screen.getByText('King Black Dragon').parentElement?.textContent).toContain('\u00d72');
    expect(screen.getByText('Rat').parentElement?.textContent).toContain('\u00d73');
    expect(screen.getByText('Herb patch').parentElement?.textContent).toContain('\u00d74');
    expect(screen.getByText('Yew tree').parentElement?.textContent).toContain('\u00d75');
    expect(screen.getByTitle('Needs Slayer 15 \u2014 you have 1')).toBeTruthy();
    expect(screen.getByText('Yew tree').closest('div')?.getAttribute('title'))
      .toBe('Needs Woodcutting 60 \u2014 you have 40');
  });
  it('groups quest, combat, and gathering rows while preserving locked labels', async () => {
    mocks.state.content = {
      ...emptyContent(),
      quests: { 'Sheep Shearer': 'first' },
      monsters: [{ name: 'Rat', count: 3, slayer: null }, { name: 'King Black Dragon', count: 1, slayer: null }],
      objects: [['Herb patch', 1], ['Yew tree', 2]],
    };
    mocks.state.completedQuests = ['Sheep Shearer'];

    render(<ChunkActivityPanel {...baseProps} />);

    const quests = screen.getByRole('button', { name: /Quests/ });
    const combat = screen.getByRole('button', { name: /Combat/ });
    const gathering = screen.getByRole('button', { name: /Gathering/ });
    expect(quests.getAttribute('aria-expanded')).toBe('true');
    expect(combat.getAttribute('aria-expanded')).toBe('false');
    expect(gathering.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(combat);
    await userEvent.click(gathering);
    expect(quests.getAttribute('aria-expanded')).toBe('true');
    expect(combat.getAttribute('aria-expanded')).toBe('true');
    expect(gathering.getAttribute('aria-expanded')).toBe('true');
    const completedQuest = screen.getByRole('link', { name: /Sheep Shearer.*Completed/ });
    const completedRow = completedQuest.closest('[data-quest-row]');
    expect(completedRow).toBeTruthy();
    expect(within(completedRow as HTMLElement).getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Yew tree').parentElement?.parentElement?.className).toContain('text-gray-400');
  });

  it('shows locked and ready quest state in text and in the Wiki link name', () => {
    mocks.state.content = {
      ...emptyContent(),
      quests: { "Doric's Quest": 'first' },
    };

    const { unmount } = render(<ChunkActivityPanel {...baseProps} />);
    const lockedLink = screen.getByRole('link', { name: /Doric's Quest.*Locked/ });
    expect(within(lockedLink.closest('[data-quest-row]') as HTMLElement).getByText('Locked')).toBeTruthy();
    unmount();

    mocks.state.regions = ['Falador'];
    render(<ChunkActivityPanel {...baseProps} />);
    const readyLink = screen.getByRole('link', { name: /Doric's Quest.*Ready/ });
    expect(within(readyLink.closest('[data-quest-row]') as HTMLElement).getByText('Ready')).toBeTruthy();
  });
  it('shows a manual-confirmation reason visibly and in the quest link name', () => {
    mocks.state.content = {
      ...emptyContent(),
      quests: { 'Prying Times': 'first' },
    };
    mocks.state.completedQuests = ['Pandemonium', "The Knight's Sword"];
    mocks.state.regions = ['The Pandemonium', 'Port Sarim', 'Rimmington'];
    mocks.state.skills = { Smithing: 3, Sailing: 2 };
    mocks.state.levels = { Smithing: 30, Sailing: 12 };

    render(<ChunkActivityPanel {...baseProps} />);

    const questLink = screen.getByRole('link', {
      name: /Prying Times.*Confirm: One open Sailing task slot/,
    });
    const questRow = questLink.closest('[data-quest-row]');
    expect(questRow).toBeTruthy();
    expect(within(questRow as HTMLElement).getByText('Confirm')).toBeTruthy();
    expect(within(questRow as HTMLElement).getByText('Confirm: One open Sailing task slot')).toBeTruthy();
  });

  it('uses Varies for a ready quest in mixed scope and keeps untracked explicit', async () => {
    mocks.state.content = {
      ...emptyContent(),
      quests: { 'Sheep Shearer': 'first', Miniquest: 'step' },
    };
    mocks.state.regions = ['Misthalin'];

    render(<ChunkActivityPanel {...baseProps} wholeAreaOwnershipMixed />);
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));

    const mixedLink = screen.getByRole('link', { name: /Sheep Shearer.*Varies/ });
    expect(within(mixedLink.closest('[data-quest-row]') as HTMLElement).getByText('Varies')).toBeTruthy();
    const untrackedLink = screen.getByRole('link', { name: /Miniquest.*Untracked/ });
    expect(within(untrackedLink.closest('[data-quest-row]') as HTMLElement).getByText('Untracked')).toBeTruthy();
  });
  it('uses neutral availability wording for combat and gathering rows in mixed area scope', async () => {
    mocks.state.content = {
      ...emptyContent(),
      quests: { 'Sheep Shearer': 'first' },
      monsters: [{ name: 'King Black Dragon', count: 1, slayer: null }],
      objects: [['Herb patch', 1], ['Yew tree', 2]],
    };
    mocks.state.regions = ['Misthalin'];

    render(<ChunkActivityPanel {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));
    await userEvent.click(screen.getByRole('button', { name: /Combat/ }));
    await userEvent.click(screen.getByRole('button', { name: /Gathering/ }));

    expect(screen.getByText('King Black Dragon').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
    expect(screen.getByText('Herb patch').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
    expect(screen.getByText('Yew tree').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
    expect(screen.getByText('Needs King Black Dragon')).toBeTruthy();
    expect(screen.getByText('Sheep Shearer').closest('[data-quest-row]')?.getAttribute('title')).toBe('Availability varies across this area');

  });
  it('retains known boss, guild, and minigame gates in mixed Whole area scope', async () => {
    mocks.state.content = {
      ...emptyContent(),
      quests: { 'Sheep Shearer': 'first' },
      monsters: [{ name: 'King Black Dragon', count: 1, slayer: null }],
      npcs: ["Cooks' Guild", 'Castle Wars'],
    };
    mocks.state.guilds = ["Cooks' Guild"];

    render(<ChunkActivityPanel {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));
    await userEvent.click(screen.getByRole('button', { name: /Combat/ }));
    await userEvent.click(screen.getByRole('button', { name: /Other/ }));

    expect(screen.getByText('Needs King Black Dragon')).toBeTruthy();
    expect(screen.getByText('Guild unlocked')).toBeTruthy();
    expect(screen.getByText('Needs Minigame unlock')).toBeTruthy();
    expect(screen.getByText('Indexed activities')).toBeTruthy();
  });
  it('exposes locked guild and minigame requirements in visible and focused text', async () => {
    mocks.state.content = {
      ...emptyContent(),
      npcs: ["Cooks' Guild", 'Castle Wars'],
    };

    render(<ChunkActivityPanel {...baseProps} />);
    const disclosure = screen.getByRole('button', { name: /Other/ });
    if (disclosure.getAttribute('aria-expanded') === 'false') await userEvent.click(disclosure);

    expect(screen.getByText('Needs Guild unlock')).toBeTruthy();
    expect(screen.getByText('Needs Minigame unlock')).toBeTruthy();
    expect(screen.getByRole('link', { name: "Cooks' Guild — Needs Guild unlock" })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Castle Wars — Needs Minigame unlock' })).toBeTruthy();
  });

  it('exposes chunk-locked guild and minigame state when intrinsic gates are met', async () => {
    mocks.state.content = {
      ...emptyContent(),
      npcs: ["Cooks' Guild", 'Castle Wars'],
    };
    mocks.state.guilds = ["Cooks' Guild"];
    mocks.state.minigames = ['Castle Wars'];

    render(<ChunkActivityPanel {...baseProps} unlocked={false} />);
    const disclosure = screen.getByRole('button', { name: /Other/ });
    if (disclosure.getAttribute('aria-expanded') === 'false') await userEvent.click(disclosure);
    const section = disclosure.closest('section');
    expect(section).toBeTruthy();

    expect(within(section as HTMLElement).getAllByText('Locked')).toHaveLength(2);
    expect(within(section as HTMLElement).getByRole('link', { name: "Cooks' Guild — Locked" })).toBeTruthy();
    expect(within(section as HTMLElement).getByRole('link', { name: 'Castle Wars — Locked' })).toBeTruthy();
  });


  it('uses neutral totals for a non-chunked Whole area with mixed subarea ownership', async () => {
    mocks.state.content = {
      ...emptyContent(),
      monsters: [{ name: 'Rat', count: 3, slayer: null }],
    };

    render(
      <ChunkActivityPanel
        {...baseProps}
        wholeAreaOwnershipMixed
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));

    expect(screen.getByText('Indexed activities')).toBeTruthy();
    expect(screen.queryByText('Available now')).toBeNull();
    expect(screen.getByText('Varies')).toBeTruthy();
    expect(screen.queryByText('Unlocked')).toBeNull();

    cleanup();
    render(<ChunkActivityPanel {...baseProps} unlocked={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));

    expect(screen.getByText('Varies')).toBeTruthy();
    expect(screen.queryByText('Locked')).toBeNull();
  });
  it('opens Combat by default when quests are absent and omits empty groups', () => {
    mocks.state.content = {
      ...emptyContent(),
      monsters: [{ name: 'Rat', count: 3, slayer: null }],
    };

    render(<ChunkActivityPanel {...baseProps} />);

    expect(screen.getByRole('button', { name: /Combat/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('button', { name: /Quests/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Gathering/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Shops/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Travel/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Other/ })).toBeNull();
  });

  it('groups shops, travel, and reference rows without losing nested controls', async () => {
    mocks.state.content = {
      ...emptyContent(),
      shops: ['Varrock General Store', 'Odd Shop'],
      quests: { 'Sheep Shearer': 'first' },
      monsters: [{ name: 'Rat', count: 1, slayer: null }],
      objects: [['Fairy ring', 1], ['Herb patch', 1], ['Yew tree', 1], ['Statue', 2]],
      npcs: ["Cooks' Guild", 'Castle Wars', 'Shopkeeper'],
      diaries: { Lumbridge: 'LB1' },
      clues: { hard: 1 },
      spawns: ['Bronze dagger'],
    };
    mocks.service.shopStock.mockReturnValue(['Bronze dagger']);
    mocks.service.connectGraph.mockReturnValue({ '12853': ['12854'] });
    const onShowChunk = vi.fn();
    window.addEventListener('fate:show-chunk', onShowChunk);

    render(<ChunkActivityPanel {...baseProps} />);

    expect(screen.getByRole('button', { name: /Shops/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Travel/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Other/ })).toBeTruthy();
    const accordionLabels = screen.getAllByRole('button')
      .map(button => button.getAttribute('aria-label'))
      .filter((label): label is string => /^(Quests|Combat|Gathering|Shops|Travel|Other),/.test(label))
      .map(label => label.split(',')[0]);
    expect(accordionLabels).toEqual(['Quests', 'Combat', 'Gathering', 'Shops', 'Travel', 'Other']);
    expect(accordionLabels).toHaveLength(6);
    expect(screen.queryByText('Travel links')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Shops/ }));
    await userEvent.click(screen.getAllByTitle('Show stock')[0]);
    expect(screen.getAllByText('Bronze dagger')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: /Travel/ }));
    await userEvent.click(screen.getByTitle('Needs the "Fairy Rings" network'));
    expect(onShowChunk).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /Other/ }));
    expect(screen.getByText('Shopkeeper')).toBeTruthy();
    expect(screen.getAllByText('Bronze dagger').length).toBeGreaterThan(1);
    window.removeEventListener('fate:show-chunk', onShowChunk);
  });
  it('keeps Shops, Travel, and Other rows neutral in mixed area scope', async () => {
    mocks.state.content = {
      ...emptyContent(),
      shops: ['Varrock General Store', 'Odd Shop'],
      objects: [['Fairy ring', 1]],
      npcs: ["Cooks' Guild"],
    };
    mocks.state.regions = ['Misthalin'];

    render(<ChunkActivityPanel {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));
    await userEvent.click(screen.getByRole('button', { name: /Travel/ }));
    await userEvent.click(screen.getByRole('button', { name: /Other/ }));

    expect(screen.getByText('Varrock General Store').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
    expect(screen.getByText('Fairy ring').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
    const oddShopRow = screen.getByText('Odd Shop').closest('div');
    expect(oddShopRow).toBeTruthy();
    expect(within(oddShopRow as HTMLElement).getByText('No unlock gate')).toBeTruthy();
    expect(screen.getAllByText("Cooks' Guild")[0].closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
  });

  it('excludes monsters with unevaluated access requirements from availability totals', () => {
    mocks.state.content = {
      ...emptyContent(),
      monsters: [{ name: 'Rat', count: 1, slayer: null }],
    };
    mocks.service.taskRequirements.mockReturnValue(['Dragon Slayer I']);

    render(<ChunkActivityPanel {...baseProps} />);

    expect(screen.getByText('Available now').previousElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Needs unlocks').previousElementSibling?.textContent).toBe('0');
    const row = screen.getByText('Rat').closest('div');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('Dragon Slayer I')).toBeTruthy();
    expect(within(row as HTMLElement).queryByText('Available')).toBeNull();
  });

  it('counts requirement-bearing monsters as locked when the selected chunk is locked', () => {
    mocks.state.content = {
      ...emptyContent(),
      monsters: [{ name: 'Rat', count: 1, slayer: null }],
    };
    mocks.service.taskRequirements.mockReturnValue(['Dragon Slayer I']);

    render(<ChunkActivityPanel {...baseProps} unlocked={false} />);

    expect(screen.getByText('Available now').previousElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Needs unlocks').previousElementSibling?.textContent).toBe('1');
    expect(screen.getByRole('button', { name: 'Combat, 1 locked' })).toBeTruthy();
    const row = screen.getByText('Rat').closest('div');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('Dragon Slayer I')).toBeTruthy();
  });
  it('keeps per-chunk monster requirements neutral in a uniform Whole area summary', async () => {
    mocks.state.content = {
      ...emptyContent(),
      monsters: [{ name: 'Rat', count: 2, slayer: null }],
    };
    mocks.service.taskRequirements.mockImplementation(
      (_name: string, _kind: string, cx: number, _cy: number) => cx === 51 ? ['Dragon Slayer I'] : [],
    );

    render(
      <ChunkActivityPanel
        {...baseProps}
        regionChunks={[{ cx: 50, cy: 53 }, { cx: 51, cy: 53 }]}
        wholeAreaOwnershipMixed={false}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));

    expect(screen.getByText('Available now').previousElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Needs unlocks').previousElementSibling?.textContent).toBe('0');
    const row = screen.getByText('Rat').closest('div');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('Dragon Slayer I')).toBeTruthy();
    expect(within(row as HTMLElement).queryByText('Available')).toBeNull();
  });

  it('keeps unevaluated boss, shop, and object requirements out of available totals', async () => {
    setRequirementAwareFixture();

    render(<ChunkActivityPanel {...baseProps} />);

    expect(screen.getByText('Available now').previousElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Needs unlocks').previousElementSibling?.textContent).toBe('0');
    await userEvent.click(screen.getByRole('button', { name: /Gathering/ }));
    await userEvent.click(screen.getByRole('button', { name: /Shops/ }));
    expect(screen.getByTitle('Access requirement: Desert Treasure II - The Fallen Empire')).toBeTruthy();
    expect(screen.getByTitle('Access requirement: Access the Farming Guild#Beginner tier')).toBeTruthy();
    expect(screen.getByTitle('Access requirement: Dragon Slayer I')).toBeTruthy();
  });

  it('counts requirement-bearing actionable rows as locked when the chunk is locked', () => {
    setRequirementAwareFixture();

    render(<ChunkActivityPanel {...baseProps} unlocked={false} />);

    expect(screen.getByText('Available now').previousElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Needs unlocks').previousElementSibling?.textContent).toBe('3');
  });

  it('keeps an unclassified shop neutral in mixed scope everywhere', async () => {
    mocks.state.content = { ...emptyContent(), shops: ['Odd Shop'] };

    render(<ChunkActivityPanel {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));
    await userEvent.click(screen.getByRole('button', { name: 'Shops, 1 item' }));

    expect(screen.getByText('Indexed activities').previousElementSibling?.textContent).toBe('0');
    const row = screen.getByText('Odd Shop').closest('div');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('No unlock gate')).toBeTruthy();
    expect(within(row as HTMLElement).queryByText('Area')).toBeNull();
  });
});
describe('ChunkActivityPanel summary hierarchy', () => {
  it('shows uniform availability and neutral chunk-owned area totals', async () => {
    render(<ChunkActivityPanel {...baseProps} />);
    expect(screen.getByText('Available now')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: 'Access & facilities' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));
    expect(screen.getByText('Indexed activities')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Access & facilities' })).toBeNull();
    expect(screen.queryByText('Available now')).toBeNull();
  });
});

describe('ChunkActivityPanel body states', () => {
  it('treats ready chunks with no indexed document as empty and keeps access before it', () => {
    mocks.state.content = null;

    render(<ChunkActivityPanel {...baseProps} />);

    const access = screen.getByRole('heading', { name: 'Access & facilities' });
    const empty = screen.getByText('No indexed content');
    expect(access.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByText('Available now')).toBeNull();
    expect(screen.queryByText('Needs unlocks')).toBeNull();
  });

  it('shows loading without an access card or zero summary while initialization is pending', () => {
    mocks.service.ready = false;
    mocks.service.init.mockImplementation(() => new Promise<boolean>(() => undefined));

    render(<ChunkActivityPanel {...baseProps} />);

    expect(screen.getByLabelText('Loading chunk content')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Access & facilities' })).toBeNull();
    expect(screen.queryByText('Available now')).toBeNull();
    expect(screen.queryByText('Needs unlocks')).toBeNull();
  });

  it('announces failed loading and retries initialization', async () => {
    mocks.service.ready = false;
    mocks.service.init
      .mockResolvedValueOnce(false)
      .mockImplementation(async () => {
        mocks.service.ready = true;
        return true;
      });

    render(<ChunkActivityPanel {...baseProps} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Chunk content unavailable');
    expect(screen.queryByText('Available now')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Retry loading chunk content' }));
    expect(await screen.findByText('Available now')).toBeTruthy();
  });
});
