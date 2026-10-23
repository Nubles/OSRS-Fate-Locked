import { describe, expect, it } from 'vitest';
import { MAP_AUTHORING_FLAG, mapAuthoringAvailable } from './mapAuthoring';

const store = (value: string | null) => ({ getItem: (key: string) => (key === MAP_AUTHORING_FLAG ? value : null) });

describe('mapAuthoringAvailable', () => {
  it('hides the map authoring tool from players in a deployed build', () => {
    expect(mapAuthoringAvailable(false, store(null))).toBe(false);
    expect(mapAuthoringAvailable(false, undefined)).toBe(false);
    expect(mapAuthoringAvailable(false, { getItem: () => { throw new Error('blocked'); } })).toBe(false);
  });

  it('shows it in the dev server, or once a maintainer opts this browser in', () => {
    expect(mapAuthoringAvailable(true, store(null))).toBe(true);
    expect(mapAuthoringAvailable(false, store('1'))).toBe(true);
  });
});
