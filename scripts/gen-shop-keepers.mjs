// Who runs each shop: contracts/golden-bundles/shop-keepers.json, for the RuneLite plugin.
//
// A SHOPS row in the RuneLite export carries only the shop's name, and many names do not say who
// runs the shop (Fine Fashions is Rometti's, Varrock Swordshop has a Shop keeper). The plugin finds,
// outlines and tags a shop by the NPC or object the player trades with, so it reads this table,
// copied with the golden bundles. No module of the app imports it.
//
//   node scripts/gen-shop-keepers.mjs            rebuild the contract file from the committed source
//   node scripts/gen-shop-keepers.mjs --check    offline: fail when the source or the contract file is stale
//   node scripts/gen-shop-keepers.mjs --refresh  networked: read each shop page's Infobox Shop owner
//                                                field from the OSRS Wiki into data/sources/shop-keepers.json
//
// The source file keeps each shop's page, revision and raw owner field; the contract file keeps only
// the names. scripts/gen-shop-keepers.test.ts checks both offline.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC_PATH = resolve(ROOT, 'public', 'chunk-content.json');
export const SOURCE_PATH = resolve(ROOT, 'data', 'sources', 'shop-keepers.json');
export const CONTRACT_PATH = resolve(ROOT, 'contracts', 'golden-bundles', 'shop-keepers.json');
const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
const USER_AGENT = process.env.WIKI_USER_AGENT
  || 'OSRS-Fate-Locked shop keeper refresh/1.0 (https://github.com/Nubles/OSRS-Fate-Locked)';

export const CONTRACT_ABOUT = 'Who runs each shop the RuneLite export can name in a SHOPS row: the names the game shows on '
  + 'the NPCs or objects the player trades with there, read from the Infobox Shop owner field of the shop\'s OSRS Wiki page, '
  + 'and an empty list where the page names no one.';

/**
 * Shops whose Wiki page title is not their name with any "#section" taken off. Empty while every
 * name finds its page that way.
 */
export const PAGE_TITLES = {};

/**
 * Shops whose page names no keeper (owner "None" or no owner field), reviewed so that an empty list
 * is a decision and not a gap. The value says what the player trades with.
 */
export const NO_KEEPER = {
  "Culinaromancer's Chest": 'owner = None: the player trades with the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#0 Subquests": 'owner = None: the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#1 Subquests": 'owner = None: the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#2 Subquests": 'owner = None: the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#3 Subquests": 'owner = None: the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#4 Subquests": 'owner = None: the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#5 Subquests": 'owner = None: the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#6 Subquests": 'owner = None: the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#7 Subquests": 'owner = None: the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#8 Subquests": 'owner = None: the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#Food": 'owner = None: the chest in the Lumbridge Castle cellar',
  "Culinaromancer's Chest#Full": 'owner = None: the chest in the Lumbridge Castle cellar',
  'Farming Supplies': 'owner = No: any Group of Advanced Gardeners member, each with a name of their own',
};

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Every shop name content.shops yields: the "s" lists of every chunk and every interior, sorted. */
export function shopNames(doc) {
  const names = new Set();
  for (const entry of Object.values(doc.chunks ?? {})) for (const name of entry?.s ?? []) names.add(name);
  for (const interior of Object.values(doc.interiors ?? {})) for (const name of interior?.content?.s ?? []) names.add(name);
  return [...names].sort(byCodeUnit);
}

/** The Wiki page a shop name stands for: the name without its "#section". */
export const pageTitleOf = (name) => PAGE_TITLES[name] ?? name.replace(/#.*$/, '').trim();

/** The raw owner fields (owner, owner1, owner2 ...) of every Infobox Shop on a page. */
export function infoboxOwnerFields(wikitext) {
  const fields = [];
  let from = 0;
  for (;;) {
    const start = wikitext.indexOf('{{Infobox Shop', from);
    if (start < 0) break;
    let depth = 0;
    let end = start;
    for (; end < wikitext.length; end += 1) {
      if (wikitext.startsWith('{{', end)) { depth += 1; end += 1; } else if (wikitext.startsWith('}}', end)) {
        depth -= 1; end += 1;
        if (depth === 0) break;
      }
    }
    const box = wikitext.slice(start, end + 1);
    for (const match of box.matchAll(/^\s*\|\s*owner\d*\s*=(.*)$/gm)) fields.push(match[1].trim());
    from = end + 1;
  }
  return fields;
}

/** Words an owner field uses for "no one". */
const NOBODY = /^(none|no|n\/a|nobody|no one|unknown|-|\?)$/i;

/**
 * Link labels a page misspells, and the name the game shows. Cam Torum General Store's page
 * (revision 15318519) shows its link to Shopkeeper (Cam Torum) as "Shopkeeeper".
 */
export const LABEL_FIXES = { Shopkeeeper: 'Shopkeeper' };

/** The name a link shows: its label, or its target without a "#section" or a "(qualifier)". */
function linkName(inner) {
  const [target, label] = inner.split('|');
  if (label !== undefined && label.trim()) return LABEL_FIXES[label.trim()] ?? label.trim();
  return target.replace(/#.*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * The names an owner field gives, as the game shows them: a piped link's label, a link's page
 * title without its bracketed qualifier ("Shop keeper (Varrock Swordshop)" is a Shop keeper), plain
 * text as written. Several owners give several names; "None" gives none.
 */
export function ownerNames(raw) {
  const text = String(raw)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{(?:plink|NPC link)\|([^}|]*)(?:\|[^}]*)?\}\}/gi, '[[$1]]')
    .replace(/\{\{[^}]*\}\}/g, '');
  // Links first, so that a bracketed note after an owner ("[[Roy]] (After [[Sins of the Father]])")
  // goes with the links inside it, while a link's own qualifier stays with its link.
  const links = [];
  const marked = text.replace(/\[\[([^\]]*)\]\]/g, (_, inner) => `\u0000${links.push(linkName(inner)) - 1}\u0000`);
  const names = [];
  for (const part of marked.replace(/\([^)]*\)/g, '').split(/,|;|\/|<br\s*\/?>|\band\b|\bor\b|&/i)) {
    const pieces = part.split(/\u0000(\d+)\u0000/).map((value, index) => (index % 2 ? links[Number(value)] : value));
    for (const piece of pieces) {
      const name = piece.replace(/'''?/g, '').trim();
      if (name && !NOBODY.test(name)) names.push(name);
    }
  }
  return [...new Set(names.filter((name) => name && !NOBODY.test(name)))];
}

/**
 * The contract file from the source file: every shop name, sorted, with the names its owner
 * fields give. Refuses a shop with no record, a record for no shop, an empty list that is not
 * reviewed and a reviewed shop that names someone after all.
 */
export function buildShopKeepers(source, names, reviewed = NO_KEEPER) {
  const records = source.shops ?? {};
  const missing = names.filter((name) => !records[name]);
  if (missing.length) throw new Error(`Shops with no record in data/sources/shop-keepers.json (run --refresh): ${missing.join(', ')}`);
  const extra = Object.keys(records).filter((name) => !names.includes(name));
  if (extra.length) throw new Error(`Records for shops the content no longer has (run --refresh): ${extra.join(', ')}`);
  const shops = {};
  const unreviewed = [];
  const named = [];
  for (const name of names) {
    const keepers = [...new Set(records[name].owner.flatMap(ownerNames))];
    if (!keepers.length && !(name in reviewed)) unreviewed.push(name);
    if (keepers.length && name in reviewed) named.push(name);
    shops[name] = keepers;
  }
  if (unreviewed.length) throw new Error(`Shops whose page names no keeper, not in NO_KEEPER: ${unreviewed.join(', ')}`);
  if (named.length) throw new Error(`Shops in NO_KEEPER whose page names a keeper: ${named.join(', ')}`);
  const stale = Object.keys(reviewed).filter((name) => !names.includes(name));
  if (stale.length) throw new Error(`NO_KEEPER names shops the content no longer has: ${stale.join(', ')}`);
  return { schema: 1, about: CONTRACT_ABOUT, shops };
}

export const jsonText = (value) => `${JSON.stringify(value, null, 1)}\n`;

export const readSource = (path = SOURCE_PATH) => JSON.parse(readFileSync(path, 'utf8'));
export const readDoc = (path = DOC_PATH) => JSON.parse(readFileSync(path, 'utf8'));

async function wikiQuery(params) {
  const url = new URL(WIKI_API);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const response = await fetch(url, { headers: { 'Api-User-Agent': USER_AGENT, 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Wiki request failed: HTTP ${response.status} for ${url}`);
  const body = await response.json();
  if (body.error) throw new Error(`Wiki request failed: ${body.error.code}: ${body.error.info}`);
  return body;
}

/** Each page's current revision and Infobox Shop owner fields, 50 titles a request, redirects followed. */
async function fetchPages(titles) {
  const pages = new Map();
  for (let offset = 0; offset < titles.length; offset += 50) {
    const requested = titles.slice(offset, offset + 50);
    const body = await wikiQuery({
      action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', redirects: '1',
      titles: requested.join('|'),
    });
    const alias = new Map();
    for (const { from, to } of [...(body.query?.normalized ?? []), ...(body.query?.redirects ?? [])]) alias.set(from, to);
    const byTitle = new Map((body.query?.pages ?? []).map((page) => [page.title, page]));
    for (const title of requested) {
      let current = title;
      for (let hops = 0; alias.has(current) && hops < 5; hops += 1) current = alias.get(current);
      const page = byTitle.get(current);
      const revision = page?.revisions?.[0];
      if (!page || page.missing || !revision) { pages.set(title, null); continue; }
      pages.set(title, {
        page: page.title,
        revision: revision.revid,
        timestamp: revision.timestamp,
        owner: infoboxOwnerFields(revision.slots?.main?.content ?? ''),
      });
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  return pages;
}

async function refresh(names) {
  const titles = [...new Set(names.map(pageTitleOf))].sort(byCodeUnit);
  const pages = await fetchPages(titles);
  const missing = titles.filter((title) => !pages.get(title));
  if (missing.length) throw new Error(`No Wiki page for these shops (add them to PAGE_TITLES): ${missing.join(', ')}`);
  const noBox = titles.filter((title) => !pages.get(title).owner.length);
  if (noBox.length) console.warn(`Pages with no Infobox Shop owner field: ${noBox.join(', ')}`);
  return {
    about: 'Where contracts/golden-bundles/shop-keepers.json comes from: for each shop name, the OSRS Wiki page read, '
      + 'its revision and the raw owner fields of its Infobox Shop. Written by node scripts/gen-shop-keepers.mjs --refresh.',
    reviewedAt: new Date().toISOString().slice(0, 10),
    shops: Object.fromEntries(names.map((name) => [name, pages.get(pageTitleOf(name))])),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check' && arg !== '--refresh') || args.length > 1) {
    throw new Error('Usage: node scripts/gen-shop-keepers.mjs [--check | --refresh]');
  }
  const names = shopNames(readDoc());
  if (args[0] === '--refresh') writeFileSync(SOURCE_PATH, jsonText(await refresh(names)));
  const expected = jsonText(buildShopKeepers(readSource(), names));
  if (args[0] === '--check') {
    if (!existsSync(CONTRACT_PATH) || readFileSync(CONTRACT_PATH, 'utf8').replace(/\r\n?/g, '\n') !== expected) {
      throw new Error('contracts/golden-bundles/shop-keepers.json is stale: run node scripts/gen-shop-keepers.mjs');
    }
    console.log(`Shop keepers are current: ${names.length} shops.`);
  } else {
    writeFileSync(CONTRACT_PATH, expected);
    console.log(`Wrote contracts/golden-bundles/shop-keepers.json with ${names.length} shops.`);
  }
}
