import { describe, expect, it } from 'vitest';
import { PETS } from './pets';
import { PET_GROUPS, PET_SOURCES, petImageFile, petMatches } from './petSources';

const pet = (name: string) => PETS.find((candidate) => candidate.name === name)!;
const find = (query: string) => PETS.filter((candidate) => petMatches(candidate, query)).map((candidate) => candidate.name);

describe('pet sources', () => {
  it('names where every pet comes from, grouped as the wiki groups them', () => {
    expect(PETS.filter((candidate) => !PET_SOURCES[candidate.id]).map((candidate) => candidate.name)).toEqual([]);
    expect(Object.keys(PET_SOURCES).map(Number).sort()).toEqual(PETS.map((candidate) => candidate.id).sort());
    const count = (group: string) => PETS.filter((candidate) => PET_SOURCES[candidate.id].group === group).length;
    // The wiki's Pet page: boss pets, skilling pets, and the collection log's other pets.
    expect([count('Boss'), count('Skilling'), count('Other')]).toEqual([54, 9, 8]);
    expect(PET_GROUPS.map(({ group }) => group)).toEqual(['Boss', 'Skilling', 'Other']);
  });

  it('finds a pet by its name, its source or a short name, ignoring case and apostrophes', () => {
    expect(find('vorkath')).toEqual(['Vorki']);
    expect(find('VORKI')).toEqual(['Vorki']);
    expect(find('kril')).toEqual(["Pet K'ril Tsutsaroth"]);
    expect(find('mining')).toEqual(['Rock golem']);
    expect(find('cox')).toEqual(['Olmlet']);
    expect(find('kq')).toEqual(['Kalphite Princess']);
    expect(find('dagannoth prime')).toEqual(['Pet Dagannoth Prime']);
    expect(find('dks')).toHaveLength(3);
    expect(find('nothing like this')).toEqual([]);
    expect(find('  ')).toHaveLength(PETS.length);
  });

  it("uses the wiki's picture for each pet, by its name", () => {
    expect(petImageFile(pet('Vorki'))).toBe('Vorki.png');
    expect(petImageFile(pet("Vet'ion Jr."))).toBe("Vet'ion_Jr..png");
    expect(petImageFile(pet('Ikkle Hydra (serpentine)'))).toBe('Ikkle_Hydra_(serpentine).png');
  });
});
