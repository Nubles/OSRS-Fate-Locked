/**
 * Chunk Picker requirement wording the transform reviews before it reaches
 * public/chunk-content.json, shared by surface chunks and interiors.
 *
 * "F2P Only" marks members content as missing from free-to-play worlds. The
 * tracker has no free-to-play mode, so the tag is never a requirement here:
 * read as one, it left 405 members entities, 47 of them shops, at "needs
 * confirmation" (accuracy audit S11).
 */
export const DROPPED_REQUIREMENTS = new Set(['F2P Only']);

/** The requirements a source requirement stands for: none for a dropped tag, else itself. */
export function reviewRequirement(raw) {
  return DROPPED_REQUIREMENTS.has(raw) ? [] : [raw];
}
