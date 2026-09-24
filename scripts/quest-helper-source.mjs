import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync, inflateRawSync } from 'node:zlib';

export const QUEST_HELPER_COMMIT = 'a52646118f0e5ea63a6b3331cefa98087a7b4d6c';
export const QUEST_HELPER_ARCHIVE_SHA256 = '9df2c49db8abf3cb8f85974d409ac796ea8cef1f1d59edf679ee91601e635be3';
export const QUEST_HELPER_SNAPSHOT_SHA256 = '2d27a6c7fdbd177dfe041c5107f224434ce7bf3064212deb8986379c2a639b90';
export const QUEST_HELPER_REPOSITORY = 'Zoinkwiz/quest-helper';
const root = fileURLToPath(new URL('../', import.meta.url));
export const QUEST_HELPER_PATHS = {
  manifest: join(root, 'data/sources/quest-helper-source.json'),
  snapshot: join(root, 'data/sources/quest-helper-source.json.gz'),
  licence: join(root, 'docs/third-party/quest-helper-LICENSE.txt'),
};
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const sourceBase = 'src/main/java/com/questhelper/';
const supportingPaths = [
  'questinfo/QuestHelperQuest.java',
  'requirements/item/ItemRequirement.java',
  'steps/ConditionalStep.java',
  'steps/DetailedQuestStep.java',
  'steps/QuestStep.java',
  'steps/NpcStep.java',
  'steps/ObjectStep.java',
].map(path => sourceBase + path);

function validSourcePath(path) {
  return supportingPaths.includes(path)
    || /^src\/main\/java\/com\/questhelper\/helpers\/(quests|miniquests)\/[a-zA-Z0-9_/]+\.java$/.test(path);
}

/** Read selected text entries from this exact, hash-pinned GitHub ZIP. Never extract paths. */
export function pinnedArchiveEntries(archive) {
  if (sha256(archive) !== QUEST_HELPER_ARCHIVE_SHA256) throw new Error('Quest Helper archive hash mismatch; source-pin review required');
  let end = archive.length - 22;
  const floor = Math.max(0, archive.length - 65557);
  while (end >= floor && archive.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < floor) throw new Error('ZIP central directory missing');
  const count = archive.readUInt16LE(end + 10);
  let cursor = archive.readUInt32LE(end + 16);
  const directoryEnd = cursor + archive.readUInt32LE(end + 12);
  if (archive.readUInt16LE(end + 4) || archive.readUInt16LE(end + 6) || count === 65535 || directoryEnd > end) throw new Error('Unsupported ZIP layout');
  const prefix = `quest-helper-${QUEST_HELPER_COMMIT}/`;
  const files = new Map();
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > directoryEnd || archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP directory entry');
    const method = archive.readUInt16LE(cursor + 10);
    const packed = archive.readUInt32LE(cursor + 20), size = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28), extraLength = archive.readUInt16LE(cursor + 30), commentLength = archive.readUInt16LE(cursor + 32);
    const local = archive.readUInt32LE(cursor + 42);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name.startsWith(prefix)) continue;
    const path = name.slice(prefix.length);
    if (path !== 'LICENSE' && !validSourcePath(path)) continue;
    if (files.has(path) || local + 30 > archive.length || archive.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid/duplicate ZIP source entry');
    const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
    if (size > 4_000_000 || start + packed > archive.length) throw new Error('Invalid ZIP source size');
    const bytes = method === 0 ? archive.subarray(start, start + packed)
      : method === 8 ? inflateRawSync(archive.subarray(start, start + packed), { maxOutputLength: 4_000_000 }) : null;
    if (!bytes || bytes.length !== size) throw new Error('Unsupported/corrupt ZIP source entry');
    files.set(path, bytes);
  }
  return files;
}

export function assertArchiveSource(path, bytes, archiveEntries) {
  if (!archiveEntries.get(path)?.equals(bytes)) throw new Error(`Extracted source does not match pinned archive: ${path}`);
}

/** Capture only text from a previously downloaded immutable source archive. No Java is run. */
export async function captureQuestHelperSource({ sourceRoot, markerPath, archivePath, paths = QUEST_HELPER_PATHS }) {
  const marker = await readFile(markerPath, 'utf8');
  if (!marker.split(/\r?\n/).includes(`repository=https://github.com/${QUEST_HELPER_REPOSITORY}.git`)
      || !marker.split(/\r?\n/).includes(`commit=${QUEST_HELPER_COMMIT}`)) {
    throw new Error('Plugin Hub marker does not match the reviewed Quest Helper source pin');
  }
  const archive = await readFile(archivePath);
  const archiveEntries = pinnedArchiveEntries(archive);
  const licenceBytes = await readFile(join(sourceRoot, 'LICENSE'));
  assertArchiveSource('LICENSE', licenceBytes, archiveEntries);
  const licenceText = licenceBytes.toString('utf8');
  if (!licenceText.startsWith('BSD 2-Clause License') || !licenceText.includes('Zoinkwiz')) {
    throw new Error('Quest Helper licence changed; review required');
  }
  const selectedPaths = [...archiveEntries.keys()].filter(path => path !== 'LICENSE').sort();
  if (selectedPaths.length !== new Set(selectedPaths).size) throw new Error('Duplicate source paths');
  const files = [];
  for (const path of selectedPaths) {
    if (!validSourcePath(path)) throw new Error(`Unexpected source path: ${path}`);
    const bytes = await readFile(join(sourceRoot, path));
    assertArchiveSource(path, bytes, archiveEntries);
    const content = bytes.toString('utf8');
    if (!Buffer.from(content, 'utf8').equals(bytes)) throw new Error(`Source is not UTF-8: ${path}`);
    files.push({ path, sha256: sha256(bytes), content });
  }
  const snapshot = { schemaVersion: 1, repository: QUEST_HELPER_REPOSITORY, commit: QUEST_HELPER_COMMIT, licenceText, files };
  const bytes = Buffer.from(stableJson(snapshot));
  const manifest = {
    schemaVersion: 1,
    repository: QUEST_HELPER_REPOSITORY,
    commit: QUEST_HELPER_COMMIT,
    sourceUrl: `https://github.com/${QUEST_HELPER_REPOSITORY}/tree/${QUEST_HELPER_COMMIT}`,
    archiveUrl: `https://codeload.github.com/${QUEST_HELPER_REPOSITORY}/zip/${QUEST_HELPER_COMMIT}`,
    archiveSha256: sha256(archive),
    pluginHubMarker: marker.trim(),
    licence: 'BSD-2-Clause',
    licenceSha256: sha256(licenceText),
    rawSha256: sha256(bytes),
    rawBytes: bytes.length,
    fileCount: files.length,
    scope: 'helpers/quests and helpers/miniquests, plus seven supporting source files; excludes other helper categories',
    status: 'SOURCE_SNAPSHOT_ONLY',
  };
  validateQuestHelperSnapshot(bytes, manifest);
  await mkdir(new URL('../docs/third-party/', import.meta.url), { recursive: true });
  await writeFile(paths.snapshot, gzipSync(bytes, { level: 9, mtime: 0 }));
  await writeFile(paths.manifest, stableJson(manifest));
  await writeFile(paths.licence, licenceText);
  return manifest;
}

export function validateQuestHelperSnapshot(bytes, manifest) {
  if (manifest.schemaVersion !== 1 || manifest.repository !== QUEST_HELPER_REPOSITORY || manifest.commit !== QUEST_HELPER_COMMIT
      || manifest.archiveSha256 !== QUEST_HELPER_ARCHIVE_SHA256 || manifest.rawSha256 !== QUEST_HELPER_SNAPSHOT_SHA256) {
    throw new Error('Quest Helper source manifest does not match the reviewed pin');
  }
  if (bytes.length !== manifest.rawBytes || sha256(bytes) !== manifest.rawSha256) throw new Error('Quest Helper snapshot hash/length mismatch');
  const data = JSON.parse(bytes.toString('utf8'));
  if (data.schemaVersion !== 1 || data.repository !== manifest.repository || data.commit !== manifest.commit) throw new Error('Quest Helper snapshot identity mismatch');
  if (sha256(data.licenceText) !== manifest.licenceSha256) throw new Error('Quest Helper licence hash mismatch');
  if (!Array.isArray(data.files) || data.files.length !== manifest.fileCount || !data.files.length) throw new Error('Quest Helper source count mismatch');
  const seen = new Set();
  for (const file of data.files) {
    if (typeof file.path !== 'string' || !validSourcePath(file.path) || seen.has(file.path)) throw new Error('Invalid/duplicate Quest Helper source path');
    seen.add(file.path);
    if (typeof file.content !== 'string' || sha256(file.content) !== file.sha256) throw new Error(`Quest Helper file hash mismatch: ${file.path}`);
  }
  for (const path of supportingPaths) if (!seen.has(path)) throw new Error(`Missing supporting source: ${path}`);
  return data;
}

export async function readQuestHelperSource(paths = QUEST_HELPER_PATHS) {
  const manifest = JSON.parse(await readFile(paths.manifest, 'utf8'));
  const raw = gunzipSync(await readFile(paths.snapshot));
  const data = validateQuestHelperSnapshot(raw, manifest);
  if (await readFile(paths.licence, 'utf8') !== data.licenceText) throw new Error('Distributed Quest Helper licence differs from snapshot');
  return { manifest, data, raw };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === '--check') {
    const { manifest } = await readQuestHelperSource();
    console.log(`Quest Helper source verified offline: ${manifest.fileCount} files at ${manifest.commit}.`);
  } else {
    const readArg = key => argv.find(arg => arg.startsWith(`${key}=`))?.slice(key.length + 1);
    const allowed = ['--source-dir=', '--marker=', '--archive='];
    if (argv.length !== 3 || argv.some(arg => !allowed.some(prefix => arg.startsWith(prefix))) || !allowed.every(prefix => argv.filter(arg => arg.startsWith(prefix)).length === 1)) {
      throw new Error('Use --check, or --source-dir=PATH --marker=PATH --archive=PATH for the pinned source archive');
    }
    const manifest = await captureQuestHelperSource({ sourceRoot: readArg('--source-dir'), markerPath: readArg('--marker'), archivePath: readArg('--archive') });
    console.log(`Captured ${manifest.fileCount} source files at ${manifest.commit}; candidate extraction is separate.`);
  }
}
