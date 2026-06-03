/**
 * Batch-export OSRS models → public/models/<slug>.glb using the open-source
 * osrscachereader (BSD-2). You provide a local cache; this turns the entities
 * you list into glTF the app auto-displays on unlock (via the manifest).
 *
 * One-time setup
 * --------------
 *   1. npm install -D osrscachereader            # the cache reader (not bundled)
 *   2. Get an OSRS cache (e.g. an archive from OpenRS2) and note its folder —
 *      it must contain main_file_cache.dat2 + main_file_cache.idx255 (+ xteas.json).
 *   3. List the entities you want in scripts/models.config.json (see that file).
 *
 * Run
 * ---
 *   node scripts/export-models.mjs --cache "C:/path/to/cache"
 *      [--limit 20] [--names]      # --names also auto-resolves the "names" list
 *
 * Then `npm run models:manifest` (or just `npm run build`) picks them up.
 *
 * IP: the cache + models are Jagex's; use is under their non-commercial Fan
 * Content Policy. This script bundles nothing — it only processes a cache YOU
 * provide, into files you own as fan content.
 *
 * NOTE: osrscachereader's model exporter is driven here through its confirmed
 * CLI (scripts/command.js → `modelBuilder npc <id> name <slug>`). If your
 * installed version differs, the two marked spots below (CACHE LOAD + EXPORT)
 * are the only places to adjust.
 */
import { readFileSync, existsSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'models');
const LIB_DIR = path.join(ROOT, 'node_modules', 'osrscachereader');

// ── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] ?? true) : d; };
const CACHE_DIR = arg('--cache', process.env.OSRS_CACHE_DIR);
const LIMIT = Number(arg('--limit', Infinity));
const DO_NAMES = args.includes('--names');

if (!CACHE_DIR) {
  console.error('Missing --cache <dir> (or OSRS_CACHE_DIR). See the header of this file.');
  process.exit(1);
}
if (!existsSync(LIB_DIR)) {
  console.error('osrscachereader not installed. Run:  npm install -D osrscachereader');
  process.exit(1);
}

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ── config: which entities to export ────────────────────────────────────────
const cfgPath = path.join(ROOT, 'scripts', 'models.config.json');
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
const npcIds = cfg.npcIds ?? {};   // { "<slug>": <npcId> }  — most reliable
const names = cfg.names ?? [];     // ["Zulrah", ...]        — auto-resolved by cache name

// Build the work list: explicit ids first, then optionally resolved names.
const jobs = Object.entries(npcIds).map(([slug, id]) => ({ slug: slugify(slug), id, kind: 'npc' }));

if (DO_NAMES && names.length) {
  // ── CACHE LOAD (confirmed API) ────────────────────────────────────────────
  const { RSCache, IndexType, ConfigType } = await import('osrscachereader');
  const cache = new RSCache(CACHE_DIR);

  // Build a name → npcId index by scanning NPC configs. One-time + offline, so
  // a simple guarded sweep is fine. (def.name is the standard NPC-def field.)
  console.log('Indexing NPC names from the cache…');
  const want = new Map(names.map((n) => [n.toLowerCase(), slugify(n)]));
  for (let id = 0; id < 30000 && want.size; id++) {
    let def;
    try { def = await cache.getDef(IndexType.CONFIGS, ConfigType.NPC, id); } catch { continue; }
    const nm = def?.name && String(def.name).toLowerCase();
    if (nm && want.has(nm)) { jobs.push({ slug: want.get(nm), id, kind: 'npc' }); want.delete(nm); }
  }
  if (want.size) console.warn('Unresolved names (add to npcIds manually):', [...want.values()]);
}

// Dedupe by slug — an explicit npcId (pushed first) wins over a resolved name.
const seen = new Set();
const uniqueJobs = jobs.filter((j) => (seen.has(j.slug) ? false : (seen.add(j.slug), true)));

if (!uniqueJobs.length) {
  console.error('Nothing to export. Populate scripts/models.config.json (npcIds or names).');
  process.exit(1);
}

// ── export each via osrscachereader's confirmed CLI ──────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const newestGlbSince = (since) => {
  let best = null;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
      else if (/\.glb$/i.test(e.name)) { const m = statSync(p).mtimeMs; if (m >= since && (!best || m > statSync(best).mtimeMs)) best = p; }
    }
  };
  try { walk(LIB_DIR); } catch {}
  return best;
};

let ok = 0;
for (const job of uniqueJobs.slice(0, LIMIT)) {
  const t0 = Date.now() - 1000;
  try {
    // ── EXPORT (confirmed CLI) ─────────────────────────────────────────────
    // Runs inside the cache dir so the reader's relative cache path resolves.
    execFileSync('node', [path.join(LIB_DIR, 'scripts', 'command.js'), 'modelBuilder', job.kind, String(job.id), 'name', job.slug], {
      cwd: CACHE_DIR, stdio: 'inherit',
    });
    const produced = newestGlbSince(t0);
    if (!produced) { console.warn(`  ! no .glb produced for ${job.slug} (id ${job.id})`); continue; }
    copyFileSync(produced, path.join(OUT_DIR, `${job.slug}.glb`));
    console.log(`✓ ${job.slug}.glb (npc ${job.id})`);
    ok++;
  } catch (e) {
    console.warn(`  ! export failed for ${job.slug} (id ${job.id}):`, e?.message ?? e);
  }
}

console.log(`\nDone: ${ok}/${uniqueJobs.length} model(s) → public/models/. Now run: npm run models:manifest`);
