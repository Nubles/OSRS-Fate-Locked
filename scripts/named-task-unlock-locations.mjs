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
    if (record?.disposition === 'mapped' && entrances.length === 0) {
      errors.push(`Mapped named task-unlock location has no entrances: ${name}`);
    }
    if (EXCLUDED_DISPOSITIONS.has(record?.disposition) && entrances.length > 0) {
      errors.push(`Excluded named task-unlock location has entrances: ${name}`);
    }
    if (!Array.isArray(record?.sources) || record.sources.length === 0) {
      errors.push(`Named task-unlock location has no sources: ${name}`);
    }
    if (typeof record?.note !== 'string' || record.note.trim() === '') {
      errors.push(`Named task-unlock location has no note: ${name}`);
    }

    for (const entrance of entrances) {
      const chunkId = String(entrance?.chunkId);
      if (!context?.validChunkIds?.has(chunkId)) {
        errors.push(`Unknown named task-unlock chunk ID: ${chunkId}`);
      }

      if (Number.isFinite(entrance?.x) && Number.isFinite(entrance?.y)) {
        const expectedChunkId = entranceChunkId(entrance);
        if (chunkId !== expectedChunkId) {
          errors.push(
            `Named task-unlock entrance chunk mismatch for ${name} / ${entrance?.label}: expected ${expectedChunkId}, received ${chunkId}`,
          );
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
