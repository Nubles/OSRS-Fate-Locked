// @vitest-environment jsdom
// ui-osrs-b.d1[1]: both gear pickers (Classic GearView and the OSRS layout)
// find an item typed without its apostrophe, as the journal searches do.
import React from 'react';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EQUIPMENT_CATALOGUE } from '../data/equipmentCatalogue';

const bonuses = { astab: 0, aslash: 0, acrush: 0, amagic: 0, arange: 0, dstab: 0, dslash: 0, dcrush: 0, dmagic: 0, drange: 0, str: 0, rstr: 0, mdmg: 0, prayer: 0 };
const items = vi.hoisted(() => [] as { id: number; name: string; slot: string; imageFile: string; speed: number; twoHanded: boolean; bonuses: unknown }[]);
vi.mock('../services/GearService', () => ({
  gearService: {
    ready: true,
    error: null,
    init: () => Promise.resolve(),
    bySlot: () => items,
    byId: () => undefined,
    tierOf: () => 1,
    isEstimated: () => false,
  },
}));
vi.mock('../services/ChunkContentService', () => ({ chunkContentService: { ready: false, init: () => new Promise(() => {}) } }));
vi.mock('../context/GameContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../context/GameContext')>();
  const fresh = actual.createFreshState();
  return {
    ...actual,
    useGame: () => ({ ...fresh, unlocks: { ...fresh.unlocks, equipment: { ...fresh.unlocks.equipment, Head: 5 } }, loadout: {}, setLoadoutSlot: vi.fn() }),
  };
});

import { OsrsGearPicker } from './osrs/OsrsCharGear';
import { GearView } from './GearView';

// Real names from the shipped catalogue.
const catalogue: { name: string; id: number }[] = JSON.parse(readFileSync(resolve('public', EQUIPMENT_CATALOGUE.asset), 'utf8'));
for (const name of ["Karil's coif", "Dharok's helm", 'Bronze full helm']) {
  const row = catalogue.find(r => r.name === name)!;
  expect(row).toBeDefined();
  items.push({ id: row.id, name, slot: 'Head', imageFile: '', speed: 0, twoHanded: false, bonuses });
}

afterEach(cleanup);

const shown = () => ["Karil's coif", "Dharok's helm", 'Bronze full helm'].filter(n => screen.queryByText(n));

describe('gear picker search', () => {
  it('OSRS layout: finds "karils coif" without its apostrophe', () => {
    render(<OsrsGearPicker slot="Head" status="ready" onClose={() => {}} onRetry={() => {}} />);
    fireEvent.change(screen.getByLabelText('Search head'), { target: { value: 'karils coif ' } });
    expect(shown()).toEqual(["Karil's coif"]);
  });

  it('Classic layout: finds "karils coif" without its apostrophe', () => {
    render(<GearView />);
    fireEvent.click(screen.getByTitle(/^Head:/));
    fireEvent.change(screen.getByPlaceholderText(/^Search head/), { target: { value: 'karils coif' } });
    expect(shown()).toEqual(["Karil's coif"]);
  });
});
