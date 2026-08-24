import { createHash } from 'node:crypto';

const EXPECTED_COUNTS = Object.freeze({
  total: 210,
  quest: 191,
  miniquest: 19,
  f2pQuest: 22,
  f2pMiniquest: 1,
  membersQuest: 169,
  membersMiniquest: 18,
});
const EXPECTED_AUDIT_STATUSES = Object.freeze({
  verified: 1,
  'verified-with-notes': 206,
  unresolved: 3,
});
const EXPECTED_MILESTONES = Object.freeze({ 1: 5, 2: 18, 3: 91, 4: 62, 5: 34 });
const EXPECTED_RFD_IDS = Object.freeze([
  'RFD: Dwarf', 'RFD: Evil Dave', 'RFD: Finale', 'RFD: Goblins',
  'RFD: King Awowogei', 'RFD: Lumbridge Guide', 'RFD: Pirate Pete',
  'RFD: Sir Amik Varze', 'RFD: Skrach Uglogwee', 'RFD: The Cook',
]);
const SOURCE_FILES = Object.freeze([
  'data/sources/quest-list.json',
  'data/sources/quest-requirement-audit.json',
  'data/sources/f2p-quest-membership.json',
  'data/sources/runeproof-complexity-overrides.json',
]);
const OVERRIDE_KEYS = Object.freeze([
  'questId', 'fromMilestone', 'toMilestone', 'reviewer', 'reviewedAt', 'reason',
]);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const assertExactKeys = (value, expected, label) => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(JSON.stringify(actual) === JSON.stringify(wanted),
    `${label} must contain exactly: ${wanted.join(', ')}`);
};

const isValidDate = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const canonicalValue = value => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalValue(child)]));
  }
  return value;
};

export const stableJson = value => `${JSON.stringify(canonicalValue(value), null, 2)}\n`;

const questRequirementFingerprint = quest => JSON.stringify({
  kind: quest.kind,
  accessPolicy: quest.accessPolicy,
  regions: canonicalValue(quest.regions),
  locations: canonicalValue(quest.locations),
  skills: canonicalValue(quest.skills),
  combatLevel: quest.combatLevel,
  prereqs: canonicalValue(quest.prereqs),
  oneOf: canonicalValue(quest.oneOf),
  manualRequirements: canonicalValue(quest.manualRequirements),
  points: quest.points,
});

const normalizedSlug = questId => questId
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[\u2018\u2019']/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const classifyRuneProofComplexity = ({ quest, audit, prerequisiteDepth }) => {
  const skillGateCount = Object.keys(quest.skills ?? {})
    .filter(skill => skill !== 'Quest Points').length;
  const partialNotes = audit.notes.partialCompletion
    .map(note => note.trim())
    .filter(note => note.length > 0 && note !==
      'No additional unavoidable manual or alternative completion gate was identified beyond the recorded runtime fields.');
  const uniqueRegions = new Set([
    ...(quest.regions ?? []),
    ...(quest.oneOf ?? []).flatMap(option => option.regions ?? []),
  ]);
  const uniqueLocations = new Set([
    ...(quest.locations ?? []).map(location => location.id),
    ...(quest.oneOf ?? []).flatMap(option =>
      (option.locations ?? []).map(location => location.id)),
  ]);
  const difficultyName = String(quest.difficulty).toUpperCase();
  const difficultyWeight = difficultyName.includes('GRANDMASTER') ? 12
    : difficultyName.includes('MASTER') ? 8
      : difficultyName.includes('EXPERIENCED') ? 4
        : difficultyName.includes('INTERMEDIATE') ? 2
          : 0;
  const dimensions = Object.freeze({
    prerequisiteDepth,
    prerequisiteFanOut: (quest.prereqs ?? []).length,
    skillGateCount,
    questPointGate: Number((quest.skills ?? {})['Quest Points'] ?? 0) > 0,
    combatGate: Number.isFinite(quest.combatLevel),
    uniqueRegionCount: uniqueRegions.size,
    uniqueLocationCount: uniqueLocations.size,
    itemNoteCount: audit.notes.items.length,
    travelNoteCount: audit.notes.travel.length,
    instanceSignal: audit.notes.instances.some(note => note.trim().length > 0),
    positivePartialSignal: partialNotes.length > 0,
    manualConditionCount: (quest.manualRequirements ?? []).length,
    alternativeRequirementCount: (quest.oneOf ?? []).length,
  });
  const flags = [
    ...(audit.status === 'unresolved' ? ['UNRESOLVED_AUDIT'] : []),
    ...(dimensions.instanceSignal ? ['INSTANCE_EVIDENCE'] : []),
    ...(dimensions.positivePartialSignal ? ['PARTIAL_COMPLETION'] : []),
    ...(dimensions.manualConditionCount > 0 ? ['MANUAL_CONDITION'] : []),
    ...(dimensions.alternativeRequirementCount > 0 ? ['ALTERNATIVE_REQUIREMENT'] : []),
    ...(dimensions.questPointGate ? ['QUEST_POINT_GATE'] : []),
    ...(dimensions.combatGate ? ['COMBAT_GATE'] : []),
    ...(difficultyName.includes('GRANDMASTER') ? ['GRANDMASTER'] : []),
    ...(!difficultyName.includes('GRANDMASTER') && difficultyName.includes('MASTER')
      ? ['MASTER'] : []),
  ];
  const score = difficultyWeight
    + prerequisiteDepth
    + dimensions.prerequisiteFanOut
    + Math.min(skillGateCount, 6)
    + (dimensions.questPointGate ? 2 : 0)
    + Math.ceil((dimensions.uniqueRegionCount + dimensions.uniqueLocationCount) / 2)
    + (dimensions.instanceSignal ? 2 : 0)
    + (dimensions.positivePartialSignal ? 2 : 0)
    + (dimensions.manualConditionCount > 0 ? 4 : 0)
    + (dimensions.alternativeRequirementCount > 0 ? 4 : 0)
    + (dimensions.combatGate ? 3 : 0)
    + (audit.status === 'unresolved' ? 20 : 0);
  const milestone = flags.includes('UNRESOLVED_AUDIT')
    || flags.includes('MASTER')
    || flags.includes('GRANDMASTER')
    || score >= 20
    ? 5
    : score <= 9
      ? 3
      : 4;
  return Object.freeze({
    schemaVersion: 1,
    score,
    baselineMilestone: milestone,
    assignedMilestone: milestone,
    dimensions,
    flags: Object.freeze(flags),
  });
};

const validateOverrideContainer = (overrides, assessments, f2pIds) => {
  assert(isRecord(overrides), 'complexity override snapshot must be an object');
  assertExactKeys(overrides, ['schemaVersion', 'reviewedAt', 'entries'], 'complexity override snapshot');
  assert(overrides.schemaVersion === 1, 'complexity override schemaVersion must be 1');
  assert(isValidDate(overrides.reviewedAt), 'complexity override reviewedAt must be a valid date');
  assert(Array.isArray(overrides.entries), 'complexity override entries must be an array');
  const seen = new Set();
  return new Map(overrides.entries.map((entry, index) => {
    const label = `complexity override entries[${index}]`;
    assert(isRecord(entry), `${label} must be an object`);
    assertExactKeys(entry, OVERRIDE_KEYS, label);
    assert(typeof entry.questId === 'string' && entry.questId.trim(), `${label}.questId must be nonblank`);
    assert(!seen.has(entry.questId), `duplicate complexity override for ${entry.questId}`);
    seen.add(entry.questId);
    assert(assessments.has(entry.questId), `${label}.questId is unknown`);
    assert(!f2pIds.has(entry.questId), `${label} must name members-only content`);
    const assessment = assessments.get(entry.questId);
    assert(entry.fromMilestone === assessment.baselineMilestone,
      `${label}.fromMilestone does not match computed complexity`);
    assert([3, 4, 5].includes(entry.toMilestone), `${label}.toMilestone must be 3, 4, or 5`);
    assert(typeof entry.reviewer === 'string' && entry.reviewer.trim(), `${label}.reviewer must be nonblank`);
    assert(typeof entry.reason === 'string' && entry.reason.trim(), `${label}.reason must be nonblank`);
    assert(isValidDate(entry.reviewedAt), `${label}.reviewedAt must be a valid date`);
    const { questId, ...appliedOverride } = entry;
    return [questId, Object.freeze(appliedOverride)];
  }));
};

const requirementStatus = status => ({
  verified: 'VERIFIED',
  'verified-with-notes': 'VERIFIED_WITH_NOTES',
  unresolved: 'UNRESOLVED',
})[status];

const assertExactIdSets = (sets) => {
  const [referenceName, reference] = sets[0];
  const wanted = [...reference].sort();
  for (const [name, ids] of sets) {
    assert(ids.size === EXPECTED_COUNTS.total, `${name} must contain exactly 210 unique IDs`);
    assert(JSON.stringify([...ids].sort()) === JSON.stringify(wanted),
      `${referenceName} and ${name} ID sets differ`);
  }
};

const countBy = (values, key) => values.reduce((counts, value) => {
  const group = key(value);
  counts[group] = (counts[group] ?? 0) + 1;
  return counts;
}, {});

const assertCount = (actual, expected, label) => {
  assert(actual === expected, `${label} must be ${expected}; found ${actual}`);
};

const buildDepths = questData => {
  const depths = new Map();
  const visiting = new Set();
  const visit = questId => {
    assert(Object.hasOwn(questData, questId), `dangling prerequisite ID: ${questId}`);
    if (depths.has(questId)) return depths.get(questId);
    assert(!visiting.has(questId), `prerequisite cycle detected at ${questId}`);
    visiting.add(questId);
    const quest = questData[questId];
    const depth = quest.prereqs.length === 0
      ? 0
      : 1 + Math.max(...quest.prereqs.map(prerequisite => {
        assert(prerequisite !== questId, `self prerequisite edge: ${questId}`);
        return visit(prerequisite);
      }));
    visiting.delete(questId);
    depths.set(questId, depth);
    return depth;
  };
  Object.keys(questData).forEach(visit);
  return depths;
};

const compareReady = (left, right, assessments) => {
  const leftAssessment = assessments.get(left);
  const rightAssessment = assessments.get(right);
  return leftAssessment.assignedMilestone - rightAssessment.assignedMilestone
    || leftAssessment.score - rightAssessment.score
    || left.localeCompare(right);
};

const stableMemberOrder = (questData, memberIds, assessments) => {
  const indegrees = new Map([...memberIds].map(id => [id, 0]));
  const dependents = new Map([...memberIds].map(id => [id, []]));
  for (const id of memberIds) {
    for (const prerequisite of questData[id].prereqs) {
      if (!memberIds.has(prerequisite)) continue;
      indegrees.set(id, indegrees.get(id) + 1);
      dependents.get(prerequisite).push(id);
    }
  }
  const ready = [...memberIds].filter(id => indegrees.get(id) === 0)
    .sort((left, right) => compareReady(left, right, assessments));
  const ordered = [];
  while (ready.length) {
    const id = ready.shift();
    ordered.push(id);
    for (const dependent of dependents.get(id)) {
      indegrees.set(dependent, indegrees.get(dependent) - 1);
      if (indegrees.get(dependent) === 0) {
        ready.push(dependent);
        ready.sort((left, right) => compareReady(left, right, assessments));
      }
    }
  }
  assert(ordered.length === memberIds.size, 'prerequisite cycle prevents catalogue ordering');
  return ordered;
};

export const generateRuneProofCatalogue = ({ questList, audit, f2p, overrides, questData }) => {
  assert(isRecord(questList) && Array.isArray(questList.entries), 'quest list entries must be an array');
  assert(isRecord(audit) && Array.isArray(audit.entries), 'audit entries must be an array');
  assert(isRecord(f2p) && Array.isArray(f2p.quests), 'F2P quests must be an array');
  assert(isRecord(questData), 'questData must be an object');

  const listIds = new Set(questList.entries.map(entry => entry.id));
  const auditIds = new Set(audit.entries.map(entry => entry.id));
  const runtimeIds = new Set(Object.keys(questData));
  assertExactIdSets([
    ['quest list', listIds],
    ['audit', auditIds],
    ['QUEST_DATA', runtimeIds],
    ['normalized catalogue', runtimeIds],
  ]);
  assertCount(questList.entries.filter(entry => entry.kind === 'quest').length,
    EXPECTED_COUNTS.quest, 'quest count');
  assertCount(questList.entries.filter(entry => entry.kind === 'miniquest').length,
    EXPECTED_COUNTS.miniquest, 'miniquest count');

  const listById = new Map(questList.entries.map(entry => [entry.id, entry]));
  const auditById = new Map(audit.entries.map(entry => [entry.id, entry]));
  const statusCounts = countBy(audit.entries, entry => entry.status);
  for (const [status, expected] of Object.entries(EXPECTED_AUDIT_STATUSES)) {
    assertCount(statusCounts[status] ?? 0, expected, `${status} audit count`);
  }

  for (const [questId, quest] of Object.entries(questData)) {
    const listed = listById.get(questId);
    const audited = auditById.get(questId);
    assert(JSON.stringify(listed.source) === JSON.stringify(audited.source),
      `${questId}: source differs between quest list and audit`);
    assert(audited.requirementFingerprint === questRequirementFingerprint(quest),
      `${questId}: requirement fingerprint is stale`);
    assert(listed.kind === quest.kind && audited.kind === quest.kind,
      `${questId}: kind differs between sources and QUEST_DATA`);
  }

  const edges = Object.values(questData).flatMap(quest =>
    quest.prereqs.map(prerequisite => `${prerequisite}\u0000${quest.id}`));
  assertCount(edges.length, 258, 'prerequisite edge count');
  assertCount(new Set(edges).size, 258, 'unique prerequisite edge count');
  const depths = buildDepths(questData);
  assertCount(Math.max(...depths.values()), 7, 'maximum prerequisite depth');

  assertCount(f2p.quests.length, 23, 'F2P input count');
  const f2pIds = new Set(f2p.quests.map(entry => entry.questId));
  assertCount(f2pIds.size, 23, 'unique F2P ID count');
  assert([...f2pIds].every(id => runtimeIds.has(id)), 'F2P input contains an unknown quest ID');
  assertCount(f2p.quests.filter(entry => entry.kind === 'quest').length,
    EXPECTED_COUNTS.f2pQuest, 'F2P quest count');
  assertCount(f2p.quests.filter(entry => entry.kind === 'miniquest').length,
    EXPECTED_COUNTS.f2pMiniquest, 'F2P miniquest count');
  assertCount([...runtimeIds].filter(id => !f2pIds.has(id) && questData[id].kind === 'quest').length,
    EXPECTED_COUNTS.membersQuest, 'members quest count');
  assertCount([...runtimeIds].filter(id => !f2pIds.has(id) && questData[id].kind === 'miniquest').length,
    EXPECTED_COUNTS.membersMiniquest, 'members miniquest count');

  const assessments = new Map(Object.entries(questData).map(([questId, quest]) => [
    questId,
    classifyRuneProofComplexity({ quest, audit: auditById.get(questId), prerequisiteDepth: depths.get(questId) }),
  ]));
  const overrideById = validateOverrideContainer(overrides, assessments, f2pIds);
  for (const [questId, override] of overrideById) {
    const baseline = assessments.get(questId);
    assessments.set(questId, Object.freeze({
      ...baseline,
      assignedMilestone: override.toMilestone,
      override,
    }));
  }

  const memberIds = new Set([...runtimeIds].filter(id => !f2pIds.has(id)));
  const memberOrder = stableMemberOrder(questData, memberIds, assessments);
  const orderedIds = [...f2p.quests.map(entry => entry.questId), ...memberOrder];
  const f2pById = new Map(f2p.quests.map(entry => [entry.questId, entry]));
  const slugs = new Set();
  const entries = orderedIds.map((questId, index) => {
    const quest = questData[questId];
    const listed = listById.get(questId);
    const audited = auditById.get(questId);
    const reviewedF2p = f2pById.get(questId);
    const slug = normalizedSlug(questId);
    if (reviewedF2p) {
      assert(reviewedF2p.slug === slug, `${questId}: generated slug differs from reviewed F2P slug`);
      assert(reviewedF2p.kind === quest.kind, `${questId}: reviewed F2P kind differs from QUEST_DATA`);
      assert(reviewedF2p.progressionPriority === index + 1,
        `${questId}: reviewed F2P priority differs from catalogue priority`);
      assert(Number.isInteger(reviewedF2p.wave) && reviewedF2p.wave >= 1 && reviewedF2p.wave <= 5,
        `${questId}: reviewed F2P wave must be 1 through 5`);
    }
    assert(!slugs.has(slug), `normalized slug collision: ${slug}`);
    slugs.add(slug);
    return {
      questId,
      slug,
      kind: quest.kind,
      membership: reviewedF2p ? 'F2P' : 'MEMBERS',
      wikiTitle: listed.pageTitle,
      sourceRevision: String(listed.source.revision),
      sourceRevisionTimestamp: listed.source.revisionTimestamp,
      requirementStatus: requirementStatus(audited.status),
      ...(quest.series === undefined ? {} : { series: quest.series }),
      progressionPriority: index + 1,
      milestone: reviewedF2p
        ? (reviewedF2p.wave === 1 ? 1 : 2)
        : assessments.get(questId).assignedMilestone,
      requirementComplexity: assessments.get(questId),
    };
  });

  assertExactIdSets([
    ['quest list', listIds],
    ['audit', auditIds],
    ['QUEST_DATA', runtimeIds],
    ['normalized catalogue', new Set(entries.map(entry => entry.questId))],
  ]);
  const milestoneCounts = countBy(entries, entry => entry.milestone);
  for (const [milestone, expected] of Object.entries(EXPECTED_MILESTONES)) {
    assertCount(milestoneCounts[milestone] ?? 0, expected, `milestone ${milestone} count`);
  }
  const rfdIds = entries.filter(entry => entry.questId.startsWith('RFD:'))
    .map(entry => entry.questId).sort();
  assert(JSON.stringify(rfdIds) === JSON.stringify(EXPECTED_RFD_IDS),
    'normalized Recipe for Disaster IDs differ from the reviewed ten-part set');
  assert(!runtimeIds.has('Recipe for Disaster'), 'Recipe for Disaster parent ID must be absent');

  const catalogueRevision = createHash('sha256')
    .update(JSON.stringify(canonicalValue(entries)))
    .digest('hex');
  return {
    schemaVersion: 1,
    catalogueRevision,
    sourceFiles: [...SOURCE_FILES],
    entries,
  };
};
