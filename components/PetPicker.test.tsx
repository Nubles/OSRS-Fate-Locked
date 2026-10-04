// @vitest-environment jsdom
import React, { StrictMode, useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PETS } from '../data/pets';
import { PetPicker } from './PetPicker';

afterEach(cleanup);

const named = (name: string) => PETS.find((pet) => pet.name === name)!;

function Harness({ onChange = vi.fn(), extra }: { onChange?: (value: string) => void; extra?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <StrictMode>
      <PetPicker
        pets={PETS}
        value={value}
        onChange={(next) => { setValue(next); onChange(next); }}
        label="The pet you got"
        extra={extra ? { value: 'none', label: 'Not a new pet' } : undefined}
      />
    </StrictMode>
  );
}

const box = () => screen.getByRole('combobox', { name: 'The pet you got' });
const options = () => within(screen.getByRole('listbox')).getAllByRole('option');

describe('PetPicker', () => {
  it('lists every pet under the wiki’s groups once opened', () => {
    render(<Harness />);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.focus(box());
    expect(box().getAttribute('aria-expanded')).toBe('true');
    expect(options()).toHaveLength(PETS.length);
    expect(screen.getByRole('group', { name: 'Boss pets' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Skilling pets' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Other pets' })).toBeTruthy();
    // Each with where it comes from.
    expect(options().find((option) => option.dataset.value === String(named('Vorki').id))?.textContent).toContain('Vorkath');
  });

  it('narrows the list to what the player types, by name or by source', () => {
    render(<Harness />);
    fireEvent.change(box(), { target: { value: 'vorkath' } });
    expect(options().map((option) => option.dataset.value)).toEqual([String(named('Vorki').id)]);
    fireEvent.change(box(), { target: { value: 'woodcutting' } });
    expect(options().map((option) => option.dataset.value)).toEqual([String(named('Beaver').id)]);
    fireEvent.change(box(), { target: { value: 'zzz' } });
    expect(screen.getByText('No pet matches “zzz”.')).toBeTruthy();
  });

  it('picks with a click, and shows the pet chosen', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(box(), { target: { value: 'vorkath' } });
    fireEvent.click(options()[0]);
    expect(onChange).toHaveBeenCalledWith(String(named('Vorki').id));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect((box() as HTMLInputElement).value).toBe('Vorki');
  });

  it('picks with the arrow keys and Enter, and Escape closes the list', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(box(), { target: { value: 'dks' } });
    const ids = options().map((option) => option.dataset.value);
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    expect(box().getAttribute('aria-activedescendant')).toBe(options()[1].id);
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(ids[1]);
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('offers the extra choice first, and finds it by its words', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} extra />);
    fireEvent.focus(box());
    expect(options()[0].textContent).toContain('Not a new pet');
    fireEvent.change(box(), { target: { value: 'not a new' } });
    fireEvent.click(options()[0]);
    expect(onChange).toHaveBeenCalledWith('none');
  });
});
