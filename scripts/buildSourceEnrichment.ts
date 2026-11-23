// One-off authoring tool: enriches existing RESOURCE_MAP items with SHOP and
// DROP sources pulled from the OSRS Wiki `storeline` and `dropsline` buckets.
// Writes data/resourceEnrichment.ts, which resourceData.ts merges at load.
//
// Run:  node_modules/.bin/jiti scripts/buildSourceEnrichment.ts
//
// Inputs: the Wiki buckets storeline, dropsline, infobox_monster and
// infobox_shop, fetched from the Wiki API with curl. To run from saved copies
// instead, set WIKI_BUCKET_DIR to a folder holding <bucket>.json files (each a
// JSON array of the bucket's rows with the fields selected below); a missing
// file is fetched. The pure rules live in scripts/sourceEnrichmentRules.ts.
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { RESOURCE_MAP, resourceUnlockDependency } from '../data/resourceData';
import { BOSSES_LIST, MINIGAMES_LIST, REGION_GROUPS, MISTHALIN_AREAS } from '../data/items';
import { ACTIVITY_REGIONS } from '../data/activityRegions';
import { REGION_CHUNKS } from '../data/regionChunks';
import chunkDoc from '../public/chunk-content.json';
import {
  buildPlaceIndex, curatedRows, isClueSource, isQuestRewardSource, isSkillingSource, leagueRegions,
  buildShopRegions, makeUnlockResolver, pickDrops, placePairs, shopKey, shopRegionOverride,
  type WikiDrop,
} from './sourceEnrichmentRules';

// Chunk-truth: monster (lowercased) -> regions the chunk dataset proves it in.
// data/resourceChunkTruth.test.ts enforces that every proven region is listed
// on the emitted DROP source, so union them in here at generation time.
const provenRegions: Map<string, Set<string>> = (() => {
  const chunkRegion: Record<string, string> = {};
  for (const [region, chunks] of Object.entries(REGION_CHUNKS)) {
    for (const c of chunks as { cx: number; cy: number }[]) chunkRegion[`${c.cx},${c.cy}`] = region;
  }
  const truth = new Map<string, Set<string>>();
  for (const [id, e] of Object.entries<any>((chunkDoc as any).chunks)) {
    const region = chunkRegion[`${Math.floor(+id / 256)},${+id % 256}`];
    if (!region) continue;
    for (const [name] of e.m ?? []) {
      const k = (name as string).toLowerCase();
      if (!truth.has(k)) truth.set(k, new Set());
      truth.get(k)!.add(region);
    }
  }
  return truth;
})();

/** Mirrors resourceChunkTruth.test.ts's covers(): is region r already implied? */
const coversRegion = (listed: string[], r: string): boolean => {
  if (listed.includes('Any') || listed.includes(r)) return true;
  const children = r === 'Misthalin' ? MISTHALIN_AREAS : (REGION_GROUPS as Record<string, string[]>)[r];
  return !!children && listed.some((l) => children.includes(l));
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const API = 'https://oldschool.runescape.wiki/api.php';

/** Fetch every row of a bucket, paginating past the 5000-row query cap. */
const fetchAll = (table: string, fields: string[]): any[] => {
  const saved = process.env.WIKI_BUCKET_DIR && join(process.env.WIKI_BUCKET_DIR, `${table}.json`);
  if (saved && existsSync(saved)) return JSON.parse(readFileSync(saved, 'utf8'));
  const rows: any[] = [];
  for (let offset = 0; ; offset += 5000) {
    const query = `bucket('${table}').select(${fields.map((f) => `'${f}'`).join(',')}).limit(5000).offset(${offset}).run()`;
    const url = `${API}?action=bucket&format=json&query=${encodeURIComponent(query)}`;
    const body = execFileSync('curl', ['-s', '-A', UA, url], { encoding: 'utf8', maxBuffer: 1e8 });
    const json = JSON.parse(body);
    if (!json.bucket) throw new Error(`${table}: ${body.slice(0, 200)}`);
    rows.push(...json.bucket);
    if (json.bucket.length < 5000) break;
  }
  return rows;
};

// --- name helpers -----------------------------------------------------------
const CONNECTORS = new Set(['of', 'the', 'a', 'an', 'and', 'to', 'on', 'from']);
const toAppCase = (raw: string) =>
  raw.trim().replace(/\.$/, '').split(' ').map((w, i) => {
    const lower = w.toLowerCase();
    if (i > 0 && CONNECTORS.has(lower)) return lower;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');

// --- gather wiki data -------------------------------------------------------
console.log('Fetching storeline…');
const storeRows = fetchAll('storeline', ['sold_item', 'sold_by', 'store_currency']);
console.log(`  ${storeRows.length} store rows`);
console.log('Fetching dropsline…');
const dropRows = fetchAll('dropsline', ['item_name', 'drop_json']);
console.log(`  ${dropRows.length} drop rows`);
console.log('Fetching infobox_monster…');
const monsterRows = fetchAll('infobox_monster', ['name', 'league_region']);
console.log(`  ${monsterRows.length} monster rows`);
console.log('Fetching infobox_shop…');
const shopRows = fetchAll('infobox_shop', ['page_name', 'location']);
console.log(`  ${shopRows.length} shop rows`);

// place name (e.g. "Varrock", "Dwarven Mine") -> app region. Built from
// REGION_GROUPS and MISTHALIN_AREAS, then the guilds and activities of
// ACTIVITY_REGIONS (e.g. "Wizards' Guild"), so any shop located in a known
// place can be region-tagged automatically.
const placeToRegion = buildPlaceIndex(placePairs(REGION_GROUPS as Record<string, string[]>, [
  ...MISTHALIN_AREAS.map((p) => [p, 'Misthalin'] as const),
  ...Object.entries(ACTIVITY_REGIONS),
]));

// monster name (lowercased) -> app region from the wiki's infobox_monster
// `league_region`, used when a drop's own League region was empty.
const monsterRegion = new Map<string, string[]>();
for (const r of monsterRows) {
  if (!r.name || !r.league_region) continue;
  const mapped = leagueRegions(r.league_region);
  if (mapped.length) monsterRegion.set(r.name.toLowerCase(), mapped);
}

// shop (shopKey of its page name) -> app regions from infobox_shop.location.
const shopRegion = buildShopRegions(shopRows, placeToRegion);

// item (lowercase) -> shops
const itemShops = new Map<string, { shop: string; currency: string }[]>();
for (const r of storeRows) {
  if (!r.sold_item || !r.sold_by) continue;
  const key = r.sold_item.toLowerCase();
  if (!itemShops.has(key)) itemShops.set(key, []);
  const shop = toAppCase(r.sold_by).replace(/\s*\(shop\)$/i, '');
  itemShops.get(key)!.push({ shop, currency: r.store_currency || 'Coins' });
}

// item (lowercase) -> drops
const itemDrops = new Map<string, WikiDrop[]>();
for (const r of dropRows) {
  if (!r.item_name || !r.drop_json) continue;
  let dj: any;
  try { dj = JSON.parse(r.drop_json); } catch { continue; }
  const from = dj['Dropped from'];
  if (typeof from !== 'string' || !from) continue;
  // Strip wiki page anchors / sub-pages: "Lundail#Easy Diary" -> "Lundail".
  const cleaned = toAppCase(from.split('#')[0].split('/')[0]);
  // Skilling tables are SKILL sources; one-time quest rewards are no source.
  if (!cleaned || isSkillingSource(cleaned, dj['Drop type']) || isQuestRewardSource(cleaned)) continue;
  const key = r.item_name.toLowerCase();
  if (!itemDrops.has(key)) itemDrops.set(key, []);
  itemDrops.get(key)!.push({
    monster: cleaned,
    regions: leagueRegions(dj['League region']),
    rarity: String(dj['Rarity'] || '').trim(),
    isClue: isClueSource(cleaned),
  });
}

// --- unlock resolution ------------------------------------------------------
// Maps a drop-source name to a boss/minigame unlock id so the lock analysis
// can gate enriched drops on whether the player has that unlock.
const resolveUnlock = makeUnlockResolver([...BOSSES_LIST, ...MINIGAMES_LIST]);
// Activities a row belongs to but the app cannot gate yet, because
// data/resourceData.ts RESOURCE_UNLOCK_TABLES has no gacha table for them.
const untypedUnlocks = new Set<string>();

// --- build enrichment -------------------------------------------------------
const lowerToKey = new Map<string, string>();
for (const key of Object.keys(RESOURCE_MAP)) lowerToKey.set(key.toLowerCase(), key);

const enrichment: Record<string, any[]> = {};
let shopCount = 0;
let dropCount = 0;

for (const [lower, key] of lowerToKey) {
  // resourceData merges ENRICHED_SOURCES into RESOURCE_MAP at load (also
  // under an item's old name), so dedup against the curated sources only.
  const existing = curatedRows(RESOURCE_MAP[key]);
  const haveShop = new Set(existing.filter((s) => s.type === 'SHOP' || s.type === 'MERCHANT').map((s) => s.name.toLowerCase()));
  const haveDrop = new Set(existing.filter((s) => s.type === 'DROP').map((s) => s.name.toLowerCase()));
  const added: any[] = [];

  // SHOP sources (max 3 new)
  const shops = itemShops.get(lower) || [];
  const seenShop = new Set<string>();
  for (const { shop, currency } of shops) {
    const sl = shop.toLowerCase();
    if (haveShop.has(sl) || seenShop.has(sl)) continue;
    seenShop.add(sl);
    if ([...seenShop].length > 3) break;
    const override = shopRegionOverride(shop);
    const regions = override ? [override] : [...(shopRegion.get(shopKey(shop)) ?? ['Any'])];
    const src: any = { type: 'SHOP', name: shop, regions };
    if (currency && currency !== 'Coins') src.notes = `Bought with ${currency}`;
    added.push(src);
    shopCount++;
  }

  // DROP sources (max 6 new, one per monster and activity, commonest first)
  const picked = pickDrops(itemDrops.get(lower) || [], haveDrop, resolveUnlock);
  for (const d of picked) {
    // If the drop's own League region names no region, fall back to the
    // monster's infobox_monster league_region.
    let regions = d.regions;
    if (!regions.length) regions = monsterRegion.get(d.monster.toLowerCase()) ?? ['Any'];
    const src: any = { type: d.isClue ? 'CLUE' : 'DROP', name: d.monster, regions: [...regions] };
    const unlock = d.isClue ? undefined : resolveUnlock(d.monster);
    if (unlock) {
      // Only an unlock the app can type (RESOURCE_UNLOCK_TABLES) is written;
      // an untyped one would fail its provenance guard.
      if (resourceUnlockDependency({ unlockId: unlock })) src.unlockId = unlock;
      else untypedUnlocks.add(unlock);
      // Use the activity's authoritative region when known so the source
      // stays consistent with ACTIVITY_REGIONS.
      if (ACTIVITY_REGIONS[unlock]) src.regions = [ACTIVITY_REGIONS[unlock]];
    }
    // Union in every chunk-proven region the listed ones don't already cover.
    const proven = provenRegions.get(d.monster.toLowerCase());
    if (proven) {
      for (const r of proven) {
        if (!coversRegion(src.regions, r)) src.regions.push(r);
      }
    }
    if (d.rarity && !/^varies$/i.test(d.rarity)) src.rarity = d.rarity;
    added.push(src);
    dropCount++;
  }

  if (added.length) enrichment[key] = added;
}

// --- emit data/resourceEnrichment.ts ----------------------------------------
const esc = (s: string) => s.replace(/'/g, "\\'");
const fmt = (s: any) => {
  const parts = [`type: '${s.type}'`, `name: '${esc(s.name)}'`, `regions: [${s.regions.map((r: string) => `'${esc(r)}'`).join(', ')}]`];
  if (s.unlockId) parts.push(`unlockId: '${esc(s.unlockId)}'`);
  if (s.rarity) parts.push(`rarity: '${esc(s.rarity)}'`);
  if (s.notes) parts.push(`notes: '${esc(s.notes)}'`);
  return `{ ${parts.join(', ')} }`;
};

let out =
  `// AUTO-GENERATED by scripts/buildSourceEnrichment.ts — do not edit by hand.\n` +
  `// Additional SHOP/DROP sources sourced from the OSRS Wiki, merged into\n` +
  `// RESOURCE_MAP at load time by resourceData.ts.\n` +
  `import type { ResourceSource } from './resourceData';\n\n` +
  `export const ENRICHED_SOURCES: Record<string, ResourceSource[]> = {\n`;
for (const key of Object.keys(enrichment).sort()) {
  out += `  '${esc(key)}': [\n`;
  out += enrichment[key].map((s) => `    ${fmt(s)}`).join(',\n') + '\n';
  out += `  ],\n`;
}
out += `};\n`;

writeFileSync(new URL('../data/resourceEnrichment.ts', import.meta.url), out);
console.log(`Wrote data/resourceEnrichment.ts: ${Object.keys(enrichment).length} items enriched (+${shopCount} shops, +${dropCount} drops).`);
if (untypedUnlocks.size) {
  console.warn(`Rows left without an unlock (add each to RESOURCE_UNLOCK_TABLES in data/resourceData.ts, then re-run): ${[...untypedUnlocks].sort().join(', ')}`);
}
