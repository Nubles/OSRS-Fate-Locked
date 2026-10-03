// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PetsPanel } from './PetsPanel';

vi.mock('./EntityModel', () => ({
  EntityModel: (props: { src?: string; interactive?: boolean; autoRotate?: boolean }) => (
    <div data-testid="model" data-src={props.src} data-interactive={String(props.interactive)} data-animated={String(props.autoRotate)} />
  ),
}));

afterEach(cleanup);

const handlers = () => ({ onFollow: vi.fn(), onShowFollower: vi.fn(), onClose: vi.fn() });

describe('PetsPanel', () => {
  it('lists the claimed pets and starts on the follower, in 3D', () => {
    render(<PetsPanel claimed={[502001, 502026]} followerId={502026} followerShown animationsEnabled {...handlers()} />);
    expect(screen.getByText('2 of 71 pets claimed')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Abyssal orphan/ })).toBeTruthy();
    const model = screen.getByTestId('model');
    expect(model.dataset.src).toMatch(/502026\.gltf$/);
    expect(model.dataset.interactive).toBe('true');
    expect(screen.getByRole('button', { name: 'Vorki is following' })).toHaveProperty('disabled', true);
  });

  it('shows another pet and makes it the follower', () => {
    const h = handlers();
    render(<PetsPanel claimed={[502001, 502026]} followerId={502026} followerShown animationsEnabled {...h} />);
    fireEvent.click(screen.getByRole('button', { name: /Abyssal orphan/ }));
    expect(screen.getByTestId('model').dataset.src).toMatch(/502001\.gltf$/);
    fireEvent.click(screen.getByRole('button', { name: 'Make follower' }));
    expect(h.onFollow).toHaveBeenCalledWith(502001);
  });

  it('has the follower off switch', () => {
    const h = handlers();
    render(<PetsPanel claimed={[502026]} followerId={502026} followerShown={false} animationsEnabled={false} {...h} />);
    const box = screen.getByLabelText('Show a follower') as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(h.onShowFollower).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('model').dataset.animated).toBe('false');
    // Hidden, the follower can be made to follow again.
    expect(screen.getByRole('button', { name: 'Make follower' })).toHaveProperty('disabled', false);
  });

  it('says where pets come from when there are none', () => {
    render(<PetsPanel claimed={[]} followerId={null} followerShown animationsEnabled {...handlers()} />);
    expect(screen.getByText(/No pets yet\. Claim one in Farm Keys → Activities/)).toBeTruthy();
  });
});
