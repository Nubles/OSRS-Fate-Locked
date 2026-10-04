import { describe, expect, it } from 'vitest';
import { COLLECTION_LOG_DATA } from './collectionLogData';
import { PET_IDS } from './petIds';
import { petById, PETS, unclaimedPets } from './pets';

describe('pets', () => {
  it("are exactly the collection log's All Pets page", () => {
    expect(PETS).toEqual(COLLECTION_LOG_DATA.Other.pages['All Pets'].items);
  });

  it('each have one id, as the game state knows them', () => {
    expect(PETS.map((pet) => pet.id)).toEqual(PET_IDS);
    expect(new Set(PETS.map((pet) => pet.id)).size).toBe(PETS.length);
    expect(petById(502070)?.name).toBe('Aggy');
    expect(petById(157004)).toBeUndefined();
  });

  it('leave out the ones a run has claimed', () => {
    const left = unclaimedPets([PETS[0].id, PETS[2].id]);
    expect(left).toHaveLength(PETS.length - 2);
    expect(left[0]).toEqual(PETS[1]);
    expect(unclaimedPets(undefined)).toEqual(PETS);
  });
});
