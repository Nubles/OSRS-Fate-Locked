/**
 * Batch-export OSRS models → public/models/<slug>.gltf using the open-source
 * osrscachereader (BSD-2). You provide a local cache; this turns the entities
 * you list into models the app auto-displays on unlock (via the manifest).
 *
 * One-time setup
 * --------------
 *   1. npm install -D osrscachereader      # the cache reader (pulls `canvas`);
 *                                          # not bundled, not in this repo's deps
 *   2. Get an OSRS cache (e.g. an archive from OpenRS2) — a folder with
 *      main_file_cache.dat2 + main_file_cache.idx255 (+ optionally xteas.json).
 *   3. Pick entities in scripts/models.config.json (npcIds / names / aliases).
 *
 * Run
 * ---
 *   node scripts/export-models.mjs --cache "C:/path/to/cache" [--names] [--limit 20]
 * Then `npm run models:manifest` (or just `npm run build`) picks them up.
 *
 * IP: the cache + models are Jagex's; use is under their non-commercial Fan
 * Content Policy. This script bundles nothing — it processes a cache YOU provide
 * into files you own as fan content.
 *
 * Built directly against osrscachereader@1.1.x's exported API
 * (RSCache/IndexType/ConfigType/GLTFExporter/ModelGroup) — the same flow its own
 * GLTFModelBuilder uses. GLTFExporter writes self-contained .gltf (model-viewer
 * loads .gltf fine), so output is /public/models/<slug>.gltf.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'models');
const LIB_DIR = path.join(ROOT, 'node_modules', 'osrscachereader');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] ?? true) : d; };
const CACHE_DIR = arg('--cache', process.env.OSRS_CACHE_DIR);
const LIMIT = Number(arg('--limit', Infinity));
const DO_NAMES = args.includes('--names');

if (!CACHE_DIR) { console.error('Missing --cache <dir> (or OSRS_CACHE_DIR). See this file’s header.'); process.exit(1); }
if (!existsSync(LIB_DIR)) { console.error('osrscachereader not installed. Run:  npm install -D osrscachereader'); process.exit(1); }

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ── config ───────────────────────────────────────────────────────────────────
const cfg = (() => {
  const p = path.join(ROOT, 'scripts', 'models.config.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
})();
const npcIds = cfg.npcIds ?? {};        // { "<slug>": <npcId> } — explicit, wins
const names = cfg.names ?? [];          // ["Zulrah", ...] — resolved by cache scan
const aliases = cfg.aliases ?? {};      // { "Display Name": "Resolvable NPC name" }

// ── load cache (confirmed API: new RSCache(dir) + await cache.onload) ─────────
const { RSCache, IndexType, ConfigType, GLTFExporter, ModelGroup } = await import('osrscachereader');
console.log('Loading cache from', CACHE_DIR, '…');
const cache = new RSCache(CACHE_DIR);
await cache.onload;

const getNpc = (id) => cache.getDef(IndexType.CONFIGS, ConfigType.NPC, id);

// ── build the work list: { slug, id } ────────────────────────────────────────
const jobs = Object.entries(npcIds).map(([slug, id]) => ({ slug: slugify(slug), id: Number(id) }));

if (DO_NAMES && names.length) {
  // Map each display name → the NPC name to search for (alias when set),
  // skipping any whose slug is already pinned via npcIds.
  const pinned = new Set(jobs.map((j) => j.slug));
  const want = new Map(); // searchNameLower -> displaySlug
  for (const display of names) {
    const slug = slugify(display);
    if (!pinned.has(slug)) want.set(String(aliases[display] ?? display).toLowerCase(), slug);
  }

  console.log(`Indexing NPC names from the cache (resolving ${want.size})…`);
  for (let id = 0; id < 16000 && want.size; id++) {
    let def;
    try { def = await getNpc(id); } catch { continue; }
    const nm = def?.name && String(def.name).toLowerCase();
    if (nm && want.has(nm)) { jobs.push({ slug: want.get(nm), id }); want.delete(nm); }
  }
  if (want.size) console.warn('Unresolved (pin via npcIds or add an alias):', [...want.values()].join(', '));
}

// Dedupe by slug — an explicit npcId wins over a resolved name.
const seen = new Set();
const uniqueJobs = jobs.filter((j) => (seen.has(j.slug) ? false : (seen.add(j.slug), true)));
if (!uniqueJobs.length) { console.error('Nothing to export. Populate scripts/models.config.json.'); cache.close?.(); process.exit(1); }

// ── export one NPC → a merged, coloured glTF (same flow as GLTFModelBuilder) ──
async function exportNpc(id, slug) {
  const def = await getNpc(id);
  const entry = def?.models ?? [];
  const modelIds = Array.isArray(entry) ? entry : [entry];
  const group = new ModelGroup();
  let n = 0;
  for (const mid of modelIds) {
    if (mid == null || mid < 0) continue;
    const model = await cache.getDef(IndexType.MODELS, mid);
    if (model) { group.addModel(model); n++; }
  }
  if (!n) throw new Error('no models on this NPC def');
  const merged = group.getMergedModel();
  const exporter = new GLTFExporter(merged);
  exporter.addColors(merged);
  const gltf = exporter.export();
  writeFileSync(path.join(OUT_DIR, `${slug}.gltf`), gltf);
}

mkdirSync(OUT_DIR, { recursive: true });
let ok = 0;
for (const job of uniqueJobs.slice(0, LIMIT)) {
  try { await exportNpc(job.id, job.slug); console.log(`✓ ${job.slug}.gltf (npc ${job.id})`); ok++; }
  catch (e) { console.warn(`  ! ${job.slug} (npc ${job.id}): ${e?.message ?? e}`); }
}

cache.close?.();
console.log(`\nDone: ${ok}/${uniqueJobs.length} model(s) → public/models/. Now run: npm run models:manifest`);
