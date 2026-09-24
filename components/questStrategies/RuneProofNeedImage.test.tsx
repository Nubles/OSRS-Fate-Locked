// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wikiService } from '../../services/WikiService';
import { MAP_IMAGE } from '../../utils/mapCoords';
import { WIKI_UI_ICONS } from '../../data/wikiUiIcons';
import type { GuideNeed } from '../../utils/questStrategies/guideNeeds';
import { RuneProofNeedImage } from './RuneProofNeedImage';

vi.mock('../../services/WikiService', () => ({ wikiService: { fetchImage: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => { vi.mocked(wikiService.fetchImage).mockReset().mockResolvedValue(null); });

const need = (visual?: GuideNeed['visual'], kind: GuideNeed['kind'] = 'UNLOCK'): GuideNeed => ({
  id: 'example-need', kind, label: 'Example requirement', actionIds: ['example-step'], visual,
});
const item = (name: string): GuideNeed => ({
  ...need({ type: 'ITEM', itemKey: name }, 'ITEM'), id: `item:${name}`, label: name,
});
const pendingImage = () => {
  let resolve!: (url: string | null) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<string | null>((fulfil, fail) => { resolve = fulfil; reject = fail; });
  return { promise, resolve, reject };
};

const expectWikiFallback = (container: HTMLElement, icon: 'Package' | 'MapPin') => {
  const fallback = container.querySelector('img[aria-hidden="true"]');
  expect(fallback?.getAttribute('src')).toBe(`https://oldschool.runescape.wiki/images/${WIKI_UI_ICONS[icon]}`);
  expect(fallback?.getAttribute('alt')).toBe('');
};

describe('RuneProof requirement artwork', () => {
  it('uses recognizable named icons and recovers from a broken icon when the requirement changes', () => {
    const view = render(<RuneProofNeedImage need={need({ type: 'EQUIPMENT', slot: 'Neck' })} />);
    const neck = screen.getByRole('img', { name: 'Neck equipment slot' });
    expect(neck.getAttribute('src')).toMatch(/^https:\/\/oldschool\.runescape\.wiki\/images\//);
    fireEvent.error(neck);
    expect(screen.queryByRole('img')).toBeNull();
    expect(view.container.querySelector('svg')).toBeTruthy();

    view.rerender(<RuneProofNeedImage need={need({ type: 'SKILL', skill: 'Crafting' })} />);
    expect(screen.getByRole('img', { name: 'Crafting skill' }).getAttribute('src')).toContain('Crafting_icon.png');
    view.rerender(<RuneProofNeedImage need={need({ type: 'QUEST' })} />);
    expect(screen.getByRole('img', { name: 'Quest requirement' }).getAttribute('src')).toContain('Quest_point_icon.png');
    expect(wikiService.fetchImage).not.toHaveBeenCalled();
  });

  it('ignores an old item lookup and clears the previous artwork while a different item loads', async () => {
    const black = pendingImage();
    const yellow = pendingImage();
    const white = pendingImage();
    vi.mocked(wikiService.fetchImage).mockImplementation(name => (
      name === 'Black bead' ? black.promise : name === 'Yellow bead' ? yellow.promise : white.promise
    ));
    const view = render(<RuneProofNeedImage need={item('Black bead')} />);
    expect(screen.queryByRole('img')).toBeNull();
    view.rerender(<RuneProofNeedImage need={item('Yellow bead')} />);
    await act(async () => { black.resolve('https://example.test/black.png'); });
    expect(screen.queryByRole('img')).toBeNull();
    await act(async () => { yellow.resolve('https://example.test/yellow.png'); });
    expect(screen.getByRole('img', { name: 'Yellow bead' }).getAttribute('src')).toBe('https://example.test/yellow.png');
    expect(screen.queryByRole('img', { name: 'Black bead' })).toBeNull();

    view.rerender(<RuneProofNeedImage need={item('White bead')} />);
    expect(screen.queryByRole('img')).toBeNull();
    await act(async () => { white.reject(new Error('Wiki image unavailable')); });
    expect(screen.queryByRole('img')).toBeNull();
    expectWikiFallback(view.container, 'Package');
    expect(vi.mocked(wikiService.fetchImage).mock.calls.map(([name]) => name)).toEqual(['Black bead', 'Yellow bead', 'White bead']);
  });

  it('replaces a broken item image with a fallback without repeating its lookup', async () => {
    vi.mocked(wikiService.fetchImage).mockResolvedValue('https://example.test/bead.png');
    const view = render(<RuneProofNeedImage need={item('Black bead')} />);
    const artwork = await screen.findByRole('img', { name: 'Black bead' });
    fireEvent.error(artwork);
    expect(screen.queryByRole('img')).toBeNull();
    expectWikiFallback(view.container, 'Package');
    expect(wikiService.fetchImage).toHaveBeenCalledOnce();
  });

  it('crops a known map location within the local map and falls back safely for unavailable artwork', () => {
    const mapNeed = { ...need({ type: 'CHUNK', chunk: '50,50' }), label: 'Lumbridge Castle' };
    const view = render(<RuneProofNeedImage need={mapNeed} />);
    const map = screen.getByRole('img', { name: 'Map of Lumbridge Castle' });
    const [x, y, width, height] = (map.getAttribute('viewBox') ?? '').split(' ').map(Number);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width).toBeLessThan(MAP_IMAGE.width);
    expect(height).toBeLessThan(MAP_IMAGE.height);
    expect(x + width).toBeLessThanOrEqual(MAP_IMAGE.width);
    expect(y + height).toBeLessThanOrEqual(MAP_IMAGE.height);
    const source = map.querySelector('image')!;
    expect(source.getAttribute('href')).toBe(MAP_IMAGE.src);
    fireEvent.error(source);
    expect(screen.queryByRole('img')).toBeNull();
    expectWikiFallback(view.container, 'MapPin');

    view.rerender(<RuneProofNeedImage need={need({ type: 'CHUNK', chunk: '999,999' })} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(view.container.querySelector('image')).toBeNull();
    expectWikiFallback(view.container, 'MapPin');
    view.rerender(<RuneProofNeedImage need={need(undefined, 'CHECK')} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(view.container.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    expect(wikiService.fetchImage).not.toHaveBeenCalled();
  });
});
