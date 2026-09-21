import families from '../data/slayerTaskFamilies.json';
import type { EntityHit, EntityLocation, SlayerAssignment } from '../services/ChunkContentService';
import { placeOf } from './chunkLocations';
const normalize = (value: string) => value.toLowerCase().split('#')[0].replace(/\s*task\[\+\]$/i, '').replace(/[^a-z0-9]/g, '');
export interface SlayerLocation { name: string; location: EntityLocation; }
/** Exact reviewed monster families and the assignment's actual location constraint. */
export function locateSlayerTask(task: string, entities: readonly EntityHit[], assignment?: SlayerAssignment, master?: string): SlayerLocation[] {
  const [family, suffix] = task.split(' - ');
  const members: string[] = families.families[family.toLowerCase()] ?? [family.replace(/s$/i, '')];
  const names = new Set(members.map(name => name.toLowerCase()));
  const constraints = suffix ? [suffix] : (assignment?.locations ?? []).filter(value => !value.includes('[+]'));
  const hits: SlayerLocation[] = [];
  for (const entity of entities) {
    if (!names.has(entity.name.toLowerCase())) continue;
    for (const location of entity.locations) {
      const place = placeOf(location.cx, location.cy);
      if (master === 'Krystilia' && place.region !== 'Wilderness') continue;
      if (constraints.length && !constraints.some(constraint => {
        if (/^\d+$/.test(constraint)) return constraint === String(location.cx * 256 + location.cy);
        const value = normalize(constraint);
        return [location.locationName, place.subArea].some(name => name && normalize(name) === value);
      })) continue;
      hits.push({ name: entity.name, location });
    }
  }
  return hits;
}
