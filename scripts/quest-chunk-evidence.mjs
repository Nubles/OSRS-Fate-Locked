const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const entries = value => Object.entries(value ?? {}).sort(([a], [b]) => compare(a, b));
const canonical = value => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(entries(value).map(([key, child]) => [key, canonical(child)]))
    : value;
const uniqueSorted = values => [...new Set(values)].sort(compare);
const cleanName = value => String(value).replace(/~\||\|~/g, '').replace(/\s+/g, ' ').trim();
const nameKey = value => cleanName(value).toLowerCase();
const entityKey = value => nameKey(String(value).split('#')[0]);
const numericRegion = value => /^\d+$/.test(String(value))
  && Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 65535;
const chunkForRegion = value => `${Math.floor(Number(value) / 256)},${Number(value) % 256}`;
const sortedRows = values => [...new Map(values.map(value => [JSON.stringify(canonical(value)), value])).values()]
  .sort((a, b) => compare(JSON.stringify(canonical(a)), JSON.stringify(canonical(b))));
const requirementStrings = values => uniqueSorted((values ?? []).map(String));

/** Physical 64-tile location only. Underground coordinates are never shifted. */
export function worldPointToChunk(point) {
  if (!point || !['x', 'y', 'plane'].every(key => Number.isSafeInteger(point[key]))
    || point.x < 0 || point.x > 16383 || point.y < 0 || point.y > 16383
    || point.plane < 0 || point.plane > 3) return null;
  const cx = Math.floor(point.x / 64), cy = Math.floor(point.y / 64);
  return { chunkKey: `${cx},${cy}`, cx, cy, regionId: cx * 256 + cy, plane: point.plane };
}

function surfaceCandidate(id, runtime) {
  if (!numericRegion(id) || !Object.hasOwn(runtime.chunks ?? {}, id)
    || Object.hasOwn(runtime.interiors ?? {}, id)) return null;
  return {
    chunkKey: chunkForRegion(id),
    sourceId: String(id),
    via: 'EXPLICIT_CHUNK',
    requirementProvenance: 'NORMALIZED_RUNTIME_GATES',
    requirements: requirementStrings(runtime.questSections?.[id]),
    evidence: { runtimePath: `chunks.${id}`, regionId: Number(id) },
  };
}

function interiorCandidates(id, runtime) {
  const interior = runtime.interiors?.[id];
  if (!interior) return [];
  return (interior.entrances ?? []).flatMap(entrance => {
    const surface = surfaceCandidate(String(entrance.chunkId), runtime);
    if (!surface) return [];
    return [{
      chunkKey: surface.chunkKey,
      sourceId: String(id),
      via: 'INTERIOR_ENTRANCE',
      requirementProvenance: 'NORMALIZED_RUNTIME_GATES',
      requirements: requirementStrings([...surface.requirements, ...(entrance.requirements ?? [])]),
      evidence: {
        runtimePath: `interiors.${id}`,
        interiorId: String(id),
        interiorName: interior.name ?? null,
        ...(numericRegion(id) ? { regionId: Number(id) } : {}),
        entrance: canonical(entrance),
      },
    }];
  });
}

/**
 * Map a physical region to known surface access evidence. An unlisted region
 * produces no candidate; an interior requires an explicit runtime entrance.
 * Multiple entrances remain alternatives, with their original path and gates.
 */
export function resolveRegionAccess(regionId, runtime) {
  if (!numericRegion(regionId)) return [];
  const id = String(Number(regionId));
  // Interior classification wins if inconsistent input contains both records.
  if (Object.hasOwn(runtime.interiors ?? {}, id)) return sortedRows(interiorCandidates(id, runtime));
  const surface = surfaceCandidate(id, runtime);
  return surface ? [surface] : [];
}

const entityFields = [
  { source: 'NPCs', kind: 'npc', content: 'p' },
  { source: 'Objects', kind: 'object', content: 'o' },
  { source: 'Monsters', kind: 'monster', content: 'm' },
];

function indexRuntime(runtime) {
  const locations = new Map(), entities = new Map();
  const add = (index, key, value) => {
    const values = index.get(key) ?? [];
    values.push(value);
    index.set(key, values);
  };
  const addEntities = (id, content, interior) => {
    for (const field of entityFields) for (const rawName of content?.[field.content] ?? []) {
      const name = Array.isArray(rawName) ? rawName[0] : rawName;
      if (typeof name !== 'string') continue;
      add(entities, `${field.kind}:${entityKey(name)}`, { id, name, interior, field });
    }
  };
  for (const [id, content] of entries(runtime.chunks)) {
    if (content.n) add(locations, nameKey(content.n), { id, interior: false });
    addEntities(id, content, false);
  }
  for (const [id, interior] of entries(runtime.interiors)) {
    for (const key of uniqueSorted([nameKey(id), nameKey(interior.name ?? id)])) {
      add(locations, key, { id, interior: true });
    }
    addEntities(id, interior.content, true);
  }
  return { locations, entities };
}

function resolveSourceRef(sourceRef, runtime, index) {
  const numeric = /^(\d+)(?:-(\d+))?$/.exec(sourceRef);
  if (numeric) {
    return resolveRegionAccess(numeric[1], runtime).map(candidate => ({
      ...candidate,
      evidence: {
        ...candidate.evidence,
        sourceRef,
        // ChunkPicker suffixes identify sections. They contain no plane data.
        ...(numeric[2] ? { sectionId: numeric[2] } : {}),
      },
    }));
  }
  return (index.locations.get(nameKey(sourceRef)) ?? []).flatMap(({ id, interior }) => {
    const candidates = interior ? interiorCandidates(id, runtime) : [surfaceCandidate(id, runtime)].filter(Boolean);
    return candidates.map(candidate => ({ ...candidate, evidence: { ...candidate.evidence, sourceRef } }));
  });
}

function resolveEntity(ref, runtime, index) {
  return (index.entities.get(`${ref.kind}:${entityKey(ref.name)}`) ?? []).flatMap(match => {
    const locations = match.interior ? interiorCandidates(match.id, runtime)
      : [surfaceCandidate(match.id, runtime)].filter(Boolean);
    const interiorRequirements = match.interior
      ? runtime.interiors[match.id].requirements?.[ref.kind]?.[match.name] ?? [] : [];
    return locations.map(location => {
      // Surface task unlocks are location-specific. Keep wildcard and exact gates.
      const unlocks = runtime.taskUnlocks?.[match.field.source]?.[match.name] ?? {};
      const entranceId = location.evidence.entrance?.chunkId ?? match.id;
      return {
        ...location,
        via: 'ENTITY',
        requirements: requirementStrings([
          ...location.requirements, ...interiorRequirements,
          ...(unlocks['*'] ?? []), ...(unlocks[entranceId] ?? []),
        ]),
        evidence: {
          ...location.evidence,
          accessVia: location.via,
          entity: { ...ref },
          matchedName: match.name,
          match: nameKey(ref.name) === nameKey(match.name) ? 'EXACT_NAME' : 'BASE_NAME',
          contentField: match.field.content,
        },
      };
    });
  });
}

const metadataFields = new Set(['BaseQuest', 'Description', 'Chunks', 'NPCs', 'Objects', 'Monsters']);
const rewardFields = new Set(['Reward', 'XpReward', 'QuestPoints']);

/**
 * Lossless task/condition evidence for offline review, not executable routing.
 * A CANDIDATES label means some location evidence exists, even if issues retain
 * unresolved references. No list here asserts AND/OR semantics or eligibility.
 */
export function buildChunkQuestEvidence(raw, runtime) {
  if (!raw?.challenges?.Quest || typeof raw.challenges.Quest !== 'object') {
    throw new Error('ChunkPicker detailed quest challenges are missing');
  }
  if (!runtime?.chunks || !runtime?.interiors) {
    throw new Error('Runtime surface and interior content are required');
  }
  const index = indexRuntime(runtime), grouped = new Map();
  for (const [sourceId, task] of entries(raw.challenges.Quest)) {
    if (typeof task.BaseQuest !== 'string' || !task.BaseQuest) {
      throw new Error(`ChunkPicker task has no BaseQuest: ${sourceId}`);
    }
    const sourceRefs = [...(task.Chunks ?? [])];
    const entityRefs = entityFields.flatMap(field => (task[field.source] ?? [])
      .map(name => ({ kind: field.kind, name }))).sort((a, b) => compare(`${a.kind}:${a.name}`, `${b.kind}:${b.name}`));
    const issues = [], candidates = [];
    for (const sourceRef of sourceRefs) {
      const resolved = resolveSourceRef(sourceRef, runtime, index);
      candidates.push(...resolved);
      if (!resolved.length) issues.push({ code: 'UNRESOLVED_SOURCE_REF', sourceRef });
    }
    for (const ref of entityRefs) {
      const resolved = resolveEntity(ref, runtime, index);
      candidates.push(...resolved);
      if (!resolved.length) issues.push({ code: 'UNRESOLVED_ENTITY_REF', ...ref });
      if (new Set(resolved.map(candidate => candidate.chunkKey)).size > 1) {
        issues.push({ code: 'AMBIGUOUS_ENTITY_REF', ...ref });
      }
      if (resolved.some(candidate => candidate.evidence.match === 'BASE_NAME')) {
        issues.push({ code: 'ENTITY_VARIANT_UNVERIFIED', ...ref });
      }
    }
    const dependsOn = Object.keys(task.Tasks ?? {}).sort(compare);
    for (const dependency of dependsOn) {
      const category = task.Tasks[dependency];
      if (!Object.hasOwn(raw.challenges[category] ?? {}, dependency)) {
        issues.push({ code: 'UNRESOLVED_DEPENDENCY', sourceId: dependency, category });
      }
    }
    const taskEvidence = {
      sourceId,
      description: task.Description ?? null,
      dependsOn,
      requirements: {
        items: canonical(task.Items ?? []),
        skills: canonical(task.Skills ?? {}),
        // Preserve unfamiliar fields and dependency category/condition syntax.
        raw: canonical(Object.fromEntries(entries(task).filter(([key]) => !metadataFields.has(key) && !rewardFields.has(key)))),
      },
      rewards: {
        items: canonical(task.Reward ?? []),
        xp: canonical(task.XpReward ?? {}),
        questPoints: task.QuestPoints ?? null,
        raw: canonical(Object.fromEntries(entries(task).filter(([key]) => rewardFields.has(key)))),
      },
      location: {
        sourceRefs,
        sourceGateEvidence: sourceRefs.map(sourceRef => ({
          sourceRef,
          present: Object.hasOwn(raw.questSections ?? {}, sourceRef),
          raw: canonical(raw.questSections?.[sourceRef] ?? null),
          interpretation: 'EXACT_SOURCE_SECTION_ONLY',
        })),
        entityRefs,
        candidates: sortedRows(candidates),
        coverage: candidates.length ? 'CANDIDATES' : sourceRefs.length || entityRefs.length ? 'UNRESOLVED' : 'NO_LOCATION',
        issues: sortedRows(issues),
      },
    };
    const tasks = grouped.get(task.BaseQuest) ?? [];
    tasks.push(taskEvidence);
    grouped.set(task.BaseQuest, tasks);
  }
  const quests = [...grouped].sort(([a], [b]) => compare(a, b)).map(([questId, tasks]) => ({ questId, tasks }));
  const tasks = quests.flatMap(quest => quest.tasks);
  return {
    quests,
    counts: {
      quests: quests.length,
      tasks: tasks.length,
      tasksWithCandidates: tasks.filter(task => task.location.coverage === 'CANDIDATES').length,
      unresolvedTasks: tasks.filter(task => task.location.coverage === 'UNRESOLVED').length,
      tasksWithoutLocation: tasks.filter(task => task.location.coverage === 'NO_LOCATION').length,
      candidateLocations: tasks.reduce((total, task) => total + task.location.candidates.length, 0),
      unresolvedReferences: tasks.reduce((total, task) => total + task.location.issues.filter(issue =>
        issue.code === 'UNRESOLVED_SOURCE_REF' || issue.code === 'UNRESOLVED_ENTITY_REF').length, 0),
    },
  };
}
