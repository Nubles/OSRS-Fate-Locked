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

/** retired id -> surviving id */
export const CLOG_ID_MIGRATIONS: Record<number, number> = {
  // "Araxyte venom sac(k)" rename duplicate on the Araxxor page (July 2026):
  // 104011 was minted for the new spelling while 104002 kept the old one.
  104011: 104002,
};

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
