const LEGACY = { inventory: 'FATE_RESOURCE_INVENTORY', plan: 'FATE_RESOURCE_PLAN' };
const MIGRATED = 'FATE_RESOURCE_LEGACY_COPIED_TO_RUN';
export const resourcePlanningKey = (kind: keyof typeof LEGACY, runId: string) => `${LEGACY[kind]}:${runId}`;

export function readResourceQuantities(storage: Pick<Storage, 'getItem'>, key: string): Record<string, number> {
  try {
    const value = JSON.parse(storage.getItem(key) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, qty]) =>
      !['__proto__', 'constructor', 'prototype'].includes(key) && typeof qty === 'number' && Number.isFinite(qty) && qty > 0)) as Record<string, number>;
  } catch { return {}; }
}

export function hasLegacyResourcePlanning(storage: Pick<Storage, 'getItem'>): boolean {
  try { return !storage.getItem(MIGRATED) && Object.values(LEGACY).some(key => Object.keys(readResourceQuantities(storage, key)).length > 0); }
  catch { return false; }
}

/** User chooses the destination run; old shared values remain as a backup. */
export function copyLegacyResourcePlanning(storage: Storage, runId: string): boolean {
  if (!hasLegacyResourcePlanning(storage)) return false;
  try {
    for (const kind of ['inventory', 'plan'] as const) {
      const key = resourcePlanningKey(kind, runId);
      const merged = { ...readResourceQuantities(storage, LEGACY[kind]), ...readResourceQuantities(storage, key) };
      const data = JSON.stringify(merged);
      storage.setItem(key, data);
      if (storage.getItem(key) !== data) return false;
    }
    storage.setItem(MIGRATED, runId);
    return true;
  } catch { return false; }
}
