/** NPC services, verified against their Wiki pages on 2026-09-21. */
export const MERCHANT_SERVICES: Record<string, { category: string; requirements?: string[] }> = {
  Ellis: { category: 'Tanners' },
  Tanner: { category: 'Tanners' },
  Sbott: { category: 'Tanners' },
  'Sawmill Operator': { category: 'Sawmill Operators' },
  'Estate agent': { category: 'Real Estate Agents' },
  Taxidermist: { category: 'Taxidermists' },
  'Bob Barter (herbs)': { category: 'Decanters' },
  Zahur: { category: 'Decanters' },
  Gertrude: { category: 'Pet Shops', requirements: ["Gertrude's Cat Complete the quest"] },
  Chase: { category: 'Pet Shops', requirements: ['A Ruff Situation Complete the quest'] },
  // Sellers who sell through dialogue, with no shop window (owner call U3), checked on
  // 2026-10-02: Karim (oldid 15358428), Aggie (15083478), Silk trader (15318776),
  // Tenzing (15318801) and Nulodion (15328958).
  Karim: { category: 'Kebab Sellers' },
  Aggie: { category: 'Dye Shops' },
  'Silk trader': { category: 'Silk Shops' },
  // He shoos you away until Death Plateau shows you his secret path, and the quest has
  // you buy his climbing boots, so a started quest is enough to buy them.
  Tenzing: { category: 'Clothes Shops', requirements: ['Started Death Plateau'] },
  // His building stays locked until Dwarf Cannon, and he sells the cannon parts once it
  // is done: the four as a set through dialogue, or one by one in his shop.
  Nulodion: { category: 'Weapon Shops', requirements: ['Dwarf Cannon Complete the quest'] },
};
