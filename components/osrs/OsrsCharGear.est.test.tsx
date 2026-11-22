// @vitest-environment jsdom
// ui-osrs-b[0]: the OSRS gear picker marks "Est." only for items with no
// reviewed tier, asking GearService.isEstimated as the classic GearView does.
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const bonuses = { astab: 0, aslash: 0, acrush: 0, amagic: 0, arange: 0, dstab: 0, dslash: 0, dcrush: 0, dmagic: 0, drange: 0, str: 0, rstr: 0, mdmg: 0, prayer: 0 };
const items = vi.hoisted(() => [
  // Reviewed (tier 4) though its name matches no canonical tier rule.
  { id: 12851, name: 'Amulet of the damned', slot: 'Neck', imageFile: 'Amulet_of_the_damned.png', speed: 0, twoHanded: false },
  // A stat-based guess with no reviewed rule.
  { id: 99001, name: 'Unreviewed charm', slot: 'Neck', imageFile: 'Unreviewed_charm.png', speed: 0, twoHanded: false },
]);
vi.mock('../../services/GearService', () => ({
  gearService: {
    ready: true,
    error: null,
    bySlot: () => items.map(i => ({ ...i, bonuses })),
    byId: () => undefined,
    tierOf: () => 4,
    isEstimated: (id: number) => id === 99001,
  },
}));
vi.mock('../../services/ChunkContentService', () => ({ chunkContentService: { ready: false, init: () => new Promise(() => {}) } }));
vi.mock('../../context/GameContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../context/GameContext')>();
  const fresh = actual.createFreshState();
  return {
    ...actual,
    useGame: () => ({ ...fresh, unlocks: { ...fresh.unlocks, equipment: { ...fresh.unlocks.equipment, Neck: 5 } }, loadout: {}, setLoadoutSlot: vi.fn() }),
  };
});

import { OsrsGearPicker } from './OsrsCharGear';

afterEach(cleanup);

describe('OSRS gear picker Est. label', () => {
  it('shows Est. only for an item with no reviewed tier', () => {
    render(<OsrsGearPicker slot="Neck" status="ready" onClose={() => {}} onRetry={() => {}} />);
    const rowOf = (name: string) => screen.getByText(name).closest('button.osrs-dash-pickrow') as HTMLElement;
    expect(rowOf('Amulet of the damned').textContent).not.toMatch(/Est\./);
    expect(rowOf('Unreviewed charm').textContent).toMatch(/Est\./);
  });

  it('labels worn items from the same source in the Equipment Lab', () => {
    const source = readFileSync(resolve('components/osrs/OsrsEquipment.tsx'), 'utf8');
    expect(source).toContain('gearService.isEstimated(item.id)');
    expect(source).not.toContain('canonicalTierFromName');
  });
});
