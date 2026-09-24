// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunCardModal, loadRunCardRegionChunks } from './RunCard';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { MISTHALIN_AREAS } from '../data/items';
import { setStartArea } from '../utils/freeAreas';

const fixtures = vi.hoisted(() => ({
  game: {
    history: [], unlocks: { regions: [] as string[], chunks: [] as string[] },
    keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0, gameModeId: 'vanilla',
  },
  capture: vi.fn(),
}));

vi.mock('../context/GameContext', () => ({ useGame: () => fixtures.game }));
vi.mock('../context/ProfileContext', () => ({ useProfiles: () => ({ activeProfileName: 'Map fixture' }) }));
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => undefined }));
vi.mock('html2canvas', () => ({ default: fixtures.capture }));

const DRAFT_KEY = 'fate-region-chunks-draft-v1';
const BACKUP_KEY = 'fate-region-chunks-backup-v1';
// Lumbridge (free) and Falador (locked on a fresh Vanilla run).
const geometry = { Misthalin: [{ cx: 50, cy: 50 }], Asgarnia: [{ cx: 46, cy: 51 }] };
const envelope = { v: 2, seed: 'saved-map-seed', dirty: true, data: geometry };
const storageWith = (draft: string | null, backup: string | null = null) => ({
  getItem: vi.fn((key: string) => key === DRAFT_KEY ? draft : key === BACKUP_KEY ? backup : null),
  setItem: vi.fn(), removeItem: vi.fn(),
});

describe('Run card saved geography', () => {
  it('unwraps the exact RegionMap v2 format without touching its draft or backup', () => {
    const storage = storageWith(JSON.stringify(envelope));
    expect(loadRunCardRegionChunks(storage)).toEqual(geometry);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('keeps legacy drafts readable', () => {
    expect(loadRunCardRegionChunks(storageWith(JSON.stringify(geometry)))).toEqual(geometry);
  });

  it('recovers valid backup geometry when the draft is malformed', () => {
    const storage = storageWith('{bad json', JSON.stringify(envelope));
    expect(loadRunCardRegionChunks(storage)).toEqual(geometry);
    expect(storage.getItem).toHaveBeenCalledWith(BACKUP_KEY);
  });

  it('uses current shipped geography for an untouched older v2 cache', () => {
    const cached = { ...envelope, seed: 'old-seed', dirty: false };
    expect(loadRunCardRegionChunks(storageWith(JSON.stringify(cached)))).toBe(REGION_CHUNKS);
  });

  it.each([
    null,
    '{bad json',
    JSON.stringify({ v: 2, seed: 'seed', dirty: true }),
    JSON.stringify({ v: 3, seed: 'seed', dirty: true, data: geometry }),
    JSON.stringify({ Misthalin: 2 }),
    JSON.stringify({ Misthalin: [{ cx: 50.5, cy: 50 }] }),
    JSON.stringify({ Misthalin: [{ cx: 50, cy: -1 }] }),
    JSON.stringify({ Misthalin: [] }),
    JSON.stringify({}),
  ])('falls back to shipped geography for missing or invalid data: %s', (raw) => {
    expect(loadRunCardRegionChunks(storageWith(raw))).toBe(REGION_CHUNKS);
  });

  it('still has geography when browser storage is unavailable', () => {
    expect(loadRunCardRegionChunks({ getItem: () => { throw new Error('Storage blocked'); } })).toBe(REGION_CHUNKS);
  });
});

class PendingMapImage {
  static instances: PendingMapImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  complete = false;
  naturalWidth = 0;
  crossOrigin = '';
  src = '';
  constructor() { PendingMapImage.instances.push(this); }
}

describe('Vanilla run card map capture', () => {
  const fills: string[] = [];
  const context = {
    fillStyle: '', imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
    clearRect: vi.fn(), drawImage: vi.fn(),
    fillRect: vi.fn(() => { fills.push(context.fillStyle); }),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
  };

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    fills.length = 0;
    PendingMapImage.instances.length = 0;
    const saved = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
      clear: () => saved.clear(),
    });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(envelope));
    vi.stubGlobal('Image', PendingMapImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    fixtures.capture.mockImplementation(async () => ({ toDataURL: () => 'data:image/png;base64,map-card' }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const showCard = () => render(<RunCardModal onClose={vi.fn()} embedded />);
  const loadImage = async (index = 0) => {
    await act(async () => { PendingMapImage.instances[index].onload?.(); });
  };

  it('waits for the map and both unlocked/locked overlays before exporting', async () => {
    showCard();
    expect(PendingMapImage.instances).toHaveLength(1);
    expect(fixtures.capture).not.toHaveBeenCalled();
    expect(fills).toEqual([]);
    fixtures.capture.mockImplementation(async () => {
      expect(fills).toContain('rgba(16,185,129,0.55)');
      expect(fills).toContain('rgba(239,68,68,0.45)');
      return { toDataURL: () => 'data:image/png;base64,map-card' };
    });

    await loadImage();

    await waitFor(() => expect(fixtures.capture).toHaveBeenCalledTimes(1));
    expect(screen.getByAltText('Run card preview').getAttribute('src')).toContain('map-card');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('exports canonical overlays for a fresh profile without an authoring draft', async () => {
    localStorage.clear();
    showCard();
    await loadImage();
    await waitFor(() => expect(fixtures.capture).toHaveBeenCalledTimes(1));
    expect(fills).toContain('rgba(16,185,129,0.55)');
    expect(fills).toContain('rgba(239,68,68,0.45)');
  });

  it('clears a failed image load and lets Re-render try loading again', async () => {
    showCard();
    await act(async () => { PendingMapImage.instances[0].onerror?.(); });
    expect(screen.getByRole('alert').textContent).toContain('try Re-render');
    expect(fixtures.capture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Re-render' }));
    expect(PendingMapImage.instances).toHaveLength(2);
    await loadImage(1);
    await waitFor(() => expect(fixtures.capture).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stops waiting after 15 seconds and exposes retry', async () => {
    vi.useFakeTimers();
    showCard();
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(screen.getByRole('alert').textContent).toContain('try Re-render');
    expect((screen.getByRole('button', { name: 'Re-render' }) as HTMLButtonElement).disabled).toBe(false);
    expect(PendingMapImage.instances[0].onload).toBeNull();
    expect(fixtures.capture).not.toHaveBeenCalled();
  });

  it('handles drawing failures without an unhandled onload exception or a stuck capture', async () => {
    context.drawImage.mockImplementationOnce(() => { throw new Error('Canvas drawing failed'); });
    showCard();
    await loadImage();
    expect(screen.getByRole('alert').textContent).toContain('try Re-render');
    expect((screen.getByRole('button', { name: 'Re-render' }) as HTMLButtonElement).disabled).toBe(false);
    expect(fixtures.capture).not.toHaveBeenCalled();
  });
});

describe('Run card map colours each chunk by its own area', () => {
  const GREEN = 'rgba(16,185,129,0.55)';
  const fills: string[] = [];
  const context = {
    fillStyle: '', imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
    clearRect: vi.fn(), drawImage: vi.fn(),
    fillRect: vi.fn(() => { fills.push(context.fillStyle); }),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
  };
  const shipped = new Set(Object.values(REGION_CHUNKS).flat().map(({ cx, cy }) => `${cx},${cy}`));
  const shippedChunksOf = (areas: string[]) =>
    areas.flatMap(area => SUB_AREA_CHUNKS[area] ?? []).filter(({ cx, cy }) => shipped.has(`${cx},${cy}`)).length;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    PendingMapImage.instances.length = 0;
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), clear: vi.fn() });
    vi.stubGlobal('Image', PendingMapImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    fixtures.capture.mockImplementation(async () => ({ toDataURL: () => 'data:image/png;base64,map-card' }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setStartArea(undefined);
    fixtures.game = { ...fixtures.game, unlocks: { regions: [], chunks: [] }, gameModeId: 'vanilla' };
  });

  // Draw the shipped map for one run and count its unlocked (green) chunks.
  const greenChunks = async (unlocks: { regions?: string[]; chunks?: string[] }, gameModeId: string) => {
    fixtures.game = { ...fixtures.game, unlocks: { regions: [], chunks: [], ...unlocks }, gameModeId };
    fills.length = 0;
    const captures = fixtures.capture.mock.calls.length;
    const view = render(<RunCardModal onClose={vi.fn()} embedded />);
    await act(async () => { PendingMapImage.instances.at(-1)!.onload?.(); });
    await waitFor(() => expect(fixtures.capture).toHaveBeenCalledTimes(captures + 1));
    view.unmount();
    return fills.filter(fill => fill === GREEN).length;
  };

  it('shows Vanilla area unlocks before their whole continent is done', async () => {
    const areas = ['Falador', 'Port Sarim', 'Rimmington', 'Taverley'];
    const fresh = await greenChunks({}, 'vanilla');
    const withAreas = await greenChunks({ regions: areas }, 'vanilla');

    expect(withAreas - fresh).toBe(shippedChunksOf(areas));
    expect(shippedChunksOf(areas)).toBeGreaterThan(0);
  });

  it('paints only Lumbridge for a fresh legacy Xtreme run', async () => {
    setStartArea('lumbridge');
    const xtreme = await greenChunks({}, 'xtreme');
    setStartArea(undefined);
    const vanilla = await greenChunks({}, 'vanilla');

    expect(xtreme).toBe(shippedChunksOf(['Lumbridge']));
    expect(vanilla).toBeGreaterThanOrEqual(shippedChunksOf(MISTHALIN_AREAS));
    expect(xtreme).toBeLessThan(vanilla);
  });

  it('keeps colouring Chunked runs chunk by chunk', async () => {
    // The free start chunk plus one rolled Falador chunk.
    expect(await greenChunks({ chunks: ['46,51'] }, 'chunked')).toBe(2);
  });
});
