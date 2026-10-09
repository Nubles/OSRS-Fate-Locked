/**
 * Chunked mode's Skills rolls: a Skills Key (or a Chaos Key landing on Skills)
 * only rolls a skill the run's chunks can train at the levels that tier opens.
 * Without this a Key could open Sailing for a player standing in Lumbridge
 * Castle, and early Chunked runs ran out of Keys (October 2026 simulation:
 * 200 of 200 runs stuck within 5 chunks).
 *
 * Facts come from data/chunkSkillNodes.ts (generated). Some skills follow from
 * others: anything to fight trains melee, Ranged, Magic and Prayer (bones);
 * logs train Firemaking and Fletching; a Slayer master trains Slayer; a herb
 * patch trains Herblore.
 */
import type { UnlockState } from '../types';
import { CHUNK_SKILL_FACTS, CHUNK_SKILL_TIERS } from '../data/chunkSkillNodes';
import { CHUNKED_START_KEY } from './chunkAdjacency';

const COMBAT_SKILLS = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Prayer'];

let cachedSignature: string | null = null;
let cachedTiers = new Map<string, number>();

/** The lowest tier each skill can be trained at across the start chunk and the run's chunks. */
export const chunkedTrainingTiers = (chunks: readonly string[]): ReadonlyMap<string, number> => {
  const signature = chunks.join(';');
  if (signature === cachedSignature) return cachedTiers;
  const levels = new Map<string, number>();
  const note = (skill: string, tier: number) => levels.set(skill, Math.min(levels.get(skill) ?? tier, tier));
  for (const key of [CHUNKED_START_KEY, ...chunks]) {
    const row = CHUNK_SKILL_TIERS[key] ?? '';
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') note(CHUNK_SKILL_FACTS[i], row[i] === '0' ? 10 : Number(row[i]));
  }
  if (levels.has('@monster')) COMBAT_SKILLS.forEach(skill => note(skill, 1));
  if (levels.has('@slayer')) note('Slayer', 1);
  if (levels.has('@herb')) note('Herblore', 1);
  if (levels.has('Woodcutting')) { note('Firemaking', 1); note('Fletching', 1); }
  for (const fact of ['@monster', '@slayer', '@herb']) levels.delete(fact);
  cachedSignature = signature;
  cachedTiers = levels;
  return levels;
};

/** Whether the skill's next tier opens a level the run's chunks can train it at. */
export const chunkedSkillRollable = (skill: string, unlocks: Pick<UnlockState, 'skills' | 'chunks'>): boolean => {
  const lowest = chunkedTrainingTiers(unlocks.chunks ?? []).get(skill);
  return lowest !== undefined && lowest <= (unlocks.skills[skill] ?? 0) + 1;
};
