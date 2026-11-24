// @vitest-environment jsdom
// ui-osrs-b[2]: a row shows its area's aliases (displayAreaName), so the
// search must match them too, or typing an alias hides the row that names it.
import React, { act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '../../context/GameContext';
import { displayAreaName } from '../../data/areaMapPolicy';
import { OsrsWorldList } from './OsrsWorldList';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const stored = new Map<string, string>();
beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, String(value)),
    removeItem: (key: string) => stored.delete(key),
    clear: () => stored.clear(),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const renderList = async (searchQuery: string) => {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <GameProvider storageKey={`osrs-world-search-${searchQuery}`}>
        <OsrsWorldList searchQuery={searchQuery} showOnlyActionable={false} onUnlockArea={() => {}} suspendModals viewButtons={null} />
      </GameProvider>,
    );
  });
  return view;
};

describe('OSRS World list search', () => {
  it.each([
    ['ice mountain', 'Asgarnia', 'Goblin Village'],
    ["heroes' guild", 'Asgarnia', 'Taverley'],
  ])('keeps the row that shows the alias "%s"', async (search, group, area) => {
    expect(displayAreaName(area).toLowerCase()).toContain(search);
    const view = await renderList(search);
    expect(view.container.querySelector(`[data-region-card="${group}"]`)).not.toBeNull();
    expect(view.container.querySelector(`[data-owl-area="${area}"]`)).not.toBeNull();
  });

  // ui-osrs-b.d1[1]: names typed without their apostrophe, as the journal searches accept.
  it.each([
    ['warriors guild', "Warriors' Guild"],
    ['seers village ', "Seers' Village"],
    ['mortton', "Mort'ton"],
  ])('finds "%s" without its apostrophe', async (search, shown) => {
    const view = await renderList(search);
    const rows = [...view.container.querySelectorAll('[data-owl-area]')].map(el => displayAreaName(el.getAttribute('data-owl-area')!));
    expect(rows.some(name => name.includes(shown))).toBe(true);
  });

  it('still hides regions that match nothing', async () => {
    const view = await renderList('no such place anywhere');
    expect(view.container.querySelectorAll('[data-region-card]').length).toBe(0);
  });
});
