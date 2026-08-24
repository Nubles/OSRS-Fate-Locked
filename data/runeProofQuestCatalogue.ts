import generatedSnapshot from './sources/runeproof-quest-catalogue.json';
import { QUEST_DATA } from './questData';

export type RuneProofMembership = 'F2P' | 'MEMBERS';
export type RuneProofObjectiveKind = 'quest' | 'miniquest';
export type RuneProofPackMilestone = 1 | 2 | 3 | 4 | 5;

export interface RuneProofComplexityAssessment {
  readonly schemaVersion: 1;
  readonly score: number;
  readonly baselineMilestone: 3 | 4 | 5;
  readonly assignedMilestone: 3 | 4 | 5;
  readonly dimensions: Readonly<Record<string, number | boolean>>;
  readonly flags: readonly string[];
  readonly override?: Readonly<{
    fromMilestone: 3 | 4 | 5;
    toMilestone: 3 | 4 | 5;
    reviewer: string;
    reviewedAt: string;
    reason: string;
  }>;
}

export interface RuneProofCatalogueEntry {
  readonly questId: string;
  readonly slug: string;
  readonly kind: RuneProofObjectiveKind;
  readonly membership: RuneProofMembership;
  readonly wikiTitle: string;
  readonly sourceRevision: string;
  readonly sourceRevisionTimestamp: string;
  readonly requirementStatus: 'VERIFIED' | 'VERIFIED_WITH_NOTES' | 'UNRESOLVED';
  readonly series?: string;
  readonly progressionPriority: number;
  readonly milestone: RuneProofPackMilestone;
  readonly requirementComplexity: RuneProofComplexityAssessment;
}

export interface RuneProofCatalogueSnapshot {
  readonly schemaVersion: 1;
  readonly catalogueRevision: string;
  readonly sourceFiles: readonly string[];
  readonly entries: readonly RuneProofCatalogueEntry[];
}

const SNAPSHOT_KEYS = ['schemaVersion', 'catalogueRevision', 'sourceFiles', 'entries'] as const;
const ENTRY_KEYS = [
  'questId', 'slug', 'kind', 'membership', 'wikiTitle', 'sourceRevision',
  'sourceRevisionTimestamp', 'requirementStatus', 'series', 'progressionPriority',
  'milestone', 'requirementComplexity',
] as const;
const COMPLEXITY_KEYS = [
  'schemaVersion', 'score', 'baselineMilestone', 'assignedMilestone',
  'dimensions', 'flags', 'override',
] as const;
const DIMENSION_KEYS = [
  'prerequisiteDepth', 'prerequisiteFanOut', 'skillGateCount', 'questPointGate',
  'combatGate', 'uniqueRegionCount', 'uniqueLocationCount', 'itemNoteCount',
  'travelNoteCount', 'instanceSignal', 'positivePartialSignal',
  'manualConditionCount', 'alternativeRequirementCount',
] as const;
const OVERRIDE_KEYS = [
  'fromMilestone', 'toMilestone', 'reviewer', 'reviewedAt', 'reason',
] as const;
const EXPECTED_SOURCE_FILES = [
  'data/sources/quest-list.json',
  'data/sources/quest-requirement-audit.json',
  'data/sources/f2p-quest-membership.json',
  'data/sources/runeproof-complexity-overrides.json',
] as const;
const UNRESOLVED_IDS = new Set(['Bear Your Soul', 'Desert Treasure I', 'The Enchanted Key']);

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
  label: string,
): void => {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter(key => !allowed.has(key));
  assert(unexpected.length === 0, `${label} has unexpected field(s): ${unexpected.join(', ')}`);
  const missing = requiredKeys.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  assert(missing.length === 0, `${label} is missing field(s): ${missing.join(', ')}`);
};

const hasDenseIndexes = (value: readonly unknown[]): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
};

const nonBlankString: (value: unknown, label: string) => asserts value is string = (value, label) => {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
};

const validTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    || Number.isNaN(Date.parse(value))) return false;
  const canonicalInput = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return new Date(value).toISOString() === canonicalInput;
};

const validDate = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const isComplexityMilestone = (value: unknown): value is 3 | 4 | 5 => (
  value === 3 || value === 4 || value === 5
);

const isPackMilestone = (value: unknown): value is RuneProofPackMilestone => (
  value === 1 || value === 2 || isComplexityMilestone(value)
);

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const validateComplexity = (value: unknown, label: string): RuneProofComplexityAssessment => {
  assert(isRecord(value), `${label} must be an object`);
  assertAllowedKeys(value, COMPLEXITY_KEYS, COMPLEXITY_KEYS.filter(key => key !== 'override'), label);
  assert(value.schemaVersion === 1, `${label}.schemaVersion must be 1`);
  assert(typeof value.score === 'number' && Number.isFinite(value.score) && value.score >= 0,
    `${label}.score must be a non-negative finite number`);
  assert(isComplexityMilestone(value.baselineMilestone),
    `${label}.baselineMilestone must be 3, 4, or 5`);
  assert(isComplexityMilestone(value.assignedMilestone),
    `${label}.assignedMilestone must be 3, 4, or 5`);
  assert(isRecord(value.dimensions), `${label}.dimensions must be an object`);
  assertAllowedKeys(value.dimensions, DIMENSION_KEYS, DIMENSION_KEYS, `${label}.dimensions`);
  for (const [key, dimension] of Object.entries(value.dimensions)) {
    assert((typeof dimension === 'number' && Number.isFinite(dimension) && dimension >= 0)
      || typeof dimension === 'boolean', `${label}.dimensions.${key} must be a non-negative number or boolean`);
  }
  assert(Array.isArray(value.flags) && hasDenseIndexes(value.flags), `${label}.flags must be a dense array`);
  assert(value.flags.every(flag => typeof flag === 'string' && flag.length > 0),
    `${label}.flags must contain non-empty strings`);
  assert(new Set(value.flags).size === value.flags.length, `${label}.flags must not contain duplicates`);

  if (value.override !== undefined) {
    assert(isRecord(value.override), `${label}.override must be an object`);
    assertAllowedKeys(value.override, OVERRIDE_KEYS, OVERRIDE_KEYS, `${label}.override`);
    assert(isComplexityMilestone(value.override.fromMilestone),
      `${label}.override.fromMilestone must be 3, 4, or 5`);
    assert(isComplexityMilestone(value.override.toMilestone),
      `${label}.override.toMilestone must be 3, 4, or 5`);
    assert(value.override.fromMilestone === value.baselineMilestone,
      `${label}.override.fromMilestone must match baselineMilestone`);
    assert(value.override.toMilestone === value.assignedMilestone,
      `${label}.override.toMilestone must match assignedMilestone`);
    nonBlankString(value.override.reviewer, `${label}.override.reviewer`);
    nonBlankString(value.override.reason, `${label}.override.reason`);
    assert(validDate(value.override.reviewedAt), `${label}.override.reviewedAt must be a valid date`);
  } else {
    assert(value.assignedMilestone === value.baselineMilestone,
      `${label}.assignedMilestone must match baselineMilestone without an override`);
  }
  return value as unknown as RuneProofComplexityAssessment;
};

export function validateRuneProofQuestCatalogue(value: unknown): readonly RuneProofCatalogueEntry[] {
  assert(isRecord(value), 'RuneProof catalogue snapshot must be an object');
  assertAllowedKeys(value, SNAPSHOT_KEYS, SNAPSHOT_KEYS, 'RuneProof catalogue snapshot');
  assert(value.schemaVersion === 1, 'schemaVersion must be 1');
  assert(typeof value.catalogueRevision === 'string' && /^[a-f0-9]{64}$/.test(value.catalogueRevision),
    'catalogueRevision must be a lowercase SHA-256 hash');
  assert(Array.isArray(value.sourceFiles) && hasDenseIndexes(value.sourceFiles),
    'sourceFiles must be a dense array');
  assert(value.sourceFiles.length === EXPECTED_SOURCE_FILES.length
    && value.sourceFiles.every((file, index) => file === EXPECTED_SOURCE_FILES[index]),
  'sourceFiles must exactly name the offline catalogue inputs');
  assert(Array.isArray(value.entries), 'entries must be an array');
  assert(hasDenseIndexes(value.entries), 'entries must be a dense array');
  assert(value.entries.length === 210, 'entries must contain exactly 210 normalized objectives');

  const questIds = new Set<string>();
  const slugs = new Set<string>();
  const priorities = new Set<number>();
  const entries: RuneProofCatalogueEntry[] = [];
  let questCount = 0;
  let miniquestCount = 0;
  let f2pQuestCount = 0;
  let f2pMiniquestCount = 0;
  let membersQuestCount = 0;
  let membersMiniquestCount = 0;

  value.entries.forEach((rawEntry, index) => {
    const label = `entries[${index}]`;
    assert(isRecord(rawEntry), `${label} must be an object`);
    assertAllowedKeys(rawEntry, ENTRY_KEYS, ENTRY_KEYS.filter(key => key !== 'series'), label);
    nonBlankString(rawEntry.questId, `${label}.questId`);
    nonBlankString(rawEntry.slug, `${label}.slug`);
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawEntry.slug),
      `${label}.slug must be lowercase hyphenated text`);
    assert(rawEntry.kind === 'quest' || rawEntry.kind === 'miniquest',
      `${label}.kind must be quest or miniquest`);
    assert(rawEntry.membership === 'F2P' || rawEntry.membership === 'MEMBERS',
      `${label}.membership must be F2P or MEMBERS`);
    nonBlankString(rawEntry.wikiTitle, `${label}.wikiTitle`);
    nonBlankString(rawEntry.sourceRevision, `${label}.sourceRevision`);
    assert(/^\d+$/.test(rawEntry.sourceRevision), `${label}.sourceRevision must contain digits only`);
    assert(validTimestamp(rawEntry.sourceRevisionTimestamp),
      `${label}.sourceRevisionTimestamp must be a valid timestamp`);
    assert(rawEntry.requirementStatus === 'VERIFIED'
      || rawEntry.requirementStatus === 'VERIFIED_WITH_NOTES'
      || rawEntry.requirementStatus === 'UNRESOLVED',
    `${label}.requirementStatus is invalid`);
    if (rawEntry.series !== undefined) nonBlankString(rawEntry.series, `${label}.series`);
    assert(Number.isInteger(rawEntry.progressionPriority) && Number(rawEntry.progressionPriority) > 0,
      `${label}.progressionPriority must be a positive integer`);
    assert(isPackMilestone(rawEntry.milestone),
      `${label}.milestone must be 1, 2, 3, 4, or 5`);
    const complexity = validateComplexity(rawEntry.requirementComplexity,
      `${label}.requirementComplexity`);

    const questId = rawEntry.questId;
    const slug = rawEntry.slug;
    const priority = Number(rawEntry.progressionPriority);
    assert(!questIds.has(questId), `duplicate questId: ${questId}`);
    assert(!slugs.has(slug), `duplicate slug: ${slug}`);
    assert(!priorities.has(priority), `duplicate progressionPriority: ${priority}`);
    questIds.add(questId);
    slugs.add(slug);
    priorities.add(priority);
    assert(priority === index + 1,
      `progressionPriority must be contiguous starting at 1 (expected ${index + 1} at ${label})`);

    const publicQuest = QUEST_DATA[questId];
    assert(publicQuest !== undefined, `${label}.questId is absent from QUEST_DATA`);
    assert(rawEntry.kind === publicQuest.kind, `${label}.kind differs from QUEST_DATA`);
    if (rawEntry.membership === 'MEMBERS') {
      assert(rawEntry.milestone === complexity.assignedMilestone,
        `${label}.milestone must match assigned complexity milestone for members content`);
    }
    if (rawEntry.requirementStatus === 'UNRESOLVED') {
      assert(UNRESOLVED_IDS.has(questId), `${label} is an unexpected unresolved entry`);
      assert(rawEntry.milestone === 5, `${label} unresolved content must be in milestone 5`);
    } else {
      assert(!UNRESOLVED_IDS.has(questId), `${label} must retain its unresolved status`);
    }

    if (rawEntry.kind === 'quest') questCount += 1;
    else miniquestCount += 1;
    if (rawEntry.membership === 'F2P' && rawEntry.kind === 'quest') f2pQuestCount += 1;
    if (rawEntry.membership === 'F2P' && rawEntry.kind === 'miniquest') f2pMiniquestCount += 1;
    if (rawEntry.membership === 'MEMBERS' && rawEntry.kind === 'quest') membersQuestCount += 1;
    if (rawEntry.membership === 'MEMBERS' && rawEntry.kind === 'miniquest') membersMiniquestCount += 1;
    entries.push(rawEntry as unknown as RuneProofCatalogueEntry);
  });

  assert(questCount === 191 && miniquestCount === 19,
    `normalized kind counts must be 191 quests and 19 miniquests; found ${questCount}/${miniquestCount}`);
  assert(f2pQuestCount === 22 && f2pMiniquestCount === 1,
    `F2P kind counts must be 22 quests and 1 miniquest; found ${f2pQuestCount}/${f2pMiniquestCount}`);
  assert(membersQuestCount === 169 && membersMiniquestCount === 18,
    `members kind counts must be 169 quests and 18 miniquests; found ${membersQuestCount}/${membersMiniquestCount}`);
  const sourceIds = Object.keys(QUEST_DATA).sort();
  assert(sourceIds.length === 210 && JSON.stringify([...questIds].sort()) === JSON.stringify(sourceIds),
    'catalogue quest IDs must exactly match QUEST_DATA');
  assert([...UNRESOLVED_IDS].every(id => {
    const entry = entries.find(candidate => candidate.questId === id);
    return entry?.requirementStatus === 'UNRESOLVED' && entry.milestone === 5;
  }), 'the three unresolved entries must remain in milestone 5');

  deepFreeze(value);
  return value.entries as unknown as readonly RuneProofCatalogueEntry[];
}

export const runeProofQuestCatalogue = validateRuneProofQuestCatalogue(generatedSnapshot);
export const runeProofCatalogueRevision = generatedSnapshot.catalogueRevision;

const catalogueByQuestId = new Map(runeProofQuestCatalogue.map(entry => [entry.questId, entry]));
const catalogueBySlug = new Map(runeProofQuestCatalogue.map(entry => [entry.slug, entry]));

export function runeProofCatalogueFor(questId: string): RuneProofCatalogueEntry | undefined {
  return catalogueByQuestId.get(questId);
}

export function runeProofCatalogueBySlug(slug: string): RuneProofCatalogueEntry | undefined {
  return catalogueBySlug.get(slug);
}
