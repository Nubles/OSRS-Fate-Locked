import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { initialState } from '../context/GameContext';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { buildChunkSkillNodes, chunkSkillNodesSource } from './chunkSkillNodesBuild';
import chunkDoc from '../public/chunk-content.json';
import { chunkedSkillRollable, chunkedTrainingTiers } from './chunkedSkillPool';
import { randomUnlockPool } from './gameEngine';

const fresh = () => ({ ...initialState.unlocks, chunks: [] as string[] });
const skillPool = (unlocks: ReturnType<typeof fresh>, mode: string) =>
  randomUnlockPool(unlocks, mode, 'key', TableType.SKILLS).map(({ item }) => item);

describe('Chunked Skills rolls', () => {
  it('reads data/chunkSkillNodes.ts as generated from public/chunk-content.json', () => {
    expect(readFileSync('data/chunkSkillNodes.ts', 'utf8'))
      .toBe(chunkSkillNodesSource(buildChunkSkillNodes(chunkDoc as unknown as Parameters<typeof buildChunkSkillNodes>[0])));
  });

  it('only rolls skills the Lumbridge Castle start chunk can train', () => {
    const pool = skillPool(fresh(), 'chunked');
    expect(pool).toEqual(expect.arrayContaining(['Woodcutting', 'Firemaking', 'Attack', 'Prayer', 'Thieving', 'Cooking']));
    for (const skill of ['Sailing', 'Construction', 'Agility', 'Herblore', 'Slayer', 'Runecraft', 'Mining']) expect(pool).not.toContain(skill);
  });

  it('needs a node the next tier can reach: the castle\'s level-20 fishing spot is out of reach at tier 0', () => {
    expect(chunkedTrainingTiers([]).get('Fishing')).toBe(2);
    expect(chunkedSkillRollable('Fishing', fresh())).toBe(false);
    expect(chunkedSkillRollable('Fishing', { ...fresh(), skills: { ...fresh().skills, Fishing: 1 } })).toBe(true);
    // Lumbridge Swamp's small-net spot opens Fishing from level 1.
    expect(chunkedSkillRollable('Fishing', { ...fresh(), chunks: ['50,49'] })).toBe(true);
    expect(chunkedSkillRollable('Mining', { ...fresh(), chunks: ['50,49'] })).toBe(true);
  });

  it('leaves Vanilla Skills rolls open to every skill', () => {
    expect(skillPool(fresh(), 'vanilla')).toContain('Sailing');
  });
});
