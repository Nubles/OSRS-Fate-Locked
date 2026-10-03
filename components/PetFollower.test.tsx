// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_PETS_EVENT, readFollowerPrefs } from '../utils/petFollower';
import { PetFollowerView } from './PetFollower';

// The real viewer loads model-viewer; a stand-in shows what it was asked to draw.
vi.mock('./EntityModel', () => ({
  EntityModel: (props: { src?: string; autoRotate?: boolean; spin?: boolean }) => (
    <div data-testid="model" data-src={props.src} data-animated={String(props.autoRotate)} data-spin={String(props.spin)} />
  ),
}));

const stored = new Map<string, string>();
beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); },
    removeItem: (key: string) => { stored.delete(key); },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const VORKI = 502026;
const CALLISTO_CUB = 502003; // a still model

describe('PetFollower', () => {
  it('shows the most recently claimed pet, idling in place', () => {
    render(<PetFollowerView runId="run-1" claimed={[502001, VORKI]} animationsEnabled />);
    expect(screen.getByRole('button', { name: 'Vorki, your follower: open Your Pets' })).toBeTruthy();
    const model = screen.getByTestId('model');
    expect(model.dataset.src).toMatch(/models\/pets\/502026\.gltf$/);
    expect(model.dataset.animated).toBe('true');
    expect(model.dataset.spin).toBe('false');
  });

  it('shows nothing with no pet claimed', () => {
    render(<PetFollowerView runId="run-1" claimed={[]} animationsEnabled />);
    expect(screen.queryByTestId('pet-follower')).toBeNull();
  });

  it('has an off switch that it remembers', () => {
    const { unmount } = render(<PetFollowerView runId="run-1" claimed={[VORKI]} animationsEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide your follower' }));
    expect(screen.queryByTestId('pet-follower')).toBeNull();
    expect(readFollowerPrefs('run-1')).toEqual({ hidden: true });
    unmount();
    render(<PetFollowerView runId="run-1" claimed={[VORKI]} animationsEnabled />);
    expect(screen.queryByTestId('pet-follower')).toBeNull();
  });

  it('stands still with the animations setting off, and only a still model bobs', () => {
    const { container, rerender } = render(<PetFollowerView runId="run-1" claimed={[CALLISTO_CUB]} animationsEnabled />);
    expect(container.querySelector('.animate-pet-bob')).not.toBeNull();
    rerender(<PetFollowerView runId="run-1" claimed={[CALLISTO_CUB]} animationsEnabled={false} />);
    expect(container.querySelector('.animate-pet-bob')).toBeNull();
    expect(screen.getByTestId('model').dataset.animated).toBe('false');
    rerender(<PetFollowerView runId="run-1" claimed={[VORKI]} animationsEnabled />);
    expect(container.querySelector('.animate-pet-bob')).toBeNull();
  });

  it('lets clicks through to the page, but not on its name tag', () => {
    render(<PetFollowerView runId="run-1" claimed={[VORKI]} animationsEnabled />);
    expect(screen.getByTestId('pet-follower').className).toContain('pointer-events-none');
    expect(screen.getByRole('button', { name: 'Hide your follower' }).parentElement?.className).toContain('pointer-events-auto');
  });

  it('opens Your Pets from its name tag or from anywhere through the event', async () => {
    render(<PetFollowerView runId="run-1" claimed={[VORKI]} animationsEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Vorki, your follower: open Your Pets' }));
    expect(await screen.findByRole('dialog', { name: 'Your Pets' }, { timeout: 10_000 })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => { window.dispatchEvent(new Event(OPEN_PETS_EVENT)); });
    expect(await screen.findByRole('dialog', { name: 'Your Pets' })).toBeTruthy();
  }, 25_000);

  it('brings a hidden follower back from Your Pets', async () => {
    render(<PetFollowerView runId="run-1" claimed={[VORKI]} animationsEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide your follower' }));
    act(() => { window.dispatchEvent(new Event(OPEN_PETS_EVENT)); });
    fireEvent.click(await screen.findByLabelText('Show a follower', {}, { timeout: 10_000 }));
    expect(screen.getByTestId('pet-follower')).toBeTruthy();
    expect(readFollowerPrefs('run-1').hidden).toBeUndefined();
  }, 25_000);
});
