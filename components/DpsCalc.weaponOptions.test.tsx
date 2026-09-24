// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ZERO_BONUSES } from '../utils/gearStats';
import { DpsCalc } from './DpsCalc';

const fixture = vi.hoisted(() => ({ category: 'Whip' as string | undefined,
  game: { gameModeId: 'vanilla', unlocks: { levels: { Attack: 99, Strength: 99, Magic: 99, Ranged: 99 } }, loadout: { Weapon: 4151 } },
}));
vi.mock('../context/GameContext', () => ({ useGame: () => fixture.game }));
vi.mock('../services/GearService', () => ({ gearService: {
  ready: true, init: vi.fn().mockResolvedValue(undefined), byId: (id?: number) => id === 4151 ? {
    id, name: 'Test weapon', slot: 'Weapon', category: fixture.category,
    speed: 4, twoHanded: false, imageFile: '', bonuses: { ...ZERO_BONUSES, slash: 82, meleeStr: 82 },
  } : undefined,
} }));
const DUKE = vi.hoisted(() => ['Awakened, Awake', 'Post-quest, Awake'].map((version, index) => ({
  id: 12191, name: 'Duke Sucellus', version, imageFile: '', level: 1, hp: index === 0 ? 1697 : 485, maxHit: 50,
  defLevel: index === 0 ? 316 : 275, magicLevel: 1,
  def: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
  rangedDefence: { light: 0, standard: 0, heavy: 0 }, size: 5, attributes: [],
})));
vi.mock('../services/MonsterService', () => ({
  monsterKey: (monster: { id: number; name: string; version: string }) => `${monster.id}|${monster.name}|${monster.version}`,
  monsterService: {
    ready: true, init: vi.fn().mockResolvedValue(undefined), byId: () => undefined,
    search: () => DUKE,
    byKey: (key: string | null | undefined) => DUKE.find(monster => `${monster.id}|${monster.name}|${monster.version}` === key),
  },
}));
afterEach(cleanup);
beforeEach(() => { fixture.category = 'Whip'; });

describe('Vanilla DPS weapon controls', () => {
  it('offers slash and legal whip stances only', async () => {
    render(<DpsCalc />);
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Attack type' }) as HTMLSelectElement).value).toBe('slash'));
    const attack = screen.getByRole('combobox', { name: 'Attack type' }) as HTMLSelectElement;
    const stance = screen.getByRole('combobox', { name: 'Stance' }) as HTMLSelectElement;
    expect([...attack.options].map(option => option.value)).toEqual(['slash']);
    expect([...stance.options].map(option => option.value)).toEqual(['accurate', 'controlled', 'defensive']);
    expect((screen.getByRole('button', { name: 'Ranged' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('moves a bow to ranged and disables melee', async () => {
    fixture.category = 'Bow';
    render(<DpsCalc />);
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Attack type' })).toBeNull());
    expect((screen.getByRole('button', { name: 'Melee' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: 'Stance' }) as HTMLSelectElement).value).toBe('accurate');
  });
  it('shows an explicit unknown state when a loaded item has no category', async () => {
    fixture.category = undefined;
    render(<DpsCalc />);
    expect((await screen.findByRole('status')).textContent).toContain('Attack options for this weapon need review');
  });
  it('uses five ticks for manually cast spells even while a weapon is equipped', async () => {
    render(<DpsCalc />);
    fireEvent.click(await screen.findByRole('button', { name: 'Magic' }));
    await waitFor(() => expect(screen.getByText(/5t before stance/)).toBeTruthy());
  });
  it('calculates against the exact version picked when versions share an NPC id', async () => {
    render(<DpsCalc />);
    fireEvent.click(await screen.findByRole('button', { name: /target/i }));
    fireEvent.click(screen.getByRole('button', { name: /Awakened, Awake/ }));
    expect(await screen.findByText(/HP 1697/)).toBeTruthy();
  });
});
