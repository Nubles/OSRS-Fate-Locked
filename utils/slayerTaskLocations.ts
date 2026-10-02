import families from '../data/slayerTaskFamilies.json';
import type { EntityHit, EntityLocation, SlayerAssignment } from '../services/ChunkContentService';
import { placeOf } from './chunkLocations';
const normalize = (value: string) => value.toLowerCase().split('#')[0].replace(/\s*task\[\+\]$/i, '').replace(/[^a-z0-9]/g, '');
/** Konar's places that the map's interiors name differently (accuracy audit S-8). */
const PLACE_ALIASES: Readonly<Record<string, string>> = {
  abyss: 'abyssalarea',
  mournertunnels: 'mournertunnelstempleoflight',
};
export interface SlayerLocation { name: string; location: EntityLocation; }
/** Exact reviewed monster families and the assignment's actual location constraint. */
export function locateSlayerTask(task: string, entities: readonly EntityHit[], assignment?: SlayerAssignment, master?: string): SlayerLocation[] {
  const [family, suffix] = task.split(' - ');
  // A boss task counts the monsters of each boss the master may pick.
  const members: string[] = assignment?.bosses?.flatMap(boss => boss.monsters)
    ?? families.families[family.toLowerCase()]
    ?? [family.replace(/s$/i, '')];
  const names = new Set(members.map(name => name.toLowerCase()));
  // Konar names the place in the task; her row's own locations count too.
  const constraints = [
    ...(suffix ? [suffix] : []),
    ...(assignment?.locations ?? []).filter(value => !value.includes('[+]')),
  ];
  const hits: SlayerLocation[] = [];
  for (const entity of entities) {
    if (!names.has(entity.name.toLowerCase())) continue;
    for (const location of entity.locations) {
      const place = placeOf(location.cx, location.cy);
      // Krystilia assigns only in the Wilderness: on Wilderness land, or a dungeon's Wilderness part,
      // such as the Edgeville Dungeon's, whose entrances are in Misthalin.
      if (master === 'Krystilia' && place.region !== 'Wilderness' && !/#wilderness$/i.test(location.locationName ?? '')) continue;
      if (constraints.length && !constraints.some(constraint => {
        if (/^\d+$/.test(constraint)) return constraint === String(location.cx * 256 + location.cy);
        const value = PLACE_ALIASES[normalize(constraint)] ?? normalize(constraint);
        return [location.locationName, place.subArea].some(name => name && normalize(name) === value);
      })) continue;
      hits.push({ name: entity.name, location });
    }
  }
  return hits;
}
