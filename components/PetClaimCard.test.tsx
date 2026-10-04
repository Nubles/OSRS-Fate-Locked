// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PETS } from '../data/pets';
import { OPEN_PETS_EVENT } from '../utils/petFollower';
import { PetClaimCard } from './PetClaimCard';

afterEach(cleanup);

const card = (claimed: number[], onClaim = vi.fn()) =>
  render(<StrictMode><PetClaimCard claimed={claimed} onClaim={onClaim} /></StrictMode>);
const box = () => screen.getByRole('combobox', { name: 'The pet you got' });
const shown = () => within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.dataset.value);
/** Type into the picker, then pick the pet with this id from what it shows. */
const pick = (query: string, id: number) => {
  fireEvent.change(box(), { target: { value: query } });
  const option = within(screen.getByRole('listbox')).getAllByRole('option').find((o) => o.dataset.value === String(id));
  fireEvent.click(option!);
};

describe('PetClaimCard', () => {
  it('claims nothing until the player picks a pet and confirms it', () => {
    const onClaim = vi.fn();
    const vorki = PETS.find((pet) => pet.name === 'Vorki')!;
    card([], onClaim);
    const claim = screen.getByRole('button', { name: 'Claim Omni-Key' });
    expect(claim).toHaveProperty('disabled', true);
    fireEvent.click(claim);
    expect(onClaim).not.toHaveBeenCalled();

    pick('vorkath', vorki.id);
    fireEvent.click(screen.getByRole('button', { name: 'Claim Omni-Key' }));
    // Each pet counts once, so it asks first, naming the pet and where it's from.
    const check = screen.getByRole('group', { name: 'Check your pet' });
    expect(check.textContent).toContain('Claim an Omni-Key for Vorki?');
    expect(check.textContent).toContain('From Vorkath');
    expect(onClaim).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, I got Vorki' }));
    expect(onClaim).toHaveBeenCalledWith(vorki, expect.anything());
    expect(screen.queryByRole('group', { name: 'Check your pet' })).toBeNull();
  });

  it('goes back to the picker, keeping the choice, without claiming', () => {
    const onClaim = vi.fn();
    const beaver = PETS.find((pet) => pet.name === 'Beaver')!;
    card([], onClaim);
    pick('woodcutting', beaver.id);
    fireEvent.click(screen.getByRole('button', { name: 'Claim Omni-Key' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClaim).not.toHaveBeenCalled();
    expect((box() as HTMLInputElement).value).toBe('Beaver');
  });

  it('offers only the pets the run has not claimed', () => {
    card([PETS[0].id, PETS[1].id]);
    fireEvent.focus(box());
    expect(shown()).not.toContain(String(PETS[0].id));
    expect(shown()).not.toContain(String(PETS[1].id));
    expect(shown()).toContain(String(PETS[2].id));
    expect(screen.getByText(`2 of ${PETS.length} pets claimed`)).toBeTruthy();
  });

  it('says when every pet is claimed', () => {
    card(PETS.map((pet) => pet.id));
    expect(screen.getByText('Every pet is claimed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Claim Omni-Key' })).toBeNull();
  });

  it('opens Your Pets once the run has a pet', () => {
    const { rerender } = render(<PetClaimCard claimed={[]} onClaim={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Your pets' })).toBeNull();
    const opened = vi.fn();
    window.addEventListener(OPEN_PETS_EVENT, opened);
    rerender(<PetClaimCard claimed={[PETS[0].id]} onClaim={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Your pets' }));
    window.removeEventListener(OPEN_PETS_EVENT, opened);
    expect(opened).toHaveBeenCalledTimes(1);
  });
});
