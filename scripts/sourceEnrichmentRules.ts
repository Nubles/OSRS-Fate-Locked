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
  // Hallowed Sepulchre: the "Coffin (...)" naming is caught by the paren
  // rule, but the standalone "Grand Hallowed Coffin" needs an alias, and so
  // do hallowed sacks (bought with Hallowed marks, they hold coffin loot).
  'grand hallowed coffin': 'Hallowed Sepulchre',
  'hallowed sack': 'Hallowed Sepulchre',
  // Tempoross: the reward pool is fished with the permits it gives, and its
  // caskets come from that pool.
  'reward pool': 'Tempoross',
  'casket (reward pool)': 'Tempoross',
  // Reward tokens come from guiding a follower on Temple Trekking (or the
  // Burgh de Rott Ramble route of the same minigame).
  'reward token': 'Temple Trekking',
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

// --- drop rarity ------------------------------------------------------------
// Chance per kill for the Wiki's rarity words. The Wiki colours a drop common
// down to 1/25, uncommon to 1/99, rare to 1/999 and very rare below that; each
// word sits inside its band. 'Varies' is not a chance: the Wiki uses it for
// point-based activity rewards (Wintertodt's Reward Cart, Fishing Trawler,
// Hunters' loot sacks), which give the item every time in an amount that
// depends on points, so it ranks just after 'Always', ahead of 1/3.
const RARITY_WORDS: Record<string, number> = {
  always: 1, varies: 1 / 2, common: 1 / 16, uncommon: 1 / 64, rare: 1 / 512, 'very rare': 1 / 5000,
};

/**
 * Sort key for a Wiki drop rarity: lower is more common. A fraction is read
 * whole ('21/128' is 21 in 128, '1/1,000' is 1 in 1000); anything unreadable
 * ('Unknown', 'Once') sorts after every real chance.
 */
export const rarityRank = (raw: string): number => {
  const l = raw.trim().toLowerCase();
  const word = RARITY_WORDS[l];
  if (word !== undefined) return 1 - word;
  const m = l.match(/^~?\s*([\d.,]+)\s*\/\s*([\d.,]+)$/);
  if (m) {
    const num = Number(m[1].replace(/,/g, ''));
    const den = Number(m[2].replace(/,/g, ''));
    if (num > 0 && den > 0) return 1 - Math.min(1, num / den);
  }
  return 2;
};

// --- which Wiki drop rows to use --------------------------------------------
// Skilling "drop tables" (mining rocks, trees and so on): the engine already
// covers these as SKILL sources. Only a row the Wiki does not call a combat
// drop is skilling, so monsters such as Tree spirit or Rock Crab still count.
const SKILLING_SOURCE = /\b(rocks?|trees?|bushes?|patch|vein|deposit|spawn|ore)\b/i;
export const isSkillingSource = (source: string, dropType: unknown): boolean =>
  dropType !== 'combat' && SKILLING_SOURCE.test(source);

/** Treasure Trail reward caskets and clue scrolls; other caskets are not clues. */
export const isClueSource = (source: string): boolean => /^(reward casket|clue scroll)\b/i.test(source);

/**
 * Wiki "drop" sources that are one-time quest rewards, not a place to get
 * more: the generator leaves them out.
 */
export const isQuestRewardSource = (source: string): boolean => /^casket \(pirate's treasure\)$/i.test(source);

/**
 * The hand-written rows of a RESOURCE_MAP entry. resourceData.ts merges the
 * Wiki rows in at load and marks each requirementsUnverified, so that flag
 * (not the length of today's ENRICHED_SOURCES entry, which misses rows
 * merged in under an item's old name) tells the two apart.
 */
export const curatedRows = <T extends { requirementsUnverified?: boolean }>(merged: readonly T[]): T[] =>
  merged.filter((s) => !s.requirementsUnverified);

// --- unlocks ----------------------------------------------------------------
// The Shade Catacombs chests of Shades of Mort'ton: "Steel Chest (red)" etc.
const SHADES_CHEST = /^(bronze|steel|black|silver|gold) chest \((black|brown|crimson|purple|red)\)$/i;

/**
 * Resolver from a Wiki drop-source name to a boss or minigame unlock id, for
 * the given unlock names (BOSSES_LIST and MINIGAMES_LIST).
 */
export const makeUnlockResolver = (unlockNames: readonly string[]) => {
  const byName = new Map<string, string>();
  for (const u of unlockNames) byName.set(u.toLowerCase(), u);
  return (name: string): string | undefined => {
    const l = name.toLowerCase();
    if (byName.has(l)) return byName.get(l);
    if (UNLOCK_ALIAS[l]) return UNLOCK_ALIAS[l];
    if (SHADES_CHEST.test(name) && byName.has("shades of mort'ton")) return byName.get("shades of mort'ton");
    // Reward-chest style names, e.g. "Rewards Chest (Fortis Colosseum)".
    const paren = name.match(/\(([^)]+)\)/);
    if (paren && byName.has(paren[1].toLowerCase())) return byName.get(paren[1].toLowerCase());
    return undefined;
  };
};

// --- shop regions -----------------------------------------------------------
// Region overrides for shops whose infobox location names no known place.
// Keys are the Wiki's seller names (storeline sold_by), matched in any case.
export const SHOP_REGION: Record<string, string> = {
  'Lletya Seamstress': 'Tirannwn',
  "Lliann's Wares": 'Tirannwn',
  "TzHaar-Hur-Lek's Ore and Gem Store": 'Karamja',
  "TzHaar-Hur-Tel's Equipment Store": 'Karamja',
  "TzHaar-Mej-Roh's Rune Store": 'Karamja',
  'Mistrock Mining Supplies': 'Varlamore',
  "Daga's Scimitar Smithy": 'Islands & Others',
};
const SHOP_REGION_LOWER = new Map(Object.entries(SHOP_REGION).map(([k, v]) => [k.toLowerCase(), v]));
export const shopRegionOverride = (shop: string): string | undefined => SHOP_REGION_LOWER.get(shop.toLowerCase());

/**
 * Key that matches an infobox_shop page to a storeline seller: the page
 * 'Oziach (shop)' sells as 'Oziach', and some pages end in a full stop.
 */
export const shopKey = (name: string): string =>
  name.trim().replace(/\.$/, '').replace(/\s*\(shop\)$/i, '').toLowerCase();

/**
 * Wiki NPC location of sellers that have no infobox_shop page (they sell from
 * their own NPC page), resolved through the place index like a shop location.
 */
export const SELLER_LOCATION: Record<string, string> = {
  Trufitus: '[[Tai Bwo Wannai]]',
  'Grandpa Jack': '[[Hemenster]]',
  'Mawnis Burowgar': '[[Neitiznot]]',
  'Franklin Caranos': '[[Piscatoris Fishing Colony]]',
  Selim: '[[Al Kharid]]',
  'Fritz the Glassblower': '[[Entrana]]',
};

// Wiki location spellings of a place REGION_GROUPS already lists: each takes
// that place's region.
export const PLACE_ALIAS: Record<string, string> = {
  'Grand Tree': 'Tree Gnome Stronghold',
  'Port Piscarilius': 'Piscarilius',
  'Dwarven Mines': 'Dwarven Mine',
  Miscellania: 'Miscellania & Etceteria',
  Etceteria: 'Miscellania & Etceteria',
  'Draynor Manor': 'Draynor Village',
};

// Shop locations REGION_GROUPS does not list, with the region from the place's
// Wiki leagueRegion (checked 23 Nov 2026).
export const PLACE_REGION: Record<string, string> = {
  'Ice Mountain': 'Asgarnia',
  'South Falador Farm': 'Asgarnia',
  'White Wolf Mountain': 'Asgarnia',
  "Gu'Tanoth": 'Kandarin',
  'Combat Training Camp': 'Kandarin',
  'Outer Fortis': 'Varlamore',
  'Tal Teklan': 'Varlamore',
};

/**
 * [place, region] pairs for buildPlaceIndex: every REGION_GROUPS place, then
 * `more` (other areas, guilds and activities), then PLACE_REGION, the
 * PLACE_ALIAS spellings and each region's own name ('[[Karamja]]'). An alias
 * whose place is missing throws, so a renamed place cannot go unnoticed.
 */
export const placePairs = (
  regionGroups: Record<string, readonly string[]>, more: Iterable<readonly [string, string]>,
): [string, string][] => {
  const pairs: [string, string][] = [
    ...Object.entries(regionGroups).flatMap(([region, ps]) => ps.map((p) => [p, region] as [string, string])),
    ...[...more].map(([p, r]) => [p, r] as [string, string]),
    ...Object.entries(PLACE_REGION),
  ];
  const regionOf = new Map<string, string>();
  for (const [p, r] of pairs) if (!regionOf.has(p.toLowerCase())) regionOf.set(p.toLowerCase(), r);
  for (const [alias, place] of Object.entries(PLACE_ALIAS)) {
    const region = regionOf.get(place.toLowerCase());
    if (!region) throw new Error(`PLACE_ALIAS '${alias}' names '${place}', which is not a known place`);
    pairs.push([alias, region]);
  }
  for (const region of new Set(pairs.map(([, r]) => r))) pairs.push([region, region]);
  return pairs;
};

/**
 * Place index (lower-case place -> app region) from [place, region] pairs;
 * the first pair for a place wins. A place written with a note in brackets
 * ('Mor Ul Rek (TzHaar City)') is also found without it.
 */
export const buildPlaceIndex = (pairs: Iterable<readonly [string, string]>): Map<string, string> => {
  const index = new Map<string, string>();
  const add = (p: string, region: string) => { if (p && !index.has(p)) index.set(p, region); };
  for (const [place, region] of pairs) {
    const l = place.trim().toLowerCase();
    add(l, region);
    add(l.replace(/\s*\([^)]*\)$/, ''), region);
  }
  return index;
};

/**
 * App region of a Wiki infobox_shop location such as "[[Blast Furnace]] in
 * [[Keldagrim]]" or "[[Shilo Village (location)|Shilo Village]]". Every link
 * is tried, by its target (without a bracketed note) and its shown text;
 * failing that, a link that starts with a known place ("[[Lumbridge Castle]]").
 */
export const shopLocationRegion = (location: string, places: ReadonlyMap<string, string>): string | undefined => {
  const names: string[] = [];
  for (const m of location.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    const target = m[1].trim().toLowerCase();
    names.push(target, target.replace(/\s*\([^)]*\)$/, ''));
    if (m[2]) names.push(m[2].trim().toLowerCase());
  }
  for (const n of names) if (places.has(n)) return places.get(n);
  for (const n of names) {
    let best: string | undefined;
    for (const place of places.keys()) {
      if (n.startsWith(`${place} `) && (!best || place.length > best.length)) best = place;
    }
    if (best) return places.get(best);
  }
  return undefined;
};

/**
 * Shop (shopKey of its infobox_shop page) -> app regions of its locations. A
 * shop the Wiki lists at several places (Slayer Rewards, Forestry Shop) gets
 * each place's region, in the Wiki's order; a seller with no shop page is
 * placed by SELLER_LOCATION.
 */
export const buildShopRegions = (
  rows: readonly { page_name?: unknown; location?: unknown }[], places: ReadonlyMap<string, string>,
): Map<string, string[]> => {
  const out = new Map<string, string[]>();
  const fromRows = new Set(rows.filter((r) => r.page_name).map((r) => shopKey(String(r.page_name))));
  const sellers = Object.entries(SELLER_LOCATION)
    .filter(([name]) => !fromRows.has(shopKey(name)))
    .map(([page_name, location]) => ({ page_name, location }));
  for (const r of [...rows, ...sellers]) {
    if (!r.page_name || !r.location) continue;
    const region = shopLocationRegion(String(r.location), places);
    if (!region) continue;
    const key = shopKey(String(r.page_name));
    const list = out.get(key) ?? [];
    if (!list.includes(region)) list.push(region);
    out.set(key, list);
  }
  return out;
};

// --- picking drop rows ------------------------------------------------------
export type WikiDrop = { monster: string; regions: string[]; rarity: string; isClue: boolean };

/**
 * The Wiki drop rows the generator adds for one item: the commonest row of
 * each source, leaving out sources a hand-written row already names
 * (`have`, lower case), at most one source per activity (the Shade
 * Catacombs' ten chests are one Shades of Mort'ton source), commonest first,
 * at most `cap` of them.
 */
export const pickDrops = (
  drops: readonly WikiDrop[], have: ReadonlySet<string>,
  unlockOf: (name: string) => string | undefined, cap = 6,
): WikiDrop[] => {
  const byMonster = new Map<string, WikiDrop>();
  for (const d of drops) {
    const ml = d.monster.toLowerCase();
    const cur = byMonster.get(ml);
    if (!cur || rarityRank(d.rarity) < rarityRank(cur.rarity)) byMonster.set(ml, d);
  }
  const sorted = [...byMonster.values()]
    .filter((d) => !have.has(d.monster.toLowerCase()))
    .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity));
  const seenActivity = new Set<string>();
  const out: WikiDrop[] = [];
  for (const d of sorted) {
    const activity = d.isClue ? undefined : unlockOf(d.monster);
    if (activity) {
      if (seenActivity.has(activity)) continue;
      seenActivity.add(activity);
    }
    out.push(d);
    if (out.length >= cap) break;
  }
  return out;
};
