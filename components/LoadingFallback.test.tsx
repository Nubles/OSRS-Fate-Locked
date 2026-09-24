// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ModalFallback, PaneFallback } from './LoadingFallback';

afterEach(cleanup);

describe('loading fallbacks', () => {
  it('covers only its panel while tab content loads, with animations on or off', () => {
    const { container } = render(<div className="relative"><PaneFallback label="Loading map…" /></div>);
    const overlay = container.firstElementChild!.firstElementChild!;
    expect(overlay.className).toContain('absolute');
    expect(overlay.className).not.toContain('fixed');
    expect(screen.getByText('Loading map…')).toBeTruthy();
  });

  it('keeps covering the screen for a loading modal', () => {
    const { container } = render(<ModalFallback />);
    expect(container.firstElementChild!.className).toContain('fixed');
  });
});
