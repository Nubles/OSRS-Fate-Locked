import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import type { UnlockState } from '../types';
import { chunkEntry, chunkEntryReason, runReach, type ReachSource } from './chunkEntry';
import { CHUNKED_START } from './chunkAdjacency';
import { chunkForPlace } from './chunkLocations';
import { OCEAN_CHUNK_KEYS } from './oceanAccess';

const fresh = (): UnlockState => structuredClone(initialState.unlocks);
const idOf = ({ cx, cy }: { cx: number; cy: number }) => String(cx * 256 + cy);
const lumbridge = chunkForPlace('Lumbridge')!;
const falador = chunkForPlace('Falador')!;
const [oceanCx, oceanCy] = [...OCEAN_CHUNK_KEYS][0].split(',').map(Number);
const ocean = { cx: oceanCx, cy: oceanCy };

/** No transport at all, and one gate: the chunk north of Lumbridge needs Cook's Assistant. */
const north = { cx: lumbridge.cx, cy: lumbridge.cy + 1 };
const source: ReachSource = {
  connectGraph: () => ({}),
  questSections: () => ({ [idOf(north)]: ["Cook's Assistant"] }),
};

describe('chunkEntry', () => {
  it('locks a chunk the run does not own, whatever the reach says', () => {
    expect(chunkEntry(falador, fresh(), 'vanilla')).toBe('LOCKED');
    expect(chunkEntry(falador, fresh(), 'vanilla', new Set([idOf(falador)]))).toBe('LOCKED');
  });

  it('allows an owned chunk that a route reaches', () => {
    expect(chunkEntry(lumbridge, fresh(), 'vanilla', new Set([idOf(lumbridge)]))).toBe('ALLOWED');
  });

  it('holds an owned chunk no route reaches as not ready', () => {
    expect(chunkEntry(lumbridge, fresh(), 'vanilla', new Set())).toBe('NOT_READY');
  });

  it('counts an owned chunk as reached when there is no reach to go on', () => {
    expect(chunkEntry(lumbridge, fresh(), 'vanilla')).toBe('ALLOWED');
  });

  it('opens the ocean with Sailing and Pandemonium', () => {
    expect(chunkEntry(ocean, fresh(), 'vanilla')).toBe('LOCKED');
    const sailor = { ...fresh(), skills: { ...fresh().skills, Sailing: 1 }, quests: ['Pandemonium'] };
    expect(chunkEntry(ocean, sailor, 'vanilla')).toBe('ALLOWED');
  });
});

describe('runReach', () => {
  it('walks from Lumbridge, and from the free chunk in Chunked runs', () => {
    expect(runReach(source, fresh(), 'vanilla').has(idOf(lumbridge))).toBe(true);
    const chunked = { ...fresh(), regions: [], chunks: [] };
    expect([...runReach(source, chunked, 'chunked')]).toEqual([idOf(CHUNKED_START)]);
  });

  it('does not enter a chunk behind an unfinished quest until it is done', () => {
    expect(runReach(source, fresh(), 'vanilla').has(idOf(north))).toBe(false);
    const done = { ...fresh(), quests: ["Cook's Assistant"] };
    expect(runReach(source, done, 'vanilla').has(idOf(north))).toBe(true);
  });

  it('leaves out chunks the run does not own', () => {
    expect(runReach(source, fresh(), 'vanilla').has(idOf(falador))).toBe(false);
  });
});

describe('chunkEntryReason', () => {
  const sailor = () => ({ ...fresh(), skills: { ...fresh().skills, Sailing: 1 }, quests: ['Pandemonium'] });

  it('gives none for an ALLOWED chunk', () => {
    expect(chunkEntryReason(lumbridge, 'ALLOWED', fresh(), 'vanilla', [])).toBeUndefined();
  });

  it('says what would unlock a LOCKED chunk', () => {
    expect(chunkEntryReason(falador, 'LOCKED', fresh(), 'vanilla', [])).toBe('Unlock Falador');
    expect(chunkEntryReason(falador, 'LOCKED', fresh(), 'chunked', [])).toBe('Chunk not unlocked');
    expect(chunkEntryReason(ocean, 'LOCKED', fresh(), 'vanilla', [])).toBe('Needs Sailing and Pandemonium');
    expect(chunkEntryReason(ocean, 'LOCKED', sailor(), 'chunked', [])).toBe('Not reached from your coast');
  });

  it("names the quest a NOT_READY chunk's entry needs, or the missing route", () => {
    expect(chunkEntryReason(north, 'NOT_READY', fresh(), 'vanilla', ["Cook's Assistant"])).toBe("Needs Cook's Assistant");
    expect(chunkEntryReason(north, 'NOT_READY', fresh(), 'vanilla', ['Not A Real Quest'])).toBe('No route from Lumbridge');
    const done = { ...fresh(), quests: ["Cook's Assistant"] };
    expect(chunkEntryReason(north, 'NOT_READY', done, 'vanilla', ["Cook's Assistant"])).toBe('No route from Lumbridge');
    expect(chunkEntryReason(north, 'NOT_READY', fresh(), 'chunked', [])).toBe('No route from your start chunk');
  });
});
