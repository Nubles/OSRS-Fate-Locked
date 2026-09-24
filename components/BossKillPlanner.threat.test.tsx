// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ZERO_BONUSES } from '../utils/gearStats';
import type { MonsterStats } from '../services/MonsterService';

// The catalogue lists this boss's max hit as "Varies".
const VARIES: MonsterStats = {
  id: 7584, name: 'Ice demon', version: 'Normal', imageFile: '', level: 1, hp: 140, maxHit: null,
  defLevel: 150, magicLevel: 1,
  def: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
  rangedDefence: { light: 0, standard: 0, heavy: 0 },
  size: 3, attributes: [],
};

vi.mock('../context/GameContext', () => ({ useGame: () => ({
  unlocks: { bosses: ['Ice demon'], arcana: [], quests: [], skills: {}, levels: { Attack: 99, Strength: 99, Hitpoints: 99 } },
  gameModeId: 'vanilla', loadout: { Weapon: 4151 }, animationsEnabled: false,
}) }));
vi.mock('../services/GearService', () => ({ gearService: {
  ready: true, init: vi.fn().mockResolvedValue(undefined), byId: (id?: number) => id === 4151 ? {
    id, name: 'Abyssal whip', slot: 'Weapon', category: 'Whip', speed: 4, twoHanded: false, imageFile: '',
    bonuses: { ...ZERO_BONUSES, slash: 82, meleeStr: 82 },
  } : undefined,
} }));
vi.mock('../services/MonsterService', () => ({ monsterService: {
  ready: true, init: vi.fn().mockResolvedValue(undefined),
  versionsOf: (name: string) => name === 'Ice demon' ? [VARIES] : [],
} }));
vi.mock('../data/entityModels', () => ({ modelFor: () => undefined, orientationFor: () => undefined }));

import { BossKillPlanner } from './BossKillPlanner';

afterEach(cleanup);

describe('Boss Planner threat', () => {
  it('shows an unknown max hit as unknown danger rather than Low', async () => {
    render(<BossKillPlanner onClose={() => {}} />);
    await screen.findByText('Best DPS');
    const text = (document.body.textContent ?? '').replace(/\s+/g, ' ');
    // Tile labels and values sit in adjacent elements.
    expect(text).toContain('DangerUnknown');
    expect(text).not.toContain('DangerLow');
    expect(text).toContain('Kills / trip—');
    expect(text).toContain('Boss max hit unknown');
  });
});
