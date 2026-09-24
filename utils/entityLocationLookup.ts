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
