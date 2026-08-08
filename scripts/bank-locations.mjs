import { readFileSync } from 'node:fs';

const REGISTRY_URL = new URL('../data/sources/bank-locations.json', import.meta.url);
const REFERENCE_KINDS = new Set(['physical', 'npc', 'entrance']);
const CANONICAL_CHUNK_ID = /^(?:0|[1-9]\d*)$/;
const VIRTUAL_BANK_ID = /^[a-z][a-z0-9-]*$/;

const assertNonEmptyString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
};

const assertCanonicalChunkId = (value, label) => {
  assertNonEmptyString(value, label);
  if (!CANONICAL_CHUNK_ID.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${label} must be a canonical chunk id`);
  }
};

const assertVirtualBankId = (value, label) => {
  assertNonEmptyString(value, label);
  if (!VIRTUAL_BANK_ID.test(value)) throw new Error(`${label} must be a stable virtual bank id`);
};

const validateWikiEvidence = (wiki, label, sourceUrls) => {
  if (!Array.isArray(wiki) || !wiki.length) throw new Error(`${label} has no Wiki evidence`);
  for (const url of wiki) {
    assertNonEmptyString(url, `${label} Wiki evidence`);
    if (!sourceUrls.has(url)) throw new Error(`${label} Wiki evidence is not covered by source revisions`);
  }
};

export function readBankLocationRegistry(url = REGISTRY_URL) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

export function validateBankLocationRegistry(registry, { validChunkIds, validBankIds } = {}) {
  if (registry?.schemaVersion !== 1) throw new Error('Unsupported bank-location registry schema');
  if (!Array.isArray(registry.locations) || !Array.isArray(registry.virtualLocations) || !Array.isArray(registry.labelOverrides)
    || !Array.isArray(registry.exclusions) || !Array.isArray(registry.sourceRevisions)) {
    throw new Error('Bank-location registry arrays are missing');
  }

  const sourceUrls = new Set();
  for (const source of registry.sourceRevisions) {
    assertNonEmptyString(source.title, 'Bank source title');
    assertNonEmptyString(source.url, `Bank source ${source.title} URL`);
    if (!Number.isInteger(source.revision)) throw new Error(`Bank source ${source.title} revision must be an integer`);
    sourceUrls.add(source.url);
  }

  const ids = new Set();
  const names = new Set();
  for (const location of registry.locations) {
    assertCanonicalChunkId(location.id, 'Bank location id');
    assertNonEmptyString(location.name, `Bank location ${location.id} name`);
    if (!Number.isInteger(location.cx) || !Number.isInteger(location.cy)) {
      throw new Error(`Bank location ${location.id} coordinates must be integers`);
    }
    if (location.id !== String(location.cx * 256 + location.cy)) {
      throw new Error(`Canonical chunk id mismatch for bank location ${location.id}`);
    }
    if (ids.has(location.id)) throw new Error(`Duplicate bank location id: ${location.id}`);
    if (names.has(location.name)) throw new Error(`Duplicate bank location name: ${location.name}`);
    if (!REFERENCE_KINDS.has(location.referenceKind)) {
      throw new Error(`Unknown bank reference kind for ${location.id}: ${location.referenceKind}`);
    }
    if (location.referenceKind === 'entrance') assertNonEmptyString(location.accessVia, `Bank location ${location.id} accessVia`);
    if (!Array.isArray(location.facilities) || !location.facilities.length) throw new Error(`Bank location ${location.id} has no facilities`);
    for (const facility of location.facilities) assertNonEmptyString(facility, `Bank location ${location.id} facility`);
    validateWikiEvidence(location.wiki, `Bank location ${location.id}`, sourceUrls);
    if (validChunkIds && !validChunkIds.has(location.id)) throw new Error(`Bank location ${location.id} is not walkable`);
    ids.add(location.id);
    names.add(location.name);
  }

  if (registry.labelOverrides.length && !(validBankIds instanceof Set)) {
    throw new Error('Bank label overrides require a validBankIds set');
  }
  const overrideIds = new Set();
  for (const override of registry.labelOverrides) {
    assertCanonicalChunkId(override.id, 'Bank label override id');
    if (overrideIds.has(override.id)) throw new Error(`Duplicate bank label override id: ${override.id}`);
    if (!validBankIds.has(override.id)) throw new Error(`Bank label override ${override.id} does not target a valid bank`);
    assertNonEmptyString(override.name, `Bank label override ${override.id} name`);
    if (names.has(override.name)) throw new Error(`Duplicate bank location name: ${override.name}`);
    validateWikiEvidence(override.wiki, `Bank label override ${override.id}`, sourceUrls);
    overrideIds.add(override.id);
    names.add(override.name);
  }

  const virtualIds = new Set();
  for (const location of registry.virtualLocations) {
    assertVirtualBankId(location.id, 'Virtual bank location id');
    if (location.cx !== null || location.cy !== null) {
      throw new Error(`Virtual bank coordinates must be null for ${location.id}`);
    }
    if (ids.has(location.id)) throw new Error(`Virtual bank location id collides with a physical location: ${location.id}`);
    if (overrideIds.has(location.id)) throw new Error(`Virtual bank location id collides with a label override: ${location.id}`);
    if (virtualIds.has(location.id)) throw new Error(`Duplicate virtual bank id: ${location.id}`);
    assertNonEmptyString(location.name, `Virtual bank location ${location.id} name`);
    if (names.has(location.name)) throw new Error(`Duplicate bank location name: ${location.name}`);
    if (location.referenceKind !== 'virtual') {
      throw new Error(`Unknown virtual bank reference kind for ${location.id}: ${location.referenceKind}`);
    }
    assertNonEmptyString(location.accessVia, `Virtual bank location ${location.id} accessVia`);
    if (!Array.isArray(location.facilities) || !location.facilities.length) {
      throw new Error(`Virtual bank location ${location.id} has no facilities`);
    }
    for (const facility of location.facilities) {
      assertNonEmptyString(facility, `Virtual bank location ${location.id} facility`);
    }
    validateWikiEvidence(location.wiki, `Virtual bank location ${location.id}`, sourceUrls);
    virtualIds.add(location.id);
    names.add(location.name);
  }

  for (const exclusion of registry.exclusions) {
    assertNonEmptyString(exclusion.name, 'Bank exclusion name');
    assertNonEmptyString(exclusion.reason, `Bank exclusion ${exclusion.name} reason`);
  }
  return registry;
}

export function bankLocationLabels(registry) {
  return new Map([
    ...registry.locations.map(({ id, name }) => [String(id), name]),
    ...registry.labelOverrides.map(({ id, name }) => [String(id), name]),
  ]);
}

export function bankVirtualLocations(registry) {
  return registry.virtualLocations.map(({ id, name, accessVia, facilities, wiki }) => ({
    id: String(id), name, accessVia, facilities, wiki,
  }));
}
