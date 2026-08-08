import { readFileSync } from 'node:fs';

const REGISTRY_URL = new URL('../data/sources/bank-locations.json', import.meta.url);
const REFERENCE_KINDS = new Set(['physical', 'npc', 'entrance']);

const assertNonEmptyString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
};

export function readBankLocationRegistry(url = REGISTRY_URL) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

export function validateBankLocationRegistry(registry, { validChunkIds } = {}) {
  if (registry?.schemaVersion !== 1) throw new Error('Unsupported bank-location registry schema');
  if (!Array.isArray(registry.locations) || !Array.isArray(registry.labelOverrides)
    || !Array.isArray(registry.exclusions) || !Array.isArray(registry.sourceRevisions)) {
    throw new Error('Bank-location registry arrays are missing');
  }

  const ids = new Set();
  const names = new Set();
  for (const location of registry.locations) {
    assertNonEmptyString(location.id, 'Bank location id');
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
    if (!Array.isArray(location.wiki) || !location.wiki.length) throw new Error(`Bank location ${location.id} has no Wiki evidence`);
    if (validChunkIds && !validChunkIds.has(location.id)) throw new Error(`Bank location ${location.id} is not walkable`);
    ids.add(location.id);
    names.add(location.name);
  }

  for (const override of registry.labelOverrides) {
    assertNonEmptyString(override.id, 'Bank label override id');
    assertNonEmptyString(override.name, `Bank label override ${override.id} name`);
    if (names.has(override.name)) throw new Error(`Duplicate bank location name: ${override.name}`);
    if (!Array.isArray(override.wiki) || !override.wiki.length) throw new Error(`Bank label override ${override.id} has no Wiki evidence`);
    names.add(override.name);
  }

  for (const source of registry.sourceRevisions) {
    assertNonEmptyString(source.title, 'Bank source title');
    assertNonEmptyString(source.url, `Bank source ${source.title} URL`);
    if (!Number.isInteger(source.revision)) throw new Error(`Bank source ${source.title} revision must be an integer`);
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
