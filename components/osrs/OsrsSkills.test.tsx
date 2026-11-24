// @vitest-environment jsdom
// The OSRS Skills panel: the filter box and the skill tiles' Examine text.
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { SKILLS_LIST } from '../../constants';

const game: { current: Record<string, unknown> } = { current: {} };
vi.mock('../../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
  return { ...actual, useGame: () => game.current };
});
vi.mock('../../services/WikiService', () => ({
  wikiService: { getImage: vi.fn(() => Promise.resolve(null)), getCachedImage: vi.fn(() => null), fetchImage: vi.fn(async () => null) },
}));
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const renderSkills = async (opts: { gameModeId?: string; searchQuery?: string; skills?: Record<string, number>; levels?: Record<string, number> } = {}) => {
  const { initialState } = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
  const { OsrsSkills } = await import('./OsrsSkills');
  const unlocks = {
    ...initialState.unlocks,
    skills: { ...initialState.unlocks.skills, ...opts.skills },
    levels: { ...initialState.unlocks.levels, ...opts.levels },
  };
  game.current = { ...initialState, gameModeId: opts.gameModeId ?? 'vanilla', unlocks, history: [], hasSeenOnboarding: true, animationsEnabled: false, specialKeys: 0, keys: 3 };
  return render(
    <OsrsSkills unlocks={unlocks} specialKeys={0} totalSkillTiers={0} searchQuery={opts.searchQuery ?? ''} showOnlyActionable={false} levelingSkill={null}
      advisorsEnabled={false} suspendModals={false} onLevelUp={() => {}} onSpecialUnlock={() => {}} onOpenDetails={() => {}} onClearSearch={() => {}} />,
  );
};
const tiles = (r: ReturnType<typeof render>) => [...r.container.querySelectorAll('[data-skill-card]')].map(el => el.getAttribute('data-skill-card'));
const note = (r: ReturnType<typeof render>) => r.container.querySelector('.osrs-dash-nomatch')?.textContent ?? null;

describe('the OSRS Skills panel filter', () => {
  afterEach(cleanup);

  it('filters on the trimmed query, as its No skills match note does', async () => {
    for (const q of ['attack', 'attack ', ' attack', ' att']) {
      const r = await renderSkills({ searchQuery: q });
      expect(tiles(r), JSON.stringify(q)).toEqual(['Attack']);
      expect(note(r)).toBeNull();
      cleanup();
    }
  });

  it('treats a lone space as no filter', async () => {
    const r = await renderSkills({ searchQuery: ' ' });
    expect(tiles(r)).toHaveLength(SKILLS_LIST.length);
    expect(note(r)).toBeNull();
  });

  it('shows the note whenever nothing matches', async () => {
    const r = await renderSkills({ searchQuery: ' zzz ' });
    expect(tiles(r)).toHaveLength(0);
    expect(note(r)).toBe('No skills match ‘zzz’.Clear');
  });
});

describe('the OSRS skill tile Examine text', () => {
  afterEach(cleanup);
  const examine = (r: ReturnType<typeof render>, skill: string) =>
    r.container.querySelector(`[data-skill-card="${skill}"]`)?.getAttribute('data-examine') ?? '';

  it('in Vanilla names the methods a tier opens, not a level cap', async () => {
    const r = await renderSkills({ skills: { Attack: 2 }, levels: { Attack: 45 } });
    const text = examine(r, 'Attack');
    expect(text).toMatch(/^Level 45\. Tier 2: training methods for levels 1-20\. Next Lv 46: .+ Key chance\./);
    expect(text).not.toContain('you can train levels');
  });

  it('in Chunked keeps the past-cap odds text after the methods', async () => {
    const r = await renderSkills({ gameModeId: 'chunked', skills: { Attack: 2 }, levels: { Attack: 25 } });
    expect(examine(r, 'Attack')).toMatch(/^Level 25\. Tier 2: training methods for levels 1-20\. Next Lv 26: no Key roll\. Past this tier's cap of level 20\./);
  });
});
