/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChunkInfoIcon, type ChunkInfoIconId } from './ChunkInfoIcon';

afterEach(cleanup);

const EXPECTED_ICON_URLS: Record<ChunkInfoIconId, string> = {
  quests: 'https://oldschool.runescape.wiki/images/Quest_point_icon.png',
  combat: 'https://oldschool.runescape.wiki/images/Combat_icon.png',
  gathering: 'https://oldschool.runescape.wiki/images/Stats_icon.png',
  shops: 'https://oldschool.runescape.wiki/images/General_store_icon_(historical).png',
  travel: 'https://oldschool.runescape.wiki/images/Transportations_icon.png',
  other: 'https://oldschool.runescape.wiki/images/Collection_log_icon.png',
};

describe('ChunkInfoIcon', () => {
  it.each(Object.keys(EXPECTED_ICON_URLS) as ChunkInfoIconId[])('renders the approved OSRS image for %s', id => {
    render(<ChunkInfoIcon id={id} fallback={<span data-testid={`fallback-${id}`}>fallback</span>} />);

    const image = screen.getByTestId(`chunk-info-icon-${id}`);
    expect(image.getAttribute('src')).toBe(EXPECTED_ICON_URLS[id]);
    expect(image.getAttribute('alt')).toBe('');
    expect(image.getAttribute('aria-hidden')).toBe('true');
    expect(image.className).toContain('object-contain');
  });

  it('swaps to the supplied Lucide fallback after an image error', () => {
    render(
      <button aria-label="Quests, 2 ready">
        <ChunkInfoIcon id="quests" fallback={<span data-testid="fallback-quests">fallback</span>} />
      </button>,
    );

    fireEvent.error(screen.getByTestId('chunk-info-icon-quests'));

    expect(screen.queryByTestId('chunk-info-icon-quests')).toBeNull();
    expect(screen.getByTestId('chunk-info-icon-fallback-quests')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quests, 2 ready' })).toBeTruthy();
  });
});
