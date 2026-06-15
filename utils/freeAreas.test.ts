import { describe, it, expect, afterEach } from 'vitest';
import { isFreeArea, setStartArea } from './freeAreas';

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
});
