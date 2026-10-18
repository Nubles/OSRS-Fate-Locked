export interface OsrsMapLabel {
  /** The tracked area (or whole region) whose unlock colours the label. */
  area: string;
  /** Shorter text when the area's full name is too long for the map. */
  label?: string;
  /** Game tile [x, y] the label is centred on. */
  tile: [number, number];
}

/** Place names drawn on the OSRS map (the World board's set, plus Kourend and
 *  Varlamore for when the map is panned west). Each sits on the place itself,
 *  given as the game tile at its centre (Varrock's fountain, Burthorpe's
 *  square, ...), the way the game's own world map pins its names. Averaging an
 *  area's chunks drifted off the towns once the map audit gave areas their
 *  in-between chunks: Burthorpe's label sat on Troll Country, Draynor's on
 *  Draynor Manor. data/osrsMapLabels.test.ts keeps each one inside its area. */
export const OSRS_MAP_LABELS: readonly OsrsMapLabel[] = [
  { area: 'Lumbridge', tile: [3222, 3225] }, { area: 'Varrock', tile: [3213, 3430] },
  { area: 'Falador', tile: [2975, 3368] }, { area: 'Taverley', tile: [2895, 3445] },
  { area: "Seers' Village", tile: [2722, 3484] }, { area: 'Burthorpe', tile: [2900, 3544] },
  { area: 'Barrows', tile: [3565, 3290] },
  { area: 'Mort Myre Swamp', label: 'Mort Myre', tile: [3440, 3385] }, { area: 'Edgeville', tile: [3093, 3493] },
  { area: 'Draynor Village', label: 'Draynor', tile: [3093, 3248] },
  { area: 'Karamja', tile: [2850, 3080] }, { area: 'Wilderness', tile: [3170, 3760] },
  { area: 'Hosidius', tile: [1750, 3590] }, { area: 'Arceuus', tile: [1670, 3765] },
  { area: 'Civitas illa Fortis', tile: [1690, 3110] },
];
