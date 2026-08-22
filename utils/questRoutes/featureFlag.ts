export type RuneProofAvailability = 'OFF' | 'PUBLIC' | 'PREVIEW';

export const runeProofAvailability = (
  env: Record<string, string | boolean | undefined>,
): RuneProofAvailability => (
  env.MODE === 'runeproof-preview' ? 'PREVIEW' : 'PUBLIC'
);

export const canRenderQuestWalkthrough = (
  availability: RuneProofAvailability,
  releaseStatus: 'PREVIEW_ONLY' | 'APPROVED',
): boolean => (
  availability === 'PREVIEW'
  || (availability === 'PUBLIC' && releaseStatus === 'APPROVED')
);
