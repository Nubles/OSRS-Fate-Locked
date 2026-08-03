import type { ChunkCoord } from '../utils/mapCoords';

export type AreaAliasPolicy =
  | { kind: 'legacy'; canonical: string }
  | {
      kind: 'surface-overlap';
      canonical: string;
      chunks: readonly [ChunkCoord, ...ChunkCoord[]];
    };
export const AREA_ALIAS_POLICIES = {
  'Elf Camp': { kind: 'legacy', canonical: 'Iorwerth Camp' },
  "Heroes' Guild": {
    kind: 'surface-overlap', canonical: 'Taverley', chunks: [{ cx: 45, cy: 54 }],
  },
  'Ice Mountain': {
    kind: 'surface-overlap', canonical: 'Goblin Village', chunks: [{ cx: 46, cy: 54 }],
  },
  'Ranging Guild': {
    kind: 'surface-overlap', canonical: 'Hemenster', chunks: [{ cx: 41, cy: 53 }],
  },
  "Otto's Grotto": {
    kind: 'surface-overlap', canonical: 'Baxtorian Falls', chunks: [{ cx: 39, cy: 54 }],
  },
  'Resource Area': {
    kind: 'surface-overlap', canonical: 'Mage Arena', chunks: [{ cx: 49, cy: 61 }],
  },
} as const satisfies Readonly<Record<string, AreaAliasPolicy>>;
export const AREA_ALIASES = Object.fromEntries(
  Object.entries(AREA_ALIAS_POLICIES).map(([alias, policy]) => [alias, policy.canonical]),
) as Readonly<Record<string, string>>;

export interface AreaReference {
  kind: 'surface' | 'entrance';
  chunks: readonly [ChunkCoord, ...ChunkCoord[]];
  reason: string;
}

export const AREA_REFERENCES = {
  "Giants' Plateau": {
    kind: 'surface',
    chunks: [{ cx: 52, cy: 49 }],
    reason: 'Representative surface chunk east of Al Kharid.',
  },
  'Dwarven Mine': {
    kind: 'entrance',
    chunks: [{ cx: 47, cy: 53 }, { cx: 48, cy: 54 }],
    reason: 'Ice Mountain surface entrance to the underground mine.',
  },
  'Asgarnian Ice Dungeon': {
    kind: 'entrance',
    chunks: [{ cx: 47, cy: 49 }],
    reason: 'Surface entrance south of Port Sarim near Mudskipper Point.',
  },
  'Motherlode Mine': {
    kind: 'entrance',
    chunks: [{ cx: 47, cy: 52 }],
    reason: 'Falador access route into the Dwarven Mine and Motherlode Mine.',
  },
  'Mor Ul Rek (TzHaar City)': {
    kind: 'entrance',
    chunks: [{ cx: 44, cy: 49 }],
    reason: 'Karamja Volcano entrance to the underground TzHaar city.',
  },
  'Braindeath Island': {
    kind: 'entrance',
    chunks: [{ cx: 57, cy: 55 }],
    reason: 'Pirate Pete departure point north of Port Phasmatys.',
  },
  'Keldagrim': {
    kind: 'entrance',
    chunks: [{ cx: 42, cy: 57 }],
    reason: 'Surface cave entrance east of Rellekka.',
  },
  'Wilderness God Wars Dungeon': {
    kind: 'entrance',
    chunks: [{ cx: 47, cy: 58 }],
    reason: 'Wilderness surface entrance to the underground dungeon.',
  },
  'Catacombs of Kourend': {
    kind: 'entrance',
    chunks: [{ cx: 25, cy: 57 }],
    reason: 'Statue of King Rada I in the Kourend Castle courtyard.',
  },
  'Zanaris': {
    kind: 'entrance',
    chunks: [{ cx: 50, cy: 49 }],
    reason: 'Lumbridge Swamp shed entrance to Zanaris.',
  },
} as const satisfies Readonly<Record<string, AreaReference>>;

export const INTENTIONALLY_UNMAPPABLE_AREAS = {
  'Tutorial Island': 'A normal account cannot return after leaving the tutorial.',
} as const satisfies Readonly<Record<string, string>>;

export interface CanonicalAreaUnlocks {
  regions: string[];
  duplicateAliasRefunds: number;
  migrated: boolean;
}

export const canonicalAreaName = (name: string): string =>
  Object.hasOwn(AREA_ALIASES, name)
    ? AREA_ALIASES[name as keyof typeof AREA_ALIASES]
    : name;
const DISPLAY_ALIASES_BY_CANONICAL = Object.entries(AREA_ALIAS_POLICIES)
  .reduce<Record<string, string[]>>((groups, [alias, policy]) => {
    if (policy.kind === 'surface-overlap') {
      (groups[policy.canonical] ??= []).push(alias);
    }
    return groups;
  }, {});
export const displayAreaName = (name: string): string => {
  const canonical = canonicalAreaName(name);
  return [canonical, ...(DISPLAY_ALIASES_BY_CANONICAL[canonical] ?? [])].join(' \u00b7 ');
};

export const canonicalizeAreaUnlocks = (
  names: readonly string[],
): CanonicalAreaUnlocks => {
  const seen = new Set<string>();
  const regions: string[] = [];

  for (const name of names) {
    const canonical = canonicalAreaName(name);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    regions.push(canonical);
  }

  const paidByCanonical = new Map<string, Set<string>>();
  for (const name of new Set(names)) {
    const canonical = canonicalAreaName(name);
    const paid = paidByCanonical.get(canonical) ?? new Set<string>();
    paid.add(name);
    paidByCanonical.set(canonical, paid);
  }
  const duplicateAliasRefunds = [...paidByCanonical.values()]
    .reduce((total, paid) => total + Math.max(0, paid.size - 1), 0);
  const migrated = names.length !== regions.length
    || names.some((name, index) => regions[index] !== name);

  return { regions, duplicateAliasRefunds, migrated };
};

/**
 * Resolve duplicate canonical ownership only as far as the current key
 * counter can pay its refunds. Remaining distinct aliases are intentionally
 * retained as invisible save-state credit markers until a later validation
 * has room to settle them.
 */
export interface CanonicalAreaUnlockSettlement extends CanonicalAreaUnlocks {
  pendingAliasCredits: string[];
}

export const settleCanonicalAreaUnlocks = (
  names: readonly string[],
  regularKeyRefundCapacity: number,
): CanonicalAreaUnlockSettlement => {
  const canonical = canonicalizeAreaUnlocks(names);
  const rawNamesByCanonical = new Map<string, string[]>();
  const seenRawNames = new Set<string>();

  for (const name of names) {
    if (seenRawNames.has(name)) continue;
    seenRawNames.add(name);
    const owner = canonicalAreaName(name);
    const rawNames = rawNamesByCanonical.get(owner) ?? [];
    rawNames.push(name);
    rawNamesByCanonical.set(owner, rawNames);
  }

  const credits = canonical.regions.flatMap(owner => {
    const rawNames = rawNamesByCanonical.get(owner) ?? [];
    if (rawNames.length < 2) return [];
    // Prefer the canonical form as the visible unlock. If no canonical form
    // was ever stored, treat the earliest alias as the original payment.
    const paidIdentity = rawNames.includes(owner) ? owner : rawNames[0];
    return rawNames.filter(name => name !== paidIdentity);
  });
  const refunds = Math.min(credits.length, Math.max(0, regularKeyRefundCapacity));
  const pendingAliasCredits = credits.slice(refunds);
  const regions = [...canonical.regions, ...pendingAliasCredits];
  const migrated = names.length !== regions.length
    || names.some((name, index) => regions[index] !== name);

  return {
    regions,
    duplicateAliasRefunds: refunds,
    pendingAliasCredits,
    migrated,
  };
};
