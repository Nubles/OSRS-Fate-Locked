/**
 * Regenerate data/activityChunks.ts: the chunks each boss, minigame, guild
 * and Slayer master is entered from, for Chunked mode.
 *
 * Run: node scripts/gen-activity-chunks.mjs [--check]
 *
 * The anchors live in data/sources/activity-entrances.json and name things in
 * public/chunk-content.json, so the table follows the chunk data on a resync.
 * An anchor that no longer matches anything stops the script.
 *
 * An anchor with 'requirements' is a way in that carries its own requirement
 * (the 51 Agility pipe from the Varrock Sewers to Vannaka). Its chunks go to
 * GATED_ENTRANCE_CHUNKS with those requirement strings, never to the plain
 * tables, so a caller that does not check them never counts the way as open.
 * A chunk an ungated anchor also gives stays plain.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedTextMatches } from './generated-text.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC_PATH = resolve(ROOT, 'public', 'chunk-content.json');
const SOURCE_PATH = resolve(ROOT, 'data', 'sources', 'activity-entrances.json');
const OUTPUT_PATH = resolve(ROOT, 'data', 'activityChunks.ts');

const ANCHOR_KINDS = ['monster', 'npc', 'object', 'interior', 'chunkName', 'overlay'];

const norm = (value) => String(value).toLowerCase().replace(/[‘’]/g, "'").trim();
const keyOfId = (id) => `${Math.floor(Number(id) / 256)},${Number(id) % 256}`;
const isSurfaceId = (id) => /^\d+$/.test(String(id));
const names = (list) => (list ?? []).map((entry) => (Array.isArray(entry) ? entry[0] : entry));
const field = { monster: 'm', npc: 'p', object: 'o' };

const interiorEntrances = (interior) => (interior.entrances ?? [])
  .map((entrance) => entrance.chunkId)
  .filter(isSurfaceId)
  .map(keyOfId);

/** The surface chunks one anchor points to. */
export function resolveAnchor(doc, anchor) {
  const kinds = ANCHOR_KINDS.filter((kind) => kind in anchor);
  if (kinds.length !== 1) throw new Error(`Anchor needs exactly one of ${ANCHOR_KINDS.join(', ')}: ${JSON.stringify(anchor)}`);
  const kind = kinds[0];
  const want = norm(anchor[kind]);
  const out = new Set();
  if (kind === 'overlay') {
    for (const point of doc.overlays?.[anchor.overlay] ?? []) out.add(`${point.cx},${point.cy}`);
  } else if (kind === 'chunkName') {
    for (const [id, chunk] of Object.entries(doc.chunks ?? {})) {
      if (isSurfaceId(id) && chunk.n && norm(chunk.n) === want) out.add(keyOfId(id));
    }
  } else if (kind === 'interior') {
    for (const interior of Object.values(doc.interiors ?? {})) {
      if (norm(interior.name) === want) interiorEntrances(interior).forEach((key) => out.add(key));
    }
  } else {
    const f = field[kind];
    for (const [id, chunk] of Object.entries(doc.chunks ?? {})) {
      if (isSurfaceId(id) && names(chunk[f]).some((name) => norm(name) === want)) out.add(keyOfId(id));
    }
    for (const interior of Object.values(doc.interiors ?? {})) {
      if (names(interior.content?.[f]).some((name) => norm(name) === want)) interiorEntrances(interior).forEach((key) => out.add(key));
    }
  }
  for (const key of anchor.except ?? []) {
    if (!anchor.reason) throw new Error(`Anchor 'except' needs a reason: ${JSON.stringify(anchor)}`);
    out.delete(key);
  }
  return out;
}

const byChunk = (a, b) => {
  const [ax, ay] = a.split(',').map(Number);
  const [bx, by] = b.split(',').map(Number);
  return ax - bx || ay - by;
};

/** A gated anchor's requirement strings (the vocabulary of utils/questRoutes/accountRequirements.ts). */
const anchorNeeds = (anchor) => {
  if (!('requirements' in anchor)) return null;
  const needs = anchor.requirements;
  if (!Array.isArray(needs) || needs.length === 0 || !needs.every((need) => typeof need === 'string' && need.trim())) {
    throw new Error(`Anchor 'requirements' must be a non-empty list of strings: ${JSON.stringify(anchor)}`);
  }
  if (!anchor.reason) throw new Error(`Anchor 'requirements' needs a reason: ${JSON.stringify(anchor)}`);
  if (typeof anchor.label !== 'string' || !anchor.label.trim()) {
    throw new Error(`Anchor 'requirements' needs a label, the words players read after "with": ${JSON.stringify(anchor)}`);
  }
  return needs;
};

/**
 * name -> sorted chunk keys, failing on any anchor that matches nothing, and
 * name -> the gated ways in ({ chunk, needs, label }) that no ungated anchor gives.
 */
export function resolveSectionWays(doc, section) {
  const table = {};
  const gated = {};
  for (const [name, anchors] of Object.entries(section)) {
    const chunks = new Set();
    const ways = [];
    for (const anchor of anchors) {
      const needs = anchorNeeds(anchor);
      const found = resolveAnchor(doc, anchor);
      if (found.size === 0) throw new Error(`"${name}": anchor ${JSON.stringify(anchor)} matches nothing in public/chunk-content.json`);
      if (needs) found.forEach((chunk) => ways.push({ chunk, needs, label: anchor.label }));
      else found.forEach((key) => chunks.add(key));
    }
    table[name] = [...chunks].sort(byChunk);
    const open = ways.filter((way) => !chunks.has(way.chunk)).sort((a, b) => byChunk(a.chunk, b.chunk));
    if (open.length) gated[name] = open;
  }
  return { table, gated };
}

/** name -> sorted chunk keys (the ungated ways only). */
export function resolveSection(doc, section) {
  return resolveSectionWays(doc, section).table;
}

/** One gated table for every section, by name; a name in two sections must give the same ways. */
export function mergeGated(...sections) {
  const merged = {};
  for (const gated of sections) {
    for (const [name, ways] of Object.entries(gated)) {
      if (name in merged && JSON.stringify(merged[name]) !== JSON.stringify(ways)) {
        throw new Error(`"${name}" has different gated ways in two sections`);
      }
      merged[name] = ways;
    }
  }
  return merged;
}

const body = (table) => Object.entries(table)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, chunks]) => `  ${JSON.stringify(name)}: [${chunks.map((key) => JSON.stringify(key)).join(', ')}],`)
  .join('\n');

const gatedBody = (gated) => Object.entries(gated)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, ways]) => `  ${JSON.stringify(name)}: [${ways
    .map((way) => `{ chunk: ${JSON.stringify(way.chunk)}, needs: [${way.needs.map((need) => JSON.stringify(need)).join(', ')}], label: ${JSON.stringify(way.label)} }`)
    .join(', ')}],`)
  .join('\n');

export function generateActivityChunksSource(doc, source) {
  const activities = resolveSectionWays(doc, source.activities);
  const masters = resolveSectionWays(doc, source.slayerMasters);
  const farmCards = resolveSectionWays(doc, source.farmSlayerCards ?? {});
  const gated = mergeGated(activities.gated, masters.gated, farmCards.gated);
  return `// AUTO-GENERATED by scripts/gen-activity-chunks.mjs from public/chunk-content.json
// and data/sources/activity-entrances.json — do not edit by hand.
// Chunked mode: the "cx,cy" chunks each place is entered from. Owning any one counts.

/** Bosses, minigames and guilds (and Brutus): their entrance chunks. */
export const ACTIVITY_CHUNKS: Readonly<Record<string, readonly string[]>> = {
${body(activities.table)}
};

/** Slayer masters: the chunk each one stands in (or is reached from). */
export const SLAYER_MASTER_CHUNKS: Readonly<Record<string, readonly string[]>> = {
${body(masters.table)}
};

/** The Farm screen's Slayer cards, by the name each card shows. */
export const FARM_SLAYER_CARD_CHUNKS: Readonly<Record<string, readonly string[]>> = {
${body(farmCards.table)}
};

/**
 * Ways in that carry their own requirement, by the name in the tables above:
 * owning the chunk counts only once every requirement string is met
 * (utils/activityAccess.ts enterableChunk); label is what players read.
 * Not in the tables above.
 */
export const GATED_ENTRANCE_CHUNKS: Readonly<Record<string, readonly { chunk: string; needs: readonly string[]; label: string }[]>> = {
${gatedBody(gated)}
};
`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8'));
  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf8'));
  const text = generateActivityChunksSource(doc, source);
  if (process.argv.includes('--check')) {
    if (!generatedTextMatches(readFileSync(OUTPUT_PATH, 'utf8'), text)) {
      console.error('data/activityChunks.ts is stale: run node scripts/gen-activity-chunks.mjs');
      process.exit(1);
    }
    console.log('data/activityChunks.ts is up to date.');
  } else {
    writeFileSync(OUTPUT_PATH, text);
    console.log('Wrote data/activityChunks.ts');
  }
}
