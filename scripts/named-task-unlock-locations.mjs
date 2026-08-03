import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const NAMED_TASK_UNLOCK_REGISTRY_PATH = resolve(
  ROOT,
  'data',
  'sources',
  'named-task-unlock-locations.json',
);

const EXCLUDED_DISPOSITIONS = new Set(['instance-only', 'non-purchasable']);
const ALLOWED_DISPOSITIONS = new Set(['mapped', ...EXCLUDED_DISPOSITIONS]);
const ALLOWED_MAPPING_KINDS = new Set(['single-entrance', 'multiple-entrances']);
const ALLOWED_SOURCE_KINDS = new Set(['wiki', 'coordinate']);

export function readNamedTaskUnlockRegistry(path = NAMED_TASK_UNLOCK_REGISTRY_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function indexNamedTaskUnlockRegistry(registry) {
  const index = new Map();
  for (const record of registry.locations ?? []) {
    for (const sourceKey of record.sourceKeys ?? []) {
      if (index.has(sourceKey)) throw new Error(`Duplicate named task-unlock source key: ${sourceKey}`);
      index.set(sourceKey, record);
    }
  }
  return index;
}

export function entranceChunkId({ x, y }) {
  return String(Math.floor(x / 64) * 256 + Math.floor(y / 64));
}

export function collectNamedTaskUnlockSourceInventory(data) {
  const rows = [];
  const locations = new Set();
  for (const [category, entities] of Object.entries(data.taskUnlocks ?? {})) {
    for (const [name, value] of Object.entries(entities)) {
      if (Array.isArray(value)) continue;
      for (const location of Object.keys(value ?? {})) {
        if (/^\d+$/.test(String(location).split('-')[0])) continue;
        rows.push(`${category}/${name}/${location}`);
        locations.add(location);
      }
    }
  }
  return { rows: rows.sort(), locationKeys: [...locations].sort() };
}

const received = (value) => String(value);

export function validateNamedTaskUnlockRegistry(registry, context) {
  const errors = [];
  const locations = Array.isArray(registry?.locations) ? registry.locations : [];
  const sourceLocationKeys = [...new Set(context?.sourceLocationKeys ?? [])].map(String);
  const sourceKeyCounts = new Map();
  const labelsByChunk = new Map();

  if (registry?.sourceCommit !== context?.sourceCommit) {
    errors.push(
      `Named task-unlock source commit mismatch: expected ${received(context?.sourceCommit)}, received ${received(registry?.sourceCommit)}`,
    );
  }

  for (const record of locations) {
    const name = record?.name ?? '(unnamed location)';
    const sourceKeys = Array.isArray(record?.sourceKeys) ? record.sourceKeys : [];
    const entrances = Array.isArray(record?.entrances) ? record.entrances : [];

    if (sourceKeys.length === 0) {
      errors.push(`Named task-unlock location has no source keys: ${name}`);
    }
    for (const sourceKey of sourceKeys) {
      sourceKeyCounts.set(sourceKey, (sourceKeyCounts.get(sourceKey) ?? 0) + 1);
    }

    if (!ALLOWED_DISPOSITIONS.has(record?.disposition)) {
      errors.push(`Invalid named task-unlock disposition for ${name}: ${received(record?.disposition)}`);
    }
    if (record?.disposition === 'mapped' && !ALLOWED_MAPPING_KINDS.has(record?.mappingKind)) {
      errors.push(`Invalid named task-unlock mapping kind for ${name}: ${received(record?.mappingKind)}`);
    }
    if (record?.mappingKind === 'single-entrance' && entrances.length !== 1) {
      errors.push(`Single-entrance named task-unlock location has ${entrances.length} entrances: ${name}`);
    }
    if (record?.mappingKind === 'multiple-entrances' && entrances.length < 2) {
      errors.push(`Multiple-entrance named task-unlock location has ${entrances.length} entrances: ${name}`);
    }
    if (record?.disposition === 'mapped' && entrances.length === 0) {
      errors.push(`Mapped named task-unlock location has no entrances: ${name}`);
    }
    if (EXCLUDED_DISPOSITIONS.has(record?.disposition) && entrances.length > 0) {
      errors.push(`Excluded named task-unlock location has entrances: ${name}`);
    }
    if (!Array.isArray(record?.sources) || record.sources.length === 0) {
      errors.push(`Named task-unlock location has no sources: ${name}`);
    }
    for (const source of Array.isArray(record?.sources) ? record.sources : []) {
      if (!ALLOWED_SOURCE_KINDS.has(source?.kind)) {
        errors.push(`Invalid named task-unlock source kind for ${name}: ${received(source?.kind)}`);
      }
      if (typeof source?.url !== 'string' || !source.url.startsWith('https://')) {
        errors.push(`Named task-unlock source has no permanent HTTPS URL for ${name}`);
      }
      if (typeof source?.revision !== 'string' || source.revision.trim() === '') {
        errors.push(`Named task-unlock source has no revision for ${name}`);
      }

      if (source?.kind === 'wiki' && typeof source?.url === 'string') {
        const oldid = (() => {
          try { return new URL(source.url).searchParams.get('oldid'); } catch { return null; }
        })();
        if (oldid !== source?.revision) {
          errors.push(`Named task-unlock Wiki source is not pinned to revision ${received(source?.revision)} for ${name}`);
        }
      }

      if (source?.kind === 'coordinate') {
        if (typeof source?.source !== 'string' || source.source.trim() === '') {
          errors.push(`Named task-unlock coordinate source has no source name for ${name}`);
        }
        const isPinnedArtifact = typeof source?.url === 'string'
          && typeof source?.revision === 'string'
          && source.revision.trim() !== ''
          && source.url.includes(`/${source.revision}/`)
          && /\.(?:dat|gz|json|png)(?:$|[?#])/i.test(source.url);
        if (!isPinnedArtifact) {
          errors.push(`Named task-unlock coordinate source is not a pinned artifact for ${name}`);
        }
      }
    }
    if (typeof record?.note !== 'string' || record.note.trim() === '') {
      errors.push(`Named task-unlock location has no note: ${name}`);
    }

    for (const entrance of entrances) {
      const chunkId = String(entrance?.chunkId);
      if (typeof entrance?.label !== 'string' || entrance.label.trim() === '') {
        errors.push(`Named task-unlock entrance has no label for ${name}`);
      }
      if (typeof entrance?.wikiPage !== 'string' || entrance.wikiPage.trim() === '') {
        errors.push(`Named task-unlock entrance has no Wiki page for ${name} / ${entrance?.label}`);
      }
      if (!Array.isArray(entrance?.requirements)) {
        errors.push(`Named task-unlock entrance requirements are not an array for ${name} / ${entrance?.label}`);
      } else if (entrance.requirements.some((requirement) => typeof requirement !== 'string' || requirement.trim() === '')) {
        errors.push(`Named task-unlock entrance has a blank requirement for ${name} / ${entrance?.label}`);
      }
      if (!context?.validChunkIds?.has(chunkId)) {
        errors.push(`Unknown named task-unlock chunk ID: ${chunkId}`);
      }

      if (record?.disposition === 'mapped') {
        if (!Number.isFinite(entrance?.x) || !Number.isFinite(entrance?.y)) {
          errors.push(`Named task-unlock entrance has invalid coordinates for ${name} / ${entrance?.label}`);
        } else if (!Number.isInteger(entrance.x) || !Number.isInteger(entrance.y)) {
          errors.push(`Named task-unlock entrance has non-integral coordinates for ${name} / ${entrance?.label}`);
        } else {
          const expectedChunkId = entranceChunkId(entrance);
          if (chunkId !== expectedChunkId) {
            errors.push(
              `Named task-unlock entrance chunk mismatch for ${name} / ${entrance?.label}: expected ${expectedChunkId}, received ${chunkId}`,
            );
          }
        }
      }

      const label = entrance?.label;
      const labels = labelsByChunk.get(chunkId) ?? new Set();
      if (labels.has(label)) {
        errors.push(`Duplicate named task-unlock entrance label in chunk ${chunkId}: ${label}`);
      }
      labels.add(label);
      labelsByChunk.set(chunkId, labels);
    }
  }

  for (const [sourceKey, count] of sourceKeyCounts) {
    if (count > 1) errors.push(`Duplicate named task-unlock source key: ${sourceKey}`);
  }

  const registrySourceKeys = new Set(sourceKeyCounts.keys());
  for (const sourceKey of sourceLocationKeys) {
    if (!registrySourceKeys.has(sourceKey)) {
      errors.push(`Missing named task-unlock source key: ${sourceKey}`);
    }
  }
  for (const sourceKey of registrySourceKeys) {
    if (!sourceLocationKeys.includes(sourceKey)) {
      errors.push(`Unexpected named task-unlock source key: ${sourceKey}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid named task-unlock registry:\n${errors.sort().join('\n')}`);
  }
}

export function buildEntranceIndex(registry) {
  const chunks = new Map();
  const seen = new Set();
  for (const record of registry.locations ?? []) {
    if (record.disposition !== 'mapped') continue;
    for (const entrance of record.entrances ?? []) {
      const chunkId = String(entrance.chunkId);
      const tuple = JSON.stringify([chunkId, record.name, entrance.label]);
      if (seen.has(tuple)) continue;
      seen.add(tuple);

      const rows = chunks.get(chunkId) ?? [];
      rows.push({
        location: record.name,
        label: entrance.label,
        wikiPage: entrance.wikiPage,
        requirements: entrance.requirements,
      });
      chunks.set(chunkId, rows);
    }
  }

  return Object.fromEntries([...chunks.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([chunkId, rows]) => [chunkId, rows.sort((left, right) => left.label.localeCompare(right.label))]));
}
