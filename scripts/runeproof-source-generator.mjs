import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export function computeRuneProofDocumentVersion(document) {
  const { sourceVersion: _sourceVersion, ...contents } = document;
  return `sha256-${createHash('sha256')
    .update(canonicalJson(contents))
    .digest('hex')}`;
}
export function renderRuneProofSourceDocument(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}
export function createRuneProofGoalIndex(document, sourceAudit) {
  return {
    schemaVersion: 1,
    sourceVersion: document.sourceVersion,
    sourceAudit,
    rules: [...document.rules].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  };
}
export function renderRuneProofGoalIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}
export function assertRuneProofGeneratedOutputsCurrent(outputs) {
  const stale = Object.entries(outputs)
    .filter(([, current]) => current !== true)
    .map(([path]) => path)
    .sort();
  if (stale.length > 0) {
    throw new Error(`${stale.join(', ')} stale; run npm run runeproof:sources`);
  }
}
export function assertRuneProofJavaScriptBudget(
  assets,
  maxBytes = 2 * 1024 * 1024,
) {
  const oversized = assets
    .filter(asset => asset.path.endsWith('.js') && asset.bytes > maxBytes)
    .sort((left, right) => left.path < right.path ? -1 : 1);
  if (oversized.length > 0) {
    const details = oversized
      .map(asset => `${asset.path} (${asset.bytes} bytes)`)
      .join(', ');
    throw new Error(
      `RuneProof JavaScript budget exceeded (${maxBytes} bytes): ${details}`,
    );
  }
}
export function computeTrustedAcquisitionCatalogVersion(catalog) {
  return computeRuneProofDocumentVersion(catalog);
}
export function renderTrustedAcquisitionSourceCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

export async function generatedOutputMatches(outputPath, expectedBytes) {
  try {
    return await readFile(outputPath, 'utf8') === expectedBytes;
  } catch {
    return false;
  }
}

export function writeGeneratedOutput(outputPath, bytes) {
  return writeFile(outputPath, bytes, 'utf8');
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}