// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ZERO_BONUSES } from '../utils/gearStats';
import { DpsCalc } from './DpsCalc';
import { OsrsCharDps } from './osrs/OsrsCharDps';

// Both DPS layouts share one dart select, shown only while a blowpipe is equipped.
const fixture = vi.hoisted(() => ({
  weapon: 'Toxic blowpipe',
  game: { gameModeId: 'vanilla', unlocks: { levels: { Attack: 99, Strength: 99, Magic: 99, Ranged: 99 } }, loadout: { Weapon: 12926 } },
}));
vi.mock('../context/GameContext', () => ({ useGame: () => fixture.game }));
vi.mock('./osrs/OsrsDashGems', () => ({ skillIconSrc: () => '' }));
vi.mock('../services/GearService', () => {
  const dart = (id: number, name: string, rangedStr: number) => ({
    id, name, slot: 'Weapon', category: 'Thrown', speed: 3, twoHanded: false, imageFile: '',
    bonuses: { ...ZERO_BONUSES, ranged: 18, rangedStr },
  });
  const darts = [dart(11230, 'Dragon dart', 35), dart(811, 'Rune dart', 26), dart(810, 'Adamant dart', 17)];
  return { gearService: {
    ready: true, init: vi.fn().mockResolvedValue(undefined),
    bySlot: (slot: string) => slot === 'Weapon' ? darts : [],
    byId: (id?: number) => id === 12926 ? {
      id, name: fixture.weapon, slot: 'Weapon', category: fixture.weapon.includes('blowpipe') ? 'Thrown' : 'Bow',
      speed: 3, twoHanded: true, imageFile: '', bonuses: { ...ZERO_BONUSES, ranged: 30, rangedStr: 20 },
    } : undefined,
  } };
});
const TARGET = vi.hoisted(() => [{
  id: 1, name: 'Test dummy', version: '', imageFile: '', level: 1, hp: 100, maxHit: 1, defLevel: 1, magicLevel: 1,
  def: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 }, rangedDefence: { light: 0, standard: 0, heavy: 0 }, size: 1, attributes: [],
}]);
vi.mock('../services/MonsterService', () => ({
  monsterKey: (m: { id: number; name: string; version: string }) => `${m.id}|${m.name}|${m.version}`,
  monsterService: {
    ready: true, init: vi.fn().mockResolvedValue(undefined), byId: () => undefined, search: () => TARGET,
    byKey: (key: string | null | undefined) => TARGET.find(m => `${m.id}|${m.name}|${m.version}` === key),
  },
}));
afterEach(cleanup);
beforeEach(() => { fixture.weapon = 'Toxic blowpipe'; });

const dartSelect = () => screen.queryByRole('combobox', { name: 'Darts loaded' }) as HTMLSelectElement | null;
// 99 Ranged, Rapid, no prayer or potion: effective strength 107.
const maxHitText = (rangedStr: number) => String(Math.floor(0.5 + (107 * (rangedStr + 64)) / 640));

describe('blowpipe darts in the classic DPS calculator', () => {
  it('offers the darts the blowpipe takes and adds the chosen dart\'s strength', async () => {
    render(<DpsCalc />);
    await waitFor(() => expect(dartSelect()).not.toBeNull());
    expect([...dartSelect()!.options].map(o => o.textContent)).toEqual(['None', 'Adamant dart (+17)', 'Rune dart (+26)', 'Dragon dart (+35)']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Stance' }), { target: { value: 'rapid' } });
    fireEvent.click(screen.getByRole('button', { name: /target/i }));
    fireEvent.click(screen.getByRole('button', { name: /Test dummy/ }));
    expect(await screen.findByText(maxHitText(20))).toBeTruthy();
    fireEvent.change(dartSelect()!, { target: { value: '11230' } });
    expect(await screen.findByText(maxHitText(55))).toBeTruthy();
  });

  it('hides the dart select for any other weapon', async () => {
    fixture.weapon = 'Magic shortbow';
    render(<DpsCalc />);
    await screen.findByRole('combobox', { name: 'Stance' });
    expect(dartSelect()).toBeNull();
  });
});

describe('blowpipe darts in the OSRS layout', () => {
  it('offers the same darts and counts the chosen one in the strength summary', async () => {
    const onSummary = vi.fn();
    render(<OsrsCharDps onSummary={onSummary} />);
    await waitFor(() => expect(dartSelect()).not.toBeNull());
    expect([...dartSelect()!.options].map(o => o.value)).toEqual(['', '810', '811', '11230']);
    await waitFor(() => expect(onSummary).toHaveBeenLastCalledWith(expect.stringContaining('ranged str +20')));
    fireEvent.change(dartSelect()!, { target: { value: '11230' } });
    await waitFor(() => expect(onSummary).toHaveBeenLastCalledWith(expect.stringContaining('ranged str +55')));
  });

  it('hides the dart select for any other weapon', async () => {
    fixture.weapon = 'Magic shortbow';
    render(<OsrsCharDps />);
    await screen.findByRole('group', { name: 'Stance' });
    expect(dartSelect()).toBeNull();
  });
});
