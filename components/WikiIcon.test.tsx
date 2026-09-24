// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WikiIcon } from './WikiIcon';
import { Key, Swords } from './OsrsIcon';

afterEach(cleanup);

describe('Wiki artwork', () => {
  it('retains named controls and retries a changed file after an image fails', () => {
    const { rerender } = render(<button aria-label="Open gear"><WikiIcon file="Body_slot.png" alt="" size={20} /></button>);
    fireEvent.error(document.querySelector('img')!);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open gear' })).toBeTruthy();
    rerender(<button aria-label="Open gear"><WikiIcon file="Shield_slot.png" alt="" size={20} /></button>);
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://oldschool.runescape.wiki/images/Shield_slot.png');
  });

  it('uses real artwork while preserving sizes, styles and decorative accessibility', () => {
    render(<><Key size={18} className="shrink-0" style={{ opacity: 0.5 }} /><Swords size={32} aria-label="Combat" /></>);
    const key = document.querySelector('img')!;
    expect(key.src).toBe('https://oldschool.runescape.wiki/images/Brass_key.png');
    expect(key.getAttribute('width')).toBe('18');
    expect(key.getAttribute('aria-hidden')).toBe('true');
    expect(key.style.opacity).toBe('0.5');
    expect(screen.getByRole('img', { name: 'Combat' }).getAttribute('width')).toBe('32');
  });

  it('preserves accessible descriptions on unavailable named artwork', () => {
    render(<WikiIcon file="Missing.png" alt="Required equipment" />);
    fireEvent.error(screen.getByRole('img', { name: 'Required equipment' }));
    expect(screen.getByRole('img', { name: 'Required equipment' }).tagName).toBe('SPAN');
  });
});
