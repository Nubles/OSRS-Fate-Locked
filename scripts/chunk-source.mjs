import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { basename, dirname, join } from 'node:path';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { gunzip, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { assertChunkTransformBase, assertNoUnresolvedTaskUnlocks, transformChunkContent } from './chunk-content-transform.mjs';
import { collectNamedTaskUnlockSourceInventory, readNamedTaskUnlockRegistry, validateNamedTaskUnlockRegistry } from './named-task-unlock-locations.mjs';
import { readBankLocationRegistry, validateBankLocationRegistry } from './bank-locations.mjs';

const unzip = promisify(gunzip);
const zip = promisify(gzip);
const manifestUrl = new URL('../data/sources/chunk-content-source.json', import.meta.url);
const gzipUrl = new URL('../data/sources/chunkpicker-chunkinfo-export.json.gz', import.meta.url);

const fileOps = Object.freeze({ readFile, writeFile, rename, rm });
const CANONICAL_GZIP_HEADER = Object.freeze([31, 139, 8, 0, 0, 0, 0, 0, 2, 10]);

const rawGitBlobSha = (raw) => createHash('sha1')
  .update(`blob ${raw.length}\0`)
  .update(raw)
  .digest('hex');

const pinnedManifest = Object.freeze({
  schemaVersion: 1,
  repository: 'source-chunk/chunk-picker-v2',
  branch: 'gh-pages',
  exportPath: 'chunkpicker-chunkinfo-export.json',
  commit: 'a9a5c74760eb76dbe39f90d2b04f023fc1de3746',
  blobSha: 'ffdcc10139dde0e11be29047c6c730fd762a33c8',
  rawSha256: '2D75BF70C9E6540CECC1631783A0293D8F28B440D429F6081B2CD4EE4C21CA59',
  rawBytes: 7518778,
  policyVersion: 2,
  reviewedAt: '2026-08-16',
  sourceUrl: 'https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/a9a5c74760eb76dbe39f90d2b04f023fc1de3746/chunkpicker-chunkinfo-export.json',
  countFloors: {
    contentChunks: 938,
    connections: 1110,
    slayerMasters: 10,
    shortcuts: 219,
    shops: 435,
    dropTables: 800,
    questSections: 134,
    banks: 101,
    tags: 27,
  },
});

function rawSha256(raw) {
  return createHash('sha256').update(raw).digest('hex').toUpperCase();
}

function assertPinnedManifest(manifest) {
  for (const [key, expected] of Object.entries(pinnedManifest)) {
    if (JSON.stringify(manifest[key]) !== JSON.stringify(expected)) {
      throw new Error(`Pinned chunk source manifest mismatch for ${key}`);
    }
  }
}

function assertRaw(raw, manifest) {
  if (raw.length !== manifest.rawBytes) {
    throw new Error(`Pinned chunk source byte length mismatch: expected ${manifest.rawBytes}, received ${raw.length}`);
  }

  const hash = rawSha256(raw);
  if (hash !== manifest.rawSha256) {
    throw new Error(`Pinned chunk source SHA-256 mismatch: expected ${manifest.rawSha256}, received ${hash}`);
  }

  const blobSha = rawGitBlobSha(raw);
  if (blobSha !== manifest.blobSha) {
    throw new Error(
      `Pinned chunk source Git blob SHA-1 mismatch: expected ${manifest.blobSha}, received ${blobSha}`,
    );
  }
}

async function readManifest() {
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  assertPinnedManifest(manifest);
  return manifest;
}

const temporarySiblingUrl = (targetUrl) => {
  const targetPath = fileURLToPath(targetUrl);
  return pathToFileURL(join(
    dirname(targetPath),
    `.${basename(targetPath)}.${randomUUID()}.tmp`,
  ));
};

const assertCanonicalGzipHeader = (compressed) => {
  if (compressed.length < CANONICAL_GZIP_HEADER.length
    || CANONICAL_GZIP_HEADER.some((byte, index) => compressed[index] !== byte)) {
    throw new Error('Deterministic gzip header is not canonical');
  }
};

async function validateGzipArtifact(compressed, raw, manifest) {
  assertCanonicalGzipHeader(compressed);
  const restored = await unzip(compressed);
  assertRaw(restored, manifest);
  if (!restored.equals(raw)) {
    throw new Error('Deterministic gzip artifact does not round-trip to the approved raw source');
  }
}

async function writeDeterministicGzip(raw, manifest, targetUrl = gzipUrl, operations = fileOps) {
  const compressed = Buffer.from(await zip(raw, { level: 9, mtime: 0 }));
  // zlib may stamp a platform-specific OS byte. The gzip payload remains the
  // same, but the byte must be canonical for a cross-platform committed blob.
  compressed[9] = CANONICAL_GZIP_HEADER[9];
  const tempUrl = temporarySiblingUrl(targetUrl);

  try {
    await operations.writeFile(tempUrl, compressed);
    const written = Buffer.from(await operations.readFile(tempUrl));
    await validateGzipArtifact(written, raw, manifest);
    await operations.rename(tempUrl, targetUrl);
  } finally {
    await operations.rm(tempUrl, { force: true }).catch(() => undefined);
  }
}

export async function writeApprovedChunkSource(raw, manifest, targetUrl = gzipUrl, operations = fileOps, registryOverrides = {}) {
  assertRaw(raw, manifest);
  const data = JSON.parse(raw.toString('utf8'));
  const namedLocationRegistry = readNamedTaskUnlockRegistry();
  const upstreamResult = transformChunkContent(data, manifest, namedLocationRegistry);
  assertChunkTransformBase(upstreamResult, manifest);
  const bankLocationRegistry = registryOverrides.bankLocationRegistry ?? readBankLocationRegistry();
  validateBankLocationRegistry(bankLocationRegistry, {
    validChunkIds: new Set((data.walkableChunks ?? []).map(String)),
    validBankIds: new Set((data.rollingChunks?.bank ?? []).map((raw) => String(raw).split('-')[0])),
  });
  const result = transformChunkContent(data, manifest, namedLocationRegistry, bankLocationRegistry);
  assertChunkTransformBase(result, manifest);
  const inventory = collectNamedTaskUnlockSourceInventory(data);
  validateNamedTaskUnlockRegistry(namedLocationRegistry, {
    sourceCommit: manifest.commit,
    sourceLocationKeys: inventory.locationKeys,
    validChunkIds: new Set((data.walkableChunks ?? []).map(String)),
  });
  assertNoUnresolvedTaskUnlocks(result);
  await writeDeterministicGzip(raw, manifest, targetUrl, operations);
}

export async function readPinnedChunkSource() {
  const manifest = await readManifest();
  const raw = await unzip(await readFile(gzipUrl));
  assertRaw(raw, manifest);

  return { manifest, raw, data: JSON.parse(raw.toString('utf8')) };
}

export async function verifyPinnedChunkSource() {
  const { manifest } = await readPinnedChunkSource();
  return manifest;
}

export async function checkChunkSourceDrift(fetchImpl = fetch) {
  const manifest = await readManifest();
  const response = await fetchImpl(`https://api.github.com/repos/${manifest.repository}/branches/${manifest.branch}`);
  if (!response.ok) {
    throw new Error(`Unable to check Chunk Picker source drift: ${response.status} ${response.statusText}`);
  }

  const latestCommit = (await response.json()).commit?.sha;
  if (typeof latestCommit !== 'string') {
    throw new Error('Unable to check Chunk Picker source drift: branch response omitted commit.sha');
  }

  return {
    pinnedCommit: manifest.commit,
    latestCommit,
    moved: latestCommit !== manifest.commit,
  };
}

async function fetchApprovedSource() {
  const manifest = await readManifest();
  const response = await fetch(manifest.sourceUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch approved Chunk Picker source: ${response.status} ${response.statusText}`);
  }

  const raw = Buffer.from(await response.arrayBuffer());
  await writeApprovedChunkSource(raw, manifest);
}

async function rewritePinnedSource() {
  const { raw, manifest } = await readPinnedChunkSource();
  await writeApprovedChunkSource(raw, manifest);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === '--check-upstream') {
    console.log(JSON.stringify(await checkChunkSourceDrift()));
  } else if (command === '--fetch-approved') {
    await fetchApprovedSource();
  } else if (command === '--rewrite') {
    await rewritePinnedSource();
  } else if (command) {
    throw new Error(`Unknown command: ${command}`);
  } else {
    await verifyPinnedChunkSource();
  }
}
