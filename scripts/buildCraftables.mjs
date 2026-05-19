// One-off authoring tool: pulls Smithing / Crafting / Magic-enchant recipes
// from the OSRS Wiki `recipe` bucket and emits curated RESOURCE_MAP entries
// for the Resource Engine. Output is reviewed and pasted into resourceData.ts;
// this script is not shipped or imported at runtime.
//
// Run:  node scripts/buildCraftables.mjs
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const API = 'https://oldschool.runescape.wiki/api.php';

const bucketQuery = (skill) =>
  `bucket('recipe').select('production_json').where('uses_skill','${skill}').limit(5000).run()`;

const fetchRecipes = (skill) => {
  const url = `${API}?action=bucket&format=json&query=${encodeURIComponent(bucketQuery(skill))}`;
  const body = execFileSync('curl', ['-s', '-A', UA, url], { encoding: 'utf8', maxBuffer: 5e7 });
  const json = JSON.parse(body);
  if (!json.bucket) throw new Error(`No bucket for ${skill}: ${body.slice(0, 200)}`);
  return json.bucket.map((r) => JSON.parse(r.production_json));
};

// --- name normalisation -----------------------------------------------------
const CONNECTORS = new Set(['of', 'the', 'a', 'an', 'and', 'to', 'on', 'from']);
const toAppCase = (raw) => {
  const name = raw.trim();
  return name
    .split(' ')
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && CONNECTORS.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

// --- existing RESOURCE_MAP keys (skip collisions) ---------------------------
const resourceSrc = readFileSync(new URL('../data/resourceData.ts', import.meta.url), 'utf8');
const mapBody = resourceSrc.slice(resourceSrc.indexOf('RESOURCE_MAP'));
const existing = new Set(
  [...mapBody.matchAll(/^\s{2}'((?:[^'\\]|\\.)*)':\s*\[/gm)].map((m) =>
    m[1].replace(/\\'/g, "'").toLowerCase(),
  ),
);

// Recipe material/output names that need to match existing RESOURCE_MAP keys.
const INPUT_ALIAS = { 'Runite Bar': 'Rune Bar' };

// --- filters: which output items we want ------------------------------------
// Smithing: only the 6 standard metal tiers, smithed purely from standard bars.
const STD_BAR = /^(Bronze|Iron|Steel|Mithril|Adamantite|Runite) bar$/i;
const STD_METAL = /^(Bronze|Iron|Steel|Mithril|Adamant|Rune)\b/i;
const wantSmithing = (out, materials) => {
  if (/cannonball/i.test(out)) return false;          // only steel exists (already curated as 'Cannonball')
  if (!STD_METAL.test(out)) return false;             // skip quest metals (Blurite, Lunar, etc.)
  if (!materials.length) return false;
  return materials.every((m) => STD_BAR.test(m.name));
};

const JEWELRY = /(ring|necklace|amulet|bracelet)\b/i;
const wantCrafting = (out) => {
  const n = out.toLowerCase();
  if (/\(\d\)/.test(n)) return false; // skip charged variants e.g. "(4)"
  if (/\bd'hide\b/.test(n)) return true;
  if (/^(leather|hardleather|hard leather|studded|coif)/.test(n)) return true;
  if (JEWELRY.test(n) && /^(gold|sapphire|emerald|ruby|diamond|dragonstone|opal|jade|topaz)/.test(n)) return true;
  return false;
};
const wantMagic = (out, materials) =>
  !/\(\d\)/.test(out) && materials.some((m) => JEWELRY.test(m.name));

// --- build per-item sources -------------------------------------------------
const items = new Map(); // appKey -> { sources: [], skipped: bool }

const addRecipe = (rec, accept) => {
  const out = rec.output?.name;
  if (!out) return;
  if (!accept(out, rec.materials || [])) return;
  const materials = (rec.materials || []).map((m) => {
    const cased = toAppCase(m.name);
    return { name: INPUT_ALIAS[cased] || cased, qty: Number(m.quantity) || 1 };
  });

  const key = toAppCase(out);
  if (existing.has(key.toLowerCase())) return; // already curated
  const skill = rec.skills?.[0];
  if (!skill) return;

  const source = {
    type: skill.name === 'Magic' ? 'SKILL' : 'SKILL',
    name: rec.facilities || skill.name,
    skills: { [skill.name]: Number(skill.level) || 1 },
    inputs: Object.fromEntries(materials.map((m) => [m.name, m.qty])),
    outputYield: Number(rec.output.quantity) || 1,
  };
  if (!items.has(key)) items.set(key, []);
  // de-dupe identical sources
  const sig = JSON.stringify(source);
  const list = items.get(key);
  if (!list.some((s) => JSON.stringify(s) === sig)) list.push(source);
};

for (const rec of fetchRecipes('Smithing')) addRecipe(rec, wantSmithing);
for (const rec of fetchRecipes('Crafting')) addRecipe(rec, wantCrafting);
for (const rec of fetchRecipes('Magic')) addRecipe(rec, wantMagic);

// Drop redundant sources: the wiki often lists the same recipe twice, once
// with the consumable thread/needle spelled out and once without. Keep the
// most detailed one (same skill+facility, inputs are a superset).
for (const [key, list] of items) {
  const keep = list.filter((s, i) =>
    !list.some((other, j) => {
      if (i === j) return false;
      if (other.name !== s.name || JSON.stringify(other.skills) !== JSON.stringify(s.skills)) return false;
      const sKeys = Object.keys(s.inputs);
      const oKeys = Object.keys(other.inputs);
      if (oKeys.length < sKeys.length || (oKeys.length === sKeys.length && j < i)) return false;
      return sKeys.every((k) => other.inputs[k] === s.inputs[k]);
    }),
  );
  items.set(key, keep);
}

// --- emit TS ----------------------------------------------------------------
const esc = (s) => s.replace(/'/g, "\\'");
const fmtSource = (s) => {
  const parts = [
    `type: '${s.type}'`,
    `name: '${esc(s.name)}'`,
    `regions: ['Any']`,
    `skills: { ${Object.entries(s.skills).map(([k, v]) => `'${k}': ${v}`).join(', ')} }`,
  ];
  if (Object.keys(s.inputs).length) {
    parts.push(`inputs: { ${Object.entries(s.inputs).map(([k, v]) => `'${esc(k)}': ${v}`).join(', ')} }`);
  }
  if (s.outputYield > 1) parts.push(`outputYield: ${s.outputYield}`);
  return `{ ${parts.join(', ')} }`;
};

// --- categorise -------------------------------------------------------------
const METAL_OF = /^(Bronze|Iron|Steel|Mithril|Adamant|Rune)\b/;
const categoryOf = (key) => {
  if (/\bd'hide\b/i.test(key)) return "D'hide Armour";
  if (/^(Leather|Hardleather|Hard Leather|Studded|Coif)/i.test(key)) return 'Leather Armour';
  if (JEWELRY.test(key)) return 'Jewellery';
  const m = key.match(METAL_OF);
  if (m) return `${m[1]} Smithing`;
  return 'Jewellery'; // enchanted jewelry without a metal prefix (Ring of …)
};

const keys = [...items.keys()].sort();
const byCat = {};
for (const key of keys) (byCat[categoryOf(key)] ??= []).push(key);

let ts = '';
for (const key of keys) {
  ts += `  '${esc(key)}': [\n`;
  ts += items.get(key).map((s) => `    ${fmtSource(s)}`).join(',\n') + '\n';
  ts += `  ],\n`;
}

let catTs = '';
for (const cat of Object.keys(byCat).sort()) {
  catTs += `  '${esc(cat)}': [\n`;
  catTs += byCat[cat].map((k) => `    '${esc(k)}',`).join('\n') + '\n';
  catTs += `  ],\n`;
}

// --- splice into resourceData.ts -------------------------------------------
const dataPath = new URL('../data/resourceData.ts', import.meta.url);
let src = readFileSync(dataPath, 'utf8');

if (src.includes('CRAFTED ITEMS (generated by')) {
  throw new Error('resourceData.ts already contains a generated block — revert it before re-running.');
}

const mapAnchor = '  ]\n};\n\n// --- CATEGORY GROUPING';
const catAnchor = '  ],\n};\n\n// Reverse lookup';
if (!src.includes(mapAnchor) || !src.includes(catAnchor)) {
  throw new Error('Anchors not found — resourceData.ts structure changed.');
}
src = src.replace(
  mapAnchor,
  `  ],\n\n  // --- CRAFTED ITEMS (generated by scripts/buildCraftables.mjs) ---\n${ts}};\n\n// --- CATEGORY GROUPING`,
);
src = src.replace(
  catAnchor,
  `  ],\n${catTs}};\n\n// Reverse lookup`,
);
writeFileSync(dataPath, src);

writeFileSync(new URL('./_craftables.txt', import.meta.url), ts);
console.log(`Spliced ${keys.length} new items into data/resourceData.ts`);
for (const cat of Object.keys(byCat).sort()) console.log(`  ${cat}: ${byCat[cat].length}`);
