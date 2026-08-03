import { describe, it, expect } from 'vitest';
import { placeOf, chunkForPlace, chunkUnlocked, summarisePlaces } from './chunkLocations';
import { UnlockState } from '../types';

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
