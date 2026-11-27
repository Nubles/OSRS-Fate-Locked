// @vitest-environment jsdom
// The doll first renders while the gear catalogue is still loading, so a worn
// slot has its item but no picture yet. SlotItem was keyed by the item alone
// and chose the slot icon once at mount, so after the catalogue loaded the
// slot kept the empty silhouette until the player changed view.
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OsrsCharDoll, type DollSlot } from './OsrsCharDoll';

afterEach(cleanup);

const slot = (imageFile?: string): DollSlot => ({ slot: 'Head', itemId: 1163, imageFile, gem: 5, dim: false, label: 'Head', examine: 'Head' });
const slotImg = (container: HTMLElement) => container.querySelector('.osrs-char-slot img') as HTMLImageElement;

describe('OSRS equipment doll', () => {
  it('shows the worn item picture once the gear catalogue has loaded it', () => {
    const r = render(<OsrsCharDoll slots={[slot(undefined)]} />);
    expect(slotImg(r.container).className).toBe('osrs-char-slotsil');
    r.rerender(<OsrsCharDoll slots={[slot('Rune_full_helm.png')]} />);
    expect(slotImg(r.container).className).toBe('osrs-char-slotitem');
    expect(slotImg(r.container).getAttribute('src')).toContain('Rune_full_helm.png');
  });

  it('still falls back to the slot icon when the picture fails to load', () => {
    const r = render(<OsrsCharDoll slots={[slot(undefined)]} />);
    r.rerender(<OsrsCharDoll slots={[slot('Rune_full_helm.png')]} />);
    fireEvent.error(slotImg(r.container));
    expect(slotImg(r.container).className).toBe('osrs-char-slotsil');
    // A later render with the same picture keeps the fallback rather than retrying.
    r.rerender(<OsrsCharDoll slots={[slot('Rune_full_helm.png')]} />);
    expect(slotImg(r.container).className).toBe('osrs-char-slotsil');
  });
});
