/**
 * The world map's chunk authoring tool repaints the shipped region data, so
 * it is for maintainers, not players: it shows in the dev server, or in a
 * deployed build once this browser opts in with
 * `localStorage.setItem('fate-map-authoring', '1')`.
 */
export const MAP_AUTHORING_FLAG = 'fate-map-authoring';

export function mapAuthoringAvailable(
  dev: boolean = import.meta.env.DEV,
  storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage,
): boolean {
  if (dev) return true;
  try {
    return storage?.getItem(MAP_AUTHORING_FLAG) === '1';
  } catch {
    return false;
  }
}
