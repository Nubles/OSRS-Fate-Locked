import type { ChunkCoord } from '../utils/mapCoords';

export const AREA_ALIASES = {
  'Elf Camp': 'Iorwerth Camp',
} as const satisfies Readonly<Record<string, string>>;

export interface AreaReference {
  kind: 'surface' | 'entrance';
  chunks: readonly ChunkCoord[];
  reason: string;
}

export const AREA_REFERENCES = {
  "Heroes' Guild": {
    kind: 'surface',
    chunks: [{ cx: 45, cy: 54 }],
    reason: 'The guild surface lies between Taverley and Burthorpe.',
  },
  'Ice Mountain': {
    kind: 'surface',
    chunks: [{ cx: 46, cy: 54 }],
    reason: 'Representative surface chunk for Ice Mountain.',
  },
  'Ranging Guild': {
    kind: 'surface',
    chunks: [{ cx: 41, cy: 53 }],
    reason: 'The guild surface overlaps the Hemenster map chunk.',
  },
  "Otto's Grotto": {
    kind: 'surface',
    chunks: [{ cx: 39, cy: 54 }],
    reason: 'The grotto surface overlaps Baxtorian Falls.',
  },
  "Giants' Plateau": {
    kind: 'surface',
    chunks: [{ cx: 52, cy: 49 }],
    reason: 'Representative surface chunk east of Al Kharid.',
  },
  'Resource Area': {
    kind: 'surface',
    chunks: [{ cx: 49, cy: 61 }],
    reason: 'The enclosed Wilderness surface overlaps the Mage Arena chunk.',
  },
  'Dwarven Mine': {
    kind: 'entrance',
    chunks: [{ cx: 47, cy: 53 }],
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

export const canonicalizeAreaUnlocks = (
  names: readonly string[],
): CanonicalAreaUnlocks => {
  const input = new Set(names);
  const seen = new Set<string>();
  const regions: string[] = [];

  for (const name of names) {
    const canonical = canonicalAreaName(name);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    regions.push(canonical);
  }

  const duplicateAliasRefunds = Object.entries(AREA_ALIASES)
    .filter(([legacy, canonical]) => input.has(legacy) && input.has(canonical))
    .length;
  const migrated = names.length !== regions.length
    || names.some((name, index) => regions[index] !== name);

  return { regions, duplicateAliasRefunds, migrated };
};
