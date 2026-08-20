import { createHash } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPinnedChunkSource } from './chunk-source.mjs';
import {
  PILOT_QUESTS,
  compileWalkthroughCatalogue,
  extractPilotQuestTasks,
  extractQuickGuideLines,
  sourceLineDigest,
  stableJson,
  validateTaskGraph,
} from './quest-walkthrough-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PATHS = Object.freeze({
  source: resolve(ROOT, 'data', 'sources', 'quest-walkthrough-sources.json'),
  review: resolve(ROOT, 'data', 'sources', 'quest-walkthrough-review.json'),
  candidate: resolve(ROOT, 'data', 'sources', 'quest-walkthrough-candidate.json'),
  generated: resolve(ROOT, 'data', 'questWalkthroughs.generated.json'),
});
const PINNED_COMMIT = 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926';
const TASKS_MAP_URL = `https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/${PINNED_COMMIT}/tasksMap.json`;
const USER_AGENT = 'OSRS-Fate-Locked RuneProof walkthrough refresh/1.0 (https://github.com/Nubles/OSRS-Fate-Locked)';
const PINNED_TASKS_MAP_SHA256 = 'f740b7194189f1a3ef81515ca4d4872caf91a6516a93bdf64c5d43c93d33bd8a';
const PINNED_TASK_MAPPINGS = Object.freeze({
  "~|Cook's Assistant|~ 1": 't_7591',
  "~|Cook's Assistant|~ 2a": 't_7592',
  "~|Cook's Assistant|~ 2b": 't_7593',
  "~|Cook's Assistant|~ 2c": 't_7594',
  "~|Cook's Assistant|~ 3": 't_7595',
  "~|Cook's Assistant|~ Complete the quest": 't_7596',
  "~|Daddy's Home|~ 1": 't_9590',
  "~|Daddy's Home|~ 2": 't_9591',
  "~|Daddy's Home|~ 3a": 't_9592',
  "~|Daddy's Home|~ 3b": 't_9593',
  "~|Daddy's Home|~ 3c1": 't_9594',
  "~|Daddy's Home|~ 3c2": 't_9595',
  "~|Daddy's Home|~ 3c3": 't_9596',
  "~|Daddy's Home|~ 4": 't_9597',
  "~|Daddy's Home|~ 5": 't_9598',
  "~|Daddy's Home|~ Complete the quest": 't_9599',
  "~|Doric's Quest|~ 1": 't_7620',
  "~|Doric's Quest|~ 2": 't_7621',
  "~|Doric's Quest|~ Complete the quest": 't_7622',
  "~|Elemental Workshop I|~ 1": 't_8157',
  "~|Elemental Workshop I|~ 2": 't_8158',
  "~|Elemental Workshop I|~ 3": 't_8159',
  "~|Elemental Workshop I|~ 4": 't_8160',
  "~|Elemental Workshop I|~ 5": 't_8161',
  "~|Elemental Workshop I|~ Complete the quest": 't_8162',
  "~|Elemental Workshop I|~ Crafting skill requirement": 't_1425',
  "~|Elemental Workshop I|~ Mining skill requirement": 't_2768',
  "~|Elemental Workshop I|~ Smithing skill requirement": 't_3465',
});

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const nonBlank = (value, label) => assert(typeof value === 'string' && value.trim(), `${label} must not be blank`);

const readJson = async (path, label) => {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`${label} is missing or unreadable: ${error.message}`);
  }
  try {
    return { raw, value: JSON.parse(raw) };
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
};

const validatePermanentWikiSource = (quest) => {
  assert(Number.isInteger(quest.wikiRevision) && quest.wikiRevision > 0, `${quest.questId}: Wiki revision must be a positive integer`);
  assert(typeof quest.wikiRevisionTimestamp === 'string' && !Number.isNaN(Date.parse(quest.wikiRevisionTimestamp)), `${quest.questId}: Wiki revision timestamp is invalid`);
  const url = new URL(quest.wikiUrl);
  assert(url.origin === 'https://oldschool.runescape.wiki', `${quest.questId}: Wiki URL origin is invalid`);
  assert(url.searchParams.get('oldid') === String(quest.wikiRevision), `${quest.questId}: Wiki URL oldid must match the revision`);
};

export function validateWalkthroughSource(source) {
  assert(source?.schemaVersion === 1, 'Walkthrough source schemaVersion must be 1');
  assert(source.phase === 'SOURCE_BOOTSTRAP' || source.phase === 'REVIEWED', 'Walkthrough source phase is invalid');
  assert(source.chunkPicker?.repository === 'source-chunk/chunk-picker-v2', 'Chunk Picker repository is invalid');
  assert(source.chunkPicker?.branch === 'gh-pages', 'Chunk Picker branch is invalid');
  assert(source.chunkPicker?.commit === PINNED_COMMIT, 'Chunk Picker commit is not the reviewed pin');
  assert(source.chunkPicker?.exportPath === 'chunkpicker-chunkinfo-export.json', 'Chunk Picker export path is invalid');
  assert(source.chunkPicker?.tasksMapUrl === TASKS_MAP_URL, 'tasksMap URL is not pinned to the reviewed commit');
  assert(source.chunkPicker?.tasksMapSha256 === PINNED_TASKS_MAP_SHA256, 'Pinned tasksMap SHA-256 is invalid');
  assert(isRecord(source.chunkPicker?.taskMappings), 'Chunk Picker task mappings are required');
  assert(stableJson(source.chunkPicker.taskMappings) === stableJson(PINNED_TASK_MAPPINGS), 'Pinned task mapping keys or values are invalid');
  nonBlank(source.chunkPicker?.attribution, 'Chunk Picker attribution');
  assert(source.chunkPicker?.licenceStatus === 'UNVERIFIED' || source.chunkPicker?.licenceStatus === 'PERMISSION_RECORDED', 'Chunk Picker licence status is invalid');
  if (source.chunkPicker.licenceStatus === 'PERMISSION_RECORDED') nonBlank(source.chunkPicker.permissionReference, 'Chunk Picker permission reference');
  assert(source.wiki?.apiEndpoint === 'https://oldschool.runescape.wiki/api.php', 'Wiki API endpoint is invalid');
  nonBlank(source.wiki?.attribution, 'Wiki attribution');
  assert(source.wiki?.licence === 'CC BY-NC-SA 3.0', 'Wiki licence is invalid');
  assert(source.wiki?.licenceUrl === 'https://creativecommons.org/licenses/by-nc-sa/3.0/', 'Wiki licence URL is invalid');
  assert(Array.isArray(source.quests), 'Walkthrough source quests are required');
  assert(source.quests.length === PILOT_QUESTS.length, 'Walkthrough source must contain four source quest records');
  assert(JSON.stringify(source.quests.map(quest => quest.questId)) === JSON.stringify(PILOT_QUESTS), 'Walkthrough source quest order or IDs are invalid');
  for (const quest of source.quests) {
    assert(quest.wikiTitle === `${quest.questId}/Quick guide`, `${quest.questId}: Wiki title is invalid`);
    validatePermanentWikiSource(quest);
    assert(Array.isArray(quest.importedLines), `${quest.questId}: imported lines are required`);
    assert(Array.isArray(quest.tasks), `${quest.questId}: tasks are required`);
    quest.tasks.forEach((task) => {
      const expectedTaskId = PINNED_TASK_MAPPINGS[task.sourceId];
      assert(expectedTaskId !== undefined, quest.questId + ': task source ID is not in the pinned mapping: ' + task.sourceId);
      assert(task.id === expectedTaskId, quest.questId + ': task ID does not match pinned mapping for ' + task.sourceId);
    });
    const ids = new Set();
    quest.importedLines.forEach((line, index) => {
      nonBlank(line?.id, `${quest.questId}: source line ID`);
      assert(!ids.has(line.id), `${quest.questId}: duplicate source line ID ${line.id}`);
      ids.add(line.id);
      assert(line.sourceOrder === index + 1, `${quest.questId}: source line order must be contiguous`);
      nonBlank(line.section, `${quest.questId}: source line section`);
      nonBlank(line.rawText, `${quest.questId}: source line raw text`);
    });
  }
  validateTaskGraph(Object.fromEntries(source.quests.map(quest => [quest.questId, quest.tasks])));
  return source;
}

const validateReviewShape = (review) => {
  assert(review?.schemaVersion === 1, 'Walkthrough review schemaVersion must be 1');
  assert(isRecord(review.quests), 'Walkthrough review quests are required');
  assert(JSON.stringify(Object.keys(review.quests)) === JSON.stringify(PILOT_QUESTS), 'Walkthrough review must contain exactly the four pilot quest lists');
  assert(isRecord(review.sourceLineDigests), 'Walkthrough review source line digests are required');
  assert(JSON.stringify(Object.keys(review.sourceLineDigests).sort()) === JSON.stringify([...PILOT_QUESTS].sort()), 'Walkthrough review source line digests must contain exactly the four pilot quests');
  PILOT_QUESTS.forEach(quest => assert(Array.isArray(review.quests[quest]), `${quest}: review list is required`));
  PILOT_QUESTS.forEach((quest) => {
    assert(isRecord(review.sourceLineDigests[quest]), `${quest}: source line digests are required`);
  });
};

export function validateReviewAgreement(source, review) {
  validateReviewShape(review);
  validateTaskGraph(review.quests);
  for (const quest of source.quests) {
    const expected = quest.importedLines.map(line => line.id).sort();
    const reviewed = review.quests[quest.questId].flatMap(action => action.rawWikiLineIds ?? []).sort();
    assert(new Set(reviewed).size === reviewed.length, `${quest.questId}: review uses a source line more than once`);
    assert(JSON.stringify(reviewed) === JSON.stringify(expected), `${quest.questId}: review does not agree on every source line`);
    const reviewedDigests = review.sourceLineDigests[quest.questId];
    assert(
      JSON.stringify(Object.keys(reviewedDigests).sort()) === JSON.stringify(expected),
      `${quest.questId}: review source line digest IDs do not agree on every source line`,
    );
    for (const line of quest.importedLines) {
      assert(reviewedDigests[line.id] === sourceLineDigest(line), `${quest.questId}: source line ${line.id} digest does not match reviewed wording`);
    }

    const expectedTaskIds = new Set(quest.tasks.map(task => task.id));
    const actionByTaskId = new Map();
    for (const action of review.quests[quest.questId]) {
      if (action.chunkPickerTaskId === undefined) continue;
      assert(expectedTaskIds.has(action.chunkPickerTaskId), `${quest.questId}: review references unknown task ${action.chunkPickerTaskId}`);
      assert(!actionByTaskId.has(action.chunkPickerTaskId), `${quest.questId}: review uses task ${action.chunkPickerTaskId} more than once`);
      actionByTaskId.set(action.chunkPickerTaskId, action);
    }
    assert(actionByTaskId.size === expectedTaskIds.size, `${quest.questId}: review does not cover every pinned task`);
    for (const task of quest.tasks) {
      const action = actionByTaskId.get(task.id);
      assert(action !== undefined, `${quest.questId}: review does not cover task ${task.id}`);
      for (const dependencyTaskId of task.dependsOn ?? []) {
        const dependencyAction = actionByTaskId.get(dependencyTaskId);
        assert(dependencyAction !== undefined, `${quest.questId}: review does not cover dependency task ${dependencyTaskId}`);
        assert(action.dependsOn.includes(dependencyAction.id), `${quest.questId}: task dependency edge ${dependencyTaskId} -> ${task.id} is missing from reviewed actions`);
      }
    }
  }
  return review;
}

const fetchResponse = async (url, fetchImpl, stage) => {
  let response;
  try {
    response = await fetchImpl(url, { headers: { 'Api-User-Agent': USER_AGENT, 'User-Agent': USER_AGENT } });
  } catch (error) {
    throw new Error(`${stage} failed fetching ${url}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${stage} failed fetching ${url}: HTTP ${response.status}`);
  return response;
};

const wikiRequest = async (endpoint, params, fetchImpl, stage) => {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const body = await (await fetchResponse(url, fetchImpl, stage)).json();
  if (body.error) throw new Error(`${stage} failed at ${url}: ${body.error.code}: ${body.error.info}`);
  return body;
};

const latestWikiRevisions = async (source, fetchImpl) => {
  const titles = source.quests.map(quest => quest.wikiTitle);
  const body = await wikiRequest(source.wiki.apiEndpoint, {
    action: 'query', prop: 'revisions', redirects: '1', rvprop: 'ids|timestamp', titles: titles.join('|'),
  }, fetchImpl, 'quick-guide revision lookup');
  const pages = new Map((body.query?.pages ?? []).map(page => [page.title, page]));
  return new Map(titles.map(title => {
    const page = pages.get(title);
    const revision = page?.revisions?.[0];
    assert(page && !page.missing && Number.isInteger(revision?.revid) && revision.timestamp, `Wiki revision lookup did not resolve ${title}`);
    return [title, { revision: revision.revid, timestamp: revision.timestamp }];
  }));
};

const pinnedWikiText = async (source, title, revision, fetchImpl) => {
  const body = await wikiRequest(source.wiki.apiEndpoint, {
    action: 'query', prop: 'revisions', titles: title, rvprop: 'content', rvslots: 'main',
    rvstartid: String(revision), rvendid: String(revision),
  }, fetchImpl, `quick-guide revision ${revision}`);
  const page = body.query?.pages?.[0];
  const slot = page?.revisions?.[0]?.slots?.main;
  const content = slot?.content ?? slot?.['*'];
  assert(typeof content === 'string', `Quick-guide revision ${revision} omitted wikitext`);
  return content;
};

const flattenTaskMap = (value, result = {}) => {
  if (Array.isArray(value)) {
    value.forEach(child => flattenTaskMap(child, result));
    return result;
  }
  if (!isRecord(value)) return result;
  for (const [key, child] of Object.entries(value)) {
    if (/^~\|.+\|~\s/.test(key) && (typeof child === 'string' || typeof child === 'number')) result[key] = String(child);
    else if (isRecord(child) && /^~\|.+\|~\s/.test(key)) {
      const id = child.id ?? child.taskId ?? child.taskID;
      if (typeof id === 'string' || typeof id === 'number') result[key] = String(id);
    }
    flattenTaskMap(child, result);
  }
  return result;
};

const retainedPilotMappings = tasksMap => Object.fromEntries(
  Object.entries(flattenTaskMap(tasksMap)).filter(([sourceId]) => (
    PILOT_QUESTS.some(quest => sourceId.startsWith(`~|${quest}|~ `))
  )),
);

const permanentWikiUrl = (title, revision) => `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(' ', '_')).replaceAll('%2F', '/').replaceAll("'", '%27')}?oldid=${revision}`;

const diffCandidate = (before, after) => {
  let added = 0;
  let removed = 0;
  let reordered = 0;
  let taskChanged = 0;
  let unresolved = 0;
  const oldByQuest = new Map(before.quests.map(quest => [quest.questId, quest]));
  for (const quest of after.quests) {
    const old = oldByQuest.get(quest.questId) ?? { importedLines: [], tasks: [] };
    const oldText = old.importedLines.map(line => line.rawText);
    const newText = quest.importedLines.map(line => line.rawText);
    added += newText.filter(text => !oldText.includes(text)).length;
    removed += oldText.filter(text => !newText.includes(text)).length;
    reordered += newText.filter((text, index) => oldText.includes(text) && oldText[index] !== text).length;
    taskChanged += stableJson(old.tasks) === stableJson(quest.tasks) ? 0 : 1;
    unresolved += quest.importedLines.length;
  }
  return { added, removed, reordered, taskChanged, unresolved };
};

const refreshCandidate = async ({ source, paths, fetchImpl, readChunkSource, tasksMapDigest, write }) => {
  const { data } = await readChunkSource();
  const taskMapResponse = await fetchResponse(source.chunkPicker.tasksMapUrl, fetchImpl, 'pinned tasksMap refresh');
  const taskMapRaw = Buffer.from(await taskMapResponse.arrayBuffer());
  const taskMapHash = tasksMapDigest(taskMapRaw);
  let tasksMap;
  try { tasksMap = JSON.parse(taskMapRaw.toString('utf8')); } catch (error) { throw new Error(`Pinned tasksMap is invalid JSON: ${error.message}`); }
  const taskMappings = retainedPilotMappings(tasksMap);
  const taskGraphs = extractPilotQuestTasks(data, taskMappings);
  const revisions = await latestWikiRevisions(source, fetchImpl);
  const quests = [];
  for (const quest of source.quests) {
    const pin = revisions.get(quest.wikiTitle);
    const wikitext = await pinnedWikiText(source, quest.wikiTitle, pin.revision, fetchImpl);
    quests.push({
      ...quest,
      wikiRevision: pin.revision,
      wikiRevisionTimestamp: pin.timestamp,
      wikiUrl: permanentWikiUrl(quest.wikiTitle, pin.revision),
      importedLines: extractQuickGuideLines({ questId: quest.questId, wikitext }),
      tasks: taskGraphs[quest.questId],
    });
  }
  const candidate = {
    ...source,
    chunkPicker: { ...source.chunkPicker, tasksMapUrl: TASKS_MAP_URL, tasksMapSha256: taskMapHash, taskMappings },
    quests,
  };
  validateWalkthroughSource(candidate);
  await writeFile(paths.candidate, stableJson(candidate));
  const diff = diffCandidate(source, candidate);
  write(`Candidate written: added ${diff.added}, removed ${diff.removed}, reordered ${diff.reordered}, task-changed ${diff.taskChanged}, unresolved ${diff.unresolved}.`);
};

export const atomicWritePair = async (
  leftPath,
  leftContent,
  rightPath,
  rightContent,
  fileOps = { readFile, writeFile, rename, unlink },
) => {
  const suffix = '.tmp-' + process.pid + '-' + Date.now();
  const leftTemp = leftPath + suffix;
  const rightTemp = rightPath + suffix;
  const [leftOriginal, rightOriginal] = await Promise.all([
    fileOps.readFile(leftPath),
    fileOps.readFile(rightPath),
  ]);

  try {
    const staging = await Promise.allSettled([
      fileOps.writeFile(leftTemp, leftContent),
      fileOps.writeFile(rightTemp, rightContent),
    ]);
    const stagingFailure = staging.find(result => result.status === 'rejected');
    if (stagingFailure) throw stagingFailure.reason;

    await fileOps.rename(leftTemp, leftPath);
    await fileOps.rename(rightTemp, rightPath);
  } catch (error) {
    const rollback = await Promise.allSettled([
      fileOps.writeFile(leftPath, leftOriginal),
      fileOps.writeFile(rightPath, rightOriginal),
      fileOps.unlink(leftTemp),
      fileOps.unlink(rightTemp),
    ]);
    const rollbackErrors = rollback
      .filter(result => result.status === 'rejected')
      .map(result => result.reason)
      .filter(reason => reason?.code !== 'ENOENT');
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], 'Atomic walkthrough promotion failed and rollback was incomplete');
    }
    throw error;
  }

  await Promise.allSettled([
    fileOps.unlink(leftTemp),
    fileOps.unlink(rightTemp),
  ]);
};
export async function runWalkthroughSync({
  mode = 'check',
  paths = DEFAULT_PATHS,
  fetchImpl = fetch,
  readChunkSource = readPinnedChunkSource,
  tasksMapDigest = raw => createHash('sha256').update(raw).digest('hex'),
  write = line => console.log(line),
} = {}) {
  assert(mode === 'check' || mode === 'refresh' || mode === 'promote', `Unknown walkthrough sync mode: ${mode}`);
  const { value: source } = await readJson(paths.source, 'walkthrough source');
  validateWalkthroughSource(source);

  if (mode === 'refresh') {
    await refreshCandidate({ source, paths, fetchImpl, readChunkSource, tasksMapDigest, write });
    return;
  }

  const { value: review } = await readJson(paths.review, 'walkthrough review');
  validateReviewShape(review);
  if (mode === 'promote') {
    const { value: candidate } = await readJson(paths.candidate, 'walkthrough candidate');
    validateWalkthroughSource(candidate);
    validateReviewAgreement(candidate, review);
    const generated = compileWalkthroughCatalogue(candidate, review);
    await atomicWritePair(paths.source, stableJson(candidate), paths.generated, stableJson(generated));
    write(`Promoted ${candidate.quests.length} reviewed walkthrough sources; phase ${candidate.phase}.`);
    return;
  }

  if (source.phase === 'SOURCE_BOOTSTRAP') {
    assert(PILOT_QUESTS.every(quest => review.quests[quest].length === 0), 'SOURCE_BOOTSTRAP review lists must remain empty');
  } else {
    validateReviewAgreement(source, review);
  }
  const { raw: generatedRaw, value: generated } = await readJson(paths.generated, 'generated walkthrough catalogue');
  const expected = stableJson(compileWalkthroughCatalogue(source, review));
  assert(
    generatedRaw.replaceAll('\r\n', '\n') === expected,
    'Generated walkthrough catalogue differs from the stable offline compilation',
  );
  assert(generated.phase === source.phase, 'Generated walkthrough phase differs from source phase');
  write(`Walkthrough sources valid offline: ${source.quests.length} source quest records; phase ${source.phase}.`);
}

export const parseWalkthroughSyncMode = argument => {
  if (argument === undefined || argument === '--check') return 'check';
  if (argument === '--refresh') return 'refresh';
  if (argument === '--promote') return 'promote';
  throw new Error(`Unknown command: ${argument}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runWalkthroughSync({ mode: parseWalkthroughSyncMode(process.argv[2]) });
}
