/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChunkEntrance } from '../services/ChunkContentService';
import { ChunkEntranceNotices } from './ChunkEntranceNotices';

afterEach(cleanup);

const entrance: ChunkEntrance = {
  location: 'Taverley Dungeon',
  label: 'Entrance to Taverley Dungeon',
  wikiPage: 'Taverley_Dungeon',
  requirements: ['Example Quest'],
};

describe('ChunkEntranceNotices', () => {
  it('shows a locked entrance with its Wiki link and separate route requirement', () => {
    render(<ChunkEntranceNotices mode="chunk" entrances={[entrance]} unlocked={false} />);

    const link = screen.getByRole('link', { name: /Taverley Dungeon/ });
    expect(link.parentElement?.textContent)
      .toContain('Entrance to Taverley Dungeon — locked with this chunk');
    expect(screen.getByText('Also requires: Example Quest')).toBeTruthy();
    expect(link.getAttribute('href'))
      .toBe('https://oldschool.runescape.wiki/w/Taverley_Dungeon');
  });

  it('shows the available state when the selected chunk is unlocked', () => {
    const { container } = render(
      <ChunkEntranceNotices mode="chunk" entrances={[entrance]} unlocked />,
    );

    expect(container.textContent).toContain('Entrance to Taverley Dungeon — available');
  });

  it('gives every entrance in the selected chunk the same locked state', () => {
    const southernEntrance: ChunkEntrance = {
      ...entrance,
      label: 'Southern entrance to Taverley Dungeon',
      requirements: [],
    };

    const { container } = render(
      <ChunkEntranceNotices
        mode="chunk"
        entrances={[entrance, southernEntrance]}
        unlocked={false}
      />,
    );

    expect(container.textContent).toContain('Entrance to Taverley Dungeon — locked with this chunk');
    expect(container.textContent).toContain('Southern entrance to Taverley Dungeon — locked with this chunk');
  });

  it('omits the route-requirement line when an entrance has no requirements', () => {
    const { container } = render(
      <ChunkEntranceNotices
        mode="chunk"
        entrances={[{ ...entrance, requirements: [] }]}
        unlocked
      />,
    );

    expect(container.textContent).not.toContain('Also requires:');
  });

  it('renders no markup when there are no entrances', () => {
    const { container } = render(
      <ChunkEntranceNotices mode="chunk" entrances={[]} unlocked={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders no markup for Whole Area mode', () => {
    const { container } = render(
      <ChunkEntranceNotices mode="region" entrances={[entrance]} unlocked={false} />,
    );

    expect(container.firstChild).toBeNull();
  });
});
