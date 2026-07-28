import type {
  QuestAccessPolicy,
  QuestData,
  QuestKind,
} from './questData';

export type QuestAuditStatus =
  | 'verified'
  | 'verified-with-notes'
  | 'unresolved';

export interface QuestRequirementAuditEntry {
  id: string;
  kind: QuestKind;
  status: QuestAuditStatus;
  reviewedAt: string;
  source: {
    url: string;
    revision: number;
    revisionTimestamp: string;
  };
  chunkSourceCommit: string;
  accessPolicy: QuestAccessPolicy;
  requirementFingerprint: string;
  chunkEvidence: Array<{
    chunkId: string;
    role: 'first' | 'step';
    place: string;
  }>;
  notes: {
    items: string[];
    travel: string[];
    instances: string[];
    partialCompletion: string[];
  };
  discrepancy?: string;
  conservativeReason?: string;
}

const CHUNK_SOURCE_COMMIT = 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926';
const KINDS = new Set<QuestKind>(['quest', 'miniquest']);
const ACCESS_POLICIES = new Set<QuestAccessPolicy>([
  'regions',
  'locations',
  'regions-and-locations',
]);
const STATUSES = new Set<QuestAuditStatus>([
  'verified',
  'verified-with-notes',
  'unresolved',
]);
const GENERIC_DISCREPANCY = /\bpending\b|field-by-field|tasks?\s+\d|not yet (?:audited|reviewed)/i;

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    );
  }
  return value;
}

export function questRequirementFingerprint(quest: QuestData): string {
  return JSON.stringify({
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && !Number.isNaN(Date.parse(value));
}

function stableSourceError(value: unknown): string | undefined {
  if (!isRecord(value)) return 'source must be an object';
  const revision = value.revision;
  if (!Number.isInteger(revision) || Number(revision) <= 0) {
    return 'source revision must be a positive integer';
  }
  if (!validDate(value.revisionTimestamp)) {
    return 'source revisionTimestamp must be a valid date';
  }
  if (typeof value.url !== 'string' || !value.url) {
    return 'source URL must be non-empty';
  }
  let url: URL;
  try {
    url = new URL(value.url);
  } catch {
    return 'source URL must be absolute';
  }
  if (url.hostname !== 'oldschool.runescape.wiki') {
    return 'source URL must use oldschool.runescape.wiki';
  }
  if (url.searchParams.get('oldid') !== String(revision)) {
    return 'source URL must pin its revision with a matching oldid';
  }
  return undefined;
}

function duplicateIds(entries: unknown[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.id !== 'string') continue;
    if (seen.has(entry.id)) duplicates.add(entry.id);
    seen.add(entry.id);
  }
  return [...duplicates].sort();
}

function recordEntries(value: unknown, label: string, errors: string[]): unknown[] {
  if (!isRecord(value) || !Array.isArray(value.entries)) {
    errors.push(`${label}.entries must be an array`);
    return [];
  }
  return value.entries;
}

export function validateQuestRequirementAudit(
  questData: Record<string, QuestData>,
  officialList: unknown,
  audit: unknown,
): { errors: string[] } {
  const errors: string[] = [];
  const officialEntries = recordEntries(officialList, 'official list', errors);
  const auditEntries = recordEntries(audit, 'audit', errors);

  const runtimeIds = Object.keys(questData);
  const officialIds = officialEntries.flatMap(entry =>
    isRecord(entry) && typeof entry.id === 'string' ? [entry.id] : []);
  const auditIds = auditEntries.flatMap(entry =>
    isRecord(entry) && typeof entry.id === 'string' ? [entry.id] : []);

  for (const [label, entries, ids] of [
    ['official list', officialEntries, officialIds],
    ['audit', auditEntries, auditIds],
  ] as const) {
    const duplicates = duplicateIds(entries);
    if (duplicates.length) errors.push(`${label} has duplicate IDs: ${duplicates.join(', ')}`);
    if (ids.length !== entries.length) errors.push(`${label} has entries without string IDs`);
  }

  const compareIds = (leftLabel: string, left: string[], rightLabel: string, right: string[]) => {
    const rightSet = new Set(right);
    const missing = [...new Set(left)].filter(id => !rightSet.has(id)).sort();
    if (missing.length) {
      errors.push(`${rightLabel} is missing ${leftLabel} IDs: ${missing.join(', ')}`);
    }
  };
  compareIds('runtime', runtimeIds, 'official list', officialIds);
  compareIds('official list', officialIds, 'runtime', runtimeIds);
  compareIds('runtime', runtimeIds, 'audit', auditIds);
  compareIds('audit', auditIds, 'runtime', runtimeIds);

  const officialById = new Map<string, Record<string, unknown>>();
  for (const raw of officialEntries) {
    if (!isRecord(raw) || typeof raw.id !== 'string') continue;
    officialById.set(raw.id, raw);
    if (!KINDS.has(raw.kind as QuestKind)) {
      errors.push(`official ${raw.id}: invalid kind`);
    }
    const sourceError = stableSourceError(raw.source);
    if (sourceError) errors.push(`official ${raw.id}: ${sourceError}`);
  }

  const auditById = new Map<string, Record<string, unknown>>();
  for (const raw of auditEntries) {
    if (!isRecord(raw) || typeof raw.id !== 'string') continue;
    auditById.set(raw.id, raw);
    if (!KINDS.has(raw.kind as QuestKind)) errors.push(`audit ${raw.id}: invalid kind`);
    if (!STATUSES.has(raw.status as QuestAuditStatus)) errors.push(`audit ${raw.id}: invalid status`);
    if (!validDate(raw.reviewedAt)) errors.push(`audit ${raw.id}: invalid reviewedAt`);
    if (!ACCESS_POLICIES.has(raw.accessPolicy as QuestAccessPolicy)) {
      errors.push(`audit ${raw.id}: invalid accessPolicy`);
    }
    if (raw.chunkSourceCommit !== CHUNK_SOURCE_COMMIT) {
      errors.push(`audit ${raw.id}: unexpected Chunk Picker commit`);
    }
    if (typeof raw.requirementFingerprint !== 'string' || !raw.requirementFingerprint) {
      errors.push(`audit ${raw.id}: missing requirementFingerprint`);
    }
    const sourceError = stableSourceError(raw.source);
    if (sourceError) errors.push(`audit ${raw.id}: ${sourceError}`);
    if (!Array.isArray(raw.chunkEvidence)) {
      errors.push(`audit ${raw.id}: chunkEvidence must be an array`);
    } else {
      raw.chunkEvidence.forEach((evidence, index) => {
        if (!isRecord(evidence)
          || typeof evidence.chunkId !== 'string'
          || !evidence.chunkId
          || (evidence.role !== 'first' && evidence.role !== 'step')
          || typeof evidence.place !== 'string'
          || !evidence.place) {
          errors.push(`audit ${raw.id}: invalid chunkEvidence at index ${index}`);
        }
      });
    }
    if (!isRecord(raw.notes)
      || !['items', 'travel', 'instances', 'partialCompletion']
        .every(key => Array.isArray(raw.notes?.[key]))) {
      errors.push(`audit ${raw.id}: notes must contain all four arrays`);
    }
    if (raw.status === 'unresolved') {
      if (typeof raw.discrepancy !== 'string' || !raw.discrepancy.trim()) {
        errors.push(`audit ${raw.id}: unresolved entry requires a discrepancy`);
      } else if (GENERIC_DISCREPANCY.test(raw.discrepancy)) {
        errors.push(`audit ${raw.id}: unresolved entry has a generic procedural discrepancy`);
      }
      if (typeof raw.conservativeReason !== 'string' || !raw.conservativeReason.trim()) {
        errors.push(`audit ${raw.id}: unresolved entry requires a conservativeReason`);
      } else if (!/premature completion\/key-roll eligibility/i.test(raw.conservativeReason)) {
        errors.push(`audit ${raw.id}: conservativeReason does not explain premature completion/key-roll eligibility`);
      }
    }
  }

  for (const [id, quest] of Object.entries(questData)) {
    if (quest.id !== id) errors.push(`runtime key ${id} does not match quest.id ${quest.id}`);
    const official = officialById.get(id);
    const entry = auditById.get(id);
    if (official?.kind !== quest.kind) errors.push(`${id}: official kind does not match runtime`);
    if (entry?.kind !== quest.kind) errors.push(`${id}: audit kind does not match runtime`);
    if (entry?.accessPolicy !== quest.accessPolicy) {
      errors.push(`${id}: audit accessPolicy does not match runtime`);
    }
    if (entry?.status === 'unresolved') {
      const discrepancy = typeof entry.discrepancy === 'string' ? entry.discrepancy : '';
      const conservativeReason = typeof entry.conservativeReason === 'string'
        ? entry.conservativeReason
        : '';
      const policyText = `${quest.accessPolicy} policy`;
      if (!discrepancy.includes(policyText)) {
        errors.push(`${id}: unresolved discrepancy must name the retained ${policyText}`);
      }
      const geographyTokens = quest.locations?.length
        ? quest.locations.map(location => location.label)
        : quest.regions;
      if (geographyTokens.length && !geographyTokens.some(token => discrepancy.includes(token))) {
        errors.push(`${id}: unresolved discrepancy must name a retained runtime region or location`);
      }
      const evidenceRows = Array.isArray(entry.chunkEvidence)
        ? entry.chunkEvidence.filter(isRecord)
        : [];
      if (evidenceRows.length) {
        const namesConcreteEvidence = evidenceRows.some(row =>
          typeof row.place === 'string'
          && typeof row.chunkId === 'string'
          && discrepancy.includes(row.place)
          && discrepancy.includes(row.chunkId));
        if (!namesConcreteEvidence) {
          errors.push(`${id}: unresolved discrepancy must name a pinned Chunk Picker place and chunk`);
        }
      } else if (!/no pinned Chunk Picker first\/step activity chunk/i.test(discrepancy)) {
        errors.push(`${id}: unresolved discrepancy must state the absence of pinned chunk evidence`);
      }
      if (quest.manualRequirements?.length
        && !quest.manualRequirements.some(requirement => discrepancy.includes(requirement))) {
        errors.push(`${id}: unresolved discrepancy must name its manual requirement gap`);
      }
      const combinedReasoning = `${discrepancy} ${conservativeReason}`;
      if (quest.prereqs.length
        && !quest.prereqs.some(prerequisite => combinedReasoning.includes(prerequisite))) {
        errors.push(`${id}: unresolved reasoning must name a retained prerequisite`);
      }
      if (!conservativeReason.includes(id) || !conservativeReason.includes(policyText)) {
        errors.push(`${id}: conservativeReason must name the quest and retained policy`);
      }
      if (geographyTokens.length
        && !geographyTokens.some(token => conservativeReason.includes(token))) {
        errors.push(`${id}: conservativeReason must name a retained runtime region or location`);
      }
    }
    if (entry?.requirementFingerprint !== questRequirementFingerprint(quest)) {
      errors.push(`${id}: requirement fingerprint does not match runtime`);
    }
    if (official && entry && JSON.stringify(official.source) !== JSON.stringify(entry.source)) {
      errors.push(`${id}: official and audit source revisions differ`);
    }
  }

  return { errors };
}
