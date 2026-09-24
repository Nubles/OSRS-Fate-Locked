import type { ChunkContent } from '../services/ChunkContentService';

export type TransportEntityKind = 'object' | 'npc';

// Exact reviewed identities, separated by entity kind. Substrings such as
// "glider", "balloon", "carpet" and "eagle" also occur in unrelated scenery.
// These identify a local service, not a route to every other connected chunk.
const TRANSPORT_IDENTITIES: Record<TransportEntityKind, Record<string, string>> = {
  object: {
    'spirit tree': 'Spirit Trees',
    'fairy ring': 'Fairy Rings',
    'canoe station': 'Canoes',
    'magic mushtree': 'Mycelium Transport',
    'obelisk': 'Wilderness Obelisks',
    'mine cart': 'Mine Carts',
    'minecart': 'Mine Carts',
  },
  npc: {
    // https://oldschool.runescape.wiki/w/Trader_Crewmember?oldid=15284983
    'trader crewmember': 'Charter Ships',
    // https://oldschool.runescape.wiki/w/Renu?oldid=15252643
    'renu': 'Quetzal Network',
    // https://oldschool.runescape.wiki/w/Gnome_glider?oldid=15320406
    'captain errdo': 'Gnome Gliders',
    'gnormadium avlafrim': 'Gnome Gliders',
    'captain shoracks': 'Gnome Gliders',
    'captain bleemadge': 'Gnome Gliders',
    'captain klemfoodle': 'Gnome Gliders',
    'captain dalbur': 'Gnome Gliders',
    // https://oldschool.runescape.wiki/w/Balloon_transport_system?oldid=15267219
    'auguste': 'Balloon Transport',
    // https://oldschool.runescape.wiki/w/Rug_Merchant?oldid=15315272
    'rug merchant': 'Magic Carpets',
  },
};

/** Reviewed local transport service, or null for unknown/inert identities. */
export const mobilityFor = (name: string, kind: TransportEntityKind = 'object'): string | null => {
  const identities = TRANSPORT_IDENTITIES[kind];
  const key = name.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(identities, key) ? identities[key] : null;
};

export interface ChunkTransportNode {
  name: string;
  kind: TransportEntityKind;
  // The source supplies object counts but only NPC presence, not NPC counts.
  count?: number;
  network: string;
}

export const chunkTransportNodes = (content: Pick<ChunkContent, 'objects' | 'npcs'>): ChunkTransportNode[] => {
  const nodes: ChunkTransportNode[] = [];
  for (const [name, count] of content.objects) {
    const network = mobilityFor(name, 'object');
    if (network) nodes.push({ name, kind: 'object', count, network });
  }
  for (const name of content.npcs) {
    const network = mobilityFor(name, 'npc');
    if (network) nodes.push({ name, kind: 'npc', network });
  }
  return nodes;
};
