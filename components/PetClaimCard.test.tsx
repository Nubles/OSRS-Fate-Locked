// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PETS } from '../data/pets';
import { PetClaimCard } from './PetClaimCard';

afterEach(cleanup);

describe('PetClaimCard', () => {
  it('claims nothing until the player picks a pet', () => {
    const onClaim = vi.fn();
    render(<PetClaimCard claimed={[]} onClaim={onClaim} />);
    const claim = screen.getByRole('button', { name: 'Claim Omni-Key' });
    expect(claim).toHaveProperty('disabled', true);
    fireEvent.click(claim);
    expect(onClaim).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('The pet you got'), { target: { value: String(PETS[25].id) } });
    expect(claim).toHaveProperty('disabled', false);
    fireEvent.click(claim);
    expect(onClaim).toHaveBeenCalledWith(PETS[25].id, expect.anything());
  });

  it('offers only the pets the run has not claimed', () => {
    render(<PetClaimCard claimed={[PETS[0].id, PETS[1].id]} onClaim={vi.fn()} />);
    const names = [...(screen.getByLabelText('The pet you got') as HTMLSelectElement).options].map((o) => o.text);
    expect(names).not.toContain(PETS[0].name);
    expect(names).not.toContain(PETS[1].name);
    expect(names).toContain(PETS[2].name);
    expect(screen.getByText(`2 of ${PETS.length} pets claimed`)).toBeTruthy();
  });

  it('says when every pet is claimed', () => {
    render(<PetClaimCard claimed={PETS.map((pet) => pet.id)} onClaim={vi.fn()} />);
    expect(screen.getByText('Every pet is claimed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Claim Omni-Key' })).toBeNull();
  });
});
