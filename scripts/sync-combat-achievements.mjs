// Regenerates data/caTasks.ts from the OSRS Wiki's Combat Achievements tier
// pages. Unlike bosses/quests (which need app-specific curation — models,
// economy, prereqs), a CA task is *fully* defined by the wiki: monster, official
// name, requirement text and tier. So this is a true sync, not just a detector.
//
// IDs use the wiki's `data-ca-task-id`, which IS the stable in-game task id, so
// re-running is idempotent and preserves player progress (unlocks.completedTasks).
//
// Run:  npm run ca:sync   (also part of `npm run content:sync`)
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://oldschool.runescape.wiki/api.php';
const UA = { 'Api-User-Agent': 'FateLockedUIM/1.0 (CA sync)' };
const TIERS = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'];
const OUT = new URL('../data/caTasks.ts', import.meta.url);

const decode = (s) => s
  .replace(/<sup[\s\S]*?<\/sup>/g, '')      // drop citation superscripts
  .replace(/<[^>]+>/g, '')                   // strip tags
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/\[\d+\]/g, '')                   // footnote markers
  .replace(/\s+/g, ' ').trim();

async function fetchTier(tier) {
  const url = `${API}?action=parse&page=${encodeURIComponent('Combat Achievements/' + tier)}&prop=text&format=json&origin=*`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let json;
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: UA });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } finally { clearTimeout(timer); }
  const html = json.parse.text['*'];
  const out = [];
  for (const m of html.matchAll(/<tr data-ca-task-id="(\d+)"[\s\S]*?<\/tr>/g)) {
    const cells = [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => decode(c[1]));
    if (cells.length < 3) continue;
    out.push({ id: `ca_${m[1]}`, tierId: tier, monster: cells[0], name: cells[1], description: cells[2] });
  }
  return out;
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function render(tasks) {
  const lines = [];
  lines.push('');
  lines.push('export interface CATask {');
  lines.push('  id: string;');
  lines.push('  tierId: string;');
  lines.push('  monster: string;');
  lines.push('  /** Official in-game task name (e.g. "Noxious Foe"). */');
  lines.push('  name?: string;');
  lines.push('  description: string;');
  lines.push('}');
  lines.push('');
  lines.push('// Generated from the OSRS Wiki Combat Achievements pages by');
  lines.push('// `npm run ca:sync` (scripts/sync-combat-achievements.mjs). IDs are the');
  lines.push('// stable in-game task ids — edit the wiki / re-run rather than hand-editing.');
  lines.push('export const ALL_CA_TASKS: CATask[] = [');
  for (const tier of TIERS) {
    const group = tasks.filter(t => t.tierId === tier).sort((a, b) => (+a.id.slice(3)) - (+b.id.slice(3)));
    if (!group.length) continue;
    lines.push(`  // ${tier.toUpperCase()} TIER (${group.length})`);
    for (const t of group) {
      lines.push(`  { id: '${t.id}', tierId: '${tier}', monster: '${esc(t.monster)}', name: '${esc(t.name)}', description: '${esc(t.description)}' },`);
    }
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const all = [];
  for (const tier of TIERS) {
    const rows = await fetchTier(tier);
    if (!rows.length) throw new Error(`no tasks parsed for ${tier} — aborting to avoid wiping data`);
    all.push(...rows);
    console.log(`[ca:sync] ${tier}: ${rows.length}`);
  }
  // de-dupe by id (defensive) and sanity-check the total before writing
  const byId = new Map(all.map(t => [t.id, t]));
  const tasks = [...byId.values()];
  if (tasks.length < 500) throw new Error(`only ${tasks.length} CA tasks parsed — refusing to write (expected ~600+)`);

  const prev = (() => { try { return readFileSync(OUT, 'utf8'); } catch { return ''; } })();
  const prevCount = (prev.match(/\bid: 'ca_/g) || []).length;
  writeFileSync(OUT, render(tasks));
  console.log(`[ca:sync] wrote data/caTasks.ts: ${tasks.length} tasks (was ${prevCount}).`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('sync-combat-achievements.mjs')) {
  main().catch(e => { console.error('[ca:sync] failed:', e.message); process.exit(1); });
}
