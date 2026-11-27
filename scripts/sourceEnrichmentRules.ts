// Pure lookup rules for scripts/buildSourceEnrichment.ts, kept apart from the
// generator (which fetches the Wiki when it runs) so they can be unit tested.

// Wiki Leagues region -> app region group.
export const REGION_MAP: Record<string, string> = {
  Misthalin: 'Misthalin', Karamja: 'Karamja', Asgarnia: 'Asgarnia',
  Kandarin: 'Kandarin', Fremennik: 'Fremennik', Tirannwn: 'Tirannwn',
  Morytania: 'Morytania', Wilderness: 'Wilderness', Varlamore: 'Varlamore',
  Kourend: 'Kourend & Kebos', Desert: 'Kharidian Desert',
};

const REGION_BY_LOWER = new Map(Object.entries(REGION_MAP).map(([k, v]) => [k.toLowerCase(), v]));

/**
 * App regions for a Wiki 'League region' value; empty when none maps. The
 * Wiki writes these in any case and as lists ('asgarnia,wilderness'), with
 * '&' joining regions a source needs together; every named region is kept.
 * 'General', 'No' and 'n/a' name no region and are skipped.
 */
export const leagueRegions = (raw: unknown): string[] => {
  if (typeof raw !== 'string') return [];
  const out: string[] = [];
  for (const part of raw.split(/[,&]/)) {
    const mapped = REGION_BY_LOWER.get(part.trim().toLowerCase());
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
};

// Activity-rewards drop sources whose bare names don't match a boss/minigame
// list entry. Without these the lock analysis treated their drops as
// unconditionally available (e.g. Twisted Bow's "Ancient Chest" source had
// no unlockId, so the engine showed it unlockable from a fresh state).
export const UNLOCK_ALIAS: Record<string, string> = {
  barrows: 'Barrows Brothers',
  "barrows chest": 'Barrows Brothers',
  'dagannoth kings': 'Dagannoth Kings',
  // Chambers of Xeric
  'ancient chest': 'Chambers of Xeric',
  'great olm': 'Chambers of Xeric',
  // Theatre of Blood reward chest ('ToB chest' on the Wiki)
  'monumental chest': 'Theatre of Blood',
  // Wintertodt: reward cart pulls, and the crates Ignisia exchanges
  'reward cart': 'Wintertodt',
  'extra supply crate': 'Wintertodt',
  // Hallowed Sepulchre — the "Coffin (...)" naming is caught by the paren
  // rule below, but the standalone "Grand Hallowed Coffin" / "Casket" need
  // an explicit alias.
  'grand hallowed coffin': 'Hallowed Sepulchre',
  // Theatre of Blood — final-boss / chamber-chest names that aren't in
  // BOSSES_LIST/MINIGAMES_LIST as such.
  'verzik vitur': 'Theatre of Blood',
  'pestilent bloat': 'Theatre of Blood',
  'sotetseg': 'Theatre of Blood',
  'xarpus': 'Theatre of Blood',
  'nylocas vasilias': 'Theatre of Blood',
  'maiden of sugadinti': 'Theatre of Blood',
  // ToA per-room bosses (Wardens (...) is paren-rule, but bare names need this)
  'akkha': 'Tombs of Amascut',
  'ba-ba': 'Tombs of Amascut',
  'kephri': 'Tombs of Amascut',
  'zebak': 'Tombs of Amascut',
};
