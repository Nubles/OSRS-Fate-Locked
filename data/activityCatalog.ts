import identities from './activityCatalog.json';

export type ActivityId = `activity:${string}`;
export interface ActivityRecord { readonly id: ActivityId; readonly name: string }
export function createActivityIndex(rows: readonly ActivityRecord[]) {
  const byId = new Map<ActivityId, ActivityRecord>();
  const byName = new Map<string, ActivityId>();
  for (const row of rows) {
    if (!/^activity:\d{4}$/.test(row.id) || !row.name.trim() || byId.has(row.id) || byName.has(row.name)) throw new Error(`Invalid activity identity: ${row.id}`);
    byId.set(row.id, row); byName.set(row.name, row.id);
  }
  return { byId: byId as ReadonlyMap<ActivityId, ActivityRecord>, resolve: (reference: string): ActivityId | undefined => byId.has(reference as ActivityId) ? reference as ActivityId : byName.get(reference) };
}
export const ACTIVITY_CATALOG = identities as readonly ActivityRecord[];
export const ACTIVITY_INDEX = createActivityIndex(ACTIVITY_CATALOG);
export const activityId = ACTIVITY_INDEX.resolve;
export function activityName(reference: string): string | undefined {
  const id = activityId(reference);
  return id ? ACTIVITY_INDEX.byId.get(id)?.name : undefined;
}
/** Convert authored source keys once; missing identity is a content error, never a permissive gate. */
export function indexActivityRecords<T>(source: Readonly<Record<string, T>>): ReadonlyMap<ActivityId, T> {
  const result = new Map<ActivityId, T>();
  for (const [name, value] of Object.entries(source)) {
    const id = activityId(name);
    if (!id || result.has(id)) throw new Error(`Dangling or duplicate activity reference: ${name}`);
    result.set(id, value);
  }
  return result;
}
