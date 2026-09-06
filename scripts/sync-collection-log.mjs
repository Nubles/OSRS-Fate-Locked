// Re-syncs data/collectionLogData.ts to the live OSRS Wiki collection log so the
// in-app log stays an exact mirror of the game's. Source of truth is the wiki's
// own data module (the same data it renders, fed by WikiSync):
//   Module:Collection_log/data.json   — every item: { id, name, tabs:[page,…] }
//   Module:Collection_log             — a Lua `overrides` table of display names
//
// Run on demand:   npm run clog:sync
//
// What it does (and deliberately does NOT do):
//   • Aligns each existing page's item names to the wiki's rendered names and
//     APPENDS any newly-tracked items — PRESERVING existing synthetic IDs, so
//     player progress (keyed by id) survives a re-sync.
//   • Never renumbers, never deletes. App items with no wiki match are kept and
//     reported (so a wiki rename can't silently drop a slot).
//   • If the wiki adds a brand-new PAGE, it can't know which tab it belongs to,
//     so it just reports it for a human to place (then re-run). After placing an
//     empty page `'X': { name: 'X', items: [] }`, a re-run fills its items.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClogIdAllocator } from '../utils/clogIdAllocation.mjs';

const FILE = 'data/collectionLogData.ts';
const API = 'https://oldschool.runescape.wiki/api.php';
const UA = { 'Api-User-Agent': 'FateLockedUIM/1.0 (collection-log sync)' };

// Page-title differences between the app and the wiki (app title -> wiki title).
// Used only for MATCHING; the app keeps its own display titles for these.
const PAGE_MATCH = {
  'Beginner': 'Beginner Treasure Trails', 'Easy': 'Easy Treasure Trails',
  'Medium': 'Medium Treasure Trails', 'Hard': 'Hard Treasure Trails',
  'Elite': 'Elite Treasure Trails', 'Master': 'Master Treasure Trails',
  'Hard (Rare)': 'Hard Treasure Trails (Rare)', 'Elite (Rare)': 'Elite Treasure Trails (Rare)',
  'Master (Rare)': 'Master Treasure Trails (Rare)', 'Shared Rewards': 'Shared Treasure Trail Rewards',
  'Beginner Treasure Trails': 'Beginner Treasure Trails', 'Easy Treasure Trails': 'Easy Treasure Trails',
  'Medium Treasure Trails': 'Medium Treasure Trails', 'Hard Treasure Trails': 'Hard Treasure Trails',
  'Elite Treasure Trails': 'Elite Treasure Trails', 'Master Treasure Trails': 'Master Treasure Trails',
  'Hard Treasure Trails (Rare)': 'Hard Treasure Trails (Rare)',
  'Elite Treasure Trails (Rare)': 'Elite Treasure Trails (Rare)',
  'Master Treasure Trails (Rare)': 'Master Treasure Trails (Rare)',
  'Shared Treasure Trail Rewards': 'Shared Treasure Trail Rewards',
  'The Fight Caves': 'The Fight Caves', 'Fight Caves': 'The Fight Caves',
  'Mage Training Arena': 'Magic Training Arena',
};

const norm = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

// Micro-rename detector: one INSERTION/DELETION apart with identical digits
// ("Araxyte venom sack" -> "…sac"). Single substitutions are NOT renames —
// Team cape i/x and (t)/(g) ornament kits are genuinely different items.
// Without this pass, a micro-rename keeps the old entry AND appends the new
// name under a fresh id — a permanent duplicate slot (happened on Araxxor).
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const digits = s => s.replace(/\D/g, '');
const isMicroRename = (a, b) => {
  const na = norm(a), nb = norm(b);
  return na !== nb && digits(na) === digits(nb)
    && Math.abs(na.length - nb.length) === 1 && lev(na, nb) === 1;
};
const baseNorm = s => s.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const unesc = s => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');

async function wikiPage(title) {
  const u = `${API}?action=query&prop=revisions&titles=${encodeURIComponent(title)}&rvslots=main&rvprop=content&format=json`;
  const r = await fetch(u, { headers: UA });
  if (!r.ok) throw new Error(`wiki ${title}: HTTP ${r.status}`);
  const d = await r.json();
  return Object.values(d.query.pages)[0].revisions[0].slots.main['*'];
}

async function loadWiki() {
  const data = JSON.parse(await wikiPage('Module:Collection_log/data.json'));
  const lua = await wikiPage('Module:Collection_log');
  const overrides = {};
  const re = /\[(\d+)\]\s*=\s*\{[^}]*name\s*=\s*"((?:[^"\\]|\\.)*)"[^}]*\}/g;
  let m; while ((m = re.exec(lua)) !== null) overrides[m[1]] = m[2].replace(/\\"/g, '"');
  const rendered = it => (overrides[it.id] !== undefined ? overrides[it.id] : it.name);
  const pages = {};
  for (const it of data) for (const pg of it.tabs) (pages[pg] = pages[pg] || []).push(rendered(it));
  return pages;
}

function alignItems(appItems, wikiItems, log, page, mint) {
  const pool = wikiItems.map(n => ({ n, used: false }));
  const out = [];
  for (const ai of appItems) {
    let hit = pool.find(w => !w.used && norm(w.n) === norm(ai.name)) ||
              pool.find(w => !w.used && baseNorm(w.n) === baseNorm(ai.name)) ||
              pool.find(w => !w.used && isMicroRename(w.n, ai.name));
    if (hit) { hit.used = true; if (hit.n !== ai.name) log.renames.push(`[${page}] ${ai.name} -> ${hit.n}`); out.push({ id: ai.id, name: hit.n }); }
    else { log.kept.push(`[${page}] ${ai.name} (#${ai.id})`); out.push(ai); }
  }
  for (const w of pool) if (!w.used) { const id = mint(); out.push({ id, name: w.n }); log.adds.push(`[${page}] ${w.n} (#${id})`); }
  return out;
}

const run = async () => {
  const wikiPages = await loadWiki();
  const { text, log, newPages } = syncCollectionLogText(readFileSync(FILE, 'utf8'), wikiPages);
  writeFileSync(FILE, text);
  reportSync(log, newPages, wikiPages);
};

/** Pure transform: all identities are allocated before the caller writes anything. */
export function syncCollectionLogText(source, wikiPages) {
  const wikiByNorm = {}; for (const p of Object.keys(wikiPages)) wikiByNorm[norm(p)] = p;
  const lines = source.split(/\r?\n/);
  const tabRe = /^  '([^']+)': \{$/;
  const pageRe = /^(      ')((?:[^'\\]|\\.)*)('?: \{ name: ')((?:[^'\\]|\\.)*)(', items: \[)(.*)(\] \},?\s*)$/;
  const itemRe = /\{id: (\d+), name: '((?:[^'\\]|\\.)*)'\}/g;
  const log = { renames: [], adds: [], kept: [] };
  const matchedWiki = new Set();
  const allocatePage = createClogIdAllocator([...source.matchAll(/\{id: (\d+),/g)].map(match => Number(match[1])));

  for (let i = 0; i < lines.length; i++) {
    const pm = lines[i].match(pageRe);
    if (!pm) continue;
    const pageName = unesc(pm[4]);
    const appItems = [];
    let m; itemRe.lastIndex = 0;
    while ((m = itemRe.exec(pm[6])) !== null) appItems.push({ id: parseInt(m[1]), name: unesc(m[2]) });
    const target = PAGE_MATCH[pageName] || wikiByNorm[norm(pageName)];
    if (!target || !wikiPages[target]) { log.kept.push(`[page ${pageName}] no wiki match — left as-is`); continue; }
    matchedWiki.add(target);
    const aligned = alignItems(appItems, wikiPages[target], log, pageName, allocatePage(appItems.map(item => item.id)));
    const items = aligned.map(it => `{id: ${it.id}, name: '${esc(it.name)}'}`).join(', ');
    lines[i] = `${pm[1]}${esc(unesc(pm[2]))}${pm[3]}${esc(pageName)}${pm[5]}${items}${pm[7]}`;
  }

  const newPages = Object.keys(wikiPages).filter(p => !matchedWiki.has(p));
  return { text: lines.join('\n'), log, newPages };
}

function reportSync(log, newPages, wikiPages) {
  console.log(`[clog:sync] renames ${log.renames.length}, items added ${log.adds.length}, kept-without-wiki-match ${log.kept.length}`);
  for (const r of log.renames) console.log('  RENAME ' + r);
  for (const a of log.adds) console.log('  ADD    ' + a);
  for (const k of log.kept) console.log('  KEEP   ' + k);
  // A page that both KEEPs an unmatched app item and ADDs a new wiki item is
  // the signature of a rename too big for the micro-rename pass — flag it so
  // a human merges the pair instead of shipping a duplicate slot.
  const pageOf = s => (s.match(/^\[([^\]]+)\]/) || [])[1];
  const keptPages = new Set(log.kept.map(pageOf).filter(Boolean));
  const suspect = log.adds.map(pageOf).filter(p => p && keptPages.has(p));
  if (suspect.length) {
    console.log(`\n[clog:sync] WARNING: possible rename(s) needing a manual merge (KEEP + ADD on the same page):`);
    for (const p of [...new Set(suspect)]) console.log(`  ? "${p}" — merge the kept item into the added one (keep the OLD id) and add a CLOG_ID_MIGRATIONS entry`);
  }
  if (newPages.length) {
    console.log(`\n[clog:sync] ${newPages.length} NEW wiki page(s) need a tab + empty stub, then re-run:`);
    for (const p of newPages) console.log(`  + "${p}" (${wikiPages[p].length} items)`);
  }
  console.log(`\n[clog:sync] done. Review the diff, run \`npm test\`, and commit.`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(e => { console.error('[clog:sync] failed:', e.message); process.exit(1); });
}
