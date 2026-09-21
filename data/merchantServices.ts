/** NPC services, verified against their Wiki pages on 2026-09-21. */
export const MERCHANT_SERVICES: Record<string, { category: string; requirements?: string[] }> = {
  Ellis: { category: 'Tanners' },
  Tanner: { category: 'Tanners' },
  Taxidermist: { category: 'Taxidermists' },
  'Bob Barter (herbs)': { category: 'Decanters' },
  Zahur: { category: 'Decanters' },
  Gertrude: { category: 'Pet Shops', requirements: ["Gertrude's Cat Complete the quest"] },
  Chase: { category: 'Pet Shops', requirements: ['A Ruff Situation Complete the quest'] },
};
