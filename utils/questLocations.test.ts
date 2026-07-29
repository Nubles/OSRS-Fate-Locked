import { describe, it, expect } from 'vitest';
import { summariseQuestPlaces, refineQuestRegion } from './questLocations';
import type { EntityLocation } from '../services/ChunkContentService';
import { UnlockState } from '../types';

const unlocksWith = (regions: string[] = []): UnlockState =>
  ({ regions } as unknown as UnlockState);

// 46,52 = Falador (Asgarnia, gated); 50,50 = Lumbridge (Misthalin, always free).
const FALADOR: EntityLocation = { cx: 46, cy: 52, role: 'step' };
const FALADOR_START: EntityLocation = { cx: 46, cy: 52, role: 'first' };
const LUMBRIDGE: EntityLocation = { cx: 50, cy: 50, role: 'first' };

describe('summariseQuestPlaces', () => {
  it('reports no data for an empty location list', () => {
    const info = summariseQuestPlaces([], unlocksWith([]));
    expect(info.hasData).toBe(false);
    expect(info.allUnlocked).toBe(false);
  });

  it('tags each place with its real (sub-area) unlock state', () => {
    const info = summariseQuestPlaces([LUMBRIDGE, FALADOR], unlocksWith([]));
    expect(info.hasData).toBe(true);
    const fal = info.places.find(p => p.label.includes('Falador'))!;
    const lum = info.places.find(p => p.label.includes('Lumbridge'))!;
    expect(lum.unlocked).toBe(true);   // Misthalin free
    expect(fal.unlocked).toBe(false);  // Falador not unlocked
    expect(info.allUnlocked).toBe(false);
    expect(info.lockedPlaces).toHaveLength(1);
  });

  it('allUnlocked flips once the gated sub-area is unlocked', () => {
    const info = summariseQuestPlaces([LUMBRIDGE, FALADOR], unlocksWith(['Falador']));
    expect(info.allUnlocked).toBe(true);
    expect(info.lockedPlaces).toHaveLength(0);
  });

  it('dedupes by place and promotes a start over a passing step', () => {
    const info = summariseQuestPlaces([FALADOR, FALADOR_START], unlocksWith(['Falador']));
    expect(info.places).toHaveLength(1);
    expect(info.places[0].role).toBe('first');
    expect(info.startPlaces).toHaveLength(1);
  });

  it('preserves same-label coordinates and promotes first evidence only at its coordinate', () => {
    const info = summariseQuestPlaces([
      { cx: 18, cy: 55, role: 'step' },
      { cx: 18, cy: 55, role: 'step' },
      { cx: 19, cy: 55, role: 'step' },
      { cx: 19, cy: 55, role: 'first' },
    ], unlocksWith(['Kourend & Kebos']));

    expect(info.places).toHaveLength(1);
    expect(info.knownStepPlaces.map(place =>
      `${place.cx},${place.cy}:${place.role}`,
    )).toEqual([
      '19,55:first',
      '18,55:step',
    ]);
  });

  it('orders start places first, then locked before unlocked', () => {
    const info = summariseQuestPlaces([LUMBRIDGE, FALADOR], unlocksWith([]));
    // Lumbridge is the start → leads; Falador (locked step) follows.
    expect(info.places[0].label).toContain('Lumbridge');
  });
});

describe('refineQuestRegion display evidence', () => {
  const locked = summariseQuestPlaces([LUMBRIDGE, FALADOR], unlocksWith([]));
  const reachable = summariseQuestPlaces([LUMBRIDGE, FALADOR], unlocksWith(['Falador']));

  it('retains the legacy chunks result type without using it at runtime', () => {
    const legacyVia: ReturnType<typeof refineQuestRegion>['via'] = 'chunks';
    expect(legacyVia).toBe('chunks');
  });

  it('passes through when the authored region is already met', () => {
    expect(refineQuestRegion(true, locked)).toEqual({ met: true, via: 'authored' });
  });

  it('cannot promote a canonically blocked quest from chunk evidence', () => {
    expect(refineQuestRegion(false, reachable)).toEqual({ met: false, via: 'locked' });
  });

  it('stays locked when a needed place is still locked', () => {
    expect(refineQuestRegion(false, locked)).toEqual({ met: false, via: 'locked' });
  });

  it('stays locked when there is no chunk evidence', () => {
    const none = summariseQuestPlaces([], unlocksWith([]));
    expect(refineQuestRegion(false, none)).toEqual({ met: false, via: 'locked' });
  });
});
