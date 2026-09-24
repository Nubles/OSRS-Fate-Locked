// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { REGION_GROUPS, SKILLS_LIST } from '../data/items';

const flash = vi.hoisted(() => vi.fn());
vi.mock('../utils/flash', () => ({ flashSelector: flash }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({
  gameModeId: 'vanilla',
  unlocks: {
    equipment: {}, skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
    levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
    regions: [], chunks: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [],
    storage: [], guilds: [], farming: [], slayerUnlocks: [], banks: [], quests: [], diaries: [], cas: [],
    completedTasks: [], collectionLog: {},
  },
}) }));

import { RegionAdvisorPanel } from './RegionAdvisorPanel';

afterEach(cleanup);

describe('RegionAdvisorPanel', () => {
  it('recommends areas, not continents, and points at the area’s continent card', () => {
    render(<RegionAdvisorPanel />);
    const rows = screen.getAllByRole('listitem');
    // Titles read "Area" or "Area · alias".
    const areas = rows.map(row => row.getAttribute('aria-label')!.split(':')[0].split(' · ')[0]);
    const continentOf = (area: string) => Object.keys(REGION_GROUPS).find(name => REGION_GROUPS[name].includes(area));

    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) expect(continentOf(area)).toBeDefined();
    const continent = continentOf(areas[0])!;
    expect(rows[0].textContent).toContain(continent);
    fireEvent.click(rows[0]);
    expect(flash).toHaveBeenCalledWith(`[data-region-card="${continent}"]`, 'amber');
  });
});
