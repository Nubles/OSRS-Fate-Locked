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
 *   node scripts/export-models.mjs --cache "C:/path/to/cache" --unlocks
 * exports one still model per unlock in scripts/unlock-models.config.json to
 * public/models/<slug>.gltf: an NPC, an object (location), an item's inventory
 * model, or an item as worn (capes). Writes models-report.md in the repo root
 * listing what each unlock got (def id, faces, size) and what failed.
 *
 * Add --idle (to the default boss export or to --unlocks) to bake each NPC's
 * idle animation, and an object's own animation, as a looping morph animation
 * (as pets always get). Files grow several times over; skeletal idles stay still.
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
import { readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
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
const DO_UNLOCKS = args.includes('--unlocks');
const IDLE = args.includes('--idle'); // bake every NPC's (and animated object's) idle, not just pets'
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
const stillSlugs = new Set(cfg.still ?? []); // slugs --idle leaves still (a one-frame idle)

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

// Current caches also carry opcodes 1.1.x has never seen on NPCs, objects and items
// (4-byte model ids, sub-ops, conditional ops), and an unknown opcode throws the
// whole archive's parse off. Read them as RuneLite's loaders do; only the model ids
// are kept.
const loader = async (name) => (await import(
  pathToFileURL(path.join(LIB_DIR, 'src', 'cacheReader', 'loaders', `${name}.js`)).href
)).default;
const skipSubOp = (dv) => { dv.readUint8(); dv.readUint8(); dv.readString(); };
const skipCondOp = (dv) => { dv.readUint8(); dv.readUint16(); dv.readUint16(); dv.readInt32(); dv.readInt32(); dv.readString(); };
const skipCondSubOp = (dv) => { dv.readUint8(); dv.readUint16(); dv.readUint16(); dv.readUint16(); dv.readInt32(); dv.readInt32(); dv.readString(); };
const readNpcOpcode = NpcLoader.prototype.handleOpcode;
NpcLoader.prototype.handleOpcode = function handleOpcode(def, opcode, dataview) {
  if (opcode === 42) dataview.readUint16(); // full recolour
  else if (opcode === 130 || opcode === 147) { /* flags */ }
  else if (opcode === 251) skipSubOp(dataview);
  else if (opcode === 252) skipCondOp(dataview);
  else if (opcode === 253) skipCondSubOp(dataview);
  else return readNpcOpcode.call(this, def, opcode, dataview);
};
const ObjectLoader = await loader('ObjectLoader');
const readObjectOpcode = ObjectLoader.prototype.handleOpcode;
ObjectLoader.prototype.handleOpcode = function handleOpcode(def, opcode, dataview) {
  if (opcode === 6 || opcode === 7) { // opcodes 1 and 5 with 4-byte model ids
    const n = dataview.readUint8();
    if (n > 0) {
      def.objectModels = [];
      def.objectTypes = opcode === 6 ? [] : null;
      for (let i = 0; i < n; i++) {
        def.objectModels.push(dataview.readInt32());
        if (opcode === 6) def.objectTypes.push(dataview.readUint8());
      }
    }
  } else if (opcode === 42) dataview.readUint16(); // full recolour
  else if (opcode === 96) dataview.readUint8(); // raise
  else if (opcode === 100) skipSubOp(dataview);
  else if (opcode === 101) skipCondOp(dataview);
  else if (opcode === 102) skipCondSubOp(dataview);
  else return readObjectOpcode.call(this, def, opcode, dataview);
};
const ItemLoader = await loader('ItemLoader');
const readItemOpcode = ItemLoader.prototype.handleOpcode;
const ITEM_INT_MODELS = {
  44: 'inventoryModel', 45: 'maleModel0', 46: 'maleModel1', 47: 'maleModel2', 48: 'femaleModel0',
  49: 'femaleModel1', 50: 'femaleModel2', 51: 'maleHeadModel', 52: 'maleHeadModel2',
  53: 'femaleHeadModel', 54: 'femaleHeadModel2',
};
ItemLoader.prototype.handleOpcode = function handleOpcode(def, opcode, dataview, ...rest) {
  if (ITEM_INT_MODELS[opcode]) {
    def[ITEM_INT_MODELS[opcode]] = dataview.readInt32();
    if (opcode === 45) def.maleOffset = dataview.readUint8();
    if (opcode === 48) def.femaleOffset = dataview.readUint8();
  } else if (opcode === 15 || opcode === 160 || opcode === 251) { /* flags */ }
  else if (opcode === 99) dataview.readUint16(); // full recolour
  else if (opcode === 161) { for (let n = dataview.readUint16(); n > 0; n--) dataview.readUint16(); }
  else if (opcode === 200) skipSubOp(dataview);
  else if (opcode === 201) skipCondOp(dataview);
  else if (opcode === 202) skipCondSubOp(dataview);
  else return readItemOpcode.call(this, def, opcode, dataview, ...rest);
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
const jobs = DO_UNLOCKS ? []
  : DO_PETS
    ? Object.entries(petCfg).map(([petId, { npc }]) => ({ slug: petId, id: Number(npc), pet: true }))
    : Object.entries(npcIds).map(([slug, id]) => ({ slug: slugify(slug), id: Number(id) }));

if (DO_NAMES && names.length && !DO_PETS && !DO_UNLOCKS) {
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
if (!uniqueJobs.length && !DO_UNLOCKS) { console.error('Nothing to export. Populate scripts/models.config.json.'); cache.close?.(); process.exit(1); }

// ── export one NPC → a merged, coloured glTF (same flow as GLTFModelBuilder) ──
async function exportNpc(id, slug, pet = false, { dropJunk = false, outDir, still = false } = {}) {
  const def = await getNpc(id);
  const entry = def?.models ?? [];
  const modelIds = Array.isArray(entry) ? entry : [entry];
  const ban = new Set((excludes[slug] ?? []).map(Number)); // junk sub-models to drop
  let models = [], skipped = 0;
  for (const mid of modelIds) {
    if (mid == null || mid < 0) continue;
    if (ban.has(Number(mid))) { skipped++; continue; }
    const model = await cache.getDef(IndexType.MODELS, mid);
    if (!model) continue;
    // The NPC's own colours, as the game applies them: many pets share a model and differ
    // only by these (the Dagannoth Kings' pets, the Baby chinchompa).
    (def.recolorToFind ?? []).forEach((find, i) => model.recolor(find, def.recolorToReplace[i]));
    bakeTextureColors(model);
    models.push(model);
  }
  if (dropJunk) { const kept = withoutJunk(models); skipped += models.length - kept.length; models = kept; }
  if (!models.length) throw new Error('no models on this NPC def');
  if (skipped) exportNpc._lastSkipped = skipped; // surfaced in the per-job log line
  const group = new ModelGroup();
  for (const model of models) group.addModel(model);
  const merged = group.getMergedModel();
  exportNpc._lastGround = dropJunk ? dropGroundFaces(merged) : 0;
  exportNpc._lastFaces = merged.faceCount - exportNpc._lastGround;
  const exporter = new GLTFExporter(merged);
  exporter.addColors(merged);

  // Optional: bake the idle (standing) animation as a looping morph animation.
  exportNpc._lastAnim = 0;
  // A pet always idles: the follower and Your Pets panel show it moving.
  if (((pet && !stillPets.has(slug)) || animate.has(slug) || (IDLE && !still && !stillSlugs.has(slug))) && def.standingAnimation != null && def.standingAnimation !== -1) {
    const seq = await cache.getDef(IndexType.CONFIGS, ConfigType.SEQUENCE, def.standingAnimation);
    // A skeletal ("animaya") idle, as newer NPCs have, is beyond osrscachereader 1.1.x in
    // current caches: it misreads the keyframes' skeleton and crashes outside any await.
    // Such a model is exported still; the app gives it a gentle bob instead.
    if (seq && seq.animMayaID != null && seq.animMayaID !== -1) exportNpc._lastStill = true;
    else if (seq) {
      try { await exporter.addSequence(cache, seq); exportNpc._lastAnim = seq.frameIDs?.length ?? 0; }
      catch { exportNpc._lastStill = true; } // a frame set that won't apply: keep the model, still
    }
  }

  const gltf = pruneMorphTargets(exporter.export());
  writeFileSync(path.join(outDir ?? (pet ? PETS_DIR : OUT_DIR), `${slug}.gltf`), gltf);
}

// addSequence adds a morph target for every frame in the animation's frame archive,
// most of them other animations' (the Nightmare's one-frame idle carried 63, taking
// the file from 140 KB to 4 MB). Keep only the targets the animation ever weights,
// then drop the accessors, buffer views and buffers nothing refers to any more.
function pruneMorphTargets(text) {
  const g = JSON.parse(text);
  const mesh = g.meshes?.[0];
  const prims = mesh?.primitives ?? [];
  const n = prims[0]?.targets?.length ?? 0;
  if (!n || !g.animations?.length) return text;
  const bytesOf = (bv) => {
    const raw = Buffer.from(g.buffers[bv.buffer].uri.split(',')[1], 'base64');
    return raw.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
  };
  const floatsOf = (i) => {
    const a = g.accessors[i], b = bytesOf(g.bufferViews[a.bufferView]).subarray(a.byteOffset ?? 0);
    return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + a.count * 4));
  };
  const outputs = [];
  const used = new Set();
  for (const anim of g.animations) {
    for (const ch of anim.channels) {
      if (ch.target.path !== 'weights') continue;
      const sampler = anim.samplers[ch.sampler], w = floatsOf(sampler.output);
      outputs.push([sampler, w]);
      w.forEach((v, i) => { if (v !== 0) used.add(i % n); });
    }
  }
  if (used.size === n || !outputs.length) return text;
  const keep = [...used].sort((a, b) => a - b);
  for (const [sampler, w] of outputs) {
    const frames = w.length / n, kept = new Float32Array(frames * keep.length);
    for (let f = 0; f < frames; f++) keep.forEach((t, j) => { kept[f * keep.length + j] = w[f * n + t]; });
    const bytes = Buffer.from(kept.buffer);
    g.buffers.push({ uri: `data:application/octet-stream;base64,${bytes.toString('base64')}`, byteLength: bytes.length });
    g.bufferViews.push({ buffer: g.buffers.length - 1, byteOffset: 0, byteLength: bytes.length });
    const a = g.accessors[sampler.output];
    g.accessors.push({ ...a, bufferView: g.bufferViews.length - 1, byteOffset: 0, count: kept.length });
    sampler.output = g.accessors.length - 1;
  }
  for (const prim of prims) if (prim.targets) prim.targets = keep.map((t) => prim.targets[t]);
  if (mesh.weights?.length === n) mesh.weights = keep.map((t) => mesh.weights[t]);
  // Renumber what is still referenced, in order, and drop the rest.
  const remap = (list, used) => { const map = new Map(); [...used].sort((a, b) => a - b).forEach((old, i) => map.set(old, i)); return { map, list: [...map.keys()].map((i) => list[i]) }; };
  const accUsed = new Set();
  for (const mesh of g.meshes) for (const prim of mesh.primitives) {
    Object.values(prim.attributes).forEach((i) => accUsed.add(i));
    if (prim.indices != null) accUsed.add(prim.indices);
    (prim.targets ?? []).forEach((t) => Object.values(t).forEach((i) => accUsed.add(i)));
  }
  for (const anim of g.animations) for (const sm of anim.samplers) { accUsed.add(sm.input); accUsed.add(sm.output); }
  const acc = remap(g.accessors, accUsed);
  const fix = (i) => acc.map.get(i);
  for (const mesh of g.meshes) for (const prim of mesh.primitives) {
    for (const k of Object.keys(prim.attributes)) prim.attributes[k] = fix(prim.attributes[k]);
    if (prim.indices != null) prim.indices = fix(prim.indices);
    (prim.targets ?? []).forEach((t) => { for (const k of Object.keys(t)) t[k] = fix(t[k]); });
  }
  for (const anim of g.animations) for (const sm of anim.samplers) { sm.input = fix(sm.input); sm.output = fix(sm.output); }
  g.accessors = acc.list;
  const bv = remap(g.bufferViews, new Set([...g.accessors.map((a) => a.bufferView), ...(g.images ?? []).map((im) => im.bufferView).filter((v) => v != null)]));
  g.accessors.forEach((a) => { a.bufferView = bv.map.get(a.bufferView); });
  (g.images ?? []).forEach((im) => { if (im.bufferView != null) im.bufferView = bv.map.get(im.bufferView); });
  g.bufferViews = bv.list;
  const buf = remap(g.buffers, new Set(g.bufferViews.map((v) => v.buffer)));
  g.bufferViews.forEach((v) => { v.buffer = buf.map.get(v.buffer); });
  g.buffers = buf.list;
  return JSON.stringify(g);
}

// The exporter colours faces only by their colour, and a textured face's colour is
// a plain light grey (leaves, scales, a spirit tree's canopy all came out white).
// The cache keeps each texture's average colour, so --unlocks paints textured faces
// with it. The other modes leave their models as they were.
let textureColors = null;
function bakeTextureColors(model) {
  if (!textureColors || !model.faceTextures) return;
  for (let f = 0; f < model.faceCount; f++) {
    const t = model.faceTextures[f];
    if (t != null && t >= 0 && textureColors[t] != null) model.faceColors[f] = textureColors[t];
  }
}

// A sub-model that lies flat on the ground (a shadow disc, a floor square, a patch's
// soil) is junk next to the real model, so drop it, unless it is all there is. A flat
// piece higher up (a face detail, a cape's trim) stays.
function withoutJunk(models) {
  const solid = models.filter((m) => {
    const ys = m.vertexPositionsY ?? [];
    if (!ys.length || !m.faceCount) return false;
    let lo = Infinity, hi = -Infinity;
    for (const y of ys) { if (y < lo) lo = y; if (y > hi) hi = y; }
    return hi - lo > 4 || lo < -8 || hi > 8;
  });
  return solid.length ? solid : models;
}

// Some NPC meshes carry their floor in the same model (Branda's lava pool, the
// Great Guardian's disc): every face at or below the ground. Collapse those faces
// to nothing and park their vertices on a kept one, so the model is framed by what
// stands on the ground. Returns how many faces went.
function dropGroundFaces(m) {
  const ys = m.vertexPositionsY, a = m.faceVertexIndices1, b = m.faceVertexIndices2, c = m.faceVertexIndices3;
  const ground = (v) => ys[v] >= -2;
  const used = new Uint8Array(m.vertexCount);
  let dropped = 0, keep = -1;
  for (let f = 0; f < m.faceCount; f++) {
    if (ground(a[f]) && ground(b[f]) && ground(c[f])) { dropped++; continue; }
    used[a[f]] = used[b[f]] = used[c[f]] = 1;
    if (keep < 0) keep = a[f];
  }
  if (!dropped || keep < 0 || dropped === m.faceCount) return 0;
  for (let f = 0; f < m.faceCount; f++) {
    if (ground(a[f]) && ground(b[f]) && ground(c[f])) b[f] = c[f] = a[f];
  }
  for (let v = 0; v < m.vertexCount; v++) {
    if (!used[v]) {
      m.vertexPositionsX[v] = m.vertexPositionsX[keep];
      m.vertexPositionsY[v] = m.vertexPositionsY[keep];
      m.vertexPositionsZ[v] = m.vertexPositionsZ[keep];
    }
  }
  return dropped;
}

if (DO_UNLOCKS) {
  await exportUnlocks();
  cache.close?.();
  process.exit(0);
}

// ── --unlocks: one still model per unlock in scripts/unlock-models.config.json ──
async function exportUnlocks() {
  const cfgPath = path.join(ROOT, 'scripts', 'unlock-models.config.json');
  const unlockCfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const defs = {
    npc: await cache.getAllDefs(IndexType.CONFIGS, ConfigType.NPC),
    object: await cache.getAllDefs(IndexType.CONFIGS, ConfigType.OBJECT),
    item: await cache.getAllDefs(IndexType.CONFIGS, ConfigType.ITEM),
  };
  defs.worn = defs.item;
  textureColors = (await cache.getAllDefs(IndexType.TEXTURES, 0)).map((t) => t?.field1777);
  const byName = {};
  for (const [kind, list] of Object.entries(defs)) {
    const index = (byName[kind] = new Map());
    for (const d of list) {
      const nm = d?.name && d.name !== 'null' ? d.name.toLowerCase() : null;
      if (nm) index.set(nm, [...(index.get(nm) ?? []), d]);
    }
  }

  const real = (id) => id != null && id >= 0;
  // The model ids a def stands for, by kind. An object with per-type models (a wall
  // and its corner, say) gives its centrepiece (type 10), else its first type's.
  const modelIdsOf = (kind, d) => {
    if (!d) return [];
    if (kind === 'npc') return (d.models ?? []).filter(real);
    if (kind === 'item') return [d.inventoryModel].filter(real);
    if (kind === 'worn') return [d.maleModel0, d.maleModel1].filter(real);
    const ids = d.objectModels ?? [];
    if (!d.objectTypes) return ids.filter(real);
    const type = [10, 11].find((t) => d.objectTypes.includes(t)) ?? d.objectTypes[0];
    return ids.filter((id, i) => d.objectTypes[i] === type && real(id));
  };
  // Noted items and bank placeholders share the real item's name; skip them.
  const usable = (kind, d) => modelIdsOf(kind, d).length > 0
    && (kind !== 'item' && kind !== 'worn' || (!(d.notedTemplate >= 0) && !(d.placeholderTemplateId >= 0)));

  const faceMemo = new Map();
  const facesOf = async (kind, d) => {
    let faces = 0;
    for (const mid of modelIdsOf(kind, d)) {
      if (!faceMemo.has(mid)) faceMemo.set(mid, (await cache.getDef(IndexType.MODELS, mid).catch(() => null))?.faceCount ?? 0);
      faces += faceMemo.get(mid);
    }
    return faces;
  };

  // Every usable def with this name; an object that is only a switch between
  // states (a multiloc) stands in for the states it switches to.
  const candidates = (kind, name) => {
    const named = byName[kind].get(String(name).toLowerCase()) ?? [];
    const out = named.filter((d) => usable(kind, d));
    if (out.length || kind !== 'object') return out;
    const states = named.flatMap((d) => (d.configChangeDest ?? []).filter(real).map((id) => defs.object[id]));
    return states.filter((d) => usable(kind, d));
  };
  // Where several defs share the name, the one with the most faces is the fully built
  // or grown one; ties go to the one you can interact with, then the lowest id. An NPC
  // under 50 faces is a stand-in (the Great Olm's and TzHaar-Ket-Rak's are 12-face
  // boxes; Juna's is empty), so it doesn't count.
  const pick = async (kind, name) => {
    let best = null, bestScore = -1;
    for (const d of candidates(kind, name)) {
      const faces = await facesOf(kind, d);
      if (kind === 'npc' && faces < 50) continue;
      const acts = (kind === 'npc' || kind === 'object' ? d.actions : d.options) ?? [];
      const score = faces * 2 + (acts.some(Boolean) ? 1 : 0);
      if (score > bestScore) { best = d; bestScore = score; }
    }
    return best;
  };

  // "still": true in the config keeps one unlock still under --idle, where its animation
  // looks wrong on a loop (a crashed star that shrinks away, a portal that loses its surface).
  async function exportDef(kind, d, slug, { exclude = [], dropGround = false, still: keepStill = false } = {}) {
    if (kind === 'npc') {
      excludes[slug] = exclude;
      exportNpc._lastSkipped = 0; exportNpc._lastStill = false;
      await exportNpc(d.id, slug, false, { dropJunk: true, outDir: OUT_DIR, still: keepStill });
      return { faces: exportNpc._lastFaces, skipped: exportNpc._lastSkipped, ground: exportNpc._lastGround, anim: exportNpc._lastAnim, still: exportNpc._lastStill };
    }
    const ban = new Set(exclude.map(Number));
    let models = [], skipped = 0;
    for (const mid of modelIdsOf(kind, d)) {
      if (ban.has(Number(mid))) { skipped++; continue; }
      const model = await cache.getDef(IndexType.MODELS, mid);
      if (!model) continue;
      (d.recolorToFind ?? []).forEach((find, i) => model.recolor(find, d.recolorToReplace[i]));
      (d.retextureToFind ?? []).forEach((find, i) => model.retexture(find, d.textureToReplace[i]));
      bakeTextureColors(model);
      if (kind === 'object' && (d.modelSizeX !== 128 || d.modelSizeHeight !== 128 || d.modelSizeY !== 128)) {
        model.resize(d.modelSizeX, d.modelSizeHeight, d.modelSizeY);
        model.computeNormals(); // resize drops them, and merging needs them
      }
      models.push(model);
    }
    const kept = withoutJunk(models);
    skipped += models.length - kept.length;
    if (!kept.length) throw new Error('no models on this def');
    const group = new ModelGroup();
    for (const model of kept) group.addModel(model);
    const merged = group.getMergedModel();
    // An object's floor is often its own (a rug, a plinth), so only where asked.
    const ground = dropGround ? dropGroundFaces(merged) : 0;
    const exporter = new GLTFExporter(merged);
    exporter.addColors(merged);
    // An object's own animation (a fountain's water, a portal's swirl), with --idle.
    let anim = 0, still = false;
    if (IDLE && !keepStill && kind === 'object' && d.animationID != null && d.animationID !== -1) {
      const seq = await cache.getDef(IndexType.CONFIGS, ConfigType.SEQUENCE, d.animationID);
      if (seq && seq.animMayaID != null && seq.animMayaID !== -1) still = true; // skeletal: as for NPCs
      else if (seq) {
        try { await exporter.addSequence(cache, seq); anim = seq.frameIDs?.length ?? 0; }
        catch { still = true; }
      }
    }
    writeFileSync(path.join(OUT_DIR, `${slug}.gltf`), pruneMorphTargets(exporter.export()));
    return { faces: merged.faceCount - ground, skipped, ground, anim, still };
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const rows = [];
  const done = new Map(); // slug -> row, for unlocks listed under two groups
  for (const [group, entries] of Object.entries(unlockCfg)) {
    if (group.startsWith('_')) continue;
    for (const [unlock, spec] of Object.entries(entries).slice(0, LIMIT)) {
      const slug = slugify(unlock);
      const row = { group, unlock, slug, type: spec.type, name: spec.name };
      rows.push(row);
      if (done.has(slug)) { Object.assign(row, { ...done.get(slug), group, unlock }); continue; }
      done.set(slug, row);
      if (spec.skip) { row.error = `left out: ${spec.skip === true ? spec.hint ?? 'no model' : spec.skip}`; continue; }
      try {
        const kind = spec.type;
        if (!defs[kind]) throw new Error(`unknown type "${kind}"`);
        let d = spec.id != null ? defs[kind][spec.id] : null;
        if (spec.id != null && !usable(kind, d)) throw new Error(`${kind} ${spec.id} has no model`);
        if (!d && spec.name && spec.name !== '?') d = await pick(kind, spec.name);
        if (!d && spec.fallback) {
          d = await pick(spec.fallback.type ?? kind, spec.fallback.name);
          if (d) row.note = `fallback: ${spec.fallback.name}`;
        }
        if (!d) throw new Error(spec.name === '?' ? 'no pick yet ("?")' : `no ${kind} named "${spec.name}" with a model`);
        const kindUsed = row.note ? spec.fallback.type ?? kind : kind;
        const { faces, skipped, ground, anim, still } = await exportDef(kindUsed, d, slug, spec);
        const kb = statSync(path.join(OUT_DIR, `${slug}.gltf`)).size / 1024;
        Object.assign(row, { type: kindUsed, name: d.name, id: d.id, faces, kb, skipped, ground, anim, still });
        console.log(`✓ ${slug}.gltf (${kindUsed} ${d.id} "${d.name}", ${faces} faces, ${kb.toFixed(0)} KB${skipped ? `, dropped ${skipped} junk` : ''}${ground ? `, dropped ${ground} ground faces` : ''}${anim ? `, idle ${anim} frames` : ''}${still ? ', idle left still' : ''})`);
      } catch (e) {
        row.error = e?.message ?? String(e);
        console.warn(`  ! ${slug}: ${row.error}`);
      }
    }
  }

  const made = [...done.values()].filter((r) => !r.error).length;
  const lines = [
    '# Unlock models report',
    '',
    `${rows.filter((r) => !r.error).length} of ${rows.length} unlocks have a model (${made} files; ${rows.length - done.size} unlocks share a file with another group).`,
    '',
    '| Group | Unlock | Type | Def | Name | Faces | KB | Notes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.group} | ${r.unlock} | ${r.type} | ${r.id ?? ''} | ${r.name ?? ''} | ${r.faces ?? ''} | ${r.kb != null ? r.kb.toFixed(0) : ''} | ${[r.error && `FAILED: ${r.error}`, r.note, r.skipped && `dropped ${r.skipped} junk sub-model(s)`, r.ground && `dropped ${r.ground} ground faces`, r.anim && `idle ${r.anim} frames`, r.still && 'idle left still (skeletal or failed)'].filter(Boolean).join('; ')} |`),
    '',
  ];
  writeFileSync(path.join(ROOT, 'models-report.md'), lines.join('\n'));
  console.log(`\nDone: ${made}/${done.size} unlock model(s) → public/models/ (report: models-report.md). Now run: npm run models:manifest`);
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
