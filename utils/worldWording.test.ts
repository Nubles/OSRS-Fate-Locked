import { describe, expect, it } from 'vitest';
import { misthalinListName, tutorialIslandNote } from './worldWording';
import { skillGatherNote } from './skillGatherNote';

describe('World wording', () => {
  it('does not call Misthalin a free starter area in Chunked, or talk about area rolls', () => {
    expect(misthalinListName('chunked')).toBe('Misthalin');
    expect(tutorialIslandNote('chunked')).toBe('Tutorial Island is completed onboarding: always free, with no chunk needed.');
  });

  it('keeps the area wording in other modes', () => {
    for (const mode of ['vanilla', 'xtreme', undefined]) {
      expect(misthalinListName(mode)).toBe('Misthalin (Starter Area)');
      expect(tutorialIslandNote(mode)).toBe('Tutorial Island is completed onboarding: always free, with no area roll required.');
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
