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
import type { LogEntry } from '../types';
import { computeRunId } from '../utils/integrity';

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
      mobility: [], guilds: [], farming: [], slayerUnlocks: [],
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
  ])('reports $expected visible regions for $label', async ({ regions, expected }) => {
    mockGame.current.unlocks.regions = regions;
    const view = render(<ShareModal onClose={vi.fn()} />);

    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const summary = writeText.mock.calls[0][0];
    expect(summary).toContain(`Regions: ${expected} Unlocked`);
    expect(summary).not.toContain("Otto's Grotto");
    expect(summary).not.toContain("Heroes' Guild");
  });

  it('uses the generated bank pool size in the copied summary', async () => {
    mockGame.current.unlocks.banks = ['5678', '6454'];
    const view = render(<ShareModal onClose={vi.fn()} />);

    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain(`Banks: 2/${BANK_IDS.length}`);
    // The pool includes 127 physical chunk entries plus the virtual registry unlock.
    expect(BANK_IDS).toHaveLength(128);
  });

  it('uses all unlock families for the shared completion percentage and rank', async () => {
    Object.assign(mockGame.current.unlocks, {
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, EQUIPMENT_TIER_MAX])),
      regions: [...REGIONS_LIST],
    });
    const view = render(<ShareModal onClose={vi.fn()} />);
    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('Progression: 53%');
    expect(writeText.mock.calls[0][0]).toContain('Void Champion');
    expect(view.getByText('53%')).toBeTruthy();
    expect(view.queryByText('Master of Fate')).toBeNull();
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
    expect(writeText.mock.calls[0][0]).toContain('Master of Fate');
    expect(mockGame.current.unlocks.housing).not.toContain('Aquarium');
  });

  it.each(['Stats card', 'Map card'])('keeps keyboard focus inside %s and returns it after Escape', async (cardStyle) => {
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
    const first = view.getByRole('button', { name: 'Stats card' });
    expect(document.activeElement).toBe(first);
    await user.click(view.getByRole('button', { name: cardStyle }));
    if (cardStyle === 'Map card') await user.tab({ shift: true });
    expect(document.activeElement).toBe(first);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(view.getByRole('button', { name: /^Close$/ }));
    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.keyboard('{Escape}');
    expect(view.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the run identity stable when changing themes and copying a summary', async () => {
    mockGame.current.history = [{
      id: 'first-event', type: 'LEVEL_UP', timestamp: 1234, message: 'Started run',
    }];
    const view = render(<ShareModal onClose={vi.fn()} />);
    const expected = `Run ID: ${computeRunId(mockGame.current.history)}`;
    expect(view.getByText(expected)).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'GILDED' }));
    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(view.getByText(expected)).toBeTruthy();
  });
});
