// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import {
  placeOf, chunkForPlace, chunkUnlocked, summarisePlaces, showChunkOnMap, consumePendingChunk,
} from './chunkLocations';
import { UnlockState } from '../types';
import { AREA_ALIAS_POLICIES } from '../data/areaMapPolicy';

const unlocksWith = (regions: string[] = []): UnlockState =>
  ({ regions } as unknown as UnlockState);

describe('placeOf', () => {
  it('resolves a sub-area chunk to "SubArea · Continent"', () => {
    // 46,52 = central Falador (Asgarnia)
    expect(placeOf(46, 52)).toMatchObject({ subArea: 'Falador', region: 'Asgarnia', label: 'Falador · Asgarnia' });
  });

  it('falls back to the continent for unnamed terrain', () => {
    // 49,55 = "Center Wildy Ditch" — painted Misthalin, no sub-area
    const p = placeOf(49, 55);
    expect(p.subArea).toBeNull();
    expect(p.region).toBe('Misthalin');
    expect(p.label).toBe('Misthalin');
  });

  it('labels unpainted chunks by coordinate', () => {
    expect(placeOf(1, 1).label).toBe('chunk (1, 1)');
  });

  it.each([
    ["Heroes' Guild", { cx: 45, cy: 54 }],
    ['Ice Mountain', { cx: 46, cy: 54 }],
    ['Ranging Guild', { cx: 41, cy: 53 }],
    ["Otto's Grotto", { cx: 39, cy: 54 }],
    ['Resource Area', { cx: 49, cy: 61 }],
    ['Elf Camp', { cx: 33, cy: 50 }],
  ])('routes %s to its authored physical chunk', (alias, expected) => {
    expect(chunkForPlace(alias)).toEqual(expected);
    const policy = AREA_ALIAS_POLICIES[alias as keyof typeof AREA_ALIAS_POLICIES];
    if (policy?.kind === 'surface-overlap') expect(policy.chunks).toContainEqual(expected);
  });

  it('routes an overlap alias to its exact canonical-owned physical chunk', () => {
    expect(chunkForPlace("Otto's Grotto")).toEqual({ cx: 39, cy: 54 });
    expect(placeOf(39, 54).subArea).toBe('Baxtorian Falls');
    expect(chunkForPlace("Heroes' Guild")).toEqual({ cx: 45, cy: 54 });
    expect(placeOf(45, 54).subArea).toBe('Taverley');
  });

  it('shows recognizable overlap names without changing physical ownership', () => {
    expect(placeOf(39, 54)).toMatchObject({
      subArea: 'Baxtorian Falls',
      region: 'Kandarin',
      label: "Baxtorian Falls \u00b7 Otto's Grotto \u00b7 Kandarin",
    });
    expect(placeOf(45, 54).label).toBe("Taverley \u00b7 Heroes' Guild \u00b7 Asgarnia");
  });
});

describe('chunkUnlocked', () => {
  it('Misthalin sub-areas are always free', () => {
    // 50,50 = Lumbridge
    expect(chunkUnlocked(50, 50, unlocksWith([]))).toBe(true);
  });

  it('a sub-area chunk follows its own unlock, not the continent', () => {
    expect(chunkUnlocked(46, 52, unlocksWith([]))).toBe(false);
    expect(chunkUnlocked(46, 52, unlocksWith(['Falador']))).toBe(true);
    // unlocking a different Asgarnia sub-area does NOT unlock Falador's chunk
    expect(chunkUnlocked(46, 52, unlocksWith(['Port Sarim']))).toBe(false);
  });

  it('unpainted chunks are never unlocked', () => {
    expect(chunkUnlocked(1, 1, unlocksWith(['Falador']))).toBe(false);
  });

  it('unlocks the reported physical chunk from either name', () => {
    expect(chunkUnlocked(39, 54, unlocksWith(['Baxtorian Falls']))).toBe(true);
    expect(chunkUnlocked(39, 54, unlocksWith(["Otto's Grotto"]))).toBe(true);
  });
});

describe('summarisePlaces', () => {
  it('dedupes by place and sorts unlocked first', () => {
    const places = summarisePlaces(
      [
        { cx: 46, cy: 52 }, { cx: 45, cy: 52 }, // both Falador (locked)
        { cx: 50, cy: 50 },                      // Lumbridge (free)
      ],
      unlocksWith([]),
    );
    expect(places).toHaveLength(2);
    expect(places[0].label).toContain('Lumbridge');
    expect(places[0].unlocked).toBe(true);
    expect(places[1].label).toContain('Falador');
    expect(places[1].unlocked).toBe(false);
  });
});

it('requests World Map view and parks the exact chunk for one consumer', () => {
  const nav = vi.fn();
  const show = vi.fn();
  window.addEventListener('fate:nav', nav);
  window.addEventListener('fate:show-chunk', show);

  showChunkOnMap(30, 43);

  expect((nav.mock.calls[0][0] as CustomEvent).detail).toEqual({
    target: 'tab:WORLD',
    worldView: 'MAP',
  });
  expect((show.mock.calls[0][0] as CustomEvent).detail).toEqual({ cx: 30, cy: 43 });
  expect(consumePendingChunk()).toEqual({ cx: 30, cy: 43 });
  expect(consumePendingChunk()).toBeNull();

  window.removeEventListener('fate:nav', nav);
  window.removeEventListener('fate:show-chunk', show);
});
