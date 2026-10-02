import type { EntityHit, EntityKind } from '../services/ChunkContentService';

interface LocationSource {
  entityLocations(name: string, kinds?: EntityKind[]): EntityHit | null;
}

// Reviewed resource hosts whose activity/source type differs from the spatial
// entity kind. This affects map links only, never item availability or access.
const RESOURCE_HOSTS: Record<string, { name: string; from: EntityKind[]; kinds: EntityKind[] }> = {
  'mage arena shop': { name: "Lundail's Arena-side Rune Shop", from: ['shop'], kinds: ['shop'] },
  'magpie impling': { name: 'Magpie impling', from: ['monster'], kinds: ['npc'] },
  'dragon impling': { name: 'Dragon impling', from: ['monster'], kinds: ['npc'] },
  'duke horacio': { name: 'Duke Horacio', from: ['spawn'], kinds: ['npc'] },
  'chambers of xeric': { name: 'Chambers of Xeric', from: ['monster'], kinds: ['object'] },
  'theatre of blood': { name: 'Theatre of Blood', from: ['monster'], kinds: ['object'] },
  // Combat Achievement "monsters" the map knows by the fight's own monsters or entrance
  // (accuracy audit, 29 September 2026: 203 of 655 tasks showed no place).
  'chambers of xeric: challenge mode': { name: 'Chambers of Xeric', from: ['monster'], kinds: ['object'] },
  'theatre of blood: entry mode': { name: 'Theatre of Blood', from: ['monster'], kinds: ['object'] },
  'theatre of blood: hard mode': { name: 'Theatre of Blood', from: ['monster'], kinds: ['object'] },
  'tombs of amascut': { name: "Tumeken's Warden", from: ['monster'], kinds: ['monster'] },
  'tombs of amascut: entry mode': { name: "Tumeken's Warden", from: ['monster'], kinds: ['monster'] },
  'tombs of amascut: expert mode': { name: "Tumeken's Warden", from: ['monster'], kinds: ['monster'] },
  leviathan: { name: 'The Leviathan', from: ['monster'], kinds: ['monster'] },
  whisperer: { name: 'The Whisperer', from: ['monster'], kinds: ['monster'] },
  'royal titans': { name: 'Branda the Fire Queen', from: ['monster'], kinds: ['monster'] },
  'fortis colosseum': { name: 'Sol Heredit', from: ['monster'], kinds: ['monster'] },
  'moons of peril': { name: 'Blood Moon', from: ['monster'], kinds: ['monster'] },
  barrows: { name: 'Ahrim the Blighted', from: ['monster'], kinds: ['monster'] },
  tempoross: { name: 'Tempoross', from: ['monster'], kinds: ['npc'] },
  glough: { name: 'Glough', from: ['monster'], kinds: ['npc'] },
  'crystalline hunllef': { name: 'Gauntlet Portal', from: ['monster'], kinds: ['object', 'npc'] },
  'corrupted hunllef': { name: 'Gauntlet Portal', from: ['monster'], kinds: ['object', 'npc'] },
};

/** Exact lookup first; only explicitly reviewed resource hosts cross entity kinds. */
export const findEntityLocations = (source: LocationSource, name: string, kinds?: EntityKind[]): EntityHit | null => {
  const trimmed = name.trim();
  const exact = source.entityLocations(trimmed, kinds);
  if (exact) return exact;
  const key = trimmed.toLowerCase();
  const host = Object.hasOwn(RESOURCE_HOSTS, key) ? RESOURCE_HOSTS[key] : undefined;
  if (!host || (kinds && !kinds.some(kind => host.from.includes(kind)))) return null;
  return source.entityLocations(host.name, host.kinds);
};
