#!/usr/bin/env node
/**
 * sync-chunk-content.mjs — regenerate public/chunk-content.json
 *
 * Extracts the factual per-chunk content of Gielinor (monsters, NPCs, objects,
 * shops, quest starts/steps, diary refs, clue steps, item spawns) from the One
 * Chunk Man Chunk Picker's data export:
 *   https://github.com/source-chunk/chunk-picker-v2  (gh-pages branch,
 *   chunkpicker-chunkinfo-export.json — credit: source-chunk / whitecatblack)
 * and re-expresses it in our own compact format keyed by canonical OSRS region
 * id (regionId = regionX * 256 + regionY, i.e. our map's cx,cy).
 *
 * The app lazy-loads the JSON in ChunkContentService to power the map's
 * "what can I do with my unlocked chunks?" panel.
 *
 * Usage:  node scripts/sync-chunk-content.mjs [--local path/to/export.json]
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public', 'chunk-content.json');
const SOURCE_URL =
  'https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/gh-pages/chunkpicker-chunkinfo-export.json';

async function loadExport() {
  const localFlag = process.argv.indexOf('--local');
  if (localFlag !== -1 && process.argv[localFlag + 1]) {
    return JSON.parse(readFileSync(resolve(process.argv[localFlag + 1]), 'utf8'));
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'fate-locked-ironman content sync' } });
      if (res.ok) return await res.json();
      console.warn(`attempt ${attempt}: HTTP ${res.status}`);
    } catch (err) {
      console.warn(`attempt ${attempt}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1500 * attempt));
  }
  throw new Error('could not download the chunk picker export');
}

/** "Goblin#Drop table 1" → "Goblin" (the # suffix is a data-variant marker). */
const cleanName = (s) => s.split('#')[0].trim();

/** Merge a content blob (chunk top level OR one section) into the record. */
function mergeBlob(rec, blob, slayerReq) {
  if (blob.Monster) {
    for (const [raw, count] of Object.entries(blob.Monster)) {
      const name = cleanName(raw);
      const req = slayerReq.get(raw) ?? slayerReq.get(name);
      const cur = rec.monsters.get(name);
      if (cur) {
        cur.count += count;
        if (req != null) cur.slayer = cur.slayer == null ? req : Math.min(cur.slayer, req);
      } else {
        rec.monsters.set(name, { count, slayer: req ?? null });
      }
    }
  }
  if (blob.NPC) for (const raw of Object.keys(blob.NPC)) rec.npcs.add(cleanName(raw));
  if (blob.Object) {
    for (const [raw, count] of Object.entries(blob.Object)) {
      const name = cleanName(raw);
      rec.objects.set(name, (rec.objects.get(name) ?? 0) + count);
    }
  }
  if (blob.Shop) for (const s of Object.keys(blob.Shop)) rec.shops.add(s.replace(/\.$/, ''));
  if (blob.Quest) {
    for (const [q, kind] of Object.entries(blob.Quest)) {
      // "first" (quest starts here) wins over "step".
      const base = cleanName(q.split('/')[0]); // "Recipe for Disaster/Dwarf" → "Recipe for Disaster"
      if (kind === 'first' || !rec.quests.has(base)) rec.quests.set(base, kind === 'first' ? 'first' : 'step');
    }
  }
  if (blob.Diary) for (const [area, refs] of Object.entries(blob.Diary)) {
    rec.diaries.set(area, rec.diaries.has(area) ? `${rec.diaries.get(area)}, ${refs}` : String(refs));
  }
  if (blob.Clue) for (const [tier, n] of Object.entries(blob.Clue)) {
    rec.clues.set(tier, (rec.clues.get(tier) ?? 0) + n);
  }
  if (blob.Spawn) for (const raw of Object.keys(blob.Spawn)) rec.spawns.add(cleanName(raw));
}

function main(data) {
  const walkable = new Set(data.walkableChunks.map(String));
  // slayer requirement lookup (raw and cleaned names)
  const slayerReq = new Map(Object.entries(data.slayerMonsters));

  const out = {};
  let withContent = 0;
  for (const id of walkable) {
    const chunk = data.chunks[id];
    if (!chunk) continue;
    const rec = {
      monsters: new Map(), npcs: new Set(), objects: new Map(), shops: new Set(),
      quests: new Map(), diaries: new Map(), clues: new Map(), spawns: new Set(),
    };
    mergeBlob(rec, chunk, slayerReq);
    if (chunk.Sections) for (const sec of Object.values(chunk.Sections)) mergeBlob(rec, sec, slayerReq);

    const entry = {};
    const nick = chunk.Nickname ?? chunk.Name;
    if (nick && nick !== 'Ocean Chunk') entry.n = nick;
    if (rec.monsters.size) entry.m = [...rec.monsters.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, v]) => (v.slayer != null ? [name, v.count, v.slayer] : [name, v.count]));
    if (rec.npcs.size) entry.p = [...rec.npcs].sort();
    if (rec.objects.size) entry.o = [...rec.objects.entries()].sort((a, b) => b[1] - a[1]);
    if (rec.shops.size) entry.s = [...rec.shops].sort();
    if (rec.quests.size) entry.q = Object.fromEntries([...rec.quests.entries()].sort());
    if (rec.diaries.size) entry.d = Object.fromEntries(rec.diaries);
    if (rec.clues.size) entry.c = Object.fromEntries(rec.clues);
    if (rec.spawns.size) entry.i = [...rec.spawns].sort();

    if (Object.keys(entry).length) { out[id] = entry; withContent++; }
  }

  const doc = {
    version: 1,
    source: 'source-chunk/chunk-picker-v2 (chunkpicker-chunkinfo-export.json, gh-pages)',
    chunks: out,
  };
  writeFileSync(OUT, JSON.stringify(doc));
  const kb = Math.round(JSON.stringify(doc).length / 1024);
  console.log(`wrote public/chunk-content.json — ${withContent} chunks with content, ~${kb} KB`);
}

main(await loadExport());
