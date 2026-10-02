/**
 * Chunk Picker requirement wording the transform reviews before it reaches
 * public/chunk-content.json, shared by surface chunks and interiors.
 */
import { readFileSync } from 'node:fs';

const overrides = JSON.parse(readFileSync(new URL('../data/sources/chunk-content-overrides.json', import.meta.url), 'utf8'));

/**
 * "F2P Only" marks members content as missing from free-to-play worlds. The
 * tracker has no free-to-play mode, so the tag is never a requirement here:
 * read as one, it left 405 members entities, 47 of them shops, at "needs
 * confirmation" (accuracy audit S11).
 */
export const DROPPED_REQUIREMENTS = new Set(['F2P Only']);

/**
 * Wording no gate understands, rewritten as requirements the app checks,
 * each reviewed against the wiki (requirementRewrites in
 * data/sources/chunk-content-overrides.json). The Farming Guild's tiers are
 * one: "Access the Farming Guild#Beginner tier" is the guild and 45 Farming.
 */
export const REQUIREMENT_REWRITES = new Map((overrides.requirementRewrites ?? []).map(({ from, to }) => [from, to]));

/** The requirements a source requirement stands for: none for a dropped tag, else its reviewed form. */
export function reviewRequirement(raw) {
  if (DROPPED_REQUIREMENTS.has(raw)) return [];
  return REQUIREMENT_REWRITES.get(raw) ?? [raw];
}
