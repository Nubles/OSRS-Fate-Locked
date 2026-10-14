import { describe, expect, it } from 'vitest';
import { loadModelManifest, modelFor, modelManifestLoaded } from './entityModels';

describe('entityModels', () => {
  it('loads the model list on demand, then resolves unlock names to models', async () => {
    // Nothing at startup: callers show their 2D picture until the list is in.
    expect(modelManifestLoaded()).toBe(false);
    expect(modelFor('Zulrah')).toBeUndefined();
    await loadModelManifest();
    expect(modelFor('Zulrah')).toMatch(/models\/zulrah\.gltf$/);
    expect(modelFor('Not a real unlock')).toBeUndefined();
  });
});
