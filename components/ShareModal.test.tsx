// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BANK_IDS } from '../data/banks';
import {
  SKILLS_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX, REGIONS_LIST,
  MOBILITY_LIST, ARCANA_LIST, ROLLABLE_POH_ITEMS, MERCHANTS_LIST, MINIGAMES_LIST,
  BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST, SLAYER_UNLOCKS_LIST,
} from '../constants';
import { ShareModal } from './ShareModal';
import { getGameMode } from '../config/gameModes';
import type { LogEntry } from '../types';
import { computeRunId } from '../utils/integrity';
import { UI_STYLE_KEY } from '../utils/uiStyle';

const mockGame = vi.hoisted(() => ({
  current: {
    gameModeId: 'vanilla',
    keys: 0,
    specialKeys: 0,
    chaosKeys: 0,
    fatePoints: 0,
    history: [] as LogEntry[],
    unlocks: {
      regions: [] as string[],
      chunks: [] as string[],
      skills: {},
      equipment: {},
      levels: {},
      bosses: [] as string[],
      minigames: [] as string[],
      arcana: [] as string[],
      housing: [] as string[],
      merchants: [] as string[],
      storage: [] as string[],
      banks: [] as string[],
      mobility: [] as string[],
      guilds: [] as string[],
      farming: [] as string[],
      slayerUnlocks: [] as string[],
      quests: [] as string[],
      completedTasks: [] as string[],
      cas: [] as string[],
    },
  },
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => mockGame.current,
}));

vi.mock('../context/ProfileContext', () => ({
  useProfiles: () => ({ activeProfileName: 'Vanilla preview' }),
}));

vi.mock('./SectionGuide', () => ({
  SectionGuide: () => null,
}));

/** The area or chunk count the share card states in its description. */
const cardFigure = (view: ReturnType<typeof render>, unit: 'areas' | 'chunks') => {
  const label = view.getAllByRole('img').map(el => el.getAttribute('aria-label') ?? '').find(l => l.startsWith('Share card:')) ?? '';
  const m = label.match(new RegExp(`(\\d+) of (\\d+) ${unit}`));
  if (!m) throw new Error(`No ${unit} figure in "${label}"`);
  return { done: Number(m[1]), total: Number(m[2]) };
};

describe('ShareModal region summary', () => {
  const writeText = vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    mockGame.current.history = [];
    // jsdom has no layout; mark mounted controls visible for the real focus trap.
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (this: HTMLElement) {
      return this.parentElement;
    });
    Object.assign(mockGame.current.unlocks, {
      regions: [], chunks: [], skills: {}, equipment: {}, levels: {}, bosses: [],
      minigames: [], arcana: [], housing: [], merchants: [], storage: [], banks: [],
      mobility: [], guilds: [], farming: [], slayerUnlocks: [], quests: [], completedTasks: [], cas: [],
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    {
      label: 'pending overlap refund credits',
      regions: ['Baxtorian Falls', "Otto's Grotto", 'Taverley', "Heroes' Guild"],
      expected: 2,
    },
    {
      label: 'ordinary canonical regions',
      regions: ['Baxtorian Falls', 'Taverley'],
      expected: 2,
    },
  ])('copies the card\'s area count for $label', async ({ regions, expected }) => {
    mockGame.current.unlocks.regions = regions;
    const view = render(<ShareModal onClose={vi.fn()} />);
    // The card counts every area the run can reach: the free start areas as
    // well as the visible areas it unlocked (aliases and overlaps not twice).
    const card = cardFigure(view, 'areas');
    expect(card.done).toBeGreaterThan(expected);

    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const summary = writeText.mock.calls[0][0];
    expect(summary).toContain(`Areas: ${card.done}/${card.total}\n`);
    expect(summary).not.toContain('Unlocked');
    expect(summary).not.toContain("Otto's Grotto");
    expect(summary).not.toContain("Heroes' Guild");
  });

  it("counts a Chunked run's chunks the same way on the card and in the summary, start chunk included", async () => {
    // The review's mid run: 8 chunks around Lumbridge and Al Kharid plus the start chunk.
    mockGame.current.gameModeId = 'chunked';
    mockGame.current.unlocks.chunks = ['49,50', '49,49', '50,49', '48,50', '50,51', '51,50', '52,50', '51,49'];
    try {
      const view = render(<ShareModal onClose={vi.fn()} />);
      expect(view.getByRole('img', { name: /9 of \d+ chunks/ })).toBeTruthy();

      fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      const card = cardFigure(view, 'chunks');
      expect(card.done).toBe(9);
      expect(writeText.mock.calls[0][0]).toContain(`Chunks: 9/${card.total}\n`);
    } finally {
      mockGame.current.gameModeId = 'vanilla';
    }
  });

  it('uses the generated bank pool size in the copied summary', async () => {
    mockGame.current.unlocks.banks = ['5678', '6454'];
    const view = render(<ShareModal onClose={vi.fn()} />);

    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain(`Banks: 2/${BANK_IDS.length}`);
    // The pool includes 124 physical chunk entries plus the virtual registry unlock.
    expect(BANK_IDS).toHaveLength(125);
  });

  it('copies the same figures as the card in Vanilla, counting only what the card counts', async () => {
    // Two areas rolled with Keys, a boss and a minigame that are on the
    // card's lists, and one saved boss name that is not (an old save's).
    mockGame.current.unlocks.regions = ['Baxtorian Falls', 'Taverley'];
    mockGame.current.unlocks.bosses = ['Zulrah', 'Not A Boss'];
    mockGame.current.unlocks.minigames = ['Barbarian Assault'];
    const view = render(<ShareModal onClose={vi.fn()} />);
    const card = cardFigure(view, 'areas');
    expect(card.done).toBeGreaterThan(2);

    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const summary = writeText.mock.calls[0][0];
    expect(summary).toContain(`Areas: ${card.done}/${card.total}\n`);
    expect(summary).toContain(`Bosses: 1/${BOSSES_LIST.length} | Minigames: 1/${MINIGAMES_LIST.length}\n`);
  });

  it('leaves Banks out of the summary when the card does, as in a Custom run with banks open', async () => {
    mockGame.current.gameModeId = 'custom';
    (mockGame.current as { customMode?: unknown }).customMode = { ...getGameMode('vanilla').rules, bankLocks: false };
    try {
      const view = render(<ShareModal onClose={vi.fn()} />);
      fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(writeText.mock.calls[0][0]).not.toContain('Banks:');
    } finally {
      mockGame.current.gameModeId = 'vanilla';
      (mockGame.current as { customMode?: unknown }).customMode = undefined;
    }
  });

  it('uses all unlock families for the shared completion percentage, with no rank', async () => {
    Object.assign(mockGame.current.unlocks, {
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, EQUIPMENT_TIER_MAX])),
      regions: [...REGIONS_LIST],
    });
    const view = render(<ShareModal onClose={vi.fn()} />);
    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('Progression: 53%');
    expect(writeText.mock.calls[0][0]).toMatch(/^\*\*Fate Locked Ironman\*\* \(Vanilla mode\)\n/);
    expect(view.getByRole('img', { name: /53% complete/ })).toBeTruthy();
    const ranks = /Lost Soul|Fate Wanderer|Iron Determinator|Void Champion|Master of Fate/;
    expect(writeText.mock.calls[0][0]).not.toMatch(ranks);
    expect(document.body.textContent).not.toMatch(ranks);
    expect(document.body.textContent).not.toMatch(/RNG Edition|Fate is Absolute/i);
  });

  it('reaches 100% when every active Vanilla unlock is owned without retired housing', async () => {
    Object.assign(mockGame.current.unlocks, {
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, EQUIPMENT_TIER_MAX])),
      regions: [...REGIONS_LIST], mobility: [...MOBILITY_LIST], arcana: [...ARCANA_LIST],
      housing: [...ROLLABLE_POH_ITEMS], merchants: [...MERCHANTS_LIST],
      minigames: [...MINIGAMES_LIST], bosses: [...BOSSES_LIST], storage: [...STORAGE_LIST],
      guilds: [...GUILDS_LIST], farming: [...FARMING_PATCH_LIST],
      slayerUnlocks: [...SLAYER_UNLOCKS_LIST], banks: [...BANK_IDS],
    });
    const view = render(<ShareModal onClose={vi.fn()} />);
    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('Progression: 100%');
    expect(writeText.mock.calls[0][0]).not.toContain('Master of Fate');
    expect(mockGame.current.unlocks.housing).not.toContain('Aquarium');
  });

  it('keeps keyboard focus inside the window and returns it after Escape', async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [open, setOpen] = React.useState(false);
      return <>
        <button onClick={() => setOpen(true)}>Share Run</button>
        {open && <ShareModal onClose={() => setOpen(false)} />}
      </>;
    };
    const view = render(<Harness />);
    const trigger = view.getByRole('button', { name: 'Share Run' });
    await user.click(trigger);
    const first = view.getByRole('button', { name: 'OSRS' });
    expect(document.activeElement).toBe(first);
    await user.tab({ shift: true });
    const enabled = view.getAllByRole('button').filter(b => !(b as HTMLButtonElement).disabled && b !== trigger);
    expect(document.activeElement).toBe(enabled[enabled.length - 1]);
    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.keyboard('{Escape}');
    expect(view.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('remembers the card style for this browser', () => {
    const view = render(<ShareModal onClose={vi.fn()} />);
    expect(view.getByRole('button', { name: 'OSRS' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(view.getByRole('button', { name: 'Tracker' }));
    cleanup();
    const again = render(<ShareModal onClose={vi.fn()} />);
    expect(again.getByRole('button', { name: 'Tracker' }).getAttribute('aria-pressed')).toBe('true');
    localStorage.clear();
  });

  it('keeps the run identity stable when changing styles and copying a summary', async () => {
    mockGame.current.history = [{
      id: 'first-event', type: 'LEVEL_UP', timestamp: 1234, message: 'Started run',
    }];
    const view = render(<ShareModal onClose={vi.fn()} />);
    const expected = `Run ID: ${computeRunId(mockGame.current.history)}`;
    expect(view.getByText(new RegExp(expected))).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Tracker' }));
    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(view.getByText(new RegExp(expected))).toBeTruthy();
    localStorage.clear();
  });
});

describe('ShareModal in the OSRS layout', () => {
  afterEach(() => {
    cleanup();
    localStorage.removeItem(UI_STYLE_KEY);
  });

  it('opens in a stone window with OSRS and Tracker tabs', () => {
    localStorage.setItem(UI_STYLE_KEY, 'osrs');
    const onClose = vi.fn();
    const view = render(<ShareModal onClose={onClose} />);
    expect(view.getByRole('heading', { name: 'Share Run' })).toBeTruthy();
    expect(document.querySelector('.owb-share')).toBeTruthy();
    expect(view.getByRole('button', { name: 'OSRS' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(view.getByRole('button', { name: 'Tracker' }));
    expect(view.getByRole('button', { name: 'Tracker' }).getAttribute('aria-pressed')).toBe('true');
    expect(view.getByRole('img', { name: /Share card:/ })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Copy Summary' })).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
