import { describe, it, expect, afterEach } from 'vitest';
import { freeAreasFor, getFreeAreas, isFreeArea, isStartAreaFor, setStartArea } from './freeAreas';
import { MISTHALIN_AREAS } from '../constants';
import { getGameMode } from '../config/gameModes';

afterEach(() => setStartArea('misthalin')); // restore default for other suites

describe('freeAreas', () => {
  it('defaults to the whole of Misthalin being free', () => {
    setStartArea('misthalin');
    expect(isFreeArea('Misthalin')).toBe(true);
    expect(isFreeArea('Lumbridge')).toBe(true);
    expect(isFreeArea('Varrock')).toBe(true);
    expect(isFreeArea('Draynor Village')).toBe(true);
    expect(isFreeArea('Falador')).toBe(false); // Asgarnia, never free
  });

  it('Xtreme start frees only Lumbridge', () => {
    setStartArea('lumbridge');
    expect(isFreeArea('Lumbridge')).toBe(true);
    expect(isFreeArea('Misthalin')).toBe(false);   // continent not free
    expect(isFreeArea('Varrock')).toBe(false);      // must be earned
    expect(isFreeArea('Draynor Village')).toBe(false);
    expect(isFreeArea('Edgeville')).toBe(false);
  });

  it('undefined startArea is treated as the default', () => {
    setStartArea(undefined);
    expect(isFreeArea('Varrock')).toBe(true);
  });

  it("Chunked mode ('none') frees no named area — the map must not read as all-Misthalin-unlocked", () => {
    setStartArea('none');
    expect(isFreeArea('Misthalin')).toBe(false);
    expect(isFreeArea('Lumbridge')).toBe(false);
    expect(isFreeArea('Varrock')).toBe(false);
    expect(isFreeArea('Draynor Village')).toBe(false);
  });
});

describe('freeAreasFor', () => {
  const custom = (startArea: 'misthalin' | 'lumbridge' | 'none') => ({ ...getGameMode('vanilla').rules, startArea });

  it("gives each mode's baseline", () => {
    expect(freeAreasFor('vanilla')).toEqual(['Tutorial Island', 'Misthalin', ...MISTHALIN_AREAS]);
    expect(freeAreasFor('xtreme')).toEqual(['Tutorial Island', 'Lumbridge']);
    expect(freeAreasFor('chunked')).toEqual(['Tutorial Island']);
    expect(freeAreasFor('custom', custom('lumbridge'))).toEqual(['Tutorial Island', 'Lumbridge']);
    expect(freeAreasFor('custom', custom('none'))).toEqual(['Tutorial Island']);
  });

  it('reads the mode, not the global', () => {
    setStartArea('lumbridge');
    expect(freeAreasFor('vanilla')).toContain('Varrock');
    setStartArea('misthalin');
    expect(freeAreasFor('xtreme')).not.toContain('Varrock');
  });

  it('matches what the global gives once the mode sets it', () => {
    for (const [mode, rules] of [['vanilla', undefined], ['xtreme', undefined], ['chunked', undefined],
      ['custom', custom('none')]] as const) {
      setStartArea(rules?.startArea ?? getGameMode(mode).rules.startArea);
      expect(getFreeAreas(), mode).toEqual(freeAreasFor(mode, rules));
    }
  });
});

describe('isStartAreaFor', () => {
  it("says whether the global is the mode's baseline", () => {
    setStartArea('misthalin');
    expect(isStartAreaFor('vanilla')).toBe(true);
    expect(isStartAreaFor('xtreme')).toBe(false);
    expect(isStartAreaFor('chunked')).toBe(false);
    setStartArea('lumbridge');
    expect(isStartAreaFor('xtreme')).toBe(true);
    expect(isStartAreaFor('vanilla')).toBe(false);
    setStartArea('none');
    expect(isStartAreaFor('chunked')).toBe(true);
    expect(isStartAreaFor('custom', { ...getGameMode('vanilla').rules, startArea: 'none' })).toBe(true);
  });
});
