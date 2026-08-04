/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChunkEntrance } from '../../services/ChunkContentService';
import { ChunkInfoAccessCard } from './ChunkInfoAccessCard';

afterEach(cleanup);

const entrance: ChunkEntrance = {
  location: 'Taverley Dungeon',
  label: 'Entrance to Taverley Dungeon',
  wikiPage: 'Taverley_Dungeon',
  requirements: ['Example Quest'],
};

describe('ChunkInfoAccessCard', () => {
  it('combines preview, entry, entrance, route, and bank information in one card', () => {
    render(
      <ChunkInfoAccessCard
        previewLocked
        entryRequirements={['Dragon Slayer I']}
        entrances={[entrance]}
        chunkUnlocked={false}
        bankState="locked"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Access & facilities' })).toBeTruthy();
    expect(screen.getByText('Preview only')).toBeTruthy();
    expect(screen.getByText(/Dragon Slayer I/)).toBeTruthy();
    const entranceLink = screen.getByRole('link', { name: 'Entrance to Taverley Dungeon' });
    expect(entranceLink).toBeTruthy();
    expect(entranceLink.getAttribute('href')).toBe(
      'https://oldschool.runescape.wiki/w/Taverley_Dungeon',
    );
    expect(screen.getByText('Locked with this chunk')).toBeTruthy();
    expect(screen.getByText('Also requires Example Quest')).toBeTruthy();
    expect(screen.getByText('Bank needs its own unlock')).toBeTruthy();
  });

  it('shows available entrance and ordinary bank states', () => {
    const { rerender } = render(
      <ChunkInfoAccessCard
        previewLocked={false}
        entryRequirements={[]}
        entrances={[entrance]}
        chunkUnlocked
        bankState="available"
      />,
    );

    expect(screen.getByText('Available in this chunk')).toBeTruthy();
    expect(screen.getByText('Bank available')).toBeTruthy();

    rerender(
      <ChunkInfoAccessCard
        previewLocked={false}
        entryRequirements={[]}
        entrances={[]}
        chunkUnlocked
        bankState="present"
      />,
    );
    expect(screen.getByText('Bank in this chunk')).toBeTruthy();
  });

  it('applies the chunk lock state to every entrance and hides absent route requirements', () => {
    const southernEntrance: ChunkEntrance = {
      ...entrance,
      label: 'Southern entrance to Taverley Dungeon',
      requirements: [],
    };

    const { container } = render(
      <ChunkInfoAccessCard
        previewLocked={false}
        entryRequirements={[]}
        entrances={[entrance, southernEntrance]}
        chunkUnlocked={false}
        bankState={null}
      />,
    );

    expect(container.textContent).toContain('Locked with this chunk');
    expect(screen.getAllByText('Locked with this chunk')).toHaveLength(2);
    expect(container.textContent).toContain('Also requires Example Quest');
    expect(container.textContent).not.toContain('Also requires undefined');
  });

  it('renders nothing without access or facility rows', () => {
    const { container } = render(
      <ChunkInfoAccessCard
        previewLocked={false}
        entryRequirements={[]}
        entrances={[]}
        chunkUnlocked
        bankState={null}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
