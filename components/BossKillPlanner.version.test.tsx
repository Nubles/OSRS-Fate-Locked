// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ZERO_BONUSES } from '../utils/gearStats';
import type { MonsterStats } from '../services/MonsterService';

const version = (label: string, hp: number, defLevel: number): MonsterStats => ({
  id: 12223, name: 'Vardorvis', version: label, imageFile: '', level: 1, hp, maxHit: 40,
  defLevel, magicLevel: 1,
  def: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
  rangedDefence: { light: 0, standard: 0, heavy: 0 },
  size: 2, attributes: [],
});
const VARDORVIS = [version('Awakened', 1400, 280), version('Post-quest', 700, 215), version('Quest', 500, 180)];

vi.mock('../context/GameContext', () => ({ useGame: () => ({
  unlocks: { bosses: ['Vardorvis'], levels: { Attack: 99, Strength: 99, Ranged: 99, Magic: 99, Hitpoints: 99 } },
  loadout: { Weapon: 4151 },
  animationsEnabled: false,
}) }));
vi.mock('../services/GearService', () => ({ gearService: {
  ready: true, init: vi.fn().mockResolvedValue(undefined), byId: (id?: number) => id === 4151 ? {
    id, name: 'Abyssal whip', slot: 'Weapon', category: 'Whip', speed: 4, twoHanded: false, imageFile: '',
    bonuses: { ...ZERO_BONUSES, slash: 82, meleeStr: 82 },
  } : undefined,
} }));
vi.mock('../services/MonsterService', () => ({ monsterService: {
  ready: true, init: vi.fn().mockResolvedValue(undefined),
  versionsOf: (name: string) => name === 'Vardorvis' ? VARDORVIS : [],
} }));
vi.mock('../data/entityModels', () => ({ modelFor: () => undefined, orientationFor: () => undefined }));

import { BossKillPlanner } from './BossKillPlanner';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Boss Planner versions', () => {
  it('plans the post-quest fight by default and lets the player choose another version', async () => {
    render(<BossKillPlanner onClose={() => {}} />);
    const picker = await screen.findByRole('combobox', { name: 'Version of Vardorvis' }) as HTMLSelectElement;
    expect([...picker.options].map(option => option.value)).toEqual(['Awakened', 'Post-quest', 'Quest']);
    expect(picker.value).toBe('Post-quest');
    expect(screen.getByText(/HP 700/)).toBeTruthy();

    fireEvent.change(picker, { target: { value: 'Awakened' } });
    expect(screen.getByText(/HP 1400/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('bossplanner:versions') ?? '{}')).toEqual({ Vardorvis: 'Awakened' });
  });

  it('remembers the chosen version and ignores one the catalogue no longer has', async () => {
    localStorage.setItem('bossplanner:versions', JSON.stringify({ Vardorvis: 'Quest' }));
    render(<BossKillPlanner onClose={() => {}} />);
    expect((await screen.findByRole('combobox', { name: 'Version of Vardorvis' }) as HTMLSelectElement).value).toBe('Quest');
    cleanup();

    localStorage.setItem('bossplanner:versions', JSON.stringify({ Vardorvis: 'Retired variant' }));
    render(<BossKillPlanner onClose={() => {}} />);
    expect((await screen.findByRole('combobox', { name: 'Version of Vardorvis' }) as HTMLSelectElement).value).toBe('Post-quest');
  });
});
