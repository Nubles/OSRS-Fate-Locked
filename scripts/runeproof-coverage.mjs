#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {import('./runeproof-coverage.types.ts').RuneProofCoverageDimensionId} RuneProofCoverageDimensionId */
/** @typedef {import('./runeproof-coverage.types.ts').RuneProofCoverageDisposition} RuneProofCoverageDisposition */
/** @typedef {import('./runeproof-coverage.types.ts').RuneProofCoverageDimension} RuneProofCoverageDimension */
/** @typedef {import('./runeproof-coverage.types.ts').RuneProofCoverageRow} RuneProofCoverageRow */
/** @typedef {import('./runeproof-coverage.types.ts').RuneProofCoverageSnapshot} RuneProofCoverageSnapshot */
/** @typedef {import('./runeproof-coverage.types.ts').RuneProofPackValidationSnapshot} RuneProofPackValidationSnapshot */

export const COVERAGE_DIMENSIONS = Object.freeze([
  'identity',
  'preflight',
  'coreRoute',
  'locations',
  'transport',
  'instances',
  'items',
  'branches',
  'combatManual',
  'evidence',
  'progressMigration',
  'completion',
]);

export const COVERAGE_APPLICABILITY = Object.freeze([
  'REQUIRED',
  'NOT_REQUIRED',
  'NEEDS_REVIEW',
]);

const DISPOSITIONS = Object.freeze([
  'VALIDATED',
  'NOT_REQUIRED',
  'NEEDS_REVIEW',
]);
const DIMENSION_SET = new Set(COVERAGE_DIMENSIONS);
const DISPOSITION_SET = new Set(DISPOSITIONS);
const VALIDATION_DIMENSIONS = COVERAGE_DIMENSIONS.filter(
  dimension => dimension !== 'identity',
);
const INTRINSIC_PACK_DIMENSIONS = new Set([
  'coreRoute',
  'locations',
  'items',
  'evidence',
  'progressMigration',
  'completion',
]);
const REQUIREMENT_STATUSES = new Set([
  'VERIFIED',
  'VERIFIED_WITH_NOTES',
  'UNRESOLVED',
]);
const PREVIEW_LIFECYCLES = new Set([
  'PREVIEW_VALIDATED',
  'MILESTONE_APPROVED',
  'PUBLIC_APPROVED',
]);
const CONDITIONAL_DIMENSIONS = new Set([
  'transport',
  'instances',
  'branches',
  'combatManual',
]);
const COMPLETE_ROW_KEYS = Object.freeze([
  'questId',
  'slug',
  'kind',
  'membership',
  'milestone',
  'progressionPriority',
  'packRevision',
  'compilerValid',
  'previewApproved',
  'publicApproved',
  'dimensions',
]);
const COVERAGE_CELL_KEYS = Object.freeze([
  'applicability',
  'modelled',
  'validated',
  'previewApproved',
  'publicApproved',
  'findingIds',
]);

const compareCodePoints = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isRecord = value => value !== null
  && typeof value === 'object'
  && !Array.isArray(value);

const isPlainRecord = value => isRecord(value)
  && Object.getPrototypeOf(value) === Object.prototype;

const isPlainArray = value => Array.isArray(value)
  && Object.getPrototypeOf(value) === Array.prototype;

const isNonblank = value => typeof value === 'string' && value.trim().length > 0;

const isPositiveInteger = value => Number.isSafeInteger(value) && value > 0;

const assertDenseArray = (value, label) => {
  assert(Array.isArray(value), `${label} must be an array`);
  for (let index = 0; index < value.length; index += 1) {
    assert(Object.prototype.hasOwnProperty.call(value, index), `${label} must be dense`);
  }
};

const assertExactKeys = (value, expected, label) => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(JSON.stringify(actual) === JSON.stringify(wanted),
    `${label} must contain exactly: ${wanted.join(', ')}`);
};

const assertSortedUniqueStrings = (value, label) => {
  assertDenseArray(value, label);
  assert(value.every(isNonblank), `${label} must contain non-empty strings`);
  const sorted = [...value].sort(compareCodePoints);
  assert(new Set(value).size === value.length
    && JSON.stringify(value) === JSON.stringify(sorted),
  `${label} must contain sorted unique strings`);
};

const isDenseSortedUniqueStrings = (value) => {
  if (!isPlainArray(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== value.length + 1
    || !Object.prototype.hasOwnProperty.call(value, 'length')) return false;
  let previous;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
    const current = value[index];
    if (!isNonblank(current)) return false;
    if (index > 0 && compareCodePoints(previous, current) >= 0) return false;
    previous = current;
  }
  return true;
};

const assertBoolean = (value, label) => {
  assert(typeof value === 'boolean', `${label} must be a boolean`);
};

const canonicalValue = value => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([key, child]) => [key, canonicalValue(child)]));
  }
  return value;
};

const stableJson = value => `${JSON.stringify(canonicalValue(value), null, 2)}\n`;

const validateCatalogue = (value) => {
  assert(isRecord(value), 'RuneProof catalogue must be an object');
  assert(value.schemaVersion === 1, 'RuneProof catalogue schemaVersion must be 1');
  assert(isNonblank(value.catalogueRevision),
    'RuneProof catalogue revision must be a non-empty string');
  assertDenseArray(value.entries, 'RuneProof catalogue entries');
  const questIds = new Set();
  const slugs = new Set();
  const priorities = new Set();
  const entries = value.entries.map((entry, index) => {
    const label = `RuneProof catalogue entry ${index}`;
    assert(isRecord(entry), `${label} must be an object`);
    assert(isNonblank(entry.questId), `${label}.questId must be a non-empty string`);
    assert(isNonblank(entry.slug), `${label}.slug must be a non-empty string`);
    assert(entry.kind === 'quest' || entry.kind === 'miniquest', `${label}.kind is invalid`);
    assert(entry.membership === 'F2P' || entry.membership === 'MEMBERS',
      `${label}.membership is invalid`);
    assert([1, 2, 3, 4, 5].includes(entry.milestone), `${label}.milestone is invalid`);
    assert(isPositiveInteger(entry.progressionPriority),
      `${label}.progressionPriority must be a positive integer`);
    assert(REQUIREMENT_STATUSES.has(entry.requirementStatus),
      `${label}.requirementStatus is invalid`);
    assert(!questIds.has(entry.questId),
      `RuneProof catalogue has duplicate quest ID: ${entry.questId}`);
    assert(!slugs.has(entry.slug), `RuneProof catalogue has duplicate slug: ${entry.slug}`);
    assert(!priorities.has(entry.progressionPriority),
      `RuneProof catalogue has duplicate progression priority: ${entry.progressionPriority}`);
    questIds.add(entry.questId);
    slugs.add(entry.slug);
    priorities.add(entry.progressionPriority);
    return entry;
  });
  return {
    catalogueRevision: value.catalogueRevision,
    entries,
    questIds,
  };
};

const validatePackValidation = (value, catalogueRevision, catalogueEntries) => {
  assert(isRecord(value), 'RuneProof pack validation snapshot must be an object');
  assertExactKeys(value, ['schemaVersion', 'catalogueRevision', 'packs'],
    'RuneProof pack validation snapshot');
  assert(value.schemaVersion === 1,
    'RuneProof pack validation snapshot schemaVersion must be 1');
  assert(value.catalogueRevision === catalogueRevision,
    'RuneProof pack validation has a stale catalogue revision');
  assertDenseArray(value.packs, 'RuneProof pack validation packs');
  const catalogueById = new Map(catalogueEntries.map(entry => [entry.questId, entry]));
  const seenQuestIds = new Set();
  return new Map(value.packs.map((record, index) => {
    const label = `RuneProof pack validation record ${index}`;
    assert(isRecord(record), `${label} must be an object`);
    assertExactKeys(record, [
      'questId',
      'packRevision',
      'blockingFindingIds',
      'findingDimensions',
      'semanticDisposition',
    ], label);
    assert(isNonblank(record.questId), `${label}.questId must be a non-empty string`);
    assert(isNonblank(record.packRevision),
      `${label}.packRevision must be a non-empty string`);
    assert(catalogueById.has(record.questId),
      `${label} references unknown quest ID: ${record.questId}`);
    assert(!seenQuestIds.has(record.questId),
      `RuneProof pack validation has duplicate quest ID: ${record.questId}`);
    seenQuestIds.add(record.questId);
    assertSortedUniqueStrings(record.blockingFindingIds,
      `${label}.blockingFindingIds`);
    assert(isRecord(record.findingDimensions),
      `${label}.findingDimensions must be an object`);
    const findingKeys = Object.keys(record.findingDimensions).sort(compareCodePoints);
    assert(JSON.stringify(findingKeys) === JSON.stringify(record.blockingFindingIds),
      `${label}.findingDimensions must allocate every blocking finding exactly once`);
    Object.entries(record.findingDimensions).forEach(([findingId, dimensions]) => {
      assertDenseArray(dimensions, `${label}.findingDimensions.${findingId}`);
      assert(dimensions.length > 0,
        `${label}.findingDimensions.${findingId} must name at least one dimension`);
      assert(dimensions.every(dimension => DIMENSION_SET.has(dimension)),
        `${label}.findingDimensions.${findingId} contains an unknown dimension`);
      assert(new Set(dimensions).size === dimensions.length,
        `${label}.findingDimensions.${findingId} must contain unique dimensions`);
    });
    assert(isRecord(record.semanticDisposition),
      `${label}.semanticDisposition must be an object`);
    assertExactKeys(record.semanticDisposition, VALIDATION_DIMENSIONS,
      `${label}.semanticDisposition`);
    Object.entries(record.semanticDisposition).forEach(([dimension, disposition]) => {
      assert(DISPOSITION_SET.has(disposition),
        `${label}.semanticDisposition.${dimension} is invalid`);
      assert(disposition !== 'NOT_REQUIRED' || CONDITIONAL_DIMENSIONS.has(dimension),
        `${label}.semanticDisposition.${dimension} uses NOT_REQUIRED outside a conditional dimension`);
    });
    const catalogueEntry = catalogueById.get(record.questId);
    if (catalogueEntry.requirementStatus === 'UNRESOLVED') {
      assert(record.semanticDisposition.preflight === 'NEEDS_REVIEW',
        `${label}.preflight is stale while catalogue requirements are unresolved`);
    }
    return [record.questId, record];
  }));
};

const validateManifest = ({
  value,
  label,
  target,
  catalogueRevision,
  catalogueQuestIds,
  validationById,
}) => {
  assert(isRecord(value), `${label} must be an object`);
  assertExactKeys(value, ['schemaVersion', 'catalogueRevision', 'entries'], label);
  assert(value.schemaVersion === 1, `${label} schemaVersion must be 1`);
  assert(value.catalogueRevision === catalogueRevision,
    `${label} has a stale catalogue revision`);
  assertDenseArray(value.entries, `${label} entries`);
  const seenQuestIds = new Set();
  return new Map(value.entries.map((entry, index) => {
    const entryLabel = `${label} entry ${index}`;
    assert(isRecord(entry), `${entryLabel} must be an object`);
    assertExactKeys(entry, [
      'questId',
      'packRevision',
      'catalogueRevision',
      'lifecycle',
    ], entryLabel);
    assert(isNonblank(entry.questId), `${entryLabel}.questId must be a non-empty string`);
    assert(isNonblank(entry.packRevision),
      `${entryLabel}.packRevision must be a non-empty string`);
    assert(entry.catalogueRevision === catalogueRevision,
      `${entryLabel} has a stale catalogue revision`);
    assert(catalogueQuestIds.has(entry.questId),
      `${entryLabel} references unknown quest ID: ${entry.questId}`);
    assert(!seenQuestIds.has(entry.questId),
      `${label} has duplicate quest ID: ${entry.questId}`);
    seenQuestIds.add(entry.questId);
    assert(target === 'PUBLIC'
      ? entry.lifecycle === 'PUBLIC_APPROVED'
      : PREVIEW_LIFECYCLES.has(entry.lifecycle),
    `${entryLabel}.lifecycle is invalid for ${target}`);
    const validationRecord = validationById.get(entry.questId);
    assert(validationRecord !== undefined
      && validationRecord.packRevision === entry.packRevision,
    `${entry.questId} has a stale pack revision in ${label}`);
    return [entry.questId, entry];
  }));
};

/**
 * @param {RuneProofCoverageDisposition} disposition
 * @param {readonly string[]} findingIds
 * @returns {RuneProofCoverageDimension}
 */
const cellForDisposition = (disposition, findingIds) => {
  if (disposition === 'VALIDATED') {
    return {
      applicability: 'REQUIRED',
      modelled: true,
      validated: true,
      previewApproved: false,
      publicApproved: false,
      findingIds,
    };
  }
  if (disposition === 'NOT_REQUIRED') {
    return {
      applicability: 'NOT_REQUIRED',
      modelled: true,
      validated: true,
      previewApproved: false,
      publicApproved: false,
      findingIds,
    };
  }
  return {
    applicability: 'NEEDS_REVIEW',
    modelled: false,
    validated: false,
    previewApproved: false,
    publicApproved: false,
    findingIds,
  };
};

/** @param {RuneProofCoverageDimensionId} dimension @param {string} requirementStatus */
const absentPackCell = (dimension, requirementStatus) => {
  if (dimension === 'identity') {
    return cellForDisposition('VALIDATED', []);
  }
  if (dimension === 'preflight') {
    return cellForDisposition(
      requirementStatus === 'UNRESOLVED' ? 'NEEDS_REVIEW' : 'VALIDATED',
      [],
    );
  }
  if (INTRINSIC_PACK_DIMENSIONS.has(dimension)) {
    return {
      applicability: 'REQUIRED',
      modelled: false,
      validated: false,
      previewApproved: false,
      publicApproved: false,
      findingIds: [],
    };
  }
  return cellForDisposition('NEEDS_REVIEW', []);
};

const findingIdsByDimension = record => {
  const byDimension = new Map(COVERAGE_DIMENSIONS.map(dimension => [dimension, []]));
  record.blockingFindingIds.forEach((findingId) => {
    record.findingDimensions[findingId].forEach((dimension) => {
      byDimension.get(dimension).push(findingId);
    });
  });
  return byDimension;
};

/** @param {RuneProofCoverageRow} row */
const assertApprovalImplications = (row) => {
  assert(!row.publicApproved || row.previewApproved,
    `${row.questId} public approval requires preview approval`);
  for (const dimension of COVERAGE_DIMENSIONS) {
    const cell = row.dimensions[dimension];
    assert(!cell.publicApproved || cell.previewApproved,
      `${row.questId}.${dimension} public approval requires preview approval`);
    assert(!cell.previewApproved || cell.validated,
      `${row.questId}.${dimension} preview approval requires validated coverage`);
    assert(!cell.validated || cell.modelled,
      `${row.questId}.${dimension} validated coverage requires modelled coverage`);
    assert(cell.applicability !== 'NEEDS_REVIEW'
      || (!cell.validated && !cell.previewApproved && !cell.publicApproved),
    `${row.questId}.${dimension} NEEDS_REVIEW cannot be validated or approved`);
  }
};

const summarizeRows = (rows) => {
  const dimensions = Object.fromEntries(COVERAGE_DIMENSIONS.map(dimension => [dimension, {
    required: 0,
    notRequired: 0,
    needsReview: 0,
    modelled: 0,
    validated: 0,
    previewApproved: 0,
    publicApproved: 0,
    findingCount: 0,
  }]));
  for (const row of rows) {
    for (const dimension of COVERAGE_DIMENSIONS) {
      const cell = row.dimensions[dimension];
      const summary = dimensions[dimension];
      if (cell.applicability === 'REQUIRED') summary.required += 1;
      if (cell.applicability === 'NOT_REQUIRED') summary.notRequired += 1;
      if (cell.applicability === 'NEEDS_REVIEW') summary.needsReview += 1;
      if (cell.modelled) summary.modelled += 1;
      if (cell.validated) summary.validated += 1;
      if (cell.previewApproved) summary.previewApproved += 1;
      if (cell.publicApproved) summary.publicApproved += 1;
      summary.findingCount += cell.findingIds.length;
    }
  }
  return {
    totalObjectives: rows.length,
    quests: rows.filter(row => row.kind === 'quest').length,
    miniquests: rows.filter(row => row.kind === 'miniquest').length,
    f2p: rows.filter(row => row.membership === 'F2P').length,
    members: rows.filter(row => row.membership === 'MEMBERS').length,
    compilerValidPacks: rows.filter(row => row.compilerValid).length,
    previewApprovedPacks: rows.filter(row => row.previewApproved).length,
    publicApprovedPacks: rows.filter(row => row.publicApproved).length,
    dimensions,
  };
};

/**
 * @param {{
 *   catalogue: unknown;
 *   validation: RuneProofPackValidationSnapshot;
 *   preview: unknown;
 *   publicReleases: unknown;
 * }} input
 * @returns {RuneProofCoverageSnapshot}
 */
export const generateRuneProofCoverage = ({
  catalogue,
  validation,
  preview,
  publicReleases,
}) => {
  const validatedCatalogue = validateCatalogue(catalogue);
  const validationById = validatePackValidation(
    validation,
    validatedCatalogue.catalogueRevision,
    validatedCatalogue.entries,
  );
  const previewById = validateManifest({
    value: preview,
    label: 'RuneProof preview manifest',
    target: 'PREVIEW',
    catalogueRevision: validatedCatalogue.catalogueRevision,
    catalogueQuestIds: validatedCatalogue.questIds,
    validationById,
  });
  const publicById = validateManifest({
    value: publicReleases,
    label: 'RuneProof public manifest',
    target: 'PUBLIC',
    catalogueRevision: validatedCatalogue.catalogueRevision,
    catalogueQuestIds: validatedCatalogue.questIds,
    validationById,
  });

  publicById.forEach((release, questId) => {
    const previewRelease = previewById.get(questId);
    assert(previewRelease !== undefined
      && previewRelease.packRevision === release.packRevision,
    `${questId} public approval requires the exact preview approval`);
  });

  const rows = validatedCatalogue.entries.map((entry) => {
    const record = validationById.get(entry.questId);
    const findingIds = record ? findingIdsByDimension(record) : undefined;
    const dimensions = Object.fromEntries(COVERAGE_DIMENSIONS.map((dimension) => {
      if (!record) return [dimension, absentPackCell(dimension, entry.requirementStatus)];
      if (dimension === 'identity') {
        return [dimension, cellForDisposition('VALIDATED', findingIds.get(dimension))];
      }
      return [dimension, cellForDisposition(
        record.semanticDisposition[dimension],
        findingIds.get(dimension),
      )];
    }));
    const compilerValid = record !== undefined && record.blockingFindingIds.length === 0;
    const previewRelease = previewById.get(entry.questId);
    const publicRelease = publicById.get(entry.questId);
    const validationComplete = Object.values(dimensions).every(cell => (
      cell.modelled && cell.validated && cell.applicability !== 'NEEDS_REVIEW'
    ));
    const previewApproved = previewRelease !== undefined
      && compilerValid
      && validationComplete;
    const publicApproved = publicRelease !== undefined
      && previewApproved
      && compilerValid
      && validationComplete;
    Object.values(dimensions).forEach((cell) => {
      if (previewApproved) cell.previewApproved = true;
      if (publicApproved) cell.publicApproved = true;
    });
    const row = {
      questId: entry.questId,
      slug: entry.slug,
      kind: entry.kind,
      membership: entry.membership,
      milestone: entry.milestone,
      progressionPriority: entry.progressionPriority,
      ...(record ? { packRevision: record.packRevision } : {}),
      compilerValid,
      previewApproved,
      publicApproved,
      dimensions,
    };
    assertApprovalImplications(row);
    return row;
  });

  return {
    schemaVersion: 1,
    catalogueRevision: validatedCatalogue.catalogueRevision,
    rows,
    summary: summarizeRows(rows),
  };
};

/** @param {RuneProofCoverageSnapshot} snapshot */
export const assertRuneProofCoverageComplete = (snapshot) => {
  assert(isRecord(snapshot) && Array.isArray(snapshot.rows),
    'RuneProof coverage snapshot must contain rows');
  assert(isPlainArray(snapshot.rows),
    'RuneProof coverage rows must be a plain array');
  assertDenseArray(snapshot.rows, 'RuneProof coverage rows');
  assert(snapshot.rows.length === 210,
    `RuneProof coverage must contain exactly 210 rows; found ${snapshot.rows.length}`);
  const questIds = new Set();
  for (let rowIndex = 0; rowIndex < snapshot.rows.length; rowIndex += 1) {
    const row = snapshot.rows[rowIndex];
    const rowLabel = `RuneProof coverage row ${rowIndex}`;
    assert(isPlainRecord(row), `${rowLabel} must be a plain object`);
    assertExactKeys(row, COMPLETE_ROW_KEYS,
      `${rowLabel} including its exact pack revision`);
    assert(isNonblank(row.questId), `${rowLabel}.questId must be a non-empty string`);
    assert(isNonblank(row.slug), `${rowLabel}.slug must be a non-empty string`);
    assert(row.kind === 'quest' || row.kind === 'miniquest',
      `${rowLabel}.kind is invalid`);
    assert(row.membership === 'F2P' || row.membership === 'MEMBERS',
      `${rowLabel}.membership is invalid`);
    assert([1, 2, 3, 4, 5].includes(row.milestone),
      `${rowLabel}.milestone is invalid`);
    assert(isPositiveInteger(row.progressionPriority),
      `${rowLabel}.progressionPriority must be a positive integer`);
    assert(isNonblank(row.packRevision),
      `${rowLabel} compiler-valid coverage requires an exact pack revision`);
    assertBoolean(row.compilerValid, `${rowLabel}.compilerValid`);
    assertBoolean(row.previewApproved, `${rowLabel}.previewApproved`);
    assertBoolean(row.publicApproved, `${rowLabel}.publicApproved`);
    assert(!questIds.has(row.questId),
      `RuneProof coverage rows must have unique quest IDs: ${row.questId}`);
    questIds.add(row.questId);
    assert(row.compilerValid === true,
      `${row.questId} does not have a compiler-valid pack`);
    assert(!row.publicApproved || row.previewApproved,
      `${rowLabel} publicApproved requires previewApproved`);
    assert(isPlainRecord(row.dimensions),
      `${row.questId} coverage dimensions must be a plain object`);
    const actualDimensions = Object.keys(row.dimensions).sort(compareCodePoints);
    const exactDimensions = [...COVERAGE_DIMENSIONS].sort(compareCodePoints);
    assert(JSON.stringify(actualDimensions) === JSON.stringify(exactDimensions),
      `${row.questId} must contain the exact coverage dimension set`);
    for (const dimension of COVERAGE_DIMENSIONS) {
      const cell = row.dimensions[dimension];
      const cellLabel = `${row.questId}.${dimension} coverage cell`;
      assert(isPlainRecord(cell), `${cellLabel} must be a plain object`);
      assertExactKeys(cell, COVERAGE_CELL_KEYS, cellLabel);
      assert(typeof cell.applicability === 'string'
        && COVERAGE_APPLICABILITY.includes(cell.applicability),
      `${row.questId}.${dimension} must use a known applicability`);
      assertBoolean(cell.modelled, `${row.questId}.${dimension}.modelled`);
      assertBoolean(cell.validated, `${row.questId}.${dimension}.validated`);
      assertBoolean(cell.previewApproved,
        `${row.questId}.${dimension}.previewApproved`);
      assertBoolean(cell.publicApproved,
        `${row.questId}.${dimension}.publicApproved`);
      assert(isDenseSortedUniqueStrings(cell.findingIds),
        `${row.questId}.${dimension}.findingIds must contain dense sorted unique strings`);
      assert(!cell.publicApproved || cell.previewApproved,
        `${row.questId}.${dimension} publicApproved requires previewApproved`);
      assert(!cell.previewApproved || cell.validated,
        `${row.questId}.${dimension} previewApproved requires validated coverage`);
      assert(!cell.validated || cell.modelled,
        `${row.questId}.${dimension} validated coverage requires modelled coverage`);
      assert(cell.applicability !== 'NEEDS_REVIEW',
        `${row.questId}.${dimension} remains NEEDS_REVIEW`);
      assert(cell.applicability !== 'NOT_REQUIRED' || CONDITIONAL_DIMENSIONS.has(dimension),
        `${row.questId}.${dimension} uses NOT_REQUIRED outside a conditional dimension`);
      assert(cell.applicability !== 'REQUIRED' || (cell.modelled && cell.validated),
        `${row.questId}.${dimension} is REQUIRED but is not modelled and validated`);
      assert(cell.applicability !== 'NOT_REQUIRED' || (cell.modelled && cell.validated),
        `${row.questId}.${dimension} inspected absence is not modelled and validated`);
    }
  }
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOGUE_PATH = resolve(ROOT, 'data', 'sources', 'runeproof-quest-catalogue.json');
const VALIDATION_PATH = resolve(ROOT, 'data', 'sources', 'runeproof-pack-validation.json');
const PREVIEW_PATH = resolve(ROOT, 'data', 'sources', 'runeproof-pack-releases.preview.json');
const PUBLIC_PATH = resolve(ROOT, 'data', 'sources', 'runeproof-pack-releases.public.json');
const OUTPUT_PATH = resolve(ROOT, 'data', 'sources', 'runeproof-coverage.json');

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

const runCli = () => {
  const args = process.argv.slice(2);
  const allowed = new Set(['--check', '--require-complete']);
  const unknown = args.find(argument => !allowed.has(argument));
  assert(unknown === undefined, `Unknown RuneProof coverage option: ${unknown}`);
  const check = args.includes('--check');
  const requireComplete = args.includes('--require-complete');
  assert(!requireComplete || check,
    'RuneProof coverage --require-complete requires --check and never writes output');
  const snapshot = generateRuneProofCoverage({
    catalogue: readJson(CATALOGUE_PATH),
    validation: readJson(VALIDATION_PATH),
    preview: readJson(PREVIEW_PATH),
    publicReleases: readJson(PUBLIC_PATH),
  });
  const serialized = stableJson(snapshot);
  if (check) {
    const committed = readFileSync(OUTPUT_PATH, 'utf8').replace(/\r\n?/g, '\n');
    if (committed !== serialized.replace(/\r\n?/g, '\n')) {
      throw new Error(
        'RuneProof coverage is out of sync; run npm run runeproof:coverage:sync',
      );
    }
  } else {
    writeFileSync(OUTPUT_PATH, serialized);
  }
  if (requireComplete) {
    assertRuneProofCoverageComplete(snapshot);
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
