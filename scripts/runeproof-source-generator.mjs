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