// One-off authoring tool: enriches existing RESOURCE_MAP items with SHOP and
// DROP sources pulled from the OSRS Wiki `storeline` and `dropsline` buckets.
// Writes data/resourceEnrichment.ts, which resourceData.ts merges at load.
//
// Run:  npx tsx scripts/buildSourceEnrichment.ts
import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { RESOURCE_MAP } from '../data/resourceData';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const API = 'https://oldschool.runescape.wiki/api.php';

/** Fetch every row of a bucket, paginating past the 5000-row query cap. */
const fetchAll = (table: string, fields: string[]): any[] => {
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

// Wiki Leagues region -> app region group.
const REGION_MAP: Record<string, string> = {
  Misthalin: 'Misthalin', Karamja: 'Karamja', Asgarnia: 'Asgarnia',
  Kandarin: 'Kandarin', Fremennik: 'Fremennik', Tirannwn: 'Tirannwn',
  Morytania: 'Morytania', Wilderness: 'Wilderness', Varlamore: 'Varlamore',
  Kourend: 'Kourend & Kebos', Desert: 'Kharidian Desert',
};

// Curated region tags for notably region-locked shops; others fall back to 'Any'.
const SHOP_REGION: Record<string, string> = {
  'Lletya Seamstress': 'Tirannwn',
  'Eudav': 'Tirannwn',
  'Cardea': 'Tirannwn',
  'Lliann': 'Tirannwn',
  "Lliann's Wares": 'Tirannwn',
  'TzHaar-Hur-Tel': 'Karamja',
  "TzHaar-Hur-Lek's Ore and Gem Store": 'Karamja',
  'Tzhaar-Mej-Roh': 'Karamja',
  'Sunset Coast Mining Resort': 'Varlamore',
  'Hunter Guild': 'Varlamore',
  'Wintertodt': 'Kourend & Kebos',
  'Quartermaster': 'Kourend & Kebos',
  'Mistrock': 'Fremennik',
  'Daga': 'Islands & Others',
  "Daga's Scimitar Smithy": 'Islands & Others',
};

// --- gather wiki data -------------------------------------------------------
console.log('Fetching storeline…');
const storeRows = fetchAll('storeline', ['sold_item', 'sold_by', 'store_currency']);
console.log(`  ${storeRows.length} store rows`);
console.log('Fetching dropsline…');
const dropRows = fetchAll('dropsline', ['item_name', 'drop_json']);
console.log(`  ${dropRows.length} drop rows`);

// item (lowercase) -> shops
const itemShops = new Map<string, { shop: string; currency: string }[]>();
for (const r of storeRows) {
  if (!r.sold_item || !r.sold_by) continue;
  const key = r.sold_item.toLowerCase();
  if (!itemShops.has(key)) itemShops.set(key, []);
  const shop = toAppCase(r.sold_by).replace(/\s*\(shop\)$/i, '');
  itemShops.get(key)!.push({ shop, currency: r.store_currency || 'Coins' });
}

// Skilling "drop tables" (mining rocks, trees, etc.) — the engine already
// covers these as SKILL sources, so we exclude them from drop enrichment.
const SKILLING_SOURCE = /\b(rocks?|trees?|bushes?|patch|vein|deposit|spawn|ore)\b/i;

// item (lowercase) -> drops
type Drop = { monster: string; region: string; rarity: string; isClue: boolean };
const itemDrops = new Map<string, Drop[]>();
for (const r of dropRows) {
  if (!r.item_name || !r.drop_json) continue;
  let dj: any;
  try { dj = JSON.parse(r.drop_json); } catch { continue; }
  const from = dj['Dropped from'];
  if (typeof from !== 'string' || !from) continue;
  // Strip wiki page anchors / sub-pages: "Lundail#Easy Diary" -> "Lundail".
  const cleaned = toAppCase(from.split('#')[0].split('/')[0]);
  if (!cleaned || SKILLING_SOURCE.test(cleaned)) continue;
  const key = r.item_name.toLowerCase();
  if (!itemDrops.has(key)) itemDrops.set(key, []);
  itemDrops.get(key)!.push({
    monster: cleaned,
    region: REGION_MAP[dj['League region']] || 'Any',
    rarity: String(dj['Rarity'] || '').trim(),
    isClue: /casket|clue/i.test(cleaned),
  });
}

// --- rarity ranking (lower = more common, sorted first) ---------------------
const rarityRank = (r: string): number => {
  const l = r.toLowerCase();
  if (l === 'always' || l === '1/1') return 0;
  if (l === 'common') return 1;
  if (l === 'uncommon') return 2;
  if (l === 'varies') return 3;
  if (l === 'rare') return 4;
  if (l === 'very rare') return 6;
  const m = r.match(/1\s*\/\s*([\d.,]+)/);
  if (m) return 4 + Math.min(2, Number(m[1].replace(/,/g, '')) / 2000);
  return 5;
};

// --- build enrichment -------------------------------------------------------
const lowerToKey = new Map<string, string>();
for (const key of Object.keys(RESOURCE_MAP)) lowerToKey.set(key.toLowerCase(), key);

const enrichment: Record<string, any[]> = {};
let shopCount = 0;
let dropCount = 0;

for (const [lower, key] of lowerToKey) {
  const existing = RESOURCE_MAP[key];
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
    const src: any = { type: 'SHOP', name: shop, regions: [SHOP_REGION[shop] || 'Any'] };
    if (currency && currency !== 'Coins') src.notes = `Bought with ${currency}`;
    added.push(src);
    shopCount++;
  }

  // DROP sources (max 6 new, one per monster, commonest first)
  const drops = itemDrops.get(lower) || [];
  const byMonster = new Map<string, Drop>();
  for (const d of drops) {
    const ml = d.monster.toLowerCase();
    const cur = byMonster.get(ml);
    if (!cur || rarityRank(d.rarity) < rarityRank(cur.rarity)) byMonster.set(ml, d);
  }
  const picked = [...byMonster.values()]
    .filter((d) => !haveDrop.has(d.monster.toLowerCase()))
    .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity))
    .slice(0, 6);
  for (const d of picked) {
    const src: any = { type: d.isClue ? 'CLUE' : 'DROP', name: d.monster, regions: [d.region] };
    if (d.rarity && !/^varies$/i.test(d.rarity)) src.rarity = d.rarity;
    added.push(src);
    dropCount++;
  }

  if (added.length) enrichment[key] = added;
}

// --- emit data/resourceEnrichment.ts ----------------------------------------
const esc = (s: string) => s.replace(/'/g, "\\'");
const fmt = (s: any) => {
  const parts = [`type: '${s.type}'`, `name: '${esc(s.name)}'`, `regions: ['${esc(s.regions[0])}']`];
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
