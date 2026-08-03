import { buildEntranceIndex, indexNamedTaskUnlockRegistry } from './named-task-unlock-locations.mjs';
const REASONS = new Set([
  'base-record', 'section-merged', 'variant-name-cleaned', 'quest-subpath-collapsed',
  'subarea-suffix-collapsed', 'named-location-unmappable', 'non-walkable-content',
  'empty-walkable-chunk', 'broad-quest-gate-suppressed', 'lite-cap',
  'duplicate-deduped', 'role-promoted-to-first', 'variant-collision-merged',
  'named-location-mapped', 'named-location-instance-only', 'named-location-non-purchasable',
]);

const cleanName = (value) => String(value).split('#')[0].trim();
const stripWiki = (value) => String(value).replace(/~\|/g, '').replace(/\|~/g, '').trim();
const tidyReq = (value) => stripWiki(value).replace(/\s+/g, ' ').replace(/\s+Complete the quest$/i, '').replace(/\s+\d[a-z0-9]*$/i, '').trim();
const numericSort = (a, b) => +a - +b;

function buildSourceInventory(data) {
  const keys = [];
  const add = (category, sourceKey) => keys.push(`${category}\u0000${sourceKey}`);
  (data.walkableChunks ?? []).forEach((_, index) => add('walkableChunks', String(index)));
  for (const key of Object.keys(data.slayerMonsters ?? {})) add('slayerMonsters', key);
  for (const key of Object.keys(data.chunks ?? {})) add('chunks', key);
  for (const key of Object.keys(data.questSections ?? {})) add('questSections', key);
  for (const [category, entities] of Object.entries(data.taskUnlocks ?? {})) for (const [name, value] of Object.entries(entities)) for (const location of (Array.isArray(value) ? ['*'] : Object.keys(value ?? {}))) add('taskUnlocks', `${category}/${name}/${location}`);
  for (const [master, tasks] of Object.entries(data.slayerMasterTasks ?? {})) for (const monster of Object.keys(tasks)) add('slayerMasterTasks', `${master}/${monster}`);
  for (const [skill, challenges] of Object.entries(data.challenges ?? {})) for (const name of Object.keys(challenges)) add('challenges', `${skill}/${name}`);
  for (const key of Object.keys(data.drops ?? {})) add('drops', key);
  for (const key of Object.keys(data.shopItems ?? {})) add('shopItems', key);
  for (const key of Object.keys(data.mapOverlays ?? {})) add('mapOverlays', key);
  for (const [skill, methods] of Object.entries(data.skillItems ?? {})) for (const method of Object.keys(methods)) add('skillItems', `${skill}/${method}`);
  for (const key of Object.keys(data.searchTerms ?? {})) add('searchTerms', key);
  (data.rollingChunks?.bank ?? []).forEach((raw, index) => add('banks', `${raw}@${index}`));
  return keys;
}

function createAudit(sourceManifest, inventory) {
  const events = [];
  const expected = new Set(inventory);
  const add = (category, sourceKey, disposition, reason, targetKeys = [], terminal = true, detail) => {
    if (!REASONS.has(reason)) throw new Error(`Unknown chunk transform audit reason: ${reason}`);
    const event = { category, sourceKey: String(sourceKey), terminal, disposition, reason, targetKeys: [...targetKeys].map(String).sort() };
    if (detail) event.detail = detail;
    events.push(event);
  };
  const finish = () => {
    const terminals = new Map();
    for (const event of events) if (event.terminal) {
      const key = `${event.category}\u0000${event.sourceKey}`;
      if (!expected.has(key)) throw new Error(`Unexpected terminal chunk transform event: ${key}`);
      if (terminals.has(key)) throw new Error(`Duplicate terminal chunk transform event: ${key}`);
      terminals.set(key, event);
    }
    for (const key of expected) if (!terminals.has(key)) throw new Error(`Missing terminal chunk transform event: ${key}`);
    events.sort((a, b) => a.category.localeCompare(b.category) || a.sourceKey.localeCompare(b.sourceKey) || a.disposition.localeCompare(b.disposition) || a.reason.localeCompare(b.reason));
    const categoryTotals = {};
    for (const key of expected) { const [category] = key.split('\u0000'); const total = categoryTotals[category] ??= { source: 0, imported: 0, normalized: 0, excluded: 0, unresolved: 0 }; total.source++; }
    for (const event of terminals.values()) categoryTotals[event.category][event.disposition]++;
    for (const [category, total] of Object.entries(categoryTotals)) if (total.source !== total.imported + total.normalized + total.excluded + total.unresolved) throw new Error(`Unbalanced chunk transform audit category: ${category}`);
    return { schemaVersion: 1, policyVersion: sourceManifest.policyVersion, sourceCommit: sourceManifest.commit, categoryTotals, events };
  };
  return { add, finish };
}

function noteClean(audit, category, sourceKey, raw, target) {
  if (String(raw).includes('#')) audit.add(category, sourceKey, 'normalized', 'variant-name-cleaned', [target], false);
}

function mergeBlob(rec, blob, slayerReq, audit, sourceKey, isSection) {
  if (blob.Monster) for (const [raw, count] of Object.entries(blob.Monster)) {
    const name = cleanName(raw); noteClean(audit, 'chunks', sourceKey, raw, name);
    const req = slayerReq.get(raw) ?? slayerReq.get(name); const cur = rec.monsters.get(name);
    if (cur) { cur.count += count; if (req != null) cur.slayer = cur.slayer == null ? req : Math.min(cur.slayer, req); audit.add('chunks', sourceKey, 'normalized', 'duplicate-deduped', [name], false); }
    else rec.monsters.set(name, { count, slayer: req ?? null });
  }
  if (blob.NPC) for (const raw of Object.keys(blob.NPC)) { const name = cleanName(raw); noteClean(audit, 'chunks', sourceKey, raw, name); if (rec.npcs.has(name)) audit.add('chunks', sourceKey, 'normalized', 'duplicate-deduped', [name], false); rec.npcs.add(name); }
  if (blob.Object) for (const [raw, count] of Object.entries(blob.Object)) { const name = cleanName(raw); noteClean(audit, 'chunks', sourceKey, raw, name); if (rec.objects.has(name)) audit.add('chunks', sourceKey, 'normalized', 'duplicate-deduped', [name], false); rec.objects.set(name, (rec.objects.get(name) ?? 0) + count); }
  if (blob.Shop) for (const raw of Object.keys(blob.Shop)) { const name = raw.replace(/\.$/, ''); if (rec.shops.has(name)) audit.add('chunks', sourceKey, 'normalized', 'duplicate-deduped', [name], false); rec.shops.add(name); }
  if (blob.Quest) for (const [raw, kind] of Object.entries(blob.Quest)) {
    const base = cleanName(raw.split('/')[0]);
    if (raw.includes('/')) audit.add('chunks', sourceKey, 'normalized', 'quest-subpath-collapsed', [base], false);
    noteClean(audit, 'chunks', sourceKey, raw, base);
    const prior = rec.quests.get(base);
    if (kind === 'first' && prior !== 'first') { if (prior) audit.add('chunks', sourceKey, 'normalized', 'role-promoted-to-first', [base], false); rec.quests.set(base, 'first'); }
    else if (!prior) rec.quests.set(base, 'step');
    else audit.add('chunks', sourceKey, 'normalized', 'duplicate-deduped', [base], false);
  }
  if (blob.Diary) for (const [area, refs] of Object.entries(blob.Diary)) { if (rec.diaries.has(area)) audit.add('chunks', sourceKey, 'normalized', 'duplicate-deduped', [area], false); rec.diaries.set(area, rec.diaries.has(area) ? `${rec.diaries.get(area)}, ${refs}` : String(refs)); }
  if (blob.Clue) for (const [tier, count] of Object.entries(blob.Clue)) { if (rec.clues.has(tier)) audit.add('chunks', sourceKey, 'normalized', 'duplicate-deduped', [tier], false); rec.clues.set(tier, (rec.clues.get(tier) ?? 0) + count); }
  if (blob.Spawn) for (const raw of Object.keys(blob.Spawn)) { const name = cleanName(raw); noteClean(audit, 'chunks', sourceKey, raw, name); if (rec.spawns.has(name)) audit.add('chunks', sourceKey, 'normalized', 'duplicate-deduped', [name], false); rec.spawns.add(name); }
  if (isSection) audit.add('chunks', sourceKey, 'normalized', 'section-merged', [sourceKey], false);
}

function buildConnect(data) {
  const adj = new Map();
  const link = (a, b) => { if (a === b) return; if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set()); adj.get(a).add(b); adj.get(b).add(a); };
  const eat = (id, blob) => { if (blob.Connect) for (const target of Object.keys(blob.Connect)) link(String(id), String(target)); };
  for (const [id, chunk] of Object.entries(data.chunks ?? {})) { eat(id, chunk); for (const section of Object.values(chunk.Sections ?? {})) eat(id, section); }
  return Object.fromEntries([...adj.entries()].map(([id, set]) => [id, [...set].sort()]));
}

function groupCanonical(entries, targetOf) {
  const groups = new Map();
  for (const entry of entries) {
    const target = targetOf(entry);
    const rows = groups.get(target) ?? [];
    rows.push(entry);
    groups.set(target, rows);
  }
  return groups;
}

function assertNoCanonicalCollisions(category, groups, sourceOf) {
  for (const [target, rows] of groups) {
    if (rows.length < 2) continue;
    throw new Error(`Unreviewed ${category} canonical collision: ${target} <= ${rows.map(sourceOf).join(', ')}`);
  }
}

function buildSlayerMasters(data, audit) {
  const out = {};
  for (const [master, tasks] of Object.entries(data.slayerMasterTasks ?? {})) {
    const taskEntries = Object.entries(tasks).map(([monster, info]) => ({ monster, info }));
    const groups = groupCanonical(taskEntries, ({ monster }) => cleanName(monster));
    assertNoCanonicalCollisions('slayerMasterTasks', groups, ({ monster }) => `${master}/${monster}`);
    const result = {};
    for (const { monster, info } of taskEntries) {
      const name = cleanName(monster); const entry = { weight: info.Weight ?? 1 };
      if (info.CombatLevel != null) entry.combat = info.CombatLevel;
      if (info.Level != null) entry.slayer = info.Level;
      const req = Object.keys(info.Tasks ?? {}).map(stripWiki); if (req.length) entry.req = req;
      result[name] = entry;
      audit.add('slayerMasterTasks', `${master}/${monster}`, monster.includes('#') ? 'normalized' : 'imported', monster.includes('#') ? 'variant-name-cleaned' : 'base-record', [`${master}/${name}`]);
    }
    out[master] = result;
  }
  return out;
}

function buildShortcuts(data, audit) {
  const out = [];
  for (const [skill, challenges] of Object.entries(data.challenges ?? {})) for (const [name, info] of Object.entries(challenges)) {
    const sourceKey = `${skill}/${name}`;
    if (!(info.Category ?? []).includes('Shortcut')) { audit.add('challenges', sourceKey, 'excluded', 'non-walkable-content', []); continue; }
    const target = `${skill}/${stripWiki(name)}`;
    out.push({ name: stripWiki(name), skill, level: info.Level ?? 1, objects: (info.Objects ?? []).map(cleanName), chunks: info.Chunks ?? [] });
    audit.add('challenges', sourceKey, name.includes('#') ? 'normalized' : 'imported', name.includes('#') ? 'variant-name-cleaned' : 'base-record', [target]);
  }
  return out;
}
function buildDrops(data, audit) {
  const out = {};
  const rows = Object.entries(data.drops ?? {}).map(([rawKey, table]) => ({ rawKey, table }));
  const groups = groupCanonical(rows, ({ rawKey }) => cleanName(rawKey));
  for (const [target, sources] of groups) {
    const items = [...new Set(sources.flatMap(({ table }) => Object.keys(table).map(cleanName)))].sort();
    if (items.length) out[target] = items;
    const collision = sources.length > 1;
    const groupSources = sources.map(({ rawKey }) => rawKey).sort();
    for (const { rawKey, table } of sources) {
      const cleaned = rawKey !== target || Object.keys(table).some((item) => cleanName(item) !== item);
      const detail = collision
        ? `Merged raw drop table "${rawKey}" into canonical "${target}" using sorted unique item union across: ${groupSources.join(', ')}`
        : undefined;
      audit.add(
        'drops',
        rawKey,
        collision || cleaned ? 'normalized' : items.length ? 'imported' : 'excluded',
        collision ? 'variant-collision-merged' : cleaned ? 'variant-name-cleaned' : items.length ? 'base-record' : 'non-walkable-content',
        items.length ? [target] : [],
        true,
        detail,
      );
    }
  }
  return out;
}

function buildShopItems(data, audit) {
  const out = {};
  const rows = Object.entries(data.shopItems ?? {}).map(([rawKey, items]) => ({ rawKey, items }));
  const groups = groupCanonical(rows, ({ rawKey }) => rawKey.replace(/\.$/, ''));
  assertNoCanonicalCollisions('shopItems', groups, ({ rawKey }) => rawKey);
  for (const { rawKey, items } of rows) {
    const target = rawKey.replace(/\.$/, '');
    out[target] = Object.keys(items).map(cleanName).sort();
    const normalized = rawKey !== target || Object.keys(items).some((item) => cleanName(item) !== item);
    audit.add('shopItems', rawKey, normalized ? 'normalized' : 'imported', normalized ? 'variant-name-cleaned' : 'base-record', [target]);
  }
  return out;
}

function buildOverlays(data, audit) {
  const out = {};
  const rows = Object.entries(data.mapOverlays ?? {}).map(([rawKey, points]) => ({ rawKey, points }));
  const groups = groupCanonical(rows, ({ rawKey }) => rawKey.split('|')[0].trim());
  assertNoCanonicalCollisions('mapOverlays', groups, ({ rawKey }) => rawKey);
  for (const { rawKey, points } of rows) {
    const target = rawKey.split('|')[0].trim();
    if (!Array.isArray(points) || !points.length) {
      audit.add('mapOverlays', rawKey, 'excluded', 'non-walkable-content', []);
      continue;
    }
    out[target] = points.map((point) => {
      const item = { x: point.x, y: point.y, cx: Math.floor(point.x / 64), cy: Math.floor(point.y / 64) };
      if (point.type) item.t = point.type;
      if (point.text) item.h = stripWiki(point.text);
      return item;
    });
    audit.add('mapOverlays', rawKey, rawKey === target ? 'imported' : 'normalized', rawKey === target ? 'base-record' : 'variant-name-cleaned', [target]);
  }
  return out;
}

function buildSkillList(sources) {
  const byItem = new Map();
  for (const { method, items } of sources) {
    for (const [rawItem, stages] of Object.entries(items)) {
      const item = cleanName(rawItem);
      const evidence = byItem.get(item) ?? new Map();
      for (const [stage, rate] of Object.entries(stages)) {
        const key = `${rawItem}\u0000${stage}\u0000${rate}`;
        const contribution = evidence.get(key) ?? {
          rawItem,
          stage: String(stage),
          rate: String(rate),
          methods: new Set(),
        };
        contribution.methods.add(stripWiki(method));
        evidence.set(key, contribution);
      }
      byItem.set(item, evidence);
    }
  }
  return [...byItem.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([item, evidence]) => {
    const contributions = [...evidence.values()].sort((a, b) =>
      a.stage.localeCompare(b.stage, 'en', { numeric: true }) ||
      a.rate.localeCompare(b.rate, 'en', { numeric: true }) ||
      a.rawItem.localeCompare(b.rawItem)
    );
    const rawItems = new Set(contributions.map(({ rawItem }) => rawItem));
    if (contributions.length === 1 && rawItems.size === 1) {
      return [item, contributions[0].rate];
    }
    const stageCounts = new Map();
    for (const { stage } of contributions) stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
    const rateString = contributions.map(({ rawItem, stage, rate, methods }) => {
      const context = rawItems.size > 1
        ? ` (${rawItem})`
        : stageCounts.get(stage) > 1
          ? ` (${[...methods].sort().join(' + ')})`
          : '';
      return `${stage} @ ${rate}${context}`;
    }).join(', ');
    return [item, rateString];
  });
}

function buildSkillItems(data, audit) {
  const out = {};
  const rows = [];
  for (const [skill, methods] of Object.entries(data.skillItems ?? {})) {
    for (const [method, items] of Object.entries(methods)) rows.push({ skill, method, items });
  }
  const groups = groupCanonical(rows, ({ skill, method }) => `${stripWiki(skill)}\u0000${cleanName(stripWiki(method))}`);
  for (const [canonical, sources] of groups) {
    const [targetSkill, targetMethod] = canonical.split('\u0000');
    const collision = sources.length > 1;
    const list = buildSkillList(sources);
    if (list.length) {
      const methods = out[targetSkill] ?? {};
      methods[targetMethod] = list;
      out[targetSkill] = methods;
    }
    const groupSources = sources.map(({ skill, method }) => `${skill}/${method}`).sort();
    for (const { skill, method, items } of sources) {
      const sourceKey = `${skill}/${method}`;
      const normalized = stripWiki(skill) !== skill || cleanName(stripWiki(method)) !== method || Object.keys(items).some((item) => cleanName(item) !== item);
      const detail = collision
        ? `Merged raw skill method "${sourceKey}" into canonical "${targetSkill}/${targetMethod}" using item + stage + rate union across: ${groupSources.join(', ')}`
        : undefined;
      audit.add(
        'skillItems',
        sourceKey,
        collision || normalized ? 'normalized' : list.length ? 'imported' : 'excluded',
        collision ? 'variant-collision-merged' : normalized ? 'variant-name-cleaned' : list.length ? 'base-record' : 'non-walkable-content',
        list.length ? [`${targetSkill}/${targetMethod}`] : [],
        true,
        detail,
      );
    }
  }
  return out;
}
function buildBanks(data, audit) {
  const set = new Set();
  for (const [index, raw] of (data.rollingChunks?.bank ?? []).entries()) {
    const sourceKey = `${raw}@${index}`, base = String(raw).split('-')[0];
    if (!/^\d+$/.test(base)) { audit.add('banks', sourceKey, 'excluded', 'non-walkable-content', []); continue; }
    const duplicate = set.has(base); set.add(base);
    audit.add('banks', sourceKey, duplicate || String(raw).includes('-') ? 'normalized' : 'imported', duplicate ? 'duplicate-deduped' : String(raw).includes('-') ? 'subarea-suffix-collapsed' : 'base-record', [base]);
  }
  return [...set].sort(numericSort);
}
function buildTags(data, chunkRecs, shopItems, drops) { const add = (map, name, id) => { const set = map.get(name) ?? new Set(); set.add(id); map.set(name, set); }; const Monsters = new Map(), NPCs = new Map(), Objects = new Map(), items = new Map(); for (const [id, entry] of Object.entries(chunkRecs)) { for (const monster of entry.m ?? []) { add(Monsters, monster[0], id); for (const item of drops[monster[0]] ?? []) add(items, item, id); } for (const name of entry.p ?? []) add(NPCs, name, id); for (const object of entry.o ?? []) add(Objects, object[0], id); for (const shop of entry.s ?? []) for (const item of shopItems[shop] ?? []) add(items, item, id); } const maps = { Items: items, Monsters, NPCs, Objects }, out = {}; for (const [key, names] of Object.entries(data.searchTerms ?? {})) { const [tag, type] = key.split('|'), map = maps[type]; if (!tag || !map) continue; const set = out[tag] ?? new Set(); for (const raw of Object.keys(names)) for (const id of map.get(cleanName(raw)) ?? []) set.add(id); if (set.size) out[tag] = set; } return Object.fromEntries(Object.entries(out).map(([tag, set]) => [tag, [...set].sort(numericSort)])); }

function cleanReqs(values, audit, sourceKey, category) {
  const result = new Set(); let duplicated = false;
  for (const value of values) for (const raw of Object.keys(value ?? {})) { const clean = tidyReq(raw); if (clean) { if (result.has(clean)) duplicated = true; result.add(clean); } }
  if (duplicated) audit.add(category, sourceKey, 'normalized', 'duplicate-deduped', [...result], false);
  return [...result].sort();
}

function buildQuestSections(data, audit) {
  const raw = {}, entries = Object.entries(data.questSections ?? {});
  for (const [location, values] of entries) {
    const base = String(location).split('-')[0];
    if (!/^\d+$/.test(base)) { audit.add('questSections', location, 'unresolved', 'named-location-unmappable', []); continue; }
    const reqs = (Array.isArray(values) ? values : []).map((value) => typeof value === 'string' ? tidyReq(value) : '').filter(Boolean);
    if (String(location).includes('-')) audit.add('questSections', location, 'normalized', 'subarea-suffix-collapsed', [base], false);
    raw[base] = [...new Set([...(raw[base] ?? []), ...reqs])].sort();
  }
  const counts = {}; for (const reqs of Object.values(raw)) for (const req of reqs) counts[req] = (counts[req] ?? 0) + 1;
  const out = {};
  for (const [location, values] of entries) {
    const base = String(location).split('-')[0]; if (!/^\d+$/.test(base)) continue;
    const reqs = (Array.isArray(values) ? values : []).map((value) => typeof value === 'string' ? tidyReq(value) : '').filter(Boolean);
    const kept = reqs.filter((req) => counts[req] <= 150);
    if (kept.length) out[base] = [...new Set([...(out[base] ?? []), ...kept])].sort();
    const broad = reqs.length > 0 && kept.length === 0;
    audit.add('questSections', location, broad ? 'excluded' : String(location).includes('-') ? 'normalized' : 'imported', broad ? 'broad-quest-gate-suppressed' : String(location).includes('-') ? 'subarea-suffix-collapsed' : 'base-record', kept.length ? [base] : []);
  }
  return out;
}

function buildTaskUnlocks(data, audit, namedLocationIndex) {
  const out = {};
  for (const [category, entities] of Object.entries(data.taskUnlocks ?? {})) {
    const result = {};
    for (const [rawName, value] of Object.entries(entities)) {
      const name = cleanName(rawName), locations = Array.isArray(value) ? [['*', value]] : Object.entries(value ?? {}), byChunk = result[name] ?? {};
      for (const [location, requirements] of locations) {
        const sourceKey = `${category}/${rawName}/${location}`;
        if (!Array.isArray(requirements)) { audit.add('taskUnlocks', sourceKey, 'excluded', 'non-walkable-content', []); continue; }
        if (location !== '*') {
          const base = String(location).split('-')[0];
          if (!/^\d+$/.test(base)) {
            const namedLocation = namedLocationIndex.get(location);
            if (!namedLocation) { audit.add('taskUnlocks', sourceKey, 'unresolved', 'named-location-unmappable', []); continue; }
            if (namedLocation.disposition === 'instance-only') { audit.add('taskUnlocks', sourceKey, 'excluded', 'named-location-instance-only', []); continue; }
            if (namedLocation.disposition === 'non-purchasable') { audit.add('taskUnlocks', sourceKey, 'excluded', 'named-location-non-purchasable', []); continue; }
            if (namedLocation.disposition !== 'mapped') { audit.add('taskUnlocks', sourceKey, 'unresolved', 'named-location-unmappable', []); continue; }

            const reqs = cleanReqs(requirements, audit, sourceKey, 'taskUnlocks');
            const entranceChunks = (namedLocation.entrances ?? []).map(({ chunkId }) => String(chunkId));
            const chunkIds = [...new Set(entranceChunks)].sort(numericSort);
            const targetKeys = reqs.length ? chunkIds.map((chunkId) => `${name}/${chunkId}`) : [];
            const duplicate = entranceChunks.length !== chunkIds.length || chunkIds.some((chunkId) => Boolean(byChunk[chunkId]));
            if (rawName.includes('#')) audit.add('taskUnlocks', sourceKey, 'normalized', 'variant-name-cleaned', targetKeys, false);
            if (duplicate) audit.add('taskUnlocks', sourceKey, 'normalized', 'duplicate-deduped', targetKeys, false);
            if (reqs.length) for (const chunkId of chunkIds) byChunk[chunkId] = [...new Set([...(byChunk[chunkId] ?? []), ...reqs])].sort();
            audit.add('taskUnlocks', sourceKey, 'normalized', 'named-location-mapped', targetKeys);
            continue;
          }
          const reqs = cleanReqs(requirements, audit, sourceKey, 'taskUnlocks'), duplicate = Boolean(byChunk[base]);
          if (reqs.length) byChunk[base] = [...new Set([...(byChunk[base] ?? []), ...reqs])].sort();
          const normalized = rawName.includes('#') || String(location).includes('-') || duplicate;
          audit.add('taskUnlocks', sourceKey, normalized ? 'normalized' : 'imported', duplicate ? 'duplicate-deduped' : rawName.includes('#') ? 'variant-name-cleaned' : String(location).includes('-') ? 'subarea-suffix-collapsed' : 'base-record', reqs.length ? [`${name}/${base}`] : []);
        } else {
          const reqs = cleanReqs(requirements, audit, sourceKey, 'taskUnlocks'), duplicate = Boolean(byChunk['*']);
          if (reqs.length) byChunk['*'] = [...new Set([...(byChunk['*'] ?? []), ...reqs])].sort();
          audit.add('taskUnlocks', sourceKey, rawName.includes('#') || duplicate ? 'normalized' : 'imported', duplicate ? 'duplicate-deduped' : rawName.includes('#') ? 'variant-name-cleaned' : 'base-record', reqs.length ? [`${name}/*`] : []);
        }
      }
      if (Object.keys(byChunk).length) result[name] = byChunk;
    }
    if (Object.keys(result).length) out[category] = result;
  }
  return out;
}
function addBaseRecords(audit, category, value) {
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item]) : Object.entries(value ?? {});
  for (const [key] of entries) audit.add(category, key, 'imported', 'base-record', [key]);
}

function buildLite(doc, audit) {
  const PATCH_RE = /patch|allotment|vinery|grape ?vine|seaweed/i;
  const POI_RE = /\bbank\b|altar|anvil|furnace|cooking range|\brange\b|spinning wheel|loom|pottery|deposit box|grand exchange|obelisk|fairy ring|spirit tree|charter|slayer master/i;
  const flat = (items) => (items ?? []).map((item) => Array.isArray(item) ? item[0] : item).filter(Boolean);
  const cap = (items, length, id, kind) => { const unique = [...new Set(items)]; if (unique.length > length) audit.add('lite', `${id}/${kind}`, 'normalized', 'lite-cap', unique.slice(0, length), false, `${unique.length} source values capped at ${length}`); return unique.slice(0, length); };
  const lite = {};
  for (const [id, chunk] of Object.entries(doc.chunks ?? {})) {
    const region = +id; if (!Number.isFinite(region)) continue; const cx = region >> 8, cy = region & 255;
    const mon = cap([...(chunk.m ?? [])].sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map((value) => value[0]).filter(Boolean), 6, id, 'mon');
    const shop = cap(flat(chunk.s), 8, id, 'shop'); const objects = flat(chunk.o);
    const farm = cap(objects.filter((name) => PATCH_RE.test(name)), 8, id, 'farm'); const poi = cap(objects.filter((name) => POI_RE.test(name) && !PATCH_RE.test(name)), 8, id, 'poi');
    const entry = {}; if (mon.length) entry.mon = mon; if (shop.length) entry.shop = shop; if (farm.length) entry.farm = farm; if (poi.length) entry.poi = poi; if (Object.keys(entry).length) lite[`${cx},${cy}`] = entry;
  }
  return `// AUTO-GENERATED by scripts/sync-chunk-content.mjs — do not edit by hand.\n// Slim per-chunk "what's here" summary for the RuneLite bundle export.\n// Keyed "cx,cy"; categories: mon(sters) / shop(s) / farm (patches) / poi (banks, altars…).\n\nexport type ChunkContentEntry = { mon?: string[]; shop?: string[]; farm?: string[]; poi?: string[] };\nexport const CHUNK_CONTENT_LITE: Record<string, ChunkContentEntry> = ${JSON.stringify(lite)};\n`;
}

export function transformChunkContent(data, sourceManifest, namedLocationRegistry = null) {
  const namedLocationIndex = namedLocationRegistry
    ? indexNamedTaskUnlockRegistry(namedLocationRegistry) : new Map();
  const audit = createAudit(sourceManifest, buildSourceInventory(data)); const walkable = new Set((data.walkableChunks ?? []).map(String)); const slayerReq = new Map(Object.entries(data.slayerMonsters ?? {}));
  addBaseRecords(audit, 'walkableChunks', data.walkableChunks ?? []); addBaseRecords(audit, 'slayerMonsters', data.slayerMonsters ?? {});
  const chunks = {};
  for (const [id, chunk] of Object.entries(data.chunks ?? {})) {
    if (!walkable.has(String(id))) { audit.add('chunks', id, 'excluded', 'non-walkable-content', []); continue; }
    const rec = { monsters: new Map(), npcs: new Set(), objects: new Map(), shops: new Set(), quests: new Map(), diaries: new Map(), clues: new Map(), spawns: new Set() };
    mergeBlob(rec, chunk, slayerReq, audit, id, false); for (const section of Object.values(chunk.Sections ?? {})) mergeBlob(rec, section, slayerReq, audit, id, true);
    const entry = {}, nick = chunk.Nickname ?? chunk.Name;
    if (nick && nick !== 'Ocean Chunk') entry.n = nick;
    if (rec.monsters.size) entry.m = [...rec.monsters.entries()].sort((a, b) => b[1].count - a[1].count).map(([name, value]) => value.slayer != null ? [name, value.count, value.slayer] : [name, value.count]);
    if (rec.npcs.size) entry.p = [...rec.npcs].sort(); if (rec.objects.size) entry.o = [...rec.objects.entries()].sort((a, b) => b[1] - a[1]); if (rec.shops.size) entry.s = [...rec.shops].sort(); if (rec.quests.size) entry.q = Object.fromEntries([...rec.quests.entries()].sort()); if (rec.diaries.size) entry.d = Object.fromEntries(rec.diaries); if (rec.clues.size) entry.c = Object.fromEntries(rec.clues); if (rec.spawns.size) entry.i = [...rec.spawns].sort();
    if (!Object.keys(entry).length) { audit.add('chunks', id, 'excluded', 'empty-walkable-chunk', []); continue; }
    chunks[id] = entry;
    const normalized = Object.values(chunk.Sections ?? {}).length > 0;
    audit.add('chunks', id, normalized ? 'normalized' : 'imported', normalized ? 'section-merged' : 'base-record', [id]);
  }
  const connect = buildConnect(data), slayerMasters = buildSlayerMasters(data, audit), shortcuts = buildShortcuts(data, audit), shopItems = buildShopItems(data, audit), drops = buildDrops(data, audit), overlays = buildOverlays(data, audit), skillItems = buildSkillItems(data, audit), taskUnlocks = buildTaskUnlocks(data, audit, namedLocationIndex), questSections = buildQuestSections(data, audit), banks = buildBanks(data, audit), tags = buildTags(data, chunks, shopItems, drops);
  addBaseRecords(audit, 'searchTerms', data.searchTerms ?? {});
  const sourceMeta = { repository: sourceManifest.repository, commit: sourceManifest.commit, blobSha: sourceManifest.blobSha, rawSha256: sourceManifest.rawSha256, policyVersion: sourceManifest.policyVersion, namedLocationPolicyVersion: namedLocationRegistry?.policyVersion, namedLocationReviewedAt: namedLocationRegistry?.reviewedAt };
  const entrances = buildEntranceIndex(namedLocationRegistry ?? { locations: [] });
  const full = { version: 9, source: 'source-chunk/chunk-picker-v2 (chunkpicker-chunkinfo-export.json, gh-pages)', sourceMeta, entrances, chunks, connect, slayerMasters, shortcuts, shopItems, drops, overlays, skillItems, taskUnlocks, questSections, banks, tags };
  const liteSource = buildLite(full, audit); const finalAudit = audit.finish();
  return { full, liteSource, audit: finalAudit };
}

export function assertChunkTransform(result, sourceManifest) {
  for (const [category, total] of Object.entries(result.audit.categoryTotals)) if (total.source !== total.imported + total.normalized + total.excluded + total.unresolved) throw new Error(`Unbalanced chunk transform audit category: ${category}`);
  const unresolved = result.audit.events.filter(
    (event) => event.category === 'taskUnlocks' && event.disposition === 'unresolved',
  );
  if (unresolved.length) throw new Error(`Unresolved task-unlock records: ${unresolved.length}`);
  const floors = sourceManifest.countFloors ?? {}; const full = result.full;
  const actual = { contentChunks: Object.keys(full.chunks).length, connections: Object.keys(full.connect).length, slayerMasters: Object.keys(full.slayerMasters).length, shortcuts: full.shortcuts.length, shops: Object.keys(full.shopItems).length, dropTables: Object.keys(full.drops).length, questSections: Object.keys(full.questSections).length, banks: full.banks.length, tags: Object.keys(full.tags).length };
  for (const [key, floor] of Object.entries(floors)) if ((actual[key] ?? 0) < floor) throw new Error(`Chunk transform floor failed for ${key}: expected at least ${floor}, received ${actual[key] ?? 0}`);
}
