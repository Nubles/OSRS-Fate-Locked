export type RuneProofAvailability = 'OFF' | 'PREVIEW';

export const runeProofAvailability = (
  env: Record<string, string | boolean | undefined>,
): RuneProofAvailability => (
  env.VITE_RUNEPROOF_PREVIEW === '1' ? 'PREVIEW' : 'OFF'
);

export const canRenderQuestWalkthrough = (
  availability: RuneProofAvailability,
  _releaseStatus: 'PREVIEW_ONLY' | 'APPROVED',
): boolean => availability === 'PREVIEW';
