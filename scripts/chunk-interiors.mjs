import { readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync(new URL('../data/sources/interior-access.json', import.meta.url), 'utf8'));
const clean = value => String(value).replace(/~\||\|~/g, '').replace(/\s+/g, ' ').trim();
const baseId = value => String(value).split('-')[0];
const fields = { Monster: 'monster', NPC: 'npc', Object: 'object', Shop: 'shop', Spawn: 'spawn', Quest: 'quest' };
const taskCategories = { monster: 'Monsters', npc: 'NPCs', object: 'Objects', shop: 'Shops', spawn: 'Spawns' };
const entityName = (kind, raw) => kind === 'shop' ? raw.replace(/\.$/, '') : raw.split('#')[0].trim();

/** Retain playable interior evidence without creating purchasable underground coordinates. */
export function buildInteriorContent(data, registry, encode, accessPolicy = policy) {
  const source = data.chunks ?? {};
  const surface = new Set((data.walkableChunks ?? []).map(String));
  const reviewed = new Map((registry?.locations ?? []).flatMap(row => row.sourceKeys.map(key => [key.toLowerCase(), row])));
  const names = new Map();
  for (const [id, blob] of Object.entries(source)) {
    if (/^\d+$/.test(id) && blob.Name) {
      const group = names.get(blob.Name.toLowerCase()) ?? [];
      group.push(id); names.set(blob.Name.toLowerCase(), group);
    }
  }
  const nameOf = id => source[id]?.Name ?? (/^\d+$/.test(id) ? `Interior ${id}` : id);
  const rulesFor = id => {
    const name = nameOf(id);
    return [...new Set([
      accessPolicy.locations?.[name.split('#')[0]],
      accessPolicy.locations?.[name],
      accessPolicy.records?.[id],
    ].filter(Boolean))];
  };
  const entryRequirements = id => [...new Set([
    ...rulesFor(id).flatMap(rule => rule.requirements ?? []),
    ...(data.questSections?.[id] ?? []).map(clean),
  ])];
  const directReviewed = id => {
    const name = nameOf(id);
    const override = rulesFor(id).findLast(rule => rule.anchors || rule.entrances);
    const row = reviewed.get(name.toLowerCase()) ?? reviewed.get(id.toLowerCase());
    if (override?.anchors) return override.anchors.map(chunkId => ({ chunkId, requirements: entryRequirements(id) }));
    if (override?.entrances) return override.entrances.map(entrance => ({
      chunkId: entrance.chunkId,
      requirements: [...new Set([...entryRequirements(id), ...entrance.requirements])],
    }));
    if (row?.disposition === 'mapped') return row.entrances.map(e => ({ chunkId: e.chunkId, requirements: [...new Set([...entryRequirements(id), ...e.requirements])] }));
    return null;
  };
  // Numeric chunks are the precise records; named records supplement missing variants/services.
  const supplemental = (id, blob) => {
    if (/^\d+$/.test(id)) return blob;
    const peers = names.get(id.toLowerCase()) ?? [];
    if (!peers.length) return blob;
    const result = {};
    for (const [field, kind] of Object.entries(fields)) {
      const known = new Set(peers.flatMap(key => [source[key], ...Object.values(source[key].Sections ?? {})])
        .flatMap(record => Object.keys(record[field] ?? {}).map(name => entityName(kind, name))));
      const extra = Object.fromEntries(Object.entries(blob[field] ?? {}).filter(([name]) => !known.has(entityName(kind, name))));
      if (Object.keys(extra).length) result[field] = extra;
    }
    return result;
  };
  const connections = id => {
    const blob = source[id];
    if (!blob) return [];
    const direct = [blob, ...Object.values(blob.Sections ?? {})].flatMap(record => Object.keys(record.Connect ?? {}).map(baseId));
    // A named aggregate can contain remote teleports and other entrances. Prefer
    // the physical record's own edges; consult the aggregate only if absent.
    const fallback = blob.Name && source[blob.Name] ? Object.keys(source[blob.Name].Connect ?? {}).map(baseId) : [];
    return [...new Set(direct.length ? direct : fallback)];
  };
  const routeCache = new Map();
  const routes = start => {
    if (routeCache.has(start)) return routeCache.get(start);
    const queue = [{ id: start, requirements: [], path: [] }];
    const visited = new Set(); const found = new Map(); let nearest = Infinity;
    const recordRoute = route => {
      const previous = found.get(route.chunkId);
      if (!previous || route.via.length < previous.via.length) found.set(route.chunkId, route);
    };
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const { id, requirements, path } = queue[cursor];
      if (path.length > nearest) continue;
      if (visited.has(id)) continue;
      visited.add(id);
      const req = [...new Set([...requirements, ...entryRequirements(id)])];
      if (surface.has(id)) { nearest = Math.min(nearest, path.length); recordRoute({ chunkId: id, requirements: req, via: path }); continue; }
      const explicit = directReviewed(id);
      if (explicit) {
        nearest = Math.min(nearest, path.length + 1);
        for (const e of explicit) if (surface.has(e.chunkId)) {
          recordRoute({ chunkId: e.chunkId, requirements: [...new Set([...req, ...e.requirements])], via: [...path, id] });
        }
        continue;
      }
      for (const next of connections(id)) if (!visited.has(next)) queue.push({ id: next, requirements: req, path: [...path, id] });
    }
    const result = [...found.values()].filter(route => route.via.length <= nearest).sort((a, b) => +a.chunkId - +b.chunkId);
    routeCache.set(start, result); return result;
  };
  const entityRequirements = (id, blob) => {
    const out = {};
    const sourceNames = new Set([id, nameOf(id)]);
    for (const [field, kind] of Object.entries(fields)) {
      if (!taskCategories[kind]) continue;
      for (const raw of Object.keys(blob[field] ?? {})) {
        const entries = data.taskUnlocks?.[taskCategories[kind]]?.[raw] ?? {};
        const selected = Array.isArray(entries) ? entries : Object.entries(entries)
          .filter(([location]) => location === '*' || sourceNames.has(baseId(location)) || sourceNames.has(location))
          .flatMap(([, requirements]) => requirements);
        const requirements = [...new Set(selected.flatMap(value => Object.keys(value ?? {}).map(clean)))];
        if (requirements.length) (out[kind] ??= {})[entityName(kind, raw)] = requirements;
      }
    }
    for (const rule of rulesFor(id)) for (const [kind, entities] of Object.entries(rule.entityRequirements ?? {})) {
      for (const [name, requirements] of Object.entries(entities)) {
        (out[kind] ??= {})[name] = [...new Set([...(out[kind]?.[name] ?? []), ...requirements])];
      }
    }
    return out;
  };
  const interiors = {};
  for (const [id, blob] of Object.entries(source)) {
    if (surface.has(id)) continue;
    const record = supplemental(id, blob);
    const content = encode(record, id);
    if (!Object.keys(content).some(key => key !== 'n')) continue;
    const requirements = entityRequirements(id, record);
    for (const section of Object.values(record.Sections ?? {})) {
      for (const [kind, entities] of Object.entries(entityRequirements(id, section))) {
        for (const [name, reqs] of Object.entries(entities)) {
          ((requirements[kind] ??= {})[name] ??= []).push(...reqs);
        }
      }
    }
    interiors[id] = { name: nameOf(id), content, entrances: routes(id), requirements };
  }
  return interiors;
}

/** Reject invalid curated entrances before they reach any permission index. */
export function validateInteriorAccessPolicy(data, accessPolicy = policy) {
  const surface = new Set((data.walkableChunks ?? []).map(String));
  const source = data.chunks ?? {};
  const names = new Set(Object.values(source).map(row => row.Name).filter(Boolean));
  for (const [scope, rows] of Object.entries({ locations: accessPolicy.locations, records: accessPolicy.records ?? {} })) {
    for (const [key, rule] of Object.entries(rows ?? {})) {
      if (scope === 'records' ? !source[key] : !source[key] && !names.has(key)) throw new Error(`Unknown interior policy ${scope}/${key}`);
      if (rule.anchors && rule.entrances) throw new Error(`Conflicting interior entrances: ${key}`);
      const routes = rule.entrances ?? (rule.anchors ?? []).map(chunkId => ({ chunkId, requirements: [] }));
      const seen = new Set();
      for (const route of routes) {
        if (!surface.has(route.chunkId) || seen.has(route.chunkId)) throw new Error(`Invalid interior entrance: ${key}/${route.chunkId}`);
        seen.add(route.chunkId);
      }
      for (const point of rule.coordinates ?? []) {
        const id = String(Math.floor(point.x / 64) * 256 + Math.floor(point.y / 64));
        if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || !seen.has(id)) throw new Error(`Interior coordinate disagrees with entrance: ${key}`);
      }
      const requirements = [...(rule.requirements ?? []), ...routes.flatMap(route => route.requirements),
        ...Object.values(rule.entityRequirements ?? {}).flatMap(entities => Object.values(entities).flat())];
      if (requirements.some(raw => typeof raw !== 'string' || !raw.trim())) throw new Error(`Invalid interior requirement: ${key}`);
    }
  }
}
