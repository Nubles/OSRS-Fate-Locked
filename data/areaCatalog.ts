import records from './areaCatalog.json';
import { AREA_ALIAS_POLICIES } from './areaMapPolicy';

export type AreaId = `area:${string}`;
export interface AreaRecord { readonly id: AreaId; readonly name: string; readonly parentId?: AreaId }

/** IDs are allocated once in the checked-in catalogue. Never derive them from labels or renumber them. */
export function createAreaIndex(rows: readonly AreaRecord[], aliases: Readonly<Record<string, string>> = {}) {
  const byId = new Map<AreaId, AreaRecord>();
  const byName = new Map<string, AreaId>();
  for (const row of rows) {
    if (!/^area:\d{4}$/.test(row.id) || !row.name.trim() || byId.has(row.id) || byName.has(row.name)) {
      throw new Error(`Duplicate or invalid area identity: ${row.id} / ${row.name}`);
    }
    byId.set(row.id, row); byName.set(row.name, row.id);
  }
  for (const row of rows) {
    if (row.parentId && (!byId.has(row.parentId) || byId.get(row.parentId)?.parentId)) {
      throw new Error(`Dangling or nested area parent: ${row.id}`);
    }
  }
  for (const [alias, name] of Object.entries(aliases)) {
    const id = byName.get(name);
    if (!id || byName.has(alias)) throw new Error(`Dangling or duplicate area alias: ${alias}`);
    byName.set(alias, id);
  }
  return {
    byId: byId as ReadonlyMap<AreaId, AreaRecord>,
    resolve: (reference: string): AreaId | undefined => byId.has(reference as AreaId) ? reference as AreaId : byName.get(reference),
  };
}
export const AREA_CATALOG: readonly AreaRecord[] = records as AreaRecord[];
export const AREA_INDEX = createAreaIndex(AREA_CATALOG, Object.fromEntries(
  Object.entries(AREA_ALIAS_POLICIES).map(([alias, policy]) => [alias, policy.canonical]),
));
export const areaId = AREA_INDEX.resolve;
export const areaName = (reference: string): string | undefined => {
  const id = areaId(reference);
  return id ? AREA_INDEX.byId.get(id)?.name : undefined;
};
/** Read legacy saved labels as IDs without rewriting or discarding unknown saved values. */
export const areaUnlockIds = (references: readonly string[]): ReadonlySet<AreaId> => new Set(
  references.map(areaId).filter((id): id is AreaId => id !== undefined),
);
