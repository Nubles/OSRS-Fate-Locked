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
 *   node scripts/export-models.mjs --cache "C:/path/to/cache" --pets
 * exports every pet in scripts/pet-models.config.json, with its idle animation,
 * to public/models/pets/<petId>.gltf (the follower and Your Pets panel load them).
 * RuneLite keeps a current cache at ~/.runelite/jagexcache/oldschool/LIVE.
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
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'models');
const LIB_DIR = path.join(ROOT, 'node_modules', 'osrscachereader');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] ?? true) : d; };
const CACHE_DIR = arg('--cache', process.env.OSRS_CACHE_DIR);
const LIMIT = Number(arg('--limit', Infinity));
const DO_NAMES = args.includes('--names');
const DO_PETS = args.includes('--pets');
const PETS_DIR = path.join(OUT_DIR, 'pets');

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
const excludes = cfg.exclude ?? {};     // { "<slug>": [modelId, …] } — skip junk sub-models
                                        // (arena boxes / shadow planes / minions an NPC def bundles in)
const animate = new Set((cfg.animate ?? []).map((s) => slugify(s))); // slugs to bake the
                                        // NPC's idle (standingAnimation) into as a looping
                                        // glTF morph animation. Off by default — animation
                                        // frames multiply file size ~4-9x, so opt in per slug.

// ── load cache (confirmed API: new RSCache(dir) + await cache.onload) ─────────
const { RSCache, IndexType, ConfigType, GLTFExporter, ModelGroup } = await import('osrscachereader');

// Caches since 2025 list an NPC's model ids as 4-byte ints under opcode 61 (and its
// chathead models under 62), as RuneLite's NpcLoader reads them; osrscachereader
// 1.1.x knows only the old 2-byte opcodes 1 and 60, so every NPC came back with no
// models. Teach its loader the new two before anything is read.
const { default: NpcLoader } = await import(
  pathToFileURL(path.join(LIB_DIR, 'src', 'cacheReader', 'loaders', 'NpcLoader.js')).href
);
const readOpcode = NpcLoader.prototype.handleOpcode;
NpcLoader.prototype.handleOpcode = function handleOpcode(def, opcode, dataview) {
  if (opcode !== 61 && opcode !== 62) return readOpcode.call(this, def, opcode, dataview);
  const ids = [];
  for (let n = dataview.readUint8(); n > 0; n--) ids.push(dataview.readInt32());
  if (opcode === 61) def.models = ids;
  else def.chatheadModels = ids;
};
console.log('Loading cache from', CACHE_DIR, '…');
const cache = new RSCache(CACHE_DIR);
await cache.onload;

const getNpc = (id) => cache.getDef(IndexType.CONFIGS, ConfigType.NPC, id);

// ── build the work list: { slug, id } ────────────────────────────────────────
// --pets exports only the pets, each named by its id in data/pets.ts.
const petFile = (() => {
  const p = path.join(ROOT, 'scripts', 'pet-models.config.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
})();
const petCfg = petFile.pets ?? {};
if (DO_PETS) Object.assign(excludes, petFile.exclude ?? {});
const stillPets = new Set(petFile.still ?? []);
const jobs = DO_PETS
  ? Object.entries(petCfg).map(([petId, { npc }]) => ({ slug: petId, id: Number(npc), pet: true }))
  : Object.entries(npcIds).map(([slug, id]) => ({ slug: slugify(slug), id: Number(id) }));

if (DO_NAMES && names.length && !DO_PETS) {
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
async function exportNpc(id, slug, pet = false) {
  const def = await getNpc(id);
  const entry = def?.models ?? [];
  const modelIds = Array.isArray(entry) ? entry : [entry];
  const ban = new Set((excludes[slug] ?? []).map(Number)); // junk sub-models to drop
  const group = new ModelGroup();
  let n = 0, skipped = 0;
  for (const mid of modelIds) {
    if (mid == null || mid < 0) continue;
    if (ban.has(Number(mid))) { skipped++; continue; }
    const model = await cache.getDef(IndexType.MODELS, mid);
    if (!model) continue;
    // The NPC's own colours, as the game applies them: many pets share a model and differ
    // only by these (the Dagannoth Kings' pets, the Baby chinchompa).
    (def.recolorToFind ?? []).forEach((find, i) => model.recolor(find, def.recolorToReplace[i]));
    group.addModel(model); n++;
  }
  if (!n) throw new Error('no models on this NPC def');
  if (skipped) exportNpc._lastSkipped = skipped; // surfaced in the per-job log line
  const merged = group.getMergedModel();
  const exporter = new GLTFExporter(merged);
  exporter.addColors(merged);

  // Optional: bake the idle (standing) animation as a looping morph animation.
  exportNpc._lastAnim = 0;
  // A pet always idles: the follower and Your Pets panel show it moving.
  if (((pet && !stillPets.has(slug)) || animate.has(slug)) && def.standingAnimation != null && def.standingAnimation !== -1) {
    const seq = await cache.getDef(IndexType.CONFIGS, ConfigType.SEQUENCE, def.standingAnimation);
    // A skeletal ("animaya") idle, as newer NPCs have, is beyond osrscachereader 1.1.x in
    // current caches: it misreads the keyframes' skeleton and crashes outside any await.
    // Such a model is exported still; the app gives it a gentle bob instead.
    if (seq && seq.animMayaID != null && seq.animMayaID !== -1) exportNpc._lastStill = true;
    else if (seq) { await exporter.addSequence(cache, seq); exportNpc._lastAnim = seq.frameIDs?.length ?? 0; }
  }

  const gltf = exporter.export();
  writeFileSync(path.join(pet ? PETS_DIR : OUT_DIR, `${slug}.gltf`), gltf);
}

mkdirSync(DO_PETS ? PETS_DIR : OUT_DIR, { recursive: true });
let ok = 0;
const stillPetIds = [];
for (const job of uniqueJobs.slice(0, LIMIT)) {
  try {
    exportNpc._lastSkipped = 0; exportNpc._lastAnim = 0; exportNpc._lastStill = false;
    await exportNpc(job.id, job.slug, job.pet === true);
    const sk = exportNpc._lastSkipped ? `  (excluded ${exportNpc._lastSkipped} junk model${exportNpc._lastSkipped > 1 ? 's' : ''})` : '';
    const an = exportNpc._lastAnim ? `  (idle: ${exportNpc._lastAnim} frames)`
      : exportNpc._lastStill ? '  (still: skeletal idle)' : '';
    console.log(`✓ ${job.slug}.gltf (npc ${job.id})${sk}${an}`); ok++;
    if (job.pet && !exportNpc._lastAnim) stillPetIds.push(Number(job.slug));
  }
  catch (e) { console.warn(`  ! ${job.slug} (npc ${job.id}): ${e?.message ?? e}`); }
}

cache.close?.();
// The app bobs a still pet gently instead, so it needs to know which they are.
if (DO_PETS && ok === uniqueJobs.length && LIMIT === Infinity) {
  writeFileSync(path.join(ROOT, 'data', 'petModels.ts'), [
    '// AUTO-GENERATED by `npm run models:export -- --cache <dir> --pets` - do not edit by hand.',
    '// Every pet in data/pets.ts has a model at public/models/pets/<petId>.gltf; these have no idle',
    "// animation (a skeletal one, or one that didn't export cleanly), so the app bobs them instead.",
    `export const STILL_PET_MODELS: readonly number[] = [${stillPetIds.sort((a, b) => a - b).join(', ')}];`,
    '',
  ].join('\n'));
}
console.log(DO_PETS
  ? `\nDone: ${ok}/${uniqueJobs.length} pet model(s) → public/models/pets/.`
  : `\nDone: ${ok}/${uniqueJobs.length} model(s) → public/models/. Now run: npm run models:manifest`);
