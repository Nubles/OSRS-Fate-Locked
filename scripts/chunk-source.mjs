import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzip, gzip } from 'node:zlib';
import { promisify } from 'node:util';

const unzip = promisify(gunzip);
const zip = promisify(gzip);
const manifestUrl = new URL('../data/sources/chunk-content-source.json', import.meta.url);
const gzipUrl = new URL('../data/sources/chunkpicker-chunkinfo-export.json.gz', import.meta.url);

const pinnedManifest = Object.freeze({
  schemaVersion: 1,
  repository: 'source-chunk/chunk-picker-v2',
  branch: 'gh-pages',
  exportPath: 'chunkpicker-chunkinfo-export.json',
  commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
  blobSha: '6674e5c62cd7a6ec90267def278aca5bc1f05a06',
  rawSha256: '95E4864651E2A9C7D4555C4EBBE4DD4AB5E71B881FF18BC966799CD22D48C167',
  rawBytes: 7802950,
  policyVersion: 2,
  reviewedAt: '2026-07-28',
  sourceUrl: 'https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/ba2fcebf8b26c84c74f8d9ab328a0ede802be926/chunkpicker-chunkinfo-export.json',
  countFloors: {
    contentChunks: 936,
    connections: 1104,
    slayerMasters: 9,
    shortcuts: 199,
    shops: 433,
    dropTables: 798,
    questSections: 134,
    banks: 100,
    tags: 26,
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
}

async function readManifest() {
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  assertPinnedManifest(manifest);
  return manifest;
}

async function writeDeterministicGzip(raw) {
  await writeFile(gzipUrl, await zip(raw, { level: 9, mtime: 0 }));
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
  assertRaw(raw, manifest);
  await writeDeterministicGzip(raw);
}

async function rewritePinnedSource() {
  const { raw } = await readPinnedChunkSource();
  await writeDeterministicGzip(raw);
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
