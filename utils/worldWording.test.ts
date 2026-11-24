import { describe, expect, it } from 'vitest';
import { misthalinListName, tutorialIslandNote } from './worldWording';
import { GAME_MODES, resolveModeRules, type GameModeRules } from '../config/gameModes';
import { freeAreasFor } from './freeAreas';
import { MISTHALIN_AREAS } from '../constants';
import { skillGatherNote } from './skillGatherNote';

describe('World wording', () => {
  const labelFor = (id?: string, custom?: GameModeRules) => misthalinListName(resolveModeRules(id, custom).startArea);

  it('does not call Misthalin a free starter area in Chunked, or talk about area rolls', () => {
    expect(labelFor('chunked')).toBe('Misthalin');
    expect(tutorialIslandNote('chunked')).toBe('Tutorial Island is completed onboarding: always free, with no chunk needed.');
  });

  it('keeps the area wording in other modes', () => {
    for (const mode of ['vanilla', 'xtreme', undefined]) {
      expect(tutorialIslandNote(mode)).toBe('Tutorial Island is completed onboarding: always free, with no area roll required.');
    }
    expect(labelFor('vanilla')).toBe('Misthalin (Starter Area)');
    expect(labelFor(undefined)).toBe('Misthalin (Starter Area)');
  });

  it('calls Misthalin the starter area only when the start frees all of it', () => {
    // Legacy Xtreme Start frees only Lumbridge, so the rest of Misthalin is locked.
    expect(labelFor('xtreme')).toBe('Misthalin');
    const vanilla = resolveModeRules('vanilla');
    expect(labelFor('custom', { ...vanilla, startArea: 'lumbridge' })).toBe('Misthalin');
    expect(labelFor('custom', { ...vanilla, startArea: 'none' })).toBe('Misthalin');
    expect(labelFor('custom', { ...vanilla, startArea: 'misthalin' })).toBe('Misthalin (Starter Area)');
    // A custom mode saved before startArea existed keeps the default start.
    const { startArea: _unset, ...oldCustom } = vanilla;
    expect(labelFor('custom', oldCustom as GameModeRules)).toBe('Misthalin (Starter Area)');
    for (const mode of GAME_MODES) {
      const free = freeAreasFor(mode.id);
      const allFree = MISTHALIN_AREAS.every(area => free.includes(area));
      expect(labelFor(mode.id), mode.id).toBe(allFree ? 'Misthalin (Starter Area)' : 'Misthalin');
    }
  });
});

describe('skill Map Gathering note', () => {
  it('says the counts are world-wide in Chunked and drops "pick a region"', () => {
    expect(skillGatherNote('chunked')).toContain('not only in your chunks');
    expect(skillGatherNote('chunked')).not.toContain('region');
    expect(skillGatherNote('vanilla')).toContain('Click a resource to pick a region and jump straight there.');
  });
});
