import { describe, expect, it } from 'vitest';
import { SKILLS_LIST } from './items';
import { isSkillcape, loadModelManifest, modelFor, modelManifestLoaded, orientationFor, SKILLCAPE_SLUGS } from './entityModels';

describe('entityModels', () => {
  it('loads the model list on demand, then resolves unlock names to models', async () => {
    // Nothing at startup: callers show their 2D picture until the list is in.
    expect(modelManifestLoaded()).toBe(false);
    expect(modelFor('Zulrah')).toBeUndefined();
    await loadModelManifest();
    expect(modelFor('Zulrah')).toMatch(/models\/zulrah\.gltf$/);
    expect(modelFor('Not a real unlock')).toBeUndefined();
  });

  it('turns every skillcape round so its emblem faces the camera', async () => {
    await loadModelManifest();
    expect(SKILLCAPE_SLUGS).toHaveLength(24);
    for (const skill of SKILLS_LIST) {
      expect(modelFor(skill), skill).toBeDefined();
      expect(orientationFor(skill), skill).toBe('0deg 0deg 180deg');
      expect(isSkillcape(skill), skill).toBe(true);
    }
    expect(isSkillcape('Zulrah')).toBe(false);
    expect(orientationFor('Zulrah')).toBeUndefined();
  });
});
