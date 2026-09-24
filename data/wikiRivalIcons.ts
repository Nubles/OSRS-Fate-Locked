/** Wiki artwork for rival UI; saved emoji fields remain legacy save data only. */
const PERSONA_IMAGES: Record<string, string> = {
  casual: 'Bronze_full_helm.png',
  steady: 'Rune_full_helm.png',
  sweat: 'Dragon_full_helm.png',
};

export const getRivalImage = (mode: string, personaId: string): string =>
  mode === 'friend' ? 'Worn_Equipment.png' : PERSONA_IMAGES[personaId] ?? PERSONA_IMAGES.steady;
