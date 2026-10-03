// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PETS } from '../data/pets';
import { PET_COMPENSATION_ID } from '../utils/petCompensation';
import { PetCompensationPanel } from './PetCompensationPanel';

afterEach(cleanup);

const offer = (keyOnlyPets: number, omniPets = 0) => ({
  releaseId: PET_COMPENSATION_ID,
  status: 'pending' as const,
  keyOnlyPets,
  omniPets,
});

const name = (index: number, petIndex: number) =>
  fireEvent.change(screen.getByLabelText(`Earlier pet ${index}`), { target: { value: String(PETS[petIndex].id) } });

describe('PetCompensationPanel', () => {
  it('asks for every earlier pet before any choice can be made', () => {
    const onResolve = vi.fn();
    render(<PetCompensationPanel offer={offer(2, 1)} claimed={[]} gambitStake={15} onResolve={onResolve} />);
    expect(screen.getByText('Your run logged 3 pets before this change. Name each one, so it counts once.')).toBeTruthy();
    const owe = screen.getByRole('button', { name: /^Give up my next Keys\s*2 Omni-Keys now/ });
    expect(owe).toHaveProperty('disabled', true);

    name(1, 0);
    name(2, 1);
    expect(owe).toHaveProperty('disabled', true);
    name(3, 2);
    expect(owe).toHaveProperty('disabled', false);
    fireEvent.click(owe);
    expect(onResolve).toHaveBeenCalledWith('owe', [PETS[0].id, PETS[1].id, PETS[2].id]);
  });

  it('offers each pet once across the names, and none already claimed', () => {
    render(<PetCompensationPanel offer={offer(2)} claimed={[PETS[5].id]} gambitStake={15} onResolve={vi.fn()} />);
    name(1, 0);
    const second = [...(screen.getByLabelText('Earlier pet 2') as HTMLSelectElement).options].map((o) => o.value);
    expect(second).not.toContain(String(PETS[0].id));
    expect(second).not.toContain(String(PETS[5].id));
    expect(second).toContain(String(PETS[1].id));
  });

  it("states each choice's cost, with the mode's Gambit stake of Fate", () => {
    const onResolve = vi.fn();
    render(<PetCompensationPanel offer={offer(2, 1)} claimed={[]} gambitStake={30} onResolve={onResolve} />);
    expect(screen.getByText('1 of them already brought an Omni-Key, so it needs nothing more.')).toBeTruthy();
    expect(screen.getByText('2 Omni-Keys now, and your next 2 Standard Keys go to this.')).toBeTruthy();
    expect(screen.getByText(/2 Omni-Keys and 60 Fate for a Void Gambit now, and your next 2 Standard Keys go to this\. A won roll resets Fate, so gamble before your next win\./)).toBeTruthy();
    expect(screen.getByText('2 Omni-Keys, and nothing else changes.')).toBeTruthy();
    name(1, 0);
    name(2, 1);
    name(3, 2);
    fireEvent.click(screen.getByRole('button', { name: /Give up my next Keys for Fate/ }));
    fireEvent.click(screen.getByRole('button', { name: /Just the Omni-Keys/ }));
    expect(onResolve.mock.calls.map(([choice]) => choice)).toEqual(['gamble', 'free']);
  });

  it('only names the pets when every one already brought an Omni-Key', () => {
    const onResolve = vi.fn();
    render(<PetCompensationPanel offer={offer(0, 1)} claimed={[]} gambitStake={15} onResolve={onResolve} />);
    expect(screen.queryByRole('button', { name: /Give up/ })).toBeNull();
    name(1, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Save my pets' }));
    expect(onResolve).toHaveBeenCalledWith('free', [PETS[3].id]);
  });
});
