// Generated from data/sources/achievement-diary-tasks.json.
// Run npm run diary:sync; do not hand-edit this map.
export const DIARY_TASK_ID_MIGRATIONS: Readonly<Record<string, string>> = {
};

export const migrateCompletedTaskIds = (
  ids: readonly string[],
  migrations: Readonly<Record<string, string>> = DIARY_TASK_ID_MIGRATIONS,
): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const canonical = migrations[id] ?? id;
    if (!seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  return out;
};
