// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

/** Open the row's pet picker and pick the choice with this value. */
const answer = (index: number, value: string) => {
  fireEvent.focus(screen.getByRole('combobox', { name: `Earlier pet ${index}` }));
  const option = within(screen.getByRole('listbox')).getAllByRole('option').find((o) => o.dataset.value === value);
  fireEvent.click(option!);
};
const offered = (index: number) => {
  fireEvent.focus(screen.getByRole('combobox', { name: `Earlier pet ${index}` }));
  const values = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.dataset.value);
  fireEvent.blur(screen.getByRole('combobox', { name: `Earlier pet ${index}` }));
  return values;
};
const name = (index: number, petIndex: number) => answer(index, String(PETS[petIndex].id));
const notAPet = (index: number) => answer(index, 'none');

describe('PetCompensationPanel', () => {
  it('asks about every earlier pet roll before any choice is offered', () => {
    const onResolve = vi.fn();
    render(<PetCompensationPanel offer={offer(2, 1)} claimed={[]} gambitStake={15} onResolve={onResolve} />);
    expect(screen.getByText(/Your run logged 3 pet rolls before this change\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save my pets' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Answer each pet roll, then choose how to even it out.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Give up my next Keys/ })).toBeNull();

    name(1, 0);
    name(2, 1);
    name(3, 2);
    const owe = screen.getByRole('button', { name: /^Give up my next Keys\s*2 Omni-Keys now/ });
    fireEvent.click(owe);
    expect(onResolve).toHaveBeenCalledWith('owe', [PETS[0], PETS[1]], [PETS[2]]);
  });

  it('can always be finished: any roll can be not a new pet', () => {
    const onResolve = vi.fn();
    render(<PetCompensationPanel offer={offer(2, 1)} claimed={[]} gambitStake={15} onResolve={onResolve} />);
    notAPet(1);
    notAPet(2);
    notAPet(3);
    fireEvent.click(screen.getByRole('button', { name: 'Save my pets' }));
    expect(onResolve).toHaveBeenCalledWith('free', [null, null], [null]);
  });

  it('counts only Key-only rolls named as a pet towards the Omni-Keys', () => {
    const onResolve = vi.fn();
    render(<PetCompensationPanel offer={offer(2, 1)} claimed={[]} gambitStake={30} onResolve={onResolve} />);
    name(1, 0);
    notAPet(2);
    name(3, 2);
    expect(screen.getByText(/^1 roll paid a Key for a new pet, with no Omni-Key\./)).toBeTruthy();
    expect(screen.getByText(/1 Omni-Key and 30 Fate for a Void Gambit now, and your next Standard Key goes to this\. A won roll resets Fate, so gamble before your next win\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Give up my next Key for Fate/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Just the Omni-Key/ }));
    expect(onResolve.mock.calls.map(([choice]) => choice)).toEqual(['gamble', 'free']);
    expect(onResolve).toHaveBeenLastCalledWith('free', [PETS[0], null], [PETS[2]]);
  });

  it('offers each pet once across the answers, none already claimed, and not a new pet in every row', () => {
    render(<PetCompensationPanel offer={offer(2)} claimed={[PETS[5].id]} gambitStake={15} onResolve={vi.fn()} />);
    name(1, 0);
    const second = offered(2);
    expect(second).toContain('none');
    expect(second).not.toContain(String(PETS[0].id));
    expect(second).not.toContain(String(PETS[5].id));
    expect(second).toContain(String(PETS[1].id));
  });

  it('dates each roll and says what it paid', () => {
    const at = Date.UTC(2026, 8, 20, 12);
    render(
      <PetCompensationPanel
        offer={offer(1, 1)}
        claimed={[]}
        gambitStake={15}
        rollTimes={{ keyOnly: [at], omni: [at] }}
        onResolve={vi.fn()}
      />,
    );
    expect(screen.getByText(/^Pet roll 1, .*: paid a Key$/)).toBeTruthy();
    expect(screen.getByText(/^Pet roll 2, .*: paid a Key and an Omni-Key$/)).toBeTruthy();
  });

  it('only asks for names when every roll already brought an Omni-Key', () => {
    const onResolve = vi.fn();
    render(<PetCompensationPanel offer={offer(0, 1)} claimed={[]} gambitStake={15} onResolve={onResolve} />);
    expect(screen.getByText('Answer each pet roll.')).toBeTruthy();
    name(1, 3);
    expect(screen.queryByRole('button', { name: /Give up/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save my pets' }));
    expect(onResolve).toHaveBeenCalledWith('free', [], [PETS[3]]);
  });
});
