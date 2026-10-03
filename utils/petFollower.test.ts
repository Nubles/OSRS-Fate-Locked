// @vitest-environment jsdom
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PETS } from '../data/pets';
import { STILL_PET_MODELS } from '../data/petModels';
import {
  followerPetId,
  isStillPet,
  petModelUrl,
  readFollowerPrefs,
  writeFollowerPrefs,
} from './petFollower';

const stored = new Map<string, string>();
beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); },
    removeItem: (key: string) => { stored.delete(key); },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('pet models', () => {
  it('has a model for every pet, exported by scripts/export-models.mjs --pets', () => {
    const missing = PETS.filter((pet) => !existsSync(`public/models/pets/${pet.id}.gltf`));
    expect(missing.map((pet) => pet.name)).toEqual([]);
  });

  it('knows which models are still, and only pets are', () => {
    const ids = new Set(PETS.map((pet) => pet.id));
    expect(STILL_PET_MODELS.every((id) => ids.has(id))).toBe(true);
    expect(isStillPet(502003)).toBe(true);
    expect(isStillPet(502026)).toBe(false);
  });

  it('loads from under the site base', () => {
    expect(petModelUrl(502026)).toMatch(/\/models\/pets\/502026\.gltf$/);
  });
});

describe('the follower', () => {
  it('is the chosen pet while it is claimed, otherwise the most recently claimed', () => {
    expect(followerPetId(undefined, {})).toBeNull();
    expect(followerPetId([], {})).toBeNull();
    expect(followerPetId([502001, 502026], {})).toBe(502026);
    expect(followerPetId([502001, 502026], { petId: 502001 })).toBe(502001);
    expect(followerPetId([502001, 502026], { petId: 502050 })).toBe(502026);
  });

  it('remembers the choice and the off switch per run, and shrugs off a bad entry', () => {
    writeFollowerPrefs('run-a', { hidden: true, petId: 502001 });
    expect(readFollowerPrefs('run-a')).toEqual({ hidden: true, petId: 502001 });
    expect(readFollowerPrefs('run-b')).toEqual({});
    localStorage.setItem('fate-locked:pet-follower:run-c', '{"hidden":"yes","petId":"x"}');
    expect(readFollowerPrefs('run-c')).toEqual({});
    localStorage.setItem('fate-locked:pet-follower:run-d', 'not json');
    expect(readFollowerPrefs('run-d')).toEqual({});
  });
});
