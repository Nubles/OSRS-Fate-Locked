import { describe, expect, it, vi } from 'vitest';

// The start chunk's Thieving 1 (its men and women) hides every other chunk's
// Thieving level from the pool, so this file takes it out to see the gate.
vi.mock('../data/chunkSkillNodes', async importOriginal => {
  const real = await importOriginal<typeof import('../data/chunkSkillNodes')>();
  const { CHUNKED_START_KEY } = await import('./chunkAdjacency');
  const cells = [...real.CHUNK_SKILL_TIERS[CHUNKED_START_KEY].matchAll(/[.\d]|[A-J]\d/g)].map(([cell]) => cell);
  cells[real.CHUNK_SKILL_FACTS.indexOf('Thieving')] = '.';
  return { ...real, CHUNK_SKILL_TIERS: { ...real.CHUNK_SKILL_TIERS, [CHUNKED_START_KEY]: cells.join('') } };
});

const { chunkedTrainingLevels } = await import('./chunkedSkillPool');
const { initialState } = await import('../context/GameContext');

const run = (chunk: string, quests: string[]) =>
  ({ ...initialState.unlocks, chunks: [chunk], quests, skills: { ...initialState.unlocks.skills, Thieving: 9, Mining: 2, Woodcutting: 5 } });

describe('Chunked Skills pool: Darkmeyer vyres in the mixed chunks need Sins of the Father (deep audit chunk-sample.d3[2])', () => {
  it.each([
    ['56,51', ['Priest in Peril', 'Darkness of Hallowvale'], 'Mining', 20],
    ['56,53', ['Priest in Peril'], 'Woodcutting', 1],
    ['57,52', ['Priest in Peril'], 'Woodcutting', 45],
  ] as const)('%s counts Thieving 82 only with the quest, and its other content as before', (chunk, entry, outside, level) => {
    expect(chunkedTrainingLevels([], run(chunk, [...entry, 'Sins of the Father'])).has('Thieving')).toBe(false);
    expect(chunkedTrainingLevels([chunk], run(chunk, [...entry])).has('Thieving')).toBe(false);
    expect(chunkedTrainingLevels([chunk], run(chunk, [...entry, 'Sins of the Father'])).get('Thieving')).toBe(82);
    expect(chunkedTrainingLevels([chunk], run(chunk, [...entry])).get(outside)).toBeLessThanOrEqual(level);
    // Without a run the pool reads the content alone, vyres included.
    expect(chunkedTrainingLevels([chunk]).get('Thieving')).toBe(82);
  });

  it('56,52 waits for the quest through its entry, as before', () => {
    expect(chunkedTrainingLevels(['56,52'], run('56,52', ['Priest in Peril'])).has('Thieving')).toBe(false);
    expect(chunkedTrainingLevels(['56,52'], run('56,52', ['Priest in Peril', 'Sins of the Father'])).get('Thieving')).toBe(82);
  });
});
