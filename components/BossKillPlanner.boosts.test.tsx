// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ZERO_BONUSES } from '../utils/gearStats';
import type { MonsterStats } from '../services/MonsterService';

// General Graardor, from the pinned catalogue.
const GRAARDOR: MonsterStats = {
  id: 2215, name: 'General Graardor', version: '', imageFile: '', level: 624, hp: 255, maxHit: 60,
  defLevel: 250, magicLevel: 80,
  def: { stab: 90, slash: 90, crush: 90, magic: 298, ranged: 90 },
  rangedDefence: { light: 90, standard: 90, heavy: 90 },
  size: 4, attributes: [],
};

const game = vi.hoisted(() => ({ unlocks: {} as Record<string, unknown> }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({
  unlocks: game.unlocks, gameModeId: 'vanilla', loadout: { Weapon: 4151 }, animationsEnabled: false,
}) }));
vi.mock('../services/GearService', () => ({ gearService: {
  ready: true, init: vi.fn().mockResolvedValue(undefined), byId: (id?: number) => id === 4151 ? {
    id, name: 'Abyssal whip', slot: 'Weapon', category: 'Whip', speed: 4, twoHanded: false, imageFile: '',
    bonuses: { ...ZERO_BONUSES, slash: 82, meleeStr: 82 },
  } : undefined,
} }));
vi.mock('../services/MonsterService', () => ({ monsterService: {
  ready: true, init: vi.fn().mockResolvedValue(undefined),
  versionsOf: (name: string) => name === 'General Graardor' ? [GRAARDOR] : [],
} }));
vi.mock('../data/entityModels', () => ({ modelFor: () => undefined, orientationFor: () => undefined }));

import { BossKillPlanner } from './BossKillPlanner';

const player = (over: Record<string, unknown>) => ({
  bosses: ['General Graardor'], arcana: [], quests: [],
  skills: { Attack: 7, Strength: 7, Prayer: 7, Defence: 7, Hitpoints: 7 },
  levels: { Attack: 70, Strength: 70, Prayer: 70, Defence: 70, Hitpoints: 70 },
  ...over,
});
const detailText = async () => {
  await screen.findByText('Best DPS');
  return (document.body.textContent ?? '').replace(/\s+/g, ' ');
};

afterEach(cleanup);

describe('Boss Planner boosts', () => {
  it('assumes only the prayers the player has unlocked', async () => {
    game.unlocks = player({});
    render(<BossKillPlanner onClose={() => {}} />);
    const text = await detailText();
    expect(text).toContain('Max hit23');
    expect(text).toContain('Prayer: Improved Reflexes / Superhuman Strength · Potion: Super combat');
  });

  it('assumes Piety once it is unlocked and its gates are met', async () => {
    game.unlocks = player({ arcana: ['Piety'], quests: ["King's Ransom"] });
    render(<BossKillPlanner onClose={() => {}} />);
    const text = await detailText();
    expect(text).toContain('Max hit26');
    expect(text).toContain('Prayer: Piety · Potion: Super combat');
  });
});
