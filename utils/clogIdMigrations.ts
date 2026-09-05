/**
 * Collection-log item-id migrations for saves.
 *
 * When a wiki rename slips past the sync's matcher, the old entry is kept and
 * the new name appended under a fresh id — a duplicate slot players may have
 * ticked under either id. After merging the data back to one entry, this map
 * folds the retired id's progress into the surviving one at save load
 * (utils/saveSchema.ts). Counts merge by MAX, not sum: both ids described
 * the same physical drop, so summing would double-count it.
 */

import migrations from '../data/clogIdMigrations.json';

/** Retired id -> surviving id. Also reserves retired identities in both allocators.
 * Araxxor's July 2026 sac(k) duplicate 104011 folds into original 104002. */
export const CLOG_ID_MIGRATIONS: Record<number, number> = migrations;

export function migrateClogIds(clog: Record<number, number>): Record<number, number> {
  let touched = false;
  const out: Record<number, number> = { ...clog };
  for (const [fromStr, to] of Object.entries(CLOG_ID_MIGRATIONS)) {
    const from = Number(fromStr);
    if (!(from in out)) continue;
    out[to] = Math.max(out[to] ?? 0, out[from]);
    delete out[from];
    touched = true;
  }
  return touched ? out : clog;
}
