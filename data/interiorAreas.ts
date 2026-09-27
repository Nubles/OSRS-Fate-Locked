/**
 * Which rolled area an interior belongs to. An interior needs its area even
 * when the run owns the chunk its entrance is in: Keldagrim, Mor Ul Rek and
 * Zanaris have no surface of their own, and their entrance chunks lead to
 * other places too.
 */
import { canonicalAreaName } from './areaMapPolicy';
import { REGIONS_LIST } from './items';

/**
 * Interiors inside an area that have names of their own. Every other
 * interior belongs to the area its name names, if any.
 */
export const INTERIOR_AREA_OWNERS: Readonly<Record<string, string>> = {
  // The source exports these separately, but they are inside Keldagrim
  // (see the reviewed bank registry for the Blast Furnace).
  'Blast Furnace': 'Keldagrim',
  'Keldagrim Rat Pits': 'Keldagrim',
  // The TzHaar city's sections, and the Inferno within it.
  'Mor Ul Rek': 'Mor Ul Rek (TzHaar City)',
  'Inferno': 'Mor Ul Rek (TzHaar City)',
  'Prifddinas Library': 'Prifddinas',
  'Cosmic altar': 'Zanaris',
};

/**
 * The rolled area an interior belongs to, or undefined when it belongs to
 * none. A "#Section" suffix names a part of the same place.
 */
export function interiorArea(name: string): string | undefined {
  const base = name.split('#')[0].trim();
  const area = canonicalAreaName(INTERIOR_AREA_OWNERS[base] ?? base);
  return REGIONS_LIST.includes(area) ? area : undefined;
}
